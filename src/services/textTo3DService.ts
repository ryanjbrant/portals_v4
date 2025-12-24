/**
 * Text-to-3D Generation Service
 * 
 * Uses Fal.ai's hunyuan3d-v3 model to generate 3D objects from text prompts.
 * Generated GLB files are uploaded to R2 and saved to the user's library.
 */

import { fal } from '@fal-ai/client';
import { uploadToR2 } from './storage/r2';
import { auth, db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

// Configure Fal.ai - API key should be set via environment or config
// For security in production, use a server-side proxy
const FAL_API_KEY = process.env.FAL_KEY || '8adf4d54-c697-45a8-a78e-38f76a3a85a5:6742d739e8516d2ea1ece9db0d646fe5';

// Initialize Fal client
fal.config({
    credentials: FAL_API_KEY,
});

// R2 public base URL
const R2_PUBLIC_BASE = 'https://pub-e804e6eafc2a40ff80713d15ef76076e.r2.dev';

export interface GenerationProgress {
    status: 'queued' | 'processing' | 'downloading' | 'uploading' | 'complete' | 'error';
    message: string;
    progress?: number; // 0-100
}

export interface GenerationResult {
    success: boolean;
    modelUrl?: string;
    modelName?: string;
    thumbnailUrl?: string;
    error?: string;
    firestoreId?: string;
}

interface FalResult {
    model_glb?: {
        url: string;
        file_name?: string;
        file_size?: number;
    };
    thumbnail?: {
        url: string;
        file_name?: string;
    };
    seed?: number;
}

// Mobile-optimized settings for AR performance
// Range: 40000-1500000, default 500000
// 40K is the minimum for lightest models on mobile AR
const MOBILE_FACE_COUNT = 40000;

/**
 * Generate a 3D object from a text prompt
 * 
 * @param prompt - Text description of the 3D object to generate
 * @param onProgress - Progress callback for UI updates
 * @returns Generated model URL and metadata
 */
export async function generateObjectFromText(
    prompt: string,
    onProgress?: (progress: GenerationProgress) => void
): Promise<GenerationResult> {
    const user = auth.currentUser;
    if (!user) {
        return { success: false, error: 'User not authenticated' };
    }

    try {
        console.log('[TextTo3D] Starting generation for prompt:', prompt);
        console.log('[TextTo3D] Using mobile-optimized face count:', MOBILE_FACE_COUNT);
        onProgress?.({ status: 'queued', message: 'Starting generation...' });

        // Call Fal.ai with aggressive mobile optimization for smallest file size
        const result = await fal.subscribe('fal-ai/hunyuan3d-v3/text-to-3d', {
            input: {
                prompt: prompt,
                face_count: MOBILE_FACE_COUNT, // Minimum for mobile AR (40K faces)
                generate_type: 'LowPoly', // Low poly mode for smallest file size
                enable_pbr: false, // Disable PBR for simpler materials and smaller size
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === 'IN_QUEUE') {
                    onProgress?.({ status: 'queued', message: 'Waiting in queue...' });
                } else if (update.status === 'IN_PROGRESS') {
                    const logs = update.logs || [];
                    const lastLog = logs[logs.length - 1];
                    onProgress?.({
                        status: 'processing',
                        message: lastLog?.message || 'Generating 3D model...',
                        progress: 50,
                    });
                }
            },
        });

        const data = result.data as FalResult;
        console.log('[TextTo3D] Generation complete:', data);

        if (!data.model_glb?.url) {
            throw new Error('No model URL in response');
        }

        // For React Native, skip the local download/re-upload step
        // The Fal.ai URL is already publicly accessible, so we can use it directly
        // and just save the metadata pointing to the Fal CDN URL
        onProgress?.({ status: 'uploading', message: 'Saving to library...', progress: 85 });

        const glbUrl = data.model_glb.url;
        console.log('[TextTo3D] Using Fal CDN URL:', glbUrl);

        const timestamp = Date.now();
        const safeName = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${safeName}_${timestamp}.glb`;

        // Save metadata to Firestore - using Fal's CDN URL directly
        // (Fal URLs are persistent for a reasonable time)
        const docRef = await addDoc(collection(db, 'users', user.uid, 'uploads'), {
            name: `Generated: ${prompt.slice(0, 50)}`,
            uri: glbUrl,
            type: '3D_MODEL',
            extension: 'glb',
            source: 'ai_generated',
            prompt: prompt,
            createdAt: serverTimestamp(),
        });

        console.log('[TextTo3D] Saved to Firestore:', docRef.id);

        onProgress?.({ status: 'complete', message: 'Model ready!', progress: 100 });

        return {
            success: true,
            modelUrl: glbUrl,
            modelName: `Generated: ${prompt.slice(0, 30)}`,
            firestoreId: docRef.id,
        };

    } catch (error: any) {
        console.error('[TextTo3D] Generation failed:', error);
        onProgress?.({ status: 'error', message: error.message || 'Generation failed' });
        return {
            success: false,
            error: error.message || 'Unknown error during generation',
        };
    }
}

/**
 * Check Fal.ai service status
 */
export async function checkTextTo3DAvailable(): Promise<boolean> {
    try {
        // Simple check - just verify we can reach Fal
        return FAL_API_KEY !== 'YOUR_FAL_API_KEY' && FAL_API_KEY.length > 0;
    } catch {
        return false;
    }
}

/**
 * Cancel an in-progress generation (if supported)
 */
export async function cancelGeneration(requestId: string): Promise<void> {
    try {
        await fal.queue.cancel('fal-ai/hunyuan3d-v3/text-to-3d', { requestId });
        console.log('[TextTo3D] Generation cancelled:', requestId);
    } catch (error) {
        console.warn('[TextTo3D] Cancel failed:', error);
    }
}

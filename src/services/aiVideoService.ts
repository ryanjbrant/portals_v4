/**
 * AI Video Service
 * Integrates with Decart API (Lucy Pro V2V) for video editing with text prompts
 * 
 * API Endpoint: POST /v1/jobs/lucy-pro-v2v (multipart/form-data)
 * - Sends video file directly in request
 * - Returns job ID for polling
 * - Max 5 second video, 720p output
 */

import * as FileSystem from 'expo-file-system/legacy';

const DECART_API_KEY = 'portals_kidGRbzDWFORfiaYjegcWJMJeHFlFdoKypchGcDQsTsYsvLSghKXLHQYsbPlDnGI';
const DECART_BASE_URL = 'https://api.decart.ai';

export interface AIGenerationRequest {
    videoUrl: string;  // Local file URI
    prompt: string;
    seed?: number;
    resolution?: '720p';
    enhancePrompt?: boolean;
}

export interface AIGenerationResponse {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    output?: {
        video_url: string;
    };
    error?: string;
}

/**
 * Start AI video generation with Decart Lucy Pro V2V
 * Uploads video directly via multipart form data
 */
export async function generateAIVideo(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    try {
        console.log('[AIVideoService] Starting Decart Lucy Pro V2V generation');
        console.log('[AIVideoService] Prompt:', request.prompt);
        console.log('[AIVideoService] Video URL:', request.videoUrl);

        // Read video file and create form data
        const videoUri = request.videoUrl.replace('file://', '');

        // Create form data with video file
        const formData = new FormData();

        // Append the video file
        formData.append('data', {
            uri: request.videoUrl,
            type: 'video/mp4',
            name: 'input.mp4',
        } as any);

        formData.append('prompt', request.prompt);
        formData.append('resolution', request.resolution || '720p');
        formData.append('enhance_prompt', String(request.enhancePrompt !== false));

        if (request.seed !== undefined) {
            formData.append('seed', String(request.seed));
        }

        console.log('[AIVideoService] Submitting to Decart API...');

        const response = await fetch(`${DECART_BASE_URL}/v1/jobs/lucy-pro-v2v`, {
            method: 'POST',
            headers: {
                'x-api-key': DECART_API_KEY,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AIVideoService] Decart API error:', response.status, errorText);
            throw new Error(`Decart API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[AIVideoService] Job created:', data);

        return {
            id: data.job_id || data.id,
            status: 'pending',
        };
    } catch (error) {
        console.error('[AIVideoService] Generation failed:', error);
        throw error;
    }
}

/**
 * Poll for generation status
 * Decart API uses GET /v1/jobs/{job_id} endpoint
 */
export async function pollGenerationStatus(taskId: string): Promise<AIGenerationResponse> {
    try {
        console.log('[AIVideoService] Polling status for job:', taskId);

        const response = await fetch(`${DECART_BASE_URL}/v1/jobs/${taskId}`, {
            method: 'GET',
            headers: {
                'x-api-key': DECART_API_KEY,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AIVideoService] Poll error:', response.status, errorText);
            throw new Error(`Status check failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('[AIVideoService] Job status:', data.status);
        console.log('[AIVideoService] Full response keys:', Object.keys(data));
        console.log('[AIVideoService] Full response:', JSON.stringify(data, null, 2));

        // Map Decart status to our status format
        let status: AIGenerationResponse['status'] = 'pending';
        if (data.status === 'completed' || data.status === 'success' || data.status === 'SUCCESS') {
            status = 'completed';
        } else if (data.status === 'failed' || data.status === 'error' || data.status === 'FAILED') {
            status = 'failed';
        } else if (data.status === 'processing' || data.status === 'running' || data.status === 'PROCESSING' || data.status === 'RUNNING' || data.status === 'in_progress') {
            status = 'processing';
        }

        // Extract video URL from response - check many possible paths
        let output: AIGenerationResponse['output'] | undefined;
        const possibleUrls = [
            data.result?.url,
            data.result?.video_url,
            data.result?.output_url,
            data.output?.url,
            data.output?.video_url,
            data.output_url,
            data.video_url,
            data.url,
            data.data?.url,
            data.data?.output_url,
            // If result is a string URL directly
            typeof data.result === 'string' ? data.result : undefined,
            typeof data.output === 'string' ? data.output : undefined,
        ];

        for (const url of possibleUrls) {
            if (url && typeof url === 'string' && url.startsWith('http')) {
                output = { video_url: url };
                console.log('[AIVideoService] Found video URL at:', url);
                break;
            }
        }

        // If completed but no URL, try to download from result endpoint
        if (!output && status === 'completed') {
            console.log('[AIVideoService] No URL in response, trying to download from result endpoint...');
            try {
                const resultUrl = await downloadJobResult(taskId);
                if (resultUrl) {
                    output = { video_url: resultUrl };
                }
            } catch (downloadError) {
                console.error('[AIVideoService] Failed to download result:', downloadError);
            }
        }

        return {
            id: taskId,
            status: status,
            output: output,
            error: data.error || data.message,
        };
    } catch (error) {
        console.error('[AIVideoService] Status check failed:', error);
        throw error;
    }
}

/**
 * Download job result video from Decart
 * Returns local file URI after saving
 */
async function downloadJobResult(jobId: string): Promise<string | null> {
    try {
        console.log('[AIVideoService] Downloading result for job:', jobId);

        // Download from /content endpoint
        const response = await fetch(`${DECART_BASE_URL}/v1/jobs/${jobId}/content`, {
            method: 'GET',
            headers: {
                'x-api-key': DECART_API_KEY,
            },
        });

        if (!response.ok) {
            console.error('[AIVideoService] Result download failed:', response.status);
            return null;
        }

        // Check content type
        const contentType = response.headers.get('content-type');
        console.log('[AIVideoService] Result content-type:', contentType);

        // If it's JSON, it might contain a URL
        if (contentType?.includes('application/json')) {
            const data = await response.json();
            console.log('[AIVideoService] Result JSON:', JSON.stringify(data));
            if (data.url || data.video_url || data.output_url) {
                return data.url || data.video_url || data.output_url;
            }
            return null;
        }

        // If it's video, save to local file using expo-file-system
        if (contentType?.includes('video')) {
            const blob = await response.blob();
            const base64 = await blobToBase64(blob);

            const filePath = `${FileSystem.cacheDirectory}ai_result_${jobId}.mp4`;
            await FileSystem.writeAsStringAsync(filePath, base64, {
                encoding: FileSystem.EncodingType.Base64,
            });

            console.log('[AIVideoService] Saved result to:', filePath);
            return filePath;
        }

        console.error('[AIVideoService] Unexpected content type:', contentType);
        return null;
    } catch (error) {
        console.error('[AIVideoService] Download result error:', error);
        return null;
    }
}

/**
 * Helper to convert blob to base64
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            // Remove data:video/mp4;base64, prefix
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Wait for generation to complete with polling
 */
export async function waitForGeneration(
    taskId: string,
    onProgress?: (status: string) => void,
    maxAttempts = 120, // 10 min with 5s intervals
    intervalMs = 5000
): Promise<AIGenerationResponse> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await pollGenerationStatus(taskId);

        if (onProgress) {
            onProgress(status.status);
        }

        if (status.status === 'completed') {
            return status;
        }

        if (status.status === 'failed') {
            throw new Error(status.error || 'Generation failed');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error('Generation timed out');
}

/**
 * Upload video - NOT NEEDED for Decart as we send video directly
 * Keeping for API compatibility but just returns the local URI
 */
export async function uploadVideoForAI(localUri: string): Promise<string> {
    console.log('[AIVideoService] Using local URI for Decart:', localUri);
    return localUri;
}

/**
 * Upload asset - NOT USED with Decart (prompt only)
 */
export async function uploadAssetForAI(localUri: string): Promise<string> {
    console.log('[AIVideoService] Asset upload not used with Decart');
    return localUri;
}

/**
 * FBX to VRX Conversion Service
 * 
 * This service communicates with the Cloud Run FBX converter to transform
 * FBX files into VRX format compatible with ViroReact.
 */

// Cloud Run service URL - update this after deployment
const CONVERTER_URL = 'https://portals-fbx-converter-PLACEHOLDER.run.app';

export interface ConversionResult {
    success: boolean;
    vrxUrl?: string;
    originalName?: string;
    error?: string;
}

export interface ConversionProgress {
    status: 'uploading' | 'converting' | 'complete' | 'error';
    message: string;
}

/**
 * Convert an FBX file to VRX format via Cloud Run service
 * 
 * @param fbxUrl - Public URL of the uploaded FBX file
 * @param userId - Firebase user ID for tracking
 * @param fileName - Original filename
 * @param onProgress - Optional progress callback
 * @returns Conversion result with VRX URL
 */
export async function convertFbxToVrx(
    fbxUrl: string,
    userId: string,
    fileName: string,
    onProgress?: (progress: ConversionProgress) => void
): Promise<ConversionResult> {
    try {
        console.log('[FBXConverter] Starting conversion:', fileName);
        onProgress?.({ status: 'converting', message: 'Converting FBX to VRX...' });

        const response = await fetch(`${CONVERTER_URL}/convert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fbxUrl,
                userId,
                fileName,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('[FBXConverter] Server error:', result);
            onProgress?.({ status: 'error', message: result.error || 'Conversion failed' });
            return {
                success: false,
                error: result.error || result.message || 'Conversion failed',
            };
        }

        console.log('[FBXConverter] Conversion complete:', result.vrxUrl);
        onProgress?.({ status: 'complete', message: 'Conversion complete!' });

        return {
            success: true,
            vrxUrl: result.vrxUrl,
            originalName: result.originalName || fileName.replace('.fbx', '.vrx'),
        };

    } catch (error: any) {
        console.error('[FBXConverter] Error:', error);
        onProgress?.({ status: 'error', message: error.message });
        return {
            success: false,
            error: error.message || 'Network error during conversion',
        };
    }
}

/**
 * Check if the conversion service is available
 */
export async function checkConverterHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${CONVERTER_URL}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        const result = await response.json();
        return result.status === 'ok' && result.virofbx === true;
    } catch {
        return false;
    }
}

/**
 * Update the converter URL (for dynamic configuration)
 */
export function setConverterUrl(url: string): void {
    // Note: In production, this would update a config or env variable
    console.log('[FBXConverter] URL would be set to:', url);
}

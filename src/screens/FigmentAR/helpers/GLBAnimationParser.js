/**
 * GLB Animation Parser
 * Parses GLB files to extract animation names for ViroReact
 * GLB is binary glTF format with JSON data followed by binary buffers
 */

/**
 * Parse a GLB file from a URL and extract animation names
 * @param {string} glbUrl - URL to the GLB file
 * @returns {Promise<string[]>} Array of animation names found in the file
 */
export async function getGLBAnimationNames(glbUrl) {
    try {
        console.log('[GLBParser] Fetching GLB:', glbUrl);

        // Fetch the GLB file
        const response = await fetch(glbUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch GLB: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const dataView = new DataView(arrayBuffer);

        // GLB Header (12 bytes)
        // magic: 0x46546C67 ("glTF")
        // version: 2
        // length: total file length
        const magic = dataView.getUint32(0, true);
        if (magic !== 0x46546C67) {
            throw new Error('Not a valid GLB file');
        }

        // const version = dataView.getUint32(4, true);
        // const length = dataView.getUint32(8, true);

        // First chunk (JSON)
        // At offset 12:
        // chunkLength: 4 bytes
        // chunkType: 4 bytes (0x4E4F534A = "JSON")
        // chunkData: chunkLength bytes
        const jsonChunkLength = dataView.getUint32(12, true);
        const jsonChunkType = dataView.getUint32(16, true);

        if (jsonChunkType !== 0x4E4F534A) {
            throw new Error('First chunk is not JSON');
        }

        // Extract JSON data
        const jsonData = new Uint8Array(arrayBuffer, 20, jsonChunkLength);
        const jsonString = new TextDecoder().decode(jsonData);
        const gltf = JSON.parse(jsonString);

        // Extract animation names
        const animations = gltf.animations || [];
        const animationNames = animations.map((anim, index) => {
            // If animation has no name, use index as fallback
            return anim.name || `Animation_${index}`;
        });

        console.log('[GLBParser] Found animations:', animationNames);
        return animationNames;

    } catch (error) {
        console.error('[GLBParser] Error parsing GLB:', error);
        return [];
    }
}

/**
 * Get the first animation name from a GLB file, or a fallback
 * @param {string} glbUrl - URL to the GLB file
 * @param {string} fallback - Fallback animation name if none found
 * @returns {Promise<string>} First animation name or fallback
 */
export async function getFirstGLBAnimationName(glbUrl, fallback = 'Main') {
    const names = await getGLBAnimationNames(glbUrl);
    return names.length > 0 ? names[0] : fallback;
}

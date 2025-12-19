/**
 * Serializes Figment AR Redux state to the scene format expected by saveSceneToStorage
 */

/**
 * Convert Figment AR Redux state to saveable scene format
 * @param {object} arobjects - Redux arobjects state (modelItems, portalItems, mediaItems, effectItems)
 * @param {object} ui - Redux ui state (selectedHdri, sceneTitle)
 * @returns {object} Scene data compatible with saveSceneToStorage
 */
export function serializeFigmentScene(arobjects, ui) {
    const objects = [];

    // Serialize models
    if (arobjects.modelItems) {
        Object.values(arobjects.modelItems).forEach((item) => {
            if (!item.hidden) {
                console.log('[Serializer] Saving model item:', {
                    id: item.uuid,
                    position: JSON.stringify(item.position),
                    rotation: JSON.stringify(item.rotation),
                    scale: JSON.stringify(item.scale),
                });
                const obj = {
                    id: item.uuid,
                    type: 'viro_model',
                    modelIndex: item.index,
                    modelType: item.type || 'GLB',
                    position: item.position || [0, 0, -1],
                    rotation: item.rotation || [0, 0, 0],
                    scale: item.scale || [1, 1, 1],
                };
                // Only add optional fields if they have values (Firebase rejects undefined)
                if (item.source?.uri) obj.uri = item.source.uri;
                if (item.name) obj.name = item.name;
                if (item.animation) obj.animation = item.animation;
                if (item.artifact) obj.artifact = item.artifact;
                if (item.materials) obj.materials = item.materials;
                if (item.physics) obj.physics = item.physics;

                objects.push(obj);
            }
        });
    }

    // Serialize portals
    if (arobjects.portalItems) {
        Object.values(arobjects.portalItems).forEach((item) => {
            if (!item.hidden) {
                objects.push({
                    id: item.uuid,
                    type: 'viro_portal',
                    portalIndex: item.index,
                    portal360Image: item.portal360Image,
                    position: item.position || [0, 0, -2],
                    rotation: item.rotation || [0, 0, 0],
                    scale: item.scale || [1, 1, 1],
                    selected: item.selected,
                    loading: item.loading,
                });
            }
        });
    }

    // Serialize media (photos/videos)
    if (arobjects.mediaItems) {
        Object.values(arobjects.mediaItems).forEach((item) => {
            if (!item.hidden) {
                console.log('[Serializer] Saving media item:', {
                    id: item.uuid,
                    position: item.position,
                    rotation: item.rotation,
                    scale: item.scale,
                });
                objects.push({
                    id: item.uuid,
                    type: item.type === 'VIDEO' ? 'video' : 'image',
                    uri: item.source?.uri,
                    position: item.position || [0, 0, -1],
                    rotation: item.rotation || [0, 0, 0],
                    scale: item.scale || [1, 1, 1],
                    width: item.width,
                    height: item.height,
                });
            }
        });
    }

    // Serialize audio items
    if (arobjects.audioItems) {
        Object.values(arobjects.audioItems).forEach((item) => {
            if (!item.hidden) {
                console.log('[Serializer] Saving audio item:', {
                    id: item.uuid,
                    audioType: item.type,
                    position: item.position,
                });
                objects.push({
                    id: item.uuid,
                    type: 'audio',
                    audioType: item.type, // 'sound', 'soundfield', 'spatial'
                    uri: item.source?.uri,
                    position: item.position || [0, 0, -2],
                    rotation: item.rotation || [0, 0, 0],
                    scale: item.scale || [1, 1, 1],
                    volume: item.volume,
                    loop: item.loop,
                    minDistance: item.minDistance,
                    maxDistance: item.maxDistance,
                    rolloffModel: item.rolloffModel,
                });
            }
        });
    }

    // Build the scene object
    return {
        title: ui.sceneTitle || 'Untitled Scene',
        objects,
        effects: arobjects.effectItems || [],
        postProcessEffects: arobjects.postProcessEffects,
        objectAnimations: arobjects.objectAnimations || {}, // Animation states for each object
        hdri: ui.selectedHdri,
        createdAt: new Date().toISOString(),
        sceneType: 'figment_ar', // Identify this as a Figment AR scene
    };
}

export default serializeFigmentScene;

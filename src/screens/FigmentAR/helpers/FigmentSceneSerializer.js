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
                objects.push({
                    id: item.uuid,
                    type: 'viro_model',
                    modelIndex: item.index,
                    selected: item.selected,
                    loading: item.loading,
                });
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
                objects.push({
                    id: item.uuid,
                    type: item.type === 'VIDEO' ? 'video' : 'image',
                    uri: item.source?.uri,
                    position: item.position,
                    scale: item.scale,
                    width: item.width,
                    height: item.height,
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
        hdri: ui.selectedHdri,
        createdAt: new Date().toISOString(),
        sceneType: 'figment_ar', // Identify this as a Figment AR scene
    };
}

export default serializeFigmentScene;

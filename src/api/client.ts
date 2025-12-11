import { SerializedScene } from '../types/scene';

export const saveScene = async (scene: SerializedScene): Promise<{ sceneId: string }> => {
    // Mock API call
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ sceneId: `scene_${Date.now()}` });
        }, 1000);
    });
};

export const uploadVideo = async (uri: string): Promise<{ videoId: string }> => {
    // Mock API call
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ videoId: `vid_${Date.now()}` });
        }, 1500);
    });
};

export const createPostWithScene = async (data: {
    sceneId: string;
    videoId: string;
    caption: string;
    tags: string[];
}): Promise<{ postId: string }> => {
    // Mock API call
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ postId: `post_${Date.now()}` });
        }, 1000);
    });
};

export const getScene = async (sceneId: string): Promise<SerializedScene> => {
    // Mock fetch
    return new Promise(resolve => {
        setTimeout(() => {
            // Return a simple mock scene
            resolve({
                objects: [
                    {
                        id: 'obj_1',
                        type: 'primitive',
                        assetUri: null,
                        primitiveType: 'cube',
                        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
                    }
                ]
            });
        }, 500);
    });
};

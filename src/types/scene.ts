export interface SceneObject {
    id: string;
    type: "glb" | "primitive" | "image-plane" | "video-plane" | "audio-source";
    assetUri: string | null;
    primitiveType?: "cube" | "sphere" | "plane" | "cylinder";
    transform: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
    };
    extra?: {
        spatialAudio?: { gain: number; range: number };
        videoSettings?: { loop: boolean; muted: boolean };
    };
    material?: {
        color?: string;
        mapUri?: string;
        normalMapUri?: string;
        roughnessMapUri?: string;
        envMapUri?: string;
    };
    animations?: {
        id: string; // Unique ID for the animation instance
        type: 'bounce' | 'pulse' | 'rotate' | 'scale' | 'wiggle' | 'random';
        params: { [key: string]: number }; // e.g. intensity, interval
        active: boolean;
    }[];
}

export interface SerializedScene {
    objects: SceneObject[];
    environment?: {
        lighting?: any;
        skyboxUri?: string | null;
    };
}

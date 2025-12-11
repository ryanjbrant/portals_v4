export interface SceneObject {
    id: string;
    // Extended types for AR and Splats
    type: "glb" | "primitive" | "image-plane" | "video-plane" | "audio-source" | "gaussian-splat" | "ar-anchor";
    assetUri: string | null;
    primitiveType?: "cube" | "sphere" | "plane" | "cylinder" | "p-cone" | "p-torus"; // Extended primitives as needed
    transform: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
    };
    extra?: {
        spatialAudio?: { gain: number; range: number };
        videoSettings?: { loop: boolean; muted: boolean; autoPlay: boolean };
        splatSettings?: { splatAlphaRemovalThreshold?: number }; // Specific to splats
    };
    material?: {
        color?: string;
        mapUri?: string;
        normalMapUri?: string;
        roughnessMapUri?: string;
        envMapUri?: string;
        opacity?: number;
        transparent?: boolean;
    };
    animations?: {
        id: string;
        type: 'bounce' | 'pulse' | 'rotate' | 'scale' | 'wiggle' | 'random';
        params: { [key: string]: number };
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

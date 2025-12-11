export type AssetKind = "model" | "texture" | "audio" | "video" | "splat" | "scene" | "image";

export function assetKey(kind: AssetKind, hash: string, ext: string): string {
    switch (kind) {
        case "model":
            return `assets/models/${hash}.${ext}`;
        case "texture":
        case "image":
            return `assets/textures/${hash}.${ext}`;
        case "audio":
            return `assets/audio/${hash}.${ext}`;
        case "video":
            return `assets/video/${hash}.${ext}`;
        case "splat":
            return `assets/splats/${hash}.${ext}`;
        default:
            return `assets/misc/${hash}.${ext}`;
    }
}

export function sceneJsonKey(sceneId: string): string {
    return `scenes/${sceneId}/scene.json`;
}

export function scenePreviewKey(sceneId: string): string {
    return `scenes/${sceneId}/preview.jpg`;
}

export function finalVideoKey(videoId: string): string {
    return `videos/${videoId}.mp4`;
}

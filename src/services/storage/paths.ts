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

// Get current date as YYYY-MM-DD for path organization
function getDatePath(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function sceneJsonKey(sceneId: string, userId: string = 'anon'): string {
    return `scenes/${userId}/${getDatePath()}/${sceneId}/scene.json`;
}

export function scenePreviewKey(sceneId: string, userId: string = 'anon'): string {
    return `scenes/${userId}/${getDatePath()}/${sceneId}/preview.jpg`;
}

export function finalVideoKey(videoId: string): string {
    return `videos/${videoId}.mp4`;
}


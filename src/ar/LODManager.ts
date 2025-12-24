/**
 * LODManager - Level of Detail Manager for 3D Models
 * 
 * Provides distance-based optimization by:
 * - Adjusting model visibility based on camera distance
 * - Recommending scale reductions for distant objects
 * - Managing render quality tiers (high/medium/low/cull)
 * 
 * Usage in components:
 *   const lodTier = LODManager.getTier(objectPosition, cameraPosition);
 *   const shouldRender = lodTier !== 'cull';
 *   const scale = LODManager.getScaleFactor(lodTier, baseScale);
 */

// Distance thresholds in meters
const LOD_THRESHOLDS = {
    HIGH: 3,      // 0-3m: Full quality
    MEDIUM: 8,    // 3-8m: Reduced quality
    LOW: 15,      // 8-15m: Minimal quality
    CULL: 25,     // >25m: Don't render
};

// Scale factors for each tier
const SCALE_FACTORS = {
    high: 1.0,
    medium: 0.9,
    low: 0.75,
    cull: 0,
};

// Visibility states
const VISIBILITY = {
    high: true,
    medium: true,
    low: true,
    cull: false,
};

export type LODTier = 'high' | 'medium' | 'low' | 'cull';

type Vec3 = [number, number, number];

/**
 * Calculate 3D Euclidean distance between two points
 */
function calculateDistance(p1: Vec3, p2: Vec3): number {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    const dz = p1[2] - p2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Get LOD tier based on distance from camera
 */
function getTier(objectPosition: Vec3, cameraPosition: Vec3): LODTier {
    const distance = calculateDistance(objectPosition, cameraPosition);

    if (distance <= LOD_THRESHOLDS.HIGH) return 'high';
    if (distance <= LOD_THRESHOLDS.MEDIUM) return 'medium';
    if (distance <= LOD_THRESHOLDS.LOW) return 'low';
    return 'cull';
}

/**
 * Get LOD tier directly from distance value
 */
function getTierFromDistance(distance: number): LODTier {
    if (distance <= LOD_THRESHOLDS.HIGH) return 'high';
    if (distance <= LOD_THRESHOLDS.MEDIUM) return 'medium';
    if (distance <= LOD_THRESHOLDS.LOW) return 'low';
    return 'cull';
}

/**
 * Get scale factor for a LOD tier
 * Multiply this with base scale for distance-appropriate sizing
 */
function getScaleFactor(tier: LODTier, baseScale: number = 1): number {
    return baseScale * SCALE_FACTORS[tier];
}

/**
 * Get scale array for a LOD tier
 */
function getScaleArray(tier: LODTier, baseScale: Vec3): Vec3 {
    const factor = SCALE_FACTORS[tier];
    return [baseScale[0] * factor, baseScale[1] * factor, baseScale[2] * factor];
}

/**
 * Check if object should be rendered at this tier
 */
function shouldRender(tier: LODTier): boolean {
    return VISIBILITY[tier];
}

/**
 * Check if object should be rendered based on distance
 */
function shouldRenderAtDistance(objectPosition: Vec3, cameraPosition: Vec3): boolean {
    const tier = getTier(objectPosition, cameraPosition);
    return shouldRender(tier);
}

/**
 * Get combined LOD info for an object
 */
function getLODInfo(objectPosition: Vec3, cameraPosition: Vec3, baseScale: Vec3): {
    tier: LODTier;
    visible: boolean;
    scale: Vec3;
    distance: number;
} {
    const distance = calculateDistance(objectPosition, cameraPosition);
    const tier = getTierFromDistance(distance);

    return {
        tier,
        visible: VISIBILITY[tier],
        scale: getScaleArray(tier, baseScale),
        distance,
    };
}

/**
 * Batch process multiple objects for LOD
 * Returns map of object ID to LOD info
 */
function batchGetLOD(
    objects: { id: string; position: Vec3; scale: Vec3 }[],
    cameraPosition: Vec3
): Map<string, { tier: LODTier; visible: boolean; scale: Vec3 }> {
    const results = new Map();

    for (const obj of objects) {
        const tier = getTier(obj.position, cameraPosition);
        results.set(obj.id, {
            tier,
            visible: VISIBILITY[tier],
            scale: getScaleArray(tier, obj.scale),
        });
    }

    return results;
}

/**
 * Update LOD thresholds (for dynamic adjustment)
 */
function setThresholds(thresholds: Partial<typeof LOD_THRESHOLDS>): void {
    Object.assign(LOD_THRESHOLDS, thresholds);
}

/**
 * Get current thresholds (for debugging/UI)
 */
function getThresholds(): typeof LOD_THRESHOLDS {
    return { ...LOD_THRESHOLDS };
}

export const LODManager = {
    getTier,
    getTierFromDistance,
    getScaleFactor,
    getScaleArray,
    shouldRender,
    shouldRenderAtDistance,
    getLODInfo,
    batchGetLOD,
    setThresholds,
    getThresholds,
    calculateDistance,
    THRESHOLDS: LOD_THRESHOLDS,
    SCALE_FACTORS,
};

export default LODManager;

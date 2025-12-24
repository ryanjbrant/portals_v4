/**
 * useLOD Hook - Level of Detail for AR Objects
 * 
 * Provides distance-based rendering optimization for ViroReact components.
 * 
 * Usage:
 *   const { tier, visible, scale } = useLOD(objectPosition, cameraPosition, baseScale);
 *   if (!visible) return null;
 *   return <Viro3DObject scale={scale} ... />
 */
import { useMemo } from 'react';
import { LODManager, LODTier } from './LODManager';

type Vec3 = [number, number, number];

interface LODResult {
    tier: LODTier;
    visible: boolean;
    scale: Vec3;
    distance: number;
    // Convenience flags
    isHighQuality: boolean;
    isCulled: boolean;
}

/**
 * Hook to get LOD info based on object and camera positions
 */
export function useLOD(
    objectPosition: Vec3 | undefined,
    cameraPosition: Vec3 | undefined,
    baseScale: Vec3 = [1, 1, 1]
): LODResult {
    return useMemo(() => {
        // Default to high quality if positions not available
        if (!objectPosition || !cameraPosition) {
            return {
                tier: 'high' as LODTier,
                visible: true,
                scale: baseScale,
                distance: 0,
                isHighQuality: true,
                isCulled: false,
            };
        }

        const info = LODManager.getLODInfo(objectPosition, cameraPosition, baseScale);

        return {
            ...info,
            isHighQuality: info.tier === 'high',
            isCulled: info.tier === 'cull',
        };
    }, [
        objectPosition?.[0], objectPosition?.[1], objectPosition?.[2],
        cameraPosition?.[0], cameraPosition?.[1], cameraPosition?.[2],
        baseScale[0], baseScale[1], baseScale[2],
    ]);
}

/**
 * Hook to check if object should be rendered (simple visibility check)
 */
export function useShouldRender(
    objectPosition: Vec3 | undefined,
    cameraPosition: Vec3 | undefined
): boolean {
    return useMemo(() => {
        if (!objectPosition || !cameraPosition) return true;
        return LODManager.shouldRenderAtDistance(objectPosition, cameraPosition);
    }, [
        objectPosition?.[0], objectPosition?.[1], objectPosition?.[2],
        cameraPosition?.[0], cameraPosition?.[1], cameraPosition?.[2],
    ]);
}

/**
 * Hook for batch LOD processing (multiple objects)
 */
export function useBatchLOD(
    objects: { id: string; position: Vec3; scale: Vec3 }[],
    cameraPosition: Vec3 | undefined
): Map<string, { tier: LODTier; visible: boolean; scale: Vec3 }> {
    return useMemo(() => {
        if (!cameraPosition || objects.length === 0) {
            return new Map();
        }
        return LODManager.batchGetLOD(objects, cameraPosition);
    }, [objects, cameraPosition?.[0], cameraPosition?.[1], cameraPosition?.[2]]);
}

export default useLOD;

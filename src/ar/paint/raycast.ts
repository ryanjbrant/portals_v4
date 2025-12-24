/**
 * AR Paint System - Raycast Utilities
 * Handles reticle/touch rays, Viro hit-testing, and fallback depth
 */

import { Vec3, RaycastConfig, DEFAULT_RAYCAST_CONFIG } from './types';
import { vec3Add, vec3MulScalar, vec3Normalize, vec3Negate } from './math';

// ============ Camera State ============

export interface CameraState {
    position: Vec3;
    forward: Vec3;
    up: Vec3;
    right: Vec3;
}

let currentCameraState: CameraState = {
    position: [0, 0, 0],
    forward: [0, 0, -1],
    up: [0, 1, 0],
    right: [1, 0, 0],
};

export function updateCameraState(
    position: Vec3,
    rotation: Vec3, // Euler degrees
    forward: Vec3
): void {
    currentCameraState = {
        position: [...position] as Vec3,
        forward: vec3Normalize(forward),
        up: [0, 1, 0], // Approximation
        right: vec3Normalize([forward[2], 0, -forward[0]]),
    };
}

export function getCameraState(): CameraState {
    return currentCameraState;
}

// ============ Ray Types ============

export interface Ray {
    origin: Vec3;
    direction: Vec3;
}

export interface HitResult {
    position: Vec3;
    normal: Vec3;
    distance: number;
    hitPlane: boolean;
}

// ============ Ray Generation ============

/**
 * Get ray from center of screen (reticle mode)
 */
export function getReticleRay(): Ray {
    const camera = getCameraState();
    return {
        origin: camera.position,
        direction: camera.forward,
    };
}

/**
 * Get ray from touch coordinates
 * @param x Touch x in pixels
 * @param y Touch y in pixels  
 * @param viewportWidth Screen width in pixels
 * @param viewportHeight Screen height in pixels
 */
export function getTouchRay(
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number
): Ray {
    const camera = getCameraState();

    // Normalize touch coords to -1..1
    const nx = (x / viewportWidth) * 2 - 1;
    const ny = -((y / viewportHeight) * 2 - 1); // Flip Y

    // Approximate field of view adjustment
    const fovFactor = 0.6; // ~60 degree horizontal FOV approximation

    // Compute ray direction by offsetting from center
    const rightOffset = vec3MulScalar(camera.right, nx * fovFactor);
    const upOffset = vec3MulScalar(camera.up, ny * fovFactor * 0.75); // Adjust for aspect

    const direction = vec3Normalize(
        vec3Add(vec3Add(camera.forward, rightOffset), upOffset)
    );

    return {
        origin: camera.position,
        direction,
    };
}

// ============ Hit Testing ============

export type HitTestCallback = (result: HitResult | null) => void;

// Store pending hit test callbacks
let hitTestCallback: HitTestCallback | null = null;
let hitTestConfig: RaycastConfig = DEFAULT_RAYCAST_CONFIG;

export function setRaycastConfig(config: Partial<RaycastConfig>): void {
    hitTestConfig = { ...hitTestConfig, ...config };
}

/**
 * Perform AR hit test using Viro scene reference
 * This should be called from ARPaintScene with the scene ref
 */
export function performHitTest(
    sceneRef: any,
    screenX: number,
    screenY: number,
    callback: HitTestCallback
): void {
    if (!sceneRef?.current) {
        // No scene ref, use fallback
        callback(getFallbackHit(getReticleRay()));
        return;
    }

    try {
        // Viro's AR hit test API
        sceneRef.current.performARHitTestWithPoint(screenX, screenY)
            .then((results: any[]) => {
                if (results && results.length > 0) {
                    // Find best plane hit
                    const planeHit = results.find((r: any) =>
                        r.type === 'ExistingPlaneUsingExtent' ||
                        r.type === 'ExistingPlane'
                    );

                    const hit = planeHit || results[0];

                    if (hit && hit.transform && hit.transform.position) {
                        const pos = hit.transform.position as Vec3;
                        const distance = Math.sqrt(
                            pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]
                        );

                        if (distance <= hitTestConfig.maxHitDistanceMeters) {
                            callback({
                                position: pos,
                                normal: [0, 1, 0], // Default up for plane
                                distance,
                                hitPlane: !!planeHit,
                            });
                            return;
                        }
                    }
                }

                // No valid hit, use fallback
                const ray = getTouchRay(
                    screenX,
                    screenY,
                    currentCameraState.position[0],
                    currentCameraState.position[1]
                );
                callback(getFallbackHit(ray));
            })
            .catch(() => {
                const ray = getReticleRay();
                callback(getFallbackHit(ray));
            });
    } catch {
        const ray = getReticleRay();
        callback(getFallbackHit(ray));
    }
}

/**
 * Perform hit test for reticle (center screen)
 */
export function performReticleHitTest(
    sceneRef: any,
    viewportWidth: number,
    viewportHeight: number,
    callback: HitTestCallback
): void {
    performHitTest(
        sceneRef,
        viewportWidth / 2,
        viewportHeight / 2,
        callback
    );
}

// ============ Fallback ============

/**
 * Get fallback hit at fixed depth along ray
 */
export function getFallbackHit(ray: Ray): HitResult {
    const position = vec3Add(
        ray.origin,
        vec3MulScalar(ray.direction, hitTestConfig.fallbackDistanceMeters)
    );

    return {
        position,
        normal: vec3Negate(ray.direction), // Face camera
        distance: hitTestConfig.fallbackDistanceMeters,
        hitPlane: false,
    };
}

/**
 * Simple synchronous hit - for when we don't need async hit test
 */
export function getImmediateHit(
    isTouch: boolean,
    touchX: number,
    touchY: number,
    viewportWidth: number,
    viewportHeight: number
): HitResult {
    const ray = isTouch
        ? getTouchRay(touchX, touchY, viewportWidth, viewportHeight)
        : getReticleRay();

    return getFallbackHit(ray);
}

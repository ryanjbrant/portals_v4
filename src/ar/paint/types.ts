/**
 * AR Paint System - Core Types
 */

// ============ Basic Types ============

export type Vec3 = [number, number, number];

export type Quat = [number, number, number, number]; // x, y, z, w

// ============ Enums ============

export enum BrushMode {
    TEXTURE = 'TEXTURE',
    TUBE = 'TUBE',
    PARTICLE = 'PARTICLE',
}

export enum InputMode {
    AUTO = 'AUTO',       // Use touch if finger down, else reticle
    RETICLE = 'RETICLE', // Center of screen only
    TOUCH = 'TOUCH',     // Finger touch only
}

export enum TexturePreset {
    WET = 'WET',
    DRY = 'DRY',
}

// ============ Stroke Types ============

export interface StrokePoint {
    pos: Vec3;
    normal: Vec3;
    t: number;           // Normalized progress along stroke (0..1)
    timeMs: number;      // Timestamp when point was sampled
    speed: number;       // Speed in m/s at this point
}

export interface Stroke {
    id: string;
    points: StrokePoint[];
    mode: BrushMode;
    startedAtMs: number;
    endedAtMs?: number;
    color: string;       // Hex color
    seed: number;        // For deterministic randomness
}

export interface StrokeChunk {
    strokeId: string;
    chunkIndex: number;
    points: StrokePoint[];
    isFirst: boolean;
    isLast: boolean;
}

// ============ Brush Configs ============

export interface TextureBrushConfig {
    mode: BrushMode.TEXTURE;
    preset: TexturePreset;
    baseSizeMeters: number;
    sizeVariation: number;      // 0-1, how much size varies with speed
    opacityBase: number;        // Base opacity 0-1
    opacityVariation: number;   // 0-1
    jitterAmount: number;       // Position jitter in meters
    rotationJitter: number;     // Rotation jitter in degrees
    maxStampsPerStroke: number;
}

export interface TubeBrushConfig {
    mode: BrushMode.TUBE;
    baseRadiusMeters: number;
    tailTaper: number;          // 0-1, how thin the tail starts
    bulgeCenter: number;        // 0-1, where the bulge peaks (default 0.7)
    bulgeWidth: number;         // Gaussian width for bulge
    bulgeStrength: number;      // How much extra radius at bulge
    headTaper: number;          // 0-1, how much to taper at head
    maxSegmentsPerStroke: number;
}

export interface ParticleBrushConfig {
    mode: BrushMode.PARTICLE;
    // Floaters - stay near path
    floaterSize: number;
    floaterCount: number;       // Per point
    floaterDriftSpeed: number;  // m/s
    floaterLifetimeMs: number;
    maxFloaters: number;
    // Emanators - burst outward
    emanatorSize: number;
    emanatorBurstCount: number; // Per point
    emanatorSpeed: number;      // Initial velocity m/s
    emanatorLifetimeMs: number;
    maxEmanators: number;
}

export type BrushConfig = TextureBrushConfig | TubeBrushConfig | ParticleBrushConfig;

// ============ Default Configs ============

export const DEFAULT_TEXTURE_CONFIG: TextureBrushConfig = {
    mode: BrushMode.TEXTURE,
    preset: TexturePreset.WET,
    baseSizeMeters: 0.03,
    sizeVariation: 0.3,
    opacityBase: 0.8,
    opacityVariation: 0.2,
    jitterAmount: 0.002,
    rotationJitter: 30,
    maxStampsPerStroke: 200,
};

export const DEFAULT_TUBE_CONFIG: TubeBrushConfig = {
    mode: BrushMode.TUBE,
    baseRadiusMeters: 0.008,
    tailTaper: 0.3,
    bulgeCenter: 0.7,
    bulgeWidth: 0.15,
    bulgeStrength: 0.4,
    headTaper: 0.1,
    maxSegmentsPerStroke: 100,
};

export const DEFAULT_PARTICLE_CONFIG: ParticleBrushConfig = {
    mode: BrushMode.PARTICLE,
    floaterSize: 0.005,
    floaterCount: 2,
    floaterDriftSpeed: 0.01,
    floaterLifetimeMs: 5000,
    maxFloaters: 50,
    emanatorSize: 0.003,
    emanatorBurstCount: 3,
    emanatorSpeed: 0.1,
    emanatorLifetimeMs: 1500,
    maxEmanators: 100,
};

// ============ Sampler Config ============

export interface SamplerConfig {
    minStepMeters: number;      // Minimum distance between points
    maxStepMeters: number;      // Maximum distance (force sample)
    smoothingWindow: number;    // Moving average window size
    maxPointsPerSecond: number; // Rate limiter
    chunkSize: number;          // Points per chunk for rendering
}

export const DEFAULT_SAMPLER_CONFIG: SamplerConfig = {
    minStepMeters: 0.005,
    maxStepMeters: 0.05,
    smoothingWindow: 5,
    maxPointsPerSecond: 60,
    chunkSize: 10,
};

// ============ Raycast Config ============

export interface RaycastConfig {
    fallbackDistanceMeters: number;
    maxHitDistanceMeters: number;
}

export const DEFAULT_RAYCAST_CONFIG: RaycastConfig = {
    fallbackDistanceMeters: 0.5,
    maxHitDistanceMeters: 5.0,
};

/**
 * AR Paint System - Brush Asset References
 */

// Placeholder asset paths - these should be replaced with actual brush textures
// Create these image files in the assets directory:
// - brush_wet.png: Soft, blurred edges for wet paint look
// - brush_dry.png: Hard, textured edges for dry paint look

export const BRUSH_ASSETS = {
    WET: require('./assets/brush_wet.png'),
    DRY: require('./assets/brush_dry.png'),
} as const;

// Fallback if assets don't exist yet - use a simple white circle
export const BRUSH_FALLBACK_COLOR = '#FFFFFF';

// Particle assets
export const PARTICLE_ASSETS = {
    DOT: require('./assets/particle_dot.png'),
} as const;

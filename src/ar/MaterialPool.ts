/**
 * MaterialPool - Centralized ViroMaterials management
 * 
 * Benefits:
 * - Prevents duplicate material creation
 * - Lazy initialization (waits for Viro bridge)
 * - Memory efficient color pooling
 * - Safe hot-reload handling
 */
import { ViroMaterials } from '@reactvision/react-viro';

// Track created materials to prevent duplicates
const createdMaterials = new Set<string>();
let isBaseInitialized = false;

/**
 * Generate a consistent material name from a hex color
 */
function colorToMaterialName(hexColor: string): string {
    // Normalize color format
    const normalized = hexColor.replace('#', '').toUpperCase();
    return `color_${normalized}`;
}

/**
 * Initialize base materials (shadows, transparency, etc.)
 * Call this in componentDidMount of main AR scene
 */
export function initBaseMaterials(): void {
    if (isBaseInitialized) return;

    try {
        ViroMaterials.createMaterials({
            // Shadow catcher material
            shadowCatcher: {
                diffuseColor: 'rgba(0,0,0,0)',
                lightingModel: 'Lambert',
                writesToDepthBuffer: true,
                readsFromDepthBuffer: true,
            },
            // Ghost/preview material
            ghost: {
                diffuseColor: 'rgba(255,255,255,0.3)',
                lightingModel: 'Constant',
            },
            // Selection highlight
            highlight: {
                diffuseColor: '#FFD700',
                lightingModel: 'Constant',
                bloomThreshold: 0.5,
            },
            // White base
            white: {
                diffuseColor: '#FFFFFF',
                lightingModel: 'PBR',
            },
            // Black base
            black: {
                diffuseColor: '#000000',
                lightingModel: 'PBR',
            },
        });

        createdMaterials.add('shadowCatcher');
        createdMaterials.add('ghost');
        createdMaterials.add('highlight');
        createdMaterials.add('white');
        createdMaterials.add('black');

        isBaseInitialized = true;
        console.log('[MaterialPool] Base materials initialized');
    } catch (error) {
        console.warn('[MaterialPool] Failed to initialize base materials:', error);
    }
}

/**
 * Get or create a material for a hex color
 * Returns the material name to use in components
 */
export function getColorMaterial(hexColor: string): string {
    if (!hexColor) return 'white';

    const materialName = colorToMaterialName(hexColor);

    if (!createdMaterials.has(materialName)) {
        try {
            ViroMaterials.createMaterials({
                [materialName]: {
                    diffuseColor: hexColor,
                    lightingModel: 'PBR',
                },
            });
            createdMaterials.add(materialName);
        } catch (error) {
            console.warn(`[MaterialPool] Failed to create material for ${hexColor}:`, error);
            return 'white'; // Fallback
        }
    }

    return materialName;
}

/**
 * Get or create a paint material (optimized for strokes)
 */
export function getPaintMaterial(hexColor: string): string {
    const materialName = `paint_${hexColor.replace('#', '').toUpperCase()}`;

    if (!createdMaterials.has(materialName)) {
        try {
            ViroMaterials.createMaterials({
                [materialName]: {
                    diffuseColor: hexColor,
                    lightingModel: 'Constant', // No shading for paint
                },
            });
            createdMaterials.add(materialName);
        } catch (error) {
            console.warn(`[MaterialPool] Failed to create paint material for ${hexColor}:`, error);
            return 'white';
        }
    }

    return materialName;
}

/**
 * Ensure a custom material exists
 * Useful for textures and complex materials
 */
export function ensureMaterial(name: string, config: any): string {
    if (!createdMaterials.has(name)) {
        try {
            ViroMaterials.createMaterials({ [name]: config });
            createdMaterials.add(name);
        } catch (error) {
            console.warn(`[MaterialPool] Failed to create material ${name}:`, error);
            return 'white';
        }
    }
    return name;
}

/**
 * Check if a material exists
 */
export function hasMaterial(name: string): boolean {
    return createdMaterials.has(name);
}

/**
 * Get stats about material pool
 */
export function getStats(): { count: number; materials: string[] } {
    return {
        count: createdMaterials.size,
        materials: Array.from(createdMaterials),
    };
}

/**
 * Pre-warm common colors to avoid runtime creation
 */
export function preWarmColors(colors: string[]): void {
    colors.forEach(color => getColorMaterial(color));
    console.log(`[MaterialPool] Pre-warmed ${colors.length} colors`);
}

// Common paint colors to pre-warm
export const COMMON_PAINT_COLORS = [
    '#FF3366', '#FF6B6B', '#FFD93D', '#6BCB77',
    '#4D96FF', '#845EC2', '#FFFFFF', '#000000',
];

export const MaterialPool = {
    initBaseMaterials,
    getColorMaterial,
    getPaintMaterial,
    ensureMaterial,
    hasMaterial,
    getStats,
    preWarmColors,
    COMMON_PAINT_COLORS,
};

export default MaterialPool;

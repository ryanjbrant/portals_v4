/**
 * AR Paint System - Texture Brush Renderer
 * Stamps textured quads along the stroke path
 */

import React, { useMemo } from 'react';
import { ViroNode, ViroImage, ViroMaterials } from '@reactvision/react-viro';
import {
    StrokePoint,
    StrokeChunk,
    TextureBrushConfig,
    TexturePreset,
    DEFAULT_TEXTURE_CONFIG,
} from '../types';
import { SeededRandom, vec3Add, vec3MulScalar, quatToEulerDegrees, quatLookAt, vec3Negate } from '../math';

// ============ Material Setup ============

// Register materials for brush textures
ViroMaterials.createMaterials({
    brushWet: {
        diffuseTexture: require('../assets/brush_wet.png'),
        lightingModel: 'Constant',
        writesToDepthBuffer: false,
        readsFromDepthBuffer: false,
    },
    brushDry: {
        diffuseTexture: require('../assets/brush_dry.png'),
        lightingModel: 'Constant',
        writesToDepthBuffer: false,
        readsFromDepthBuffer: false,
    },
    brushFallback: {
        diffuseColor: '#FFFFFF',
        lightingModel: 'Constant',
        writesToDepthBuffer: false,
        readsFromDepthBuffer: false,
    },
});

// ============ Preset Configs ============

export const TEXTURE_PRESETS: Record<TexturePreset, Partial<TextureBrushConfig>> = {
    [TexturePreset.WET]: {
        baseSizeMeters: 0.035,
        sizeVariation: 0.4,
        opacityBase: 0.85,
        opacityVariation: 0.15,
        jitterAmount: 0.003,
        rotationJitter: 45,
    },
    [TexturePreset.DRY]: {
        baseSizeMeters: 0.025,
        sizeVariation: 0.2,
        opacityBase: 0.95,
        opacityVariation: 0.05,
        jitterAmount: 0.005,
        rotationJitter: 90,
    },
};

// ============ Types ============

interface StampData {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    opacity: number;
    key: string;
}

interface TextureBrushRendererProps {
    chunks: StrokeChunk[];
    config: TextureBrushConfig;
    color: string;
    seed: number;
}

// ============ Component ============

export const TextureBrushRenderer: React.FC<TextureBrushRendererProps> = ({
    chunks,
    config,
    color,
    seed,
}) => {
    const stamps = useMemo(() => {
        const rng = new SeededRandom(seed);
        const allStamps: StampData[] = [];
        let stampCount = 0;

        for (const chunk of chunks) {
            for (const point of chunk.points) {
                if (stampCount >= config.maxStampsPerStroke) break;

                // Size with speed variation
                const speedFactor = Math.min(1, point.speed / 0.3);
                const sizeMultiplier = 1 - config.sizeVariation * speedFactor;
                const size = config.baseSizeMeters * sizeMultiplier;

                // Position jitter
                const jitterX = rng.nextRange(-config.jitterAmount, config.jitterAmount);
                const jitterY = rng.nextRange(-config.jitterAmount, config.jitterAmount);
                const jitterZ = rng.nextRange(-config.jitterAmount, config.jitterAmount);
                const jitteredPos = vec3Add(point.pos, [jitterX, jitterY, jitterZ]);

                // Rotation - face normal with jitter
                const baseRotation = quatToEulerDegrees(quatLookAt(vec3Negate(point.normal)));
                const rotJitter = rng.nextRange(-config.rotationJitter, config.rotationJitter);

                // Opacity variation
                const opacity = config.opacityBase - rng.next() * config.opacityVariation;

                allStamps.push({
                    position: jitteredPos as [number, number, number],
                    rotation: [baseRotation[0], baseRotation[1] + rotJitter, baseRotation[2]],
                    scale: [size, size, size],
                    opacity,
                    key: `stamp_${chunk.strokeId}_${chunk.chunkIndex}_${stampCount}`,
                });

                stampCount++;
            }
        }

        return allStamps;
    }, [chunks, config, seed]);

    const materialName = config.preset === TexturePreset.WET ? 'brushWet' : 'brushDry';

    return (
        <ViroNode>
            {stamps.map((stamp) => (
                <ViroImage
                    key={stamp.key}
                    source={config.preset === TexturePreset.WET
                        ? require('../assets/brush_wet.png')
                        : require('../assets/brush_dry.png')
                    }
                    position={stamp.position}
                    rotation={stamp.rotation}
                    scale={stamp.scale}
                    opacity={stamp.opacity}
                    placeholderSource={require('../assets/brush_wet.png')}
                    transformBehaviors={['billboard']}
                />
            ))}
        </ViroNode>
    );
};

// ============ Factory ============

export function createTextureBrushConfig(
    preset: TexturePreset = TexturePreset.WET,
    overrides: Partial<TextureBrushConfig> = {}
): TextureBrushConfig {
    return {
        ...DEFAULT_TEXTURE_CONFIG,
        ...TEXTURE_PRESETS[preset],
        preset,
        ...overrides,
    };
}

export default TextureBrushRenderer;

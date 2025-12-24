/**
 * AR Paint System - Tube Brush Renderer
 * Renders segmented cylinders between stroke points with radius profile
 */

import React, { useMemo } from 'react';
import { ViroNode, ViroBox, ViroMaterials } from '@reactvision/react-viro';
import {
    StrokePoint,
    StrokeChunk,
    TubeBrushConfig,
    DEFAULT_TUBE_CONFIG,
    Vec3,
} from '../types';
import {
    vec3Sub,
    vec3Add,
    vec3MulScalar,
    vec3Distance,
    vec3Normalize,
    vec3Cross,
    smoothstep,
    quatToEulerDegrees,
    quatLookAt,
} from '../math';

// ============ Types ============

interface SegmentData {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    key: string;
}

interface TubeBrushRendererProps {
    chunks: StrokeChunk[];
    config: TubeBrushConfig;
    color: string;
}

// ============ Radius Profile ============

/**
 * Calculate radius at normalized position t along stroke
 * Profile: thin tail → bulge at 70% → thick head
 */
function radiusAt(t: number, config: TubeBrushConfig): number {
    const { baseRadiusMeters, tailTaper, bulgeCenter, bulgeWidth, bulgeStrength, headTaper } = config;

    // Tail taper: thin at start, full at ~20%
    const tailFactor = tailTaper + (1 - tailTaper) * smoothstep(0, 0.2, t);

    // Bulge: Gaussian centered at bulgeCenter
    const bulgeDist = (t - bulgeCenter) / bulgeWidth;
    const bulgeFactor = 1 + bulgeStrength * Math.exp(-bulgeDist * bulgeDist);

    // Head taper: slight reduction at very end
    const headFactor = 1 - headTaper * smoothstep(0.9, 1.0, t);

    return baseRadiusMeters * tailFactor * bulgeFactor * headFactor;
}

// ============ Material Setup ============

// Will be dynamically created based on color
const materialCache: Set<string> = new Set();

function getMaterialName(color: string): string {
    const name = `tube_${color.replace('#', '')}`;

    if (!materialCache.has(name)) {
        ViroMaterials.createMaterials({
            [name]: {
                diffuseColor: color,
                lightingModel: 'Blinn',
            },
        });
        materialCache.add(name);
    }

    return name;
}

// ============ Component ============

export const TubeBrushRenderer: React.FC<TubeBrushRendererProps> = ({
    chunks,
    config,
    color,
}) => {
    const segments = useMemo(() => {
        const allSegments: SegmentData[] = [];

        // Collect all points from chunks
        const allPoints: StrokePoint[] = [];
        for (const chunk of chunks) {
            allPoints.push(...chunk.points);
        }

        if (allPoints.length < 2) return [];

        // Decimate if too many points
        let points = allPoints;
        if (points.length > config.maxSegmentsPerStroke) {
            const step = Math.ceil(points.length / config.maxSegmentsPerStroke);
            points = points.filter((_, i) => i % step === 0 || i === points.length - 1);
        }

        // Create segments between consecutive points
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Segment properties
            const midPoint = vec3MulScalar(vec3Add(p1.pos, p2.pos), 0.5);
            const direction = vec3Sub(p2.pos, p1.pos);
            const length = vec3Distance(p1.pos, p2.pos);

            if (length < 0.0001) continue;

            // Average t for radius calculation
            const avgT = (p1.t + p2.t) / 2;
            const radius = radiusAt(avgT, config);

            // Orientation - point along direction
            const forward = vec3Normalize(direction);
            const rotation = quatToEulerDegrees(quatLookAt(forward));

            allSegments.push({
                position: midPoint as [number, number, number],
                rotation: [rotation[0], rotation[1], rotation[2] + 90], // Rotate to align box length
                scale: [radius * 2, radius * 2, length], // Box: width, height, depth
                key: `seg_${i}`,
            });
        }

        return allSegments;
    }, [chunks, config]);

    const materialName = getMaterialName(color);

    return (
        <ViroNode>
            {segments.map((seg) => (
                <ViroBox
                    key={seg.key}
                    position={seg.position}
                    rotation={seg.rotation}
                    scale={seg.scale}
                    materials={[materialName]}
                />
            ))}
        </ViroNode>
    );
};

// ============ Factory ============

export function createTubeBrushConfig(
    overrides: Partial<TubeBrushConfig> = {}
): TubeBrushConfig {
    return {
        ...DEFAULT_TUBE_CONFIG,
        ...overrides,
    };
}

export default TubeBrushRenderer;

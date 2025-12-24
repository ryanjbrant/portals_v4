/**
 * AR Paint Renderer - Integration for Figment Scene
 * Uses ViroPolyline for smooth tube strokes with Catmull-Rom interpolation
 */

import React, { useMemo } from 'react';
import {
    ViroNode,
    ViroPolyline,
    ViroSphere,
} from '@reactvision/react-viro';
import { getPaintMaterial } from '../MaterialPool';

// ============ Types ============

type Vec3 = [number, number, number];

export interface PaintStroke {
    id: string;
    points: Vec3[];
    color: string;
    brushType: 'texture' | 'tube' | 'particle';
    seed: number;
}

export interface PaintRendererProps {
    strokes: PaintStroke[];
    activePoints: Vec3[];
    activeColor: string;
    activeBrushType: 'texture' | 'tube' | 'particle';
}

// ============ Catmull-Rom Spline Interpolation ============

/**
 * Interpolates points using Catmull-Rom spline for smooth curves
 * @param points - Raw input points
 * @param segmentsPerCurve - Number of interpolated segments between each pair
 */
function catmullRomInterpolate(points: Vec3[], segmentsPerCurve: number = 4): Vec3[] {
    if (points.length < 2) return points;
    if (points.length === 2) return points;

    const result: Vec3[] = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[Math.min(points.length - 1, i + 1)];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        for (let j = 0; j < segmentsPerCurve; j++) {
            const t = j / segmentsPerCurve;
            const t2 = t * t;
            const t3 = t2 * t;

            // Catmull-Rom basis functions
            const b0 = -0.5 * t3 + t2 - 0.5 * t;
            const b1 = 1.5 * t3 - 2.5 * t2 + 1;
            const b2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
            const b3 = 0.5 * t3 - 0.5 * t2;

            result.push([
                p0[0] * b0 + p1[0] * b1 + p2[0] * b2 + p3[0] * b3,
                p0[1] * b0 + p1[1] * b1 + p2[1] * b2 + p3[1] * b3,
                p0[2] * b0 + p1[2] * b1 + p2[2] * b2 + p3[2] * b3,
            ]);
        }
    }

    // Add final point
    result.push(points[points.length - 1]);

    return result;
}

/**
 * Simplify points by removing those too close together (Douglas-Peucker-lite)
 */
function simplifyPoints(points: Vec3[], minDistance: number = 0.005): Vec3[] {
    if (points.length < 3) return points;

    const result: Vec3[] = [points[0]];

    for (let i = 1; i < points.length; i++) {
        const last = result[result.length - 1];
        const curr = points[i];
        const dx = curr[0] - last[0];
        const dy = curr[1] - last[1];
        const dz = curr[2] - last[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist >= minDistance || i === points.length - 1) {
            result.push(curr);
        }
    }

    return result;
}

/**
 * Process stroke points: simplify then smooth
 */
function processStrokePoints(points: Vec3[], forActive: boolean = false): Vec3[] {
    if (points.length < 2) return points;

    // Simplify to reduce noise (smaller threshold for active stroke for responsiveness)
    const simplified = simplifyPoints(points, forActive ? 0.003 : 0.006);

    // Interpolate for smoothness (fewer segments for active stroke)
    const interpolated = catmullRomInterpolate(simplified, forActive ? 3 : 5);

    return interpolated;
}

// ============ Material (via MaterialPool) ============

function ensureMaterial(color: string): string {
    return getPaintMaterial(color);
}

// ============ Seeded Random ============

class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    next(): number {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    nextRange(min: number, max: number): number {
        return min + this.next() * (max - min);
    }
}

// ============ Tube Stroke (ViroPolyline with smoothing) ============

interface TubeStrokeProps {
    points: Vec3[];
    color: string;
    strokeId: string;
    isActive?: boolean;
}

const TubeStroke: React.FC<TubeStrokeProps> = ({ points, color, strokeId, isActive = false }) => {
    const smoothedPoints = useMemo(() => {
        return processStrokePoints(points, isActive);
    }, [points, isActive]);

    if (smoothedPoints.length < 2) return null;

    const material = ensureMaterial(color);

    return (
        <ViroPolyline
            key={strokeId}
            position={[0, 0, 0]}
            points={smoothedPoints}
            thickness={0.006} // 6mm thick tube
            materials={[material]}
        />
    );
};

// ============ Particle Stroke ============

interface ParticleStrokeProps {
    points: Vec3[];
    color: string;
    strokeId: string;
    seed: number;
}

const ParticleStroke: React.FC<ParticleStrokeProps> = ({ points, color, strokeId, seed }) => {
    const processedPoints = useMemo(() => {
        return simplifyPoints(points, 0.015); // More aggressive simplification for particles
    }, [points]);

    if (processedPoints.length < 1) return null;

    const material = ensureMaterial(color);
    const rng = new SeededRandom(seed);

    const particles: React.ReactElement[] = [];

    processedPoints.forEach((basePos, i) => {
        // Main particle on path
        particles.push(
            <ViroSphere
                key={`${strokeId}_main_${i}`}
                position={basePos}
                radius={0.004}
                materials={[material]}
            />
        );

        // Scatter particles around the path
        for (let j = 0; j < 2; j++) {
            const offset: Vec3 = [
                rng.nextRange(-0.012, 0.012),
                rng.nextRange(-0.012, 0.012),
                rng.nextRange(-0.012, 0.012),
            ];
            const scatterPos: Vec3 = [
                basePos[0] + offset[0],
                basePos[1] + offset[1],
                basePos[2] + offset[2],
            ];
            const size = 0.002 + rng.next() * 0.002;

            particles.push(
                <ViroSphere
                    key={`${strokeId}_scatter_${i}_${j}`}
                    position={scatterPos}
                    radius={size}
                    materials={[material]}
                    opacity={0.6 + rng.next() * 0.4}
                />
            );
        }
    });

    return <ViroNode>{particles}</ViroNode>;
};

// ============ Texture Stroke (thicker polyline with smoothing) ============

interface TextureStrokeProps {
    points: Vec3[];
    color: string;
    strokeId: string;
    seed: number;
    isActive?: boolean;
}

const TextureStroke: React.FC<TextureStrokeProps> = ({ points, color, strokeId, seed, isActive = false }) => {
    const smoothedPoints = useMemo(() => {
        return processStrokePoints(points, isActive);
    }, [points, isActive]);

    if (smoothedPoints.length < 2) return null;

    const material = ensureMaterial(color);

    return (
        <ViroPolyline
            key={strokeId}
            position={[0, 0, 0]}
            points={smoothedPoints}
            thickness={0.012} // 12mm thick for paint brush effect
            materials={[material]}
        />
    );
};

// ============ Main Paint Renderer ============

export const PaintRenderer: React.FC<PaintRendererProps> = ({
    strokes,
    activePoints,
    activeColor,
    activeBrushType,
}) => {
    const renderStroke = (stroke: PaintStroke) => {
        switch (stroke.brushType) {
            case 'tube':
                return (
                    <TubeStroke
                        key={stroke.id}
                        points={stroke.points}
                        color={stroke.color}
                        strokeId={stroke.id}
                    />
                );
            case 'particle':
                return (
                    <ParticleStroke
                        key={stroke.id}
                        points={stroke.points}
                        color={stroke.color}
                        strokeId={stroke.id}
                        seed={stroke.seed}
                    />
                );
            case 'texture':
            default:
                return (
                    <TextureStroke
                        key={stroke.id}
                        points={stroke.points}
                        color={stroke.color}
                        strokeId={stroke.id}
                        seed={stroke.seed}
                    />
                );
        }
    };

    return (
        <ViroNode>
            {/* Completed strokes */}
            {strokes.map(renderStroke)}

            {/* Active stroke being drawn */}
            {activePoints.length >= 2 && (
                activeBrushType === 'tube' ? (
                    <TubeStroke
                        points={activePoints}
                        color={activeColor}
                        strokeId="active"
                        isActive={true}
                    />
                ) : activeBrushType === 'particle' ? (
                    <ParticleStroke
                        points={activePoints}
                        color={activeColor}
                        strokeId="active"
                        seed={Date.now()}
                    />
                ) : (
                    <TextureStroke
                        points={activePoints}
                        color={activeColor}
                        strokeId="active"
                        seed={Date.now()}
                        isActive={true}
                    />
                )
            )}
        </ViroNode>
    );
};

export default PaintRenderer;

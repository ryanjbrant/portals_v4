/**
 * AR Paint System - Particle Brush Renderer
 * Dual particle system: floaters (drift near path) + emanators (burst outward)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ViroNode, ViroSphere, ViroMaterials } from '@reactvision/react-viro';
import {
    StrokePoint,
    StrokeChunk,
    ParticleBrushConfig,
    DEFAULT_PARTICLE_CONFIG,
    Vec3,
} from '../types';
import {
    vec3Add,
    vec3MulScalar,
    vec3Normalize,
    vec3Cross,
    SeededRandom,
} from '../math';

// ============ Types ============

interface Particle {
    id: string;
    position: Vec3;
    velocity: Vec3;
    birthTimeMs: number;
    lifetimeMs: number;
    size: number;
    type: 'floater' | 'emanator';
}

interface ParticleBrushRendererProps {
    chunks: StrokeChunk[];
    config: ParticleBrushConfig;
    color: string;
    seed: number;
    isActive: boolean;
}

// ============ Material Setup ============

const particleMaterialCache: Set<string> = new Set();

function getParticleMaterial(color: string): string {
    const name = `particle_${color.replace('#', '')}`;

    if (!particleMaterialCache.has(name)) {
        ViroMaterials.createMaterials({
            [name]: {
                diffuseColor: color,
                lightingModel: 'Constant',
            },
        });
        particleMaterialCache.add(name);
    }

    return name;
}

// ============ Component ============

export const ParticleBrushRenderer: React.FC<ParticleBrushRendererProps> = ({
    chunks,
    config,
    color,
    seed,
    isActive,
}) => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const rngRef = useRef(new SeededRandom(seed));
    const lastUpdateRef = useRef(Date.now());
    const processedPointsRef = useRef<Set<string>>(new Set());
    const particleIdRef = useRef(0);

    // Spawn particles from new points
    useEffect(() => {
        const rng = rngRef.current;
        const newParticles: Particle[] = [];
        const now = Date.now();

        for (const chunk of chunks) {
            for (const point of chunk.points) {
                const pointKey = `${chunk.strokeId}_${point.timeMs}`;

                if (processedPointsRef.current.has(pointKey)) continue;
                processedPointsRef.current.add(pointKey);

                // Spawn floaters
                for (let i = 0; i < config.floaterCount && particles.length + newParticles.length < config.maxFloaters; i++) {
                    const offset = rng.nextVec3(0.02);
                    newParticles.push({
                        id: `floater_${particleIdRef.current++}`,
                        position: vec3Add(point.pos, offset),
                        velocity: vec3MulScalar(rng.nextVec3(1), config.floaterDriftSpeed),
                        birthTimeMs: now,
                        lifetimeMs: config.floaterLifetimeMs,
                        size: config.floaterSize * (0.8 + rng.next() * 0.4),
                        type: 'floater',
                    });
                }

                // Spawn emanators
                for (let i = 0; i < config.emanatorBurstCount && particles.length + newParticles.length < config.maxFloaters + config.maxEmanators; i++) {
                    const dir = vec3Normalize(rng.nextVec3(1));
                    newParticles.push({
                        id: `emanator_${particleIdRef.current++}`,
                        position: [...point.pos] as Vec3,
                        velocity: vec3MulScalar(dir, config.emanatorSpeed),
                        birthTimeMs: now,
                        lifetimeMs: config.emanatorLifetimeMs,
                        size: config.emanatorSize * (0.8 + rng.next() * 0.4),
                        type: 'emanator',
                    });
                }
            }
        }

        if (newParticles.length > 0) {
            setParticles(prev => [...prev, ...newParticles]);
        }
    }, [chunks, config]);

    // Update particle positions and remove dead particles
    useEffect(() => {
        if (particles.length === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const dt = Math.min((now - lastUpdateRef.current) / 1000, 0.1); // Cap dt
            lastUpdateRef.current = now;

            setParticles(prev => {
                const updated: Particle[] = [];

                for (const p of prev) {
                    const age = now - p.birthTimeMs;

                    // Remove dead particles
                    if (age > p.lifetimeMs) continue;

                    // Update position
                    let newVelocity = p.velocity;

                    if (p.type === 'floater') {
                        // Floaters: add slight noise to velocity for drift
                        const noise: Vec3 = [
                            (Math.random() - 0.5) * 0.01,
                            (Math.random() - 0.5) * 0.01,
                            (Math.random() - 0.5) * 0.01,
                        ];
                        newVelocity = vec3Add(p.velocity, noise);
                    } else {
                        // Emanators: slow down over time
                        newVelocity = vec3MulScalar(p.velocity, 0.95);
                    }

                    updated.push({
                        ...p,
                        position: vec3Add(p.position, vec3MulScalar(newVelocity, dt)),
                        velocity: newVelocity,
                    });
                }

                return updated;
            });
        }, 33); // ~30fps update

        return () => clearInterval(interval);
    }, [particles.length > 0]);

    // Clear processed points when stroke ends
    useEffect(() => {
        if (!isActive) {
            processedPointsRef.current.clear();
        }
    }, [isActive]);

    const materialName = getParticleMaterial(color);

    // Calculate opacity based on age
    const getOpacity = useCallback((particle: Particle): number => {
        const age = Date.now() - particle.birthTimeMs;
        const lifeRatio = age / particle.lifetimeMs;

        if (particle.type === 'floater') {
            // Floaters: slow fade
            return 1 - lifeRatio * 0.5;
        } else {
            // Emanators: quick fade
            return 1 - lifeRatio;
        }
    }, []);

    return (
        <ViroNode>
            {particles.map((p) => (
                <ViroSphere
                    key={p.id}
                    position={p.position as [number, number, number]}
                    radius={p.size}
                    materials={[materialName]}
                    opacity={getOpacity(p)}
                />
            ))}
        </ViroNode>
    );
};

// ============ Factory ============

export function createParticleBrushConfig(
    overrides: Partial<ParticleBrushConfig> = {}
): ParticleBrushConfig {
    return {
        ...DEFAULT_PARTICLE_CONFIG,
        ...overrides,
    };
}

export default ParticleBrushRenderer;

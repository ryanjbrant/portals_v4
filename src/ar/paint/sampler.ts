/**
 * AR Paint System - Stroke Sampler
 * Handles distance gating, smoothing, and chunking of stroke points
 */

import {
    Vec3,
    StrokePoint,
    StrokeChunk,
    SamplerConfig,
    DEFAULT_SAMPLER_CONFIG,
} from './types';
import {
    vec3Distance,
    vec3Add,
    vec3MulScalar,
    vec3Normalize,
    emaSmooth,
    generateStrokeId,
} from './math';

export interface SamplerState {
    strokeId: string;
    points: StrokePoint[];
    pendingChunks: StrokeChunk[];
    startTimeMs: number;
    lastSampleTimeMs: number;
    cumulativeLength: number;
    smoothedPos: Vec3 | null;
    smoothedNormal: Vec3 | null;
}

export class StrokeSampler {
    private config: SamplerConfig;
    private state: SamplerState | null = null;

    constructor(config: Partial<SamplerConfig> = {}) {
        this.config = { ...DEFAULT_SAMPLER_CONFIG, ...config };
    }

    updateConfig(config: Partial<SamplerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    isActive(): boolean {
        return this.state !== null;
    }

    beginStroke(initialPoint: Vec3, normal: Vec3, timeMs: number): string {
        const strokeId = generateStrokeId();

        const firstPoint: StrokePoint = {
            pos: [...initialPoint] as Vec3,
            normal: vec3Normalize(normal),
            t: 0,
            timeMs,
            speed: 0,
        };

        this.state = {
            strokeId,
            points: [firstPoint],
            pendingChunks: [],
            startTimeMs: timeMs,
            lastSampleTimeMs: timeMs,
            cumulativeLength: 0,
            smoothedPos: [...initialPoint] as Vec3,
            smoothedNormal: vec3Normalize(normal),
        };

        return strokeId;
    }

    extendStroke(candidatePos: Vec3, candidateNormal: Vec3, timeMs: number): boolean {
        if (!this.state) return false;

        const { points, lastSampleTimeMs, smoothedPos, smoothedNormal } = this.state;
        const lastPoint = points[points.length - 1];

        // Rate limiting
        const timeDelta = timeMs - lastSampleTimeMs;
        const minInterval = 1000 / this.config.maxPointsPerSecond;
        if (timeDelta < minInterval) return false;

        // Smooth the position using EMA
        const smoothAlpha = 0.3; // Higher = less smoothing
        const newSmoothedPos = smoothedPos
            ? emaSmooth(candidatePos, smoothedPos, smoothAlpha)
            : candidatePos;
        const newSmoothedNormal = smoothedNormal
            ? emaSmooth(candidateNormal, smoothedNormal, smoothAlpha)
            : candidateNormal;

        this.state.smoothedPos = newSmoothedPos;
        this.state.smoothedNormal = vec3Normalize(newSmoothedNormal);

        // Distance gating
        const distance = vec3Distance(newSmoothedPos, lastPoint.pos);

        // Dynamic step based on speed
        const speed = timeDelta > 0 ? distance / (timeDelta / 1000) : 0;
        const speedFactor = Math.min(1, speed / 0.5); // Scale with speed up to 0.5 m/s
        const dynamicMinStep = this.config.minStepMeters * (1 + speedFactor * 0.5);

        if (distance < dynamicMinStep && distance < this.config.maxStepMeters) {
            return false;
        }

        // Add new point
        const newCumulativeLength = this.state.cumulativeLength + distance;

        const newPoint: StrokePoint = {
            pos: [...newSmoothedPos] as Vec3,
            normal: [...this.state.smoothedNormal] as Vec3,
            t: 0, // Will be updated
            timeMs,
            speed,
        };

        points.push(newPoint);
        this.state.cumulativeLength = newCumulativeLength;
        this.state.lastSampleTimeMs = timeMs;

        // Update t values for all points (normalized progress)
        this.updateTValues();

        // Check if we need to flush a chunk
        if (points.length > 0 && points.length % this.config.chunkSize === 0) {
            this.flushChunk(false);
        }

        return true;
    }

    endStroke(timeMs: number): StrokePoint[] | null {
        if (!this.state) return null;

        // Flush remaining points as final chunk
        if (this.state.points.length > 0) {
            this.flushChunk(true);
        }

        const finalPoints = [...this.state.points];
        this.state = null;

        return finalPoints;
    }

    consumeChunks(): StrokeChunk[] {
        if (!this.state) return [];
        const chunks = this.state.pendingChunks;
        this.state.pendingChunks = [];
        return chunks;
    }

    getCurrentPoints(): StrokePoint[] {
        return this.state?.points ?? [];
    }

    getStrokeId(): string | null {
        return this.state?.strokeId ?? null;
    }

    private updateTValues(): void {
        if (!this.state || this.state.points.length === 0) return;

        const { points, cumulativeLength } = this.state;

        if (cumulativeLength === 0) {
            points.forEach((p, i) => {
                p.t = points.length > 1 ? i / (points.length - 1) : 0;
            });
            return;
        }

        // Compute t based on cumulative distance
        let runningLength = 0;
        for (let i = 0; i < points.length; i++) {
            if (i > 0) {
                runningLength += vec3Distance(points[i].pos, points[i - 1].pos);
            }
            points[i].t = runningLength / cumulativeLength;
        }
    }

    private flushChunk(isLast: boolean): void {
        if (!this.state) return;

        const { strokeId, points, pendingChunks } = this.state;
        const chunkIndex = pendingChunks.length;
        const startIdx = chunkIndex * this.config.chunkSize;
        const endIdx = isLast ? points.length : startIdx + this.config.chunkSize;

        if (startIdx >= points.length) return;

        const chunkPoints = points.slice(startIdx, endIdx);

        const chunk: StrokeChunk = {
            strokeId,
            chunkIndex,
            points: chunkPoints,
            isFirst: chunkIndex === 0,
            isLast,
        };

        pendingChunks.push(chunk);
    }
}

// ============ Singleton instance for convenience ============

let defaultSampler: StrokeSampler | null = null;

export function getDefaultSampler(): StrokeSampler {
    if (!defaultSampler) {
        defaultSampler = new StrokeSampler();
    }
    return defaultSampler;
}

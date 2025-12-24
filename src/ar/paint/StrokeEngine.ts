/**
 * AR Paint System - Stroke Engine
 * Coordinates brush mode, stroke lifecycle, undo/clear, and rendering
 */

import { useState, useCallback, useRef } from 'react';
import {
    BrushMode,
    InputMode,
    Stroke,
    StrokePoint,
    StrokeChunk,
    BrushConfig,
    TextureBrushConfig,
    TubeBrushConfig,
    ParticleBrushConfig,
    TexturePreset,
    DEFAULT_TEXTURE_CONFIG,
    DEFAULT_TUBE_CONFIG,
    DEFAULT_PARTICLE_CONFIG,
    Vec3,
} from './types';
import { StrokeSampler } from './sampler';
import { generateStrokeId, generateSeed } from './math';

// ============ Types ============

export interface StrokeEngineState {
    strokes: Stroke[];
    activeStroke: Stroke | null;
    activeChunks: StrokeChunk[];
    brushMode: BrushMode;
    inputMode: InputMode;
    color: string;
    texturePreset: TexturePreset;
    isPainting: boolean;
}

export interface StrokeEngineActions {
    setBrushMode: (mode: BrushMode) => void;
    setInputMode: (mode: InputMode) => void;
    setColor: (color: string) => void;
    setTexturePreset: (preset: TexturePreset) => void;
    startStroke: (position: Vec3, normal: Vec3) => void;
    extendStroke: (position: Vec3, normal: Vec3) => void;
    endStroke: () => void;
    undoLastStroke: () => void;
    clearAllStrokes: () => void;
    getConfig: () => BrushConfig;
    serializeStrokes: () => string;
    deserializeStrokes: (json: string) => void;
}

// ============ Engine Class ============

export class StrokeEngine {
    private strokes: Stroke[] = [];
    private activeStroke: Stroke | null = null;
    private activeChunks: StrokeChunk[] = [];
    private sampler: StrokeSampler;

    private brushMode: BrushMode = BrushMode.TEXTURE;
    private inputMode: InputMode = InputMode.AUTO;
    private color: string = '#FF3366';
    private texturePreset: TexturePreset = TexturePreset.WET;

    private onStateChange?: () => void;

    constructor() {
        this.sampler = new StrokeSampler();
    }

    setOnStateChange(callback: () => void): void {
        this.onStateChange = callback;
    }

    private notifyChange(): void {
        this.onStateChange?.();
    }

    // ============ Getters ============

    getState(): StrokeEngineState {
        return {
            strokes: this.strokes,
            activeStroke: this.activeStroke,
            activeChunks: this.activeChunks,
            brushMode: this.brushMode,
            inputMode: this.inputMode,
            color: this.color,
            texturePreset: this.texturePreset,
            isPainting: this.activeStroke !== null,
        };
    }

    getConfig(): BrushConfig {
        switch (this.brushMode) {
            case BrushMode.TEXTURE:
                return {
                    ...DEFAULT_TEXTURE_CONFIG,
                    preset: this.texturePreset,
                };
            case BrushMode.TUBE:
                return DEFAULT_TUBE_CONFIG;
            case BrushMode.PARTICLE:
                return DEFAULT_PARTICLE_CONFIG;
        }
    }

    // ============ Setters ============

    setBrushMode(mode: BrushMode): void {
        this.brushMode = mode;
        this.notifyChange();
    }

    setInputMode(mode: InputMode): void {
        this.inputMode = mode;
        this.notifyChange();
    }

    setColor(color: string): void {
        this.color = color;
        this.notifyChange();
    }

    setTexturePreset(preset: TexturePreset): void {
        this.texturePreset = preset;
        this.notifyChange();
    }

    // ============ Stroke Lifecycle ============

    startStroke(position: Vec3, normal: Vec3): void {
        if (this.activeStroke) {
            this.endStroke();
        }

        const now = Date.now();
        const strokeId = this.sampler.beginStroke(position, normal, now);

        this.activeStroke = {
            id: strokeId,
            points: [],
            mode: this.brushMode,
            startedAtMs: now,
            color: this.color,
            seed: generateSeed(),
        };

        this.activeChunks = [];
        this.notifyChange();
    }

    extendStroke(position: Vec3, normal: Vec3): void {
        if (!this.activeStroke) return;

        const now = Date.now();
        const added = this.sampler.extendStroke(position, normal, now);

        if (added) {
            // Consume any new chunks
            const newChunks = this.sampler.consumeChunks();
            if (newChunks.length > 0) {
                this.activeChunks.push(...newChunks);
                this.notifyChange();
            }
        }
    }

    endStroke(): void {
        if (!this.activeStroke) return;

        const now = Date.now();
        const finalPoints = this.sampler.endStroke(now);

        if (finalPoints && finalPoints.length >= 2) {
            this.activeStroke.points = finalPoints;
            this.activeStroke.endedAtMs = now;
            this.strokes.push(this.activeStroke);
        }

        // Consume final chunks
        const finalChunks = this.sampler.consumeChunks();
        if (finalChunks.length > 0) {
            this.activeChunks.push(...finalChunks);
        }

        this.activeStroke = null;
        this.notifyChange();
    }

    // ============ Undo / Clear ============

    undoLastStroke(): void {
        if (this.strokes.length > 0) {
            this.strokes.pop();
            this.notifyChange();
        }
    }

    clearAllStrokes(): void {
        this.strokes = [];
        this.activeStroke = null;
        this.activeChunks = [];
        this.notifyChange();
    }

    // ============ Serialization ============

    serializeStrokes(): string {
        return JSON.stringify({
            version: 1,
            strokes: this.strokes,
        });
    }

    deserializeStrokes(json: string): void {
        try {
            const data = JSON.parse(json);
            if (data.version === 1 && Array.isArray(data.strokes)) {
                this.strokes = data.strokes;
                this.notifyChange();
            }
        } catch (e) {
            console.error('[StrokeEngine] Failed to deserialize strokes:', e);
        }
    }
}

// ============ React Hook ============

export function useStrokeEngine(): [StrokeEngineState, StrokeEngineActions] {
    const engineRef = useRef<StrokeEngine | null>(null);
    const [, forceUpdate] = useState({});

    // Initialize engine
    if (!engineRef.current) {
        engineRef.current = new StrokeEngine();
        engineRef.current.setOnStateChange(() => forceUpdate({}));
    }

    const engine = engineRef.current;

    const actions: StrokeEngineActions = {
        setBrushMode: useCallback((mode: BrushMode) => engine.setBrushMode(mode), []),
        setInputMode: useCallback((mode: InputMode) => engine.setInputMode(mode), []),
        setColor: useCallback((color: string) => engine.setColor(color), []),
        setTexturePreset: useCallback((preset: TexturePreset) => engine.setTexturePreset(preset), []),
        startStroke: useCallback((pos: Vec3, normal: Vec3) => engine.startStroke(pos, normal), []),
        extendStroke: useCallback((pos: Vec3, normal: Vec3) => engine.extendStroke(pos, normal), []),
        endStroke: useCallback(() => engine.endStroke(), []),
        undoLastStroke: useCallback(() => engine.undoLastStroke(), []),
        clearAllStrokes: useCallback(() => engine.clearAllStrokes(), []),
        getConfig: useCallback(() => engine.getConfig(), []),
        serializeStrokes: useCallback(() => engine.serializeStrokes(), []),
        deserializeStrokes: useCallback((json: string) => engine.deserializeStrokes(json), []),
    };

    return [engine.getState(), actions];
}

// ============ Singleton ============

let globalEngine: StrokeEngine | null = null;

export function getGlobalStrokeEngine(): StrokeEngine {
    if (!globalEngine) {
        globalEngine = new StrokeEngine();
    }
    return globalEngine;
}

/**
 * Performance Monitoring Utilities
 * 
 * Wraps Firebase Performance Monitoring and custom trace tracking.
 * Use this for measuring:
 * - Screen load times
 * - API call durations
 * - AR scene initialization
 * - Feed fetch performance
 */
import { analytics } from '../config/firebase';

// Simple performance tracking without Firebase Perf SDK
// (Firebase Perf is not available in Expo managed workflow)

interface PerformanceTrace {
    name: string;
    startTime: number;
    attributes: Record<string, string>;
    metrics: Record<string, number>;
}

const activeTraces: Map<string, PerformanceTrace> = new Map();
const completedTraces: { name: string; duration: number; attributes: Record<string, string> }[] = [];

// Maximum cached traces before auto-flush
const MAX_CACHED_TRACES = 100;

/**
 * Start a performance trace
 */
export function startTrace(name: string): void {
    if (activeTraces.has(name)) {
        console.warn(`[Perf] Trace "${name}" already active, replacing`);
    }

    activeTraces.set(name, {
        name,
        startTime: Date.now(),
        attributes: {},
        metrics: {},
    });
}

/**
 * Add an attribute to an active trace
 */
export function putAttribute(name: string, key: string, value: string): void {
    const trace = activeTraces.get(name);
    if (trace) {
        trace.attributes[key] = value;
    }
}

/**
 * Add a metric to an active trace
 */
export function putMetric(name: string, key: string, value: number): void {
    const trace = activeTraces.get(name);
    if (trace) {
        trace.metrics[key] = value;
    }
}

/**
 * Stop a performance trace and record the duration
 */
export function stopTrace(name: string): number | null {
    const trace = activeTraces.get(name);
    if (!trace) {
        console.warn(`[Perf] Trace "${name}" not found`);
        return null;
    }

    const duration = Date.now() - trace.startTime;

    // Cache completed trace
    completedTraces.push({
        name: trace.name,
        duration,
        attributes: { ...trace.attributes, ...trace.metrics as any },
    });

    // Auto-flush if cache is full
    if (completedTraces.length >= MAX_CACHED_TRACES) {
        flushTraces();
    }

    activeTraces.delete(name);

    console.log(`[Perf] ${name}: ${duration}ms`, trace.attributes);

    return duration;
}

/**
 * Measure an async function's execution time
 */
export async function measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string>
): Promise<T> {
    startTrace(name);

    if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
            putAttribute(name, key, value);
        });
    }

    try {
        const result = await fn();
        stopTrace(name);
        return result;
    } catch (error) {
        putAttribute(name, 'error', String(error));
        stopTrace(name);
        throw error;
    }
}

/**
 * Measure a sync function's execution time
 */
export function measureSync<T>(
    name: string,
    fn: () => T,
    attributes?: Record<string, string>
): T {
    startTrace(name);

    if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
            putAttribute(name, key, value);
        });
    }

    try {
        const result = fn();
        stopTrace(name);
        return result;
    } catch (error) {
        putAttribute(name, 'error', String(error));
        stopTrace(name);
        throw error;
    }
}

/**
 * Flush completed traces to analytics
 */
export function flushTraces(): void {
    if (completedTraces.length === 0) return;

    // Log to Firebase Analytics as custom events
    try {
        // Note: analytics may not be available in all environments
        if (analytics) {
            completedTraces.forEach(trace => {
                // Firebase Analytics event (limited to 25 params, 40 char name)
                const eventName = `perf_${trace.name.substring(0, 35)}`;
                // Can't call logEvent directly here without importing from firebase/analytics
                console.log(`[Perf] Would log: ${eventName}, duration: ${trace.duration}ms`);
            });
        }
    } catch (error) {
        console.warn('[Perf] Failed to flush traces to analytics:', error);
    }

    // Clear cache
    completedTraces.length = 0;
}

/**
 * Get performance statistics
 */
export function getStats(): {
    activeTraces: number;
    cachedTraces: number;
    traceNames: string[];
} {
    return {
        activeTraces: activeTraces.size,
        cachedTraces: completedTraces.length,
        traceNames: Array.from(activeTraces.keys()),
    };
}

// Pre-defined trace names for consistency
export const TraceNames = {
    FEED_LOAD: 'feed_load',
    AR_SCENE_INIT: 'ar_scene_init',
    AR_PAINT_STROKE: 'ar_paint_stroke',
    SCENE_SAVE: 'scene_save',
    SCENE_LOAD: 'scene_load',
    MEDIA_CACHE_HIT: 'media_cache_hit',
    MEDIA_CACHE_MISS: 'media_cache_miss',
    USER_LOGIN: 'user_login',
    NOTIFICATION_LOAD: 'notification_load',
    MODEL_LOAD: 'model_load',
};

export const PerformanceMonitor = {
    startTrace,
    stopTrace,
    putAttribute,
    putMetric,
    measureAsync,
    measureSync,
    flushTraces,
    getStats,
    TraceNames,
};

export default PerformanceMonitor;

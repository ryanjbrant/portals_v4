/**
 * AR Paint System - Math Utilities
 */

import { Vec3, Quat } from './types';

// ============ Vector Operations ============

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3MulScalar(v: Vec3, s: number): Vec3 {
    return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Length(v: Vec3): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vec3Distance(a: Vec3, b: Vec3): number {
    return vec3Length(vec3Sub(a, b));
}

export function vec3Normalize(v: Vec3): Vec3 {
    const len = vec3Length(v);
    if (len < 0.0001) return [0, 1, 0]; // Default up if zero
    return [v[0] / len, v[1] / len, v[2] / len];
}

export function vec3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

export function vec3Negate(v: Vec3): Vec3 {
    return [-v[0], -v[1], -v[2]];
}

export function vec3Clone(v: Vec3): Vec3 {
    return [v[0], v[1], v[2]];
}

// ============ Scalar Utilities ============

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

export function inverseLerp(a: number, b: number, value: number): number {
    if (Math.abs(b - a) < 0.0001) return 0;
    return (value - a) / (b - a);
}

// ============ Smoothing ============

/**
 * Simple moving average for Vec3 points
 */
export function smoothPoints(points: Vec3[], windowSize: number): Vec3[] {
    if (points.length <= 1 || windowSize <= 1) return points;

    const result: Vec3[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < points.length; i++) {
        let sum: Vec3 = [0, 0, 0];
        let count = 0;

        for (let j = Math.max(0, i - halfWindow); j <= Math.min(points.length - 1, i + halfWindow); j++) {
            sum = vec3Add(sum, points[j]);
            count++;
        }

        result.push(vec3MulScalar(sum, 1 / count));
    }

    return result;
}

/**
 * Exponential moving average for smoother real-time filtering
 */
export function emaSmooth(current: Vec3, previous: Vec3, alpha: number): Vec3 {
    return vec3Lerp(previous, current, alpha);
}

// ============ Catmull-Rom Interpolation ============

/**
 * Catmull-Rom spline interpolation between 4 points
 * t: 0-1 between p1 and p2
 */
export function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
    const t2 = t * t;
    const t3 = t2 * t;

    const result: Vec3 = [0, 0, 0];

    for (let i = 0; i < 3; i++) {
        result[i] = 0.5 * (
            (2 * p1[i]) +
            (-p0[i] + p2[i]) * t +
            (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
            (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3
        );
    }

    return result;
}

/**
 * Generate refined points along a path using Catmull-Rom interpolation
 */
export function refinePath(points: Vec3[], subdivisions: number): Vec3[] {
    if (points.length < 2) return points;
    if (points.length === 2) {
        const result: Vec3[] = [];
        for (let i = 0; i <= subdivisions; i++) {
            result.push(vec3Lerp(points[0], points[1], i / subdivisions));
        }
        return result;
    }

    const result: Vec3[] = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[Math.min(points.length - 1, i + 1)];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        for (let j = 0; j < subdivisions; j++) {
            const t = j / subdivisions;
            result.push(catmullRom(p0, p1, p2, p3, t));
        }
    }

    result.push(points[points.length - 1]);
    return result;
}

// ============ Seeded Random Number Generator ============

/**
 * Seeded PRNG using xorshift32
 */
export class SeededRandom {
    private state: number;

    constructor(seed: number) {
        this.state = seed === 0 ? 1 : seed;
    }

    next(): number {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x;
        return (x >>> 0) / 0xFFFFFFFF;
    }

    nextRange(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    nextVec3(magnitude: number = 1): Vec3 {
        const theta = this.next() * Math.PI * 2;
        const phi = Math.acos(2 * this.next() - 1);
        return [
            magnitude * Math.sin(phi) * Math.cos(theta),
            magnitude * Math.sin(phi) * Math.sin(theta),
            magnitude * Math.cos(phi),
        ];
    }
}

// ============ Quaternion Helpers ============

export function quatFromAxisAngle(axis: Vec3, angleRad: number): Quat {
    const halfAngle = angleRad / 2;
    const s = Math.sin(halfAngle);
    return [
        axis[0] * s,
        axis[1] * s,
        axis[2] * s,
        Math.cos(halfAngle),
    ];
}

export function quatLookAt(forward: Vec3, up: Vec3 = [0, 1, 0]): Quat {
    const f = vec3Normalize(forward);
    const r = vec3Normalize(vec3Cross(up, f));
    const u = vec3Cross(f, r);

    // Build rotation matrix and convert to quaternion
    const m00 = r[0], m01 = r[1], m02 = r[2];
    const m10 = u[0], m11 = u[1], m12 = u[2];
    const m20 = f[0], m21 = f[1], m22 = f[2];

    const trace = m00 + m11 + m22;
    let qw: number, qx: number, qy: number, qz: number;

    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1);
        qw = 0.25 / s;
        qx = (m21 - m12) * s;
        qy = (m02 - m20) * s;
        qz = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
        const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
        qw = (m21 - m12) / s;
        qx = 0.25 * s;
        qy = (m01 + m10) / s;
        qz = (m02 + m20) / s;
    } else if (m11 > m22) {
        const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
        qw = (m02 - m20) / s;
        qx = (m01 + m10) / s;
        qy = 0.25 * s;
        qz = (m12 + m21) / s;
    } else {
        const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
        qw = (m10 - m01) / s;
        qx = (m02 + m20) / s;
        qy = (m12 + m21) / s;
        qz = 0.25 * s;
    }

    return [qx, qy, qz, qw];
}

export function quatToEulerDegrees(q: Quat): Vec3 {
    const [x, y, z, w] = q;

    // Roll (x-axis)
    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    // Pitch (y-axis)
    const sinp = 2 * (w * y - z * x);
    let pitch: number;
    if (Math.abs(sinp) >= 1) {
        pitch = Math.sign(sinp) * Math.PI / 2;
    } else {
        pitch = Math.asin(sinp);
    }

    // Yaw (z-axis)
    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    const toDeg = 180 / Math.PI;
    return [roll * toDeg, pitch * toDeg, yaw * toDeg];
}

// ============ Utility ============

export function generateStrokeId(): string {
    return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSeed(): number {
    return Math.floor(Math.random() * 0xFFFFFFFF);
}

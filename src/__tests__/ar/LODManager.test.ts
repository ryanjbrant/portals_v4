/**
 * LODManager Tests
 */
import { LODManager } from '../../ar/LODManager';

describe('LODManager', () => {
    describe('getTier', () => {
        const camera: [number, number, number] = [0, 0, 0];

        it('should return high tier for close objects (<3m)', () => {
            const object: [number, number, number] = [0, 0, -2];
            expect(LODManager.getTier(object, camera)).toBe('high');
        });

        it('should return medium tier for medium distance (3-8m)', () => {
            const object: [number, number, number] = [0, 0, -5];
            expect(LODManager.getTier(object, camera)).toBe('medium');
        });

        it('should return low tier for far objects (8-15m)', () => {
            const object: [number, number, number] = [0, 0, -12];
            expect(LODManager.getTier(object, camera)).toBe('low');
        });

        it('should return cull tier for very far objects (>25m)', () => {
            const object: [number, number, number] = [0, 0, -30];
            expect(LODManager.getTier(object, camera)).toBe('cull');
        });
    });

    describe('getScaleFactor', () => {
        it('should return 1.0 for high tier', () => {
            expect(LODManager.getScaleFactor('high')).toBe(1.0);
        });

        it('should return 0.9 for medium tier', () => {
            expect(LODManager.getScaleFactor('medium')).toBe(0.9);
        });

        it('should return 0.75 for low tier', () => {
            expect(LODManager.getScaleFactor('low')).toBe(0.75);
        });

        it('should return 0 for cull tier', () => {
            expect(LODManager.getScaleFactor('cull')).toBe(0);
        });

        it('should apply base scale correctly', () => {
            expect(LODManager.getScaleFactor('medium', 2)).toBe(1.8);
        });
    });

    describe('getScaleArray', () => {
        it('should scale all dimensions equally', () => {
            const baseScale: [number, number, number] = [1, 2, 3];
            const scaled = LODManager.getScaleArray('medium', baseScale);

            expect(scaled[0]).toBe(0.9);
            expect(scaled[1]).toBe(1.8);
            expect(scaled[2]).toBe(2.7);
        });
    });

    describe('shouldRender', () => {
        it('should return true for high tier', () => {
            expect(LODManager.shouldRender('high')).toBe(true);
        });

        it('should return true for medium tier', () => {
            expect(LODManager.shouldRender('medium')).toBe(true);
        });

        it('should return true for low tier', () => {
            expect(LODManager.shouldRender('low')).toBe(true);
        });

        it('should return false for cull tier', () => {
            expect(LODManager.shouldRender('cull')).toBe(false);
        });
    });

    describe('calculateDistance', () => {
        it('should calculate 3D Euclidean distance correctly', () => {
            const p1: [number, number, number] = [0, 0, 0];
            const p2: [number, number, number] = [3, 4, 0];
            expect(LODManager.calculateDistance(p1, p2)).toBe(5);
        });

        it('should return 0 for same point', () => {
            const p: [number, number, number] = [1, 2, 3];
            expect(LODManager.calculateDistance(p, p)).toBe(0);
        });
    });

    describe('getLODInfo', () => {
        it('should return complete LOD info object', () => {
            const camera: [number, number, number] = [0, 0, 0];
            const object: [number, number, number] = [0, 0, -2];
            const scale: [number, number, number] = [1, 1, 1];

            const info = LODManager.getLODInfo(object, camera, scale);

            expect(info.tier).toBe('high');
            expect(info.visible).toBe(true);
            expect(info.scale).toEqual([1, 1, 1]);
            expect(info.distance).toBe(2);
        });
    });

    describe('batchGetLOD', () => {
        it('should process multiple objects', () => {
            const camera: [number, number, number] = [0, 0, 0];
            const objects = [
                { id: 'obj1', position: [0, 0, -2] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
                { id: 'obj2', position: [0, 0, -30] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            ];

            const results = LODManager.batchGetLOD(objects, camera);

            expect(results.get('obj1')?.tier).toBe('high');
            expect(results.get('obj2')?.tier).toBe('cull');
        });
    });
});

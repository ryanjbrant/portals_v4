/**
 * GeoHashUtils Tests
 */
import { GeoHashUtils } from '../../utils/GeoHashUtils';

describe('GeoHashUtils', () => {
    describe('encodeGeoHash', () => {
        it('should encode a valid latitude/longitude pair', () => {
            // New York City coordinates
            const hash = GeoHashUtils.encodeGeoHash(40.7128, -74.0060, 9);
            expect(hash).toBeTruthy();
            expect(hash.length).toBe(9);
        });

        it('should produce different hashes for different locations', () => {
            const nyc = GeoHashUtils.encodeGeoHash(40.7128, -74.0060, 9);
            const la = GeoHashUtils.encodeGeoHash(34.0522, -118.2437, 9);
            expect(nyc).not.toBe(la);
        });

        it('should produce similar prefix for nearby locations', () => {
            // Two nearby points in Manhattan
            const point1 = GeoHashUtils.encodeGeoHash(40.7580, -73.9855, 6);
            const point2 = GeoHashUtils.encodeGeoHash(40.7590, -73.9850, 6);
            expect(point1.substring(0, 4)).toBe(point2.substring(0, 4));
        });

        it('should throw for invalid latitude', () => {
            expect(() => GeoHashUtils.encodeGeoHash(91, 0)).toThrow();
            expect(() => GeoHashUtils.encodeGeoHash(-91, 0)).toThrow();
        });

        it('should throw for invalid longitude', () => {
            expect(() => GeoHashUtils.encodeGeoHash(0, 181)).toThrow();
            expect(() => GeoHashUtils.encodeGeoHash(0, -181)).toThrow();
        });
    });

    describe('decodeGeoHash', () => {
        it('should decode and match approximate coordinates', () => {
            const original = { lat: 40.7128, lon: -74.0060 };
            const hash = GeoHashUtils.encodeGeoHash(original.lat, original.lon, 9);
            const decoded = GeoHashUtils.decodeGeoHash(hash);

            // Should be within ~0.001 degrees for precision 9
            expect(Math.abs(decoded.lat - original.lat)).toBeLessThan(0.001);
            expect(Math.abs(decoded.lon - original.lon)).toBeLessThan(0.001);
        });
    });

    describe('haversineDistance', () => {
        it('should calculate distance between two points', () => {
            // NYC to LA is approximately 3944 km
            const distance = GeoHashUtils.haversineDistance(40.7128, -74.0060, 34.0522, -118.2437);
            expect(distance).toBeGreaterThan(3900000); // > 3900 km
            expect(distance).toBeLessThan(4000000); // < 4000 km
        });

        it('should return 0 for same point', () => {
            const distance = GeoHashUtils.haversineDistance(40.7128, -74.0060, 40.7128, -74.0060);
            expect(distance).toBe(0);
        });

        it('should calculate short distances accurately', () => {
            // ~1km apart
            const distance = GeoHashUtils.haversineDistance(40.7128, -74.0060, 40.7218, -74.0060);
            expect(distance).toBeGreaterThan(900);
            expect(distance).toBeLessThan(1100);
        });
    });

    describe('isWithinRadius', () => {
        it('should return true for points within radius', () => {
            const result = GeoHashUtils.isWithinRadius(40.7128, -74.0060, 40.7130, -74.0062, 100);
            expect(result).toBe(true);
        });

        it('should return false for points outside radius', () => {
            const result = GeoHashUtils.isWithinRadius(40.7128, -74.0060, 40.7228, -74.0160, 100);
            expect(result).toBe(false);
        });
    });

    describe('getNeighbors', () => {
        it('should return the center hash plus neighbors', () => {
            const hash = GeoHashUtils.encodeGeoHash(40.7128, -74.0060, 5);
            const neighbors = GeoHashUtils.getNeighbors(hash);

            expect(neighbors).toContain(hash);
            expect(neighbors.length).toBeGreaterThan(1);
        });
    });
});

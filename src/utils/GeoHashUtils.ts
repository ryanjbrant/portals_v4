/**
 * GeoHash Utilities for Spatial Queries
 * 
 * Implements GeoHash encoding for efficient geospatial queries in Firestore.
 * Replace client-side distance filtering with server-side GeoHash bounds.
 * 
 * Based on: https://github.com/firebase/geofire-common
 */

// Precision levels (higher = more precise but more storage)
const GEOHASH_PRECISION = 9;

// Base32 alphabet for GeoHash encoding
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a latitude/longitude pair into a GeoHash string
 */
export function encodeGeoHash(latitude: number, longitude: number, precision: number = GEOHASH_PRECISION): string {
    if (latitude < -90 || latitude > 90) throw new Error('Invalid latitude');
    if (longitude < -180 || longitude > 180) throw new Error('Invalid longitude');

    let latRange = [-90, 90];
    let lonRange = [-180, 180];
    let hash = '';
    let bit = 0;
    let ch = 0;
    let even = true;

    while (hash.length < precision) {
        if (even) {
            const mid = (lonRange[0] + lonRange[1]) / 2;
            if (longitude >= mid) {
                ch |= 1 << (4 - bit);
                lonRange[0] = mid;
            } else {
                lonRange[1] = mid;
            }
        } else {
            const mid = (latRange[0] + latRange[1]) / 2;
            if (latitude >= mid) {
                ch |= 1 << (4 - bit);
                latRange[0] = mid;
            } else {
                latRange[1] = mid;
            }
        }

        even = !even;
        bit++;

        if (bit === 5) {
            hash += BASE32[ch];
            bit = 0;
            ch = 0;
        }
    }

    return hash;
}

/**
 * Calculate the distance between two points using Haversine formula
 * Returns distance in meters
 */
export function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371000; // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) ** 2 +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Get the 8 neighboring GeoHash cells plus the center
 * Useful for querying nearby locations
 */
export function getNeighbors(geohash: string): string[] {
    const neighbors: string[] = [geohash];
    const len = geohash.length;

    if (len === 0) return neighbors;

    // Get the parent geohash box and compute adjacent boxes
    // Simplified implementation - returns the geohash and its 8 neighbors
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    // Decode center of geohash and re-encode neighbors
    const center = decodeGeoHash(geohash);
    const precision = geohash.length;

    // Approximate cell size at this precision
    const latDelta = 180 / Math.pow(2, Math.ceil(precision * 5 / 2));
    const lonDelta = 360 / Math.pow(2, Math.floor(precision * 5 / 2));

    for (const [dLat, dLon] of directions) {
        const neighborLat = center.lat + dLat * latDelta;
        const neighborLon = center.lon + dLon * lonDelta;

        if (neighborLat >= -90 && neighborLat <= 90 &&
            neighborLon >= -180 && neighborLon <= 180) {
            neighbors.push(encodeGeoHash(neighborLat, neighborLon, precision));
        }
    }

    return [...new Set(neighbors)]; // Remove duplicates
}

/**
 * Decode a GeoHash into approximate latitude/longitude
 */
export function decodeGeoHash(geohash: string): { lat: number; lon: number } {
    let latRange = [-90, 90];
    let lonRange = [-180, 180];
    let even = true;

    for (const char of geohash) {
        const idx = BASE32.indexOf(char);
        if (idx === -1) throw new Error('Invalid geohash character');

        for (let bit = 4; bit >= 0; bit--) {
            const mask = 1 << bit;
            if (even) {
                if (idx & mask) {
                    lonRange[0] = (lonRange[0] + lonRange[1]) / 2;
                } else {
                    lonRange[1] = (lonRange[0] + lonRange[1]) / 2;
                }
            } else {
                if (idx & mask) {
                    latRange[0] = (latRange[0] + latRange[1]) / 2;
                } else {
                    latRange[1] = (latRange[0] + latRange[1]) / 2;
                }
            }
            even = !even;
        }
    }

    return {
        lat: (latRange[0] + latRange[1]) / 2,
        lon: (lonRange[0] + lonRange[1]) / 2,
    };
}

/**
 * Get query bounds for a radius search
 * Returns [minHash, maxHash] pairs for Firestore where queries
 */
export function getQueryBounds(
    latitude: number,
    longitude: number,
    radiusMeters: number
): Array<[string, string]> {
    const precision = getPrecisionForRadius(radiusMeters);
    const centerHash = encodeGeoHash(latitude, longitude, precision);
    const neighbors = getNeighbors(centerHash);

    // Create query bounds for each neighbor cell
    return neighbors.map(hash => {
        const minHash = hash;
        const maxHash = hash + '~'; // ~ is after z in ASCII
        return [minHash, maxHash] as [string, string];
    });
}

/**
 * Determine appropriate geohash precision for a given radius
 */
function getPrecisionForRadius(radiusMeters: number): number {
    // Approximate cell sizes at each precision level
    const sizes = [
        5000000,   // 1
        1250000,   // 2
        156000,    // 3
        39000,     // 4
        4900,      // 5
        1200,      // 6
        153,       // 7
        38,        // 8
        5,         // 9
    ];

    for (let i = 0; i < sizes.length; i++) {
        if (radiusMeters > sizes[i]) {
            return Math.max(1, i);
        }
    }
    return GEOHASH_PRECISION;
}

/**
 * Check if a point is within radius of another point
 */
export function isWithinRadius(
    centerLat: number, centerLon: number,
    pointLat: number, pointLon: number,
    radiusMeters: number
): boolean {
    return haversineDistance(centerLat, centerLon, pointLat, pointLon) <= radiusMeters;
}

export const GeoHashUtils = {
    encodeGeoHash,
    decodeGeoHash,
    getNeighbors,
    getQueryBounds,
    haversineDistance,
    isWithinRadius,
    GEOHASH_PRECISION,
};

export default GeoHashUtils;

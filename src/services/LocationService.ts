import * as Location from 'expo-location';
import { EventEmitter } from '../utils/EventEmitter';

// Configuration
const TRACKING_INTERVAL = 5000; // 5 seconds
const DISTANCE_FILTER = 5; // 5 meters

export interface GeoCoordinate {
    latitude: number;
    longitude: number;
    heading?: number | null;
    accuracy?: number | null;
}

class LocationService extends EventEmitter {
    private static instance: LocationService;
    private locationSubscription: Location.LocationSubscription | null = null;
    private currentLocation: GeoCoordinate | null = null;
    private lastLoggedLocation: GeoCoordinate | null = null;
    private isTracking = false;

    private constructor() {
        super();
    }

    public static getInstance(): LocationService {
        if (!LocationService.instance) {
            LocationService.instance = new LocationService();
        }
        return LocationService.instance;
    }

    /**
     * Start background/foreground location tracking
     */
    public async startTracking(): Promise<boolean> {
        if (this.isTracking) return true;

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('[LocationService] Permission denied');
                return false;
            }

            this.locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: TRACKING_INTERVAL,
                    distanceInterval: DISTANCE_FILTER,
                },
                (location) => {
                    this.handleLocationUpdate(location);
                }
            );

            this.isTracking = true;
            console.log('[LocationService] Tracking started');
            return true;

        } catch (error) {
            console.error('[LocationService] Failed to start tracking:', error);
            return false;
        }
    }

    /**
     * Stop tracking to save battery
     */
    public stopTracking() {
        if (this.locationSubscription) {
            this.locationSubscription.remove();
            this.locationSubscription = null;
        }
        this.stopHeadingTracking();
        this.isTracking = false;
        console.log('[LocationService] Tracking stopped');
    }

    // Heading Subscription
    private headingSubscription: Location.LocationSubscription | null = null;

    public async startHeadingTracking(): Promise<boolean> {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return false;

            this.headingSubscription = await Location.watchHeadingAsync((heading) => {
                this.emit('heading_update', heading.trueHeading || heading.magHeading);
                // Also update current location cache if possible, or just emit separate event
                if (this.currentLocation) {
                    this.currentLocation.heading = heading.trueHeading || heading.magHeading;
                }
            });
            return true;
        } catch (e) {
            console.error("Failed to start heading tracking", e);
            return false;
        }
    }

    public stopHeadingTracking() {
        if (this.headingSubscription) {
            this.headingSubscription.remove();
            this.headingSubscription = null;
        }
    }

    /**
     * Get cached location synchronously (instant)
     */
    public getLastKnownLocation(): GeoCoordinate | null {
        return this.currentLocation;
    }

    /**
     * Get instantaneous current position
     */
    public async getCurrentLocation(): Promise<GeoCoordinate | null> {
        if (this.currentLocation) return this.currentLocation;

        try {
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                heading: location.coords.heading,
                accuracy: location.coords.accuracy,
            };
        } catch (e) {
            console.warn('[LocationService] One-time location failed', e);
            return null;
        }
    }

    private handleLocationUpdate(location: Location.LocationObject) {
        const coords: GeoCoordinate = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
            accuracy: location.coords.accuracy,
        };

        this.currentLocation = coords;

        // Emit update for Maps/AR
        this.emit('location_update', coords);

        // Calculate distance delta for Fuel accumulation (approx)
        if (this.lastLoggedLocation) {
            const dist = this.calculateDistance(
                this.lastLoggedLocation.latitude,
                this.lastLoggedLocation.longitude,
                coords.latitude,
                coords.longitude
            );

            // Filter GPS jitter (ignore tiny movements < 3m if accuracy is bad)
            // But strict accurate filter is better handled by `distanceInterval` in watcher.
            if (dist > 0.003) { // 3 meters
                this.emit('distance_moved', dist); // Emits KM (or meters, let's stick to km for standard)
                this.lastLoggedLocation = coords;
            }
        } else {
            this.lastLoggedLocation = coords;
        }
    }

    /**
     * Haversine formula to calculate distance in Kilometers
     */
    public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return d;
    }

    /**
     * Calculate bearing (0-360) from start to end coordinates
     */
    public calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const dLon = this.deg2rad(lon2 - lon1);
        const y = Math.sin(dLon) * Math.cos(this.deg2rad(lat2));
        const x = Math.cos(this.deg2rad(lat1)) * Math.sin(this.deg2rad(lat2)) -
            Math.sin(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.cos(dLon);

        let brng = Math.atan2(y, x);
        brng = brng * (180 / Math.PI); // degrees
        brng = (brng + 360) % 360; // normalize
        return brng;
    }

    /**
     * Check if user is within radius (meters) of a target
     */
    public isWithinRadius(targetLat: number, targetLon: number, radiusMeters: number): boolean {
        if (!this.currentLocation) return false;

        const distKm = this.calculateDistance(
            this.currentLocation.latitude,
            this.currentLocation.longitude,
            targetLat,
            targetLon
        );

        return (distKm * 1000) <= radiusMeters;
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}

export default LocationService.getInstance();

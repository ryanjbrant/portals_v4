import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import LocationService, { GeoCoordinate } from '../services/LocationService';

interface NavigationHUDProps {
    target: any; // Post
}

export const NavigationHUD: React.FC<NavigationHUDProps> = ({ target }) => {
    // Internal State for autonomy
    const [userLocation, setUserLocation] = useState<GeoCoordinate | null>(LocationService.getLastKnownLocation());
    const [distance, setDistance] = useState("Locating...");
    const [guidance, setGuidance] = useState({ text: "Locating...", icon: "compass-outline" });

    // Handle updates locally to avoid parent re-renders
    useEffect(() => {
        if (!target?.locations?.[0]) return;
        const targetLoc = target.locations[0];

        // Helper to update guidance text/icon based on heading
        const updateGuidance = (lat: number, lon: number, heading: number) => {
            const bearing = LocationService.calculateBearing(lat, lon, targetLoc.latitude, targetLoc.longitude);

            let diff = (bearing - heading);
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;

            if (Math.abs(diff) < 20) {
                setGuidance({ text: "Straight Ahead", icon: "arrow-up-circle" });
            } else if (diff < 0) {
                setGuidance({ text: "Turn Left", icon: "arrow-undo-circle" });
            } else {
                setGuidance({ text: "Turn Right", icon: "arrow-redo-circle" });
            }
        };

        const handleUpdate = (loc: GeoCoordinate) => {
            setUserLocation(loc);

            // 1. Calculate Distance
            const distKm = LocationService.calculateDistance(loc.latitude, loc.longitude, targetLoc.latitude, targetLoc.longitude);
            const distM = distKm * 1000;
            if (distM < 1000) setDistance(`${Math.round(distM)}m`);
            else setDistance(`${distKm.toFixed(1)}km`);

            updateGuidance(loc.latitude, loc.longitude, loc.heading || 0);
        };

        const handleHeadingUpdate = (heading: number) => {
            // Use the latest location from service cache to calculate new bearing with new heading
            const current = LocationService.getLastKnownLocation();
            if (current) {
                // Force a small state update to ensure MapView rotation updates if needed
                setUserLocation(prev => prev ? ({ ...prev, heading }) : null);
                updateGuidance(current.latitude, current.longitude, heading);
            }
        };

        // Initial check
        const initial = LocationService.getLastKnownLocation();
        if (initial) handleUpdate(initial);

        // Subscription
        const sub = LocationService.on('location_update', handleUpdate);
        const headSub = LocationService.on('heading_update', handleHeadingUpdate);

        return () => {
            if (sub?.off) sub.off('location_update', handleUpdate);
            else LocationService.removeListener('location_update', handleUpdate);

            if (headSub?.off) headSub.off('heading_update', handleHeadingUpdate);
            else LocationService.removeListener('heading_update', handleHeadingUpdate);
        };
    }, [target]);

    const targetLoc = target?.locations?.[0];
    if (!targetLoc) return null;

    // Default to a 0,0 coord or render loading state if userLocation is null
    const userLat = userLocation?.latitude || 0;
    const userLon = userLocation?.longitude || 0;

    return (
        <View style={styles.container}>
            {/* GLASS BACKGROUND */}
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="dark" style={StyleSheet.absoluteFill} />

            <View style={styles.content}>

                {/* LEFT: MINI MAP */}
                <View style={styles.mapContainer}>
                    <MapView
                        style={styles.map}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        rotateEnabled={true}
                        pitchEnabled={false}
                        camera={{
                            center: {
                                latitude: userLat,
                                longitude: userLon,
                            },
                            pitch: 0,
                            heading: userLocation?.heading || 0,
                            altitude: 200, // Zoom level approx
                            zoom: 17
                        }}
                    >
                        {/* Target Marker */}
                        <Marker
                            coordinate={{ latitude: targetLoc.latitude, longitude: targetLoc.longitude }}
                        >
                            <View style={styles.targetDot} />
                        </Marker>

                        {/* User Dot */}
                        <Marker
                            coordinate={{ latitude: userLat, longitude: userLon }}
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <View style={styles.userDot} />
                        </Marker>

                        {/* Line */}
                        <Polyline
                            coordinates={[
                                { latitude: userLat, longitude: userLon },
                                { latitude: targetLoc.latitude, longitude: targetLoc.longitude }
                            ]}
                            strokeColor={theme.colors.primary}
                            strokeWidth={3}
                            lineDashPattern={[5, 5]}
                        />
                    </MapView>
                </View>

                {/* RIGHT: INFO & GUIDANCE */}
                <View style={styles.infoContainer}>
                    {/* GUIDANCE BANNER */}
                    <View style={styles.guidanceRow}>
                        <Ionicons name={guidance.icon as any} size={28} color={theme.colors.warning} />
                        <Text style={styles.guidanceText}>{guidance.text}</Text>
                    </View>

                    {/* TARGET DETAILS */}
                    <View style={styles.detailsRow}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.targetName} numberOfLines={1}>{target.caption || "Unknown Target"}</Text>
                                {target.isArtifact && (
                                    <View style={styles.artifactBadge}>
                                        <Ionicons name="diamond" size={10} color={theme.colors.secondary} />
                                        <Text style={styles.artifactText}>Artifact</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.distanceText}>{distance} away</Text>
                        </View>
                        <View style={styles.fuelBadge}>
                            <Ionicons name="flame" size={14} color={theme.colors.warning} />
                            <Text style={styles.fuelText}>+{target.fuelReward || 100}</Text>
                        </View>
                    </View>
                </View>

            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        height: 140,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        padding: 12,
        gap: 16
    },
    mapContainer: {
        width: 100,
        height: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    map: {
        flex: 1,
    },
    targetDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: theme.colors.primary,
        borderWidth: 2,
        borderColor: 'white'
    },
    userDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4285F4',
        borderWidth: 2,
        borderColor: 'white'
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    guidanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,0,0.1)',
        padding: 8,
        borderRadius: 12,
        alignSelf: 'flex-start'
    },
    guidanceText: {
        color: theme.colors.warning,
        fontSize: 18,
        fontWeight: '800', // Black/UltraBold
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    targetName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
        maxWidth: 140
    },
    distanceText: {
        color: '#ccc',
        fontSize: 14,
        fontWeight: '500',
    },
    fuelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4
    },
    fuelText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    artifactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 193, 7, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 3,
    },
    artifactText: {
        fontSize: 10,
        fontWeight: '600',
        color: theme.colors.secondary,
    },
});

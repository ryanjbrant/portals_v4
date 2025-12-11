import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useAppStore } from '../store';
import * as Location from 'expo-location';
import { useState, useEffect, useRef } from 'react';

const DARK_MAP_STYLE = [
    {
        "elementType": "geometry",
        "stylers": [{ "color": "#212121" }]
    },
    {
        "elementType": "labels.icon",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#757575" }]
    },
    {
        "elementType": "labels.text.stroke",
        "stylers": [{ "color": "#212121" }]
    },
    {
        "featureType": "administrative",
        "elementType": "geometry",
        "stylers": [{ "color": "#757575" }]
    },
    {
        "featureType": "administrative.country",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#9e9e9e" }]
    },
    {
        "featureType": "administrative.land_parcel",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "administrative.locality",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#bdbdbd" }]
    },
    {
        "featureType": "poi",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#757575" }]
    },
    {
        "featureType": "poi.park",
        "elementType": "geometry",
        "stylers": [{ "color": "#181818" }]
    },
    {
        "featureType": "poi.park",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#616161" }]
    },
    {
        "featureType": "poi.park",
        "elementType": "labels.text.stroke",
        "stylers": [{ "color": "#1b1b1b" }]
    },
    {
        "featureType": "road",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#2c2c2c" }]
    },
    {
        "featureType": "road",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#8a8a8a" }]
    },
    {
        "featureType": "road.arterial",
        "elementType": "geometry",
        "stylers": [{ "color": "#373737" }]
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry",
        "stylers": [{ "color": "#3c3c3c" }]
    },
    {
        "featureType": "road.highway.controlled_access",
        "elementType": "geometry",
        "stylers": [{ "color": "#4e4e4e" }]
    },
    {
        "featureType": "road.local",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#616161" }]
    },
    {
        "featureType": "transit",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#757575" }]
    },
    {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [{ "color": "#000000" }]
    },
    {
        "featureType": "water",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#3d3d3d" }]
    }
];

export const MapScreen = () => {
    const feed = useAppStore(state => state.feed);
    const mapRef = useRef<MapView>(null);
    const postsWithLocation = feed.filter(p => p.locations && p.locations.length > 0);

    useEffect(() => {
        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                // Fast load
                let location = await Location.getLastKnownPositionAsync({});
                if (location) {
                    const userRegion = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    };
                    mapRef.current?.animateToRegion(userRegion, 1000);
                }

                // Precise load
                let currentLoc = await Location.getCurrentPositionAsync({});
                if (currentLoc) {
                    const userRegion = {
                        latitude: currentLoc.coords.latitude,
                        longitude: currentLoc.coords.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    };
                    mapRef.current?.animateToRegion(userRegion, 1000);
                }
            } catch (e) {
                console.log("Map Location Error", e);
            }
        })();
    }, []);

    const goToMyLocation = async () => {
        try {
            console.log("Requesting permissions...");
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "Enable location permissions in settings.");
                return;
            }

            console.log("Getting current position...");
            // Use Highest accuracy
            let currentLoc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest
            });

            console.log("Got location:", currentLoc);
            // Alert.alert("Debug", `Loc: ${currentLoc.coords.latitude.toFixed(4)}, ${currentLoc.coords.longitude.toFixed(4)}`);

            const userRegion = {
                latitude: currentLoc.coords.latitude,
                longitude: currentLoc.coords.longitude,
                latitudeDelta: 0.01, // Zoom in closer
                longitudeDelta: 0.01,
            };

            if (mapRef.current) {
                mapRef.current.animateToRegion(userRegion, 1000);
            } else {
                Alert.alert("Error", "Map not ready");
            }
        } catch (e) {
            console.log("Map Location Error", e);
            Alert.alert("Error", `Location failed: ${e}`);
        }
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                customMapStyle={DARK_MAP_STYLE}
                showsUserLocation
                initialRegion={{
                    latitude: 34.0522, // Default to Los Angeles
                    longitude: -118.2437,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                }}
            >
                {/* Meeting Spot Marker (Keep or Remove? Maybe keep as example event?) */}
                <Marker
                    coordinate={{ latitude: 37.78825, longitude: -122.4324 }}
                    title="Meeting Spot"
                    pinColor={theme.colors.warning}
                />

                {/* Post Markers */}
                {postsWithLocation.flatMap(post =>
                    post.locations!.map((loc, index) => (
                        <Marker
                            key={`${post.id}-${index}`}
                            coordinate={{
                                latitude: loc.latitude,
                                longitude: loc.longitude
                            }}
                            title={post.user.username}
                            description={post.caption}
                            pinColor={theme.colors.primary}
                        />
                    ))
                )}
            </MapView>

            <SafeAreaView style={styles.overlay} pointerEvents="box-none">
                <View style={styles.header}>
                    <Text style={styles.title}>Map</Text>
                    <View style={styles.fuelContainer}>
                        <Ionicons name="flame" size={16} color={theme.colors.warning} />
                        <Text style={styles.fuelText}>135</Text>
                    </View>
                    <TouchableOpacity>
                        <Ionicons name="scan" size={24} color={theme.colors.white} />
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }} pointerEvents="none" />

                <TouchableOpacity style={styles.myLocationButton} onPress={goToMyLocation}>
                    <Ionicons name="locate" size={24} color={theme.colors.white} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.directionsButton}>
                    <Text style={styles.directionsText}>Directions</Text>
                    <Ionicons name="navigate" size={20} color="black" />
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.m,
    },
    title: {
        ...theme.typography.h2,
        color: theme.colors.white,
    },
    fuelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    fuelText: {
        color: theme.colors.white,
        fontWeight: 'bold',
    },
    myLocationButton: {
        alignSelf: 'flex-end',
        marginRight: 16,
        marginBottom: 16,
        backgroundColor: 'rgba(50,50,50,0.8)',
        padding: 12,
        borderRadius: 30,
        elevation: 5,
    },
    directionsButton: {
        flexDirection: 'row',
        alignSelf: 'center',
        backgroundColor: theme.colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 30,
        marginBottom: 40, // Increased to account for tab bar if needed
        alignItems: 'center',
        gap: 8,
        elevation: 5,
    },
    directionsText: {
        color: 'black',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

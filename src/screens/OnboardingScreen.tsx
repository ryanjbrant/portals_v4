import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Key for persisting onboarding completion
const ONBOARDING_KEY = '@portals_onboarding_complete';

// Static logo
const portalsLogo = require('../../assets/logo/portals-logo.png');

interface OnboardingScreenProps {
    onComplete: () => void;
}

export const OnboardingScreen = ({ onComplete }: OnboardingScreenProps) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [permissionsGranted, setPermissionsGranted] = useState({
        camera: false,
        microphone: false,
        location: false,
    });

    const handleContinue = async () => {
        if (currentPage === 0) {
            setCurrentPage(1);
        } else {
            // Mark onboarding as complete
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            onComplete();
        }
    };

    const requestPermissions = async () => {
        try {
            // Request Camera
            const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
            const cameraGranted = cameraStatus === 'granted';

            // Request Microphone
            const { status: micStatus } = await Audio.requestPermissionsAsync();
            const micGranted = micStatus === 'granted';

            // Request Location
            const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
            const locationGranted = locationStatus === 'granted';

            setPermissionsGranted({
                camera: cameraGranted,
                microphone: micGranted,
                location: locationGranted,
            });

            // All granted? Auto-continue
            if (cameraGranted && micGranted && locationGranted) {
                await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
                onComplete();
            } else {
                Alert.alert(
                    'Permissions Required',
                    'Some permissions were denied. You can enable them later in Settings.',
                    [{ text: 'Continue Anyway', onPress: handleContinue }]
                );
            }
        } catch (error) {
            console.error('[Onboarding] Permission request failed:', error);
            handleContinue();
        }
    };

    // Page 1: Welcome / Features
    const WelcomePage = () => (
        <View style={styles.page}>
            {/* Hero Image/Logo */}
            <View style={styles.heroContainer}>
                <View style={styles.heroCircle}>
                    <Image source={portalsLogo} style={styles.heroImage} resizeMode="contain" />
                </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>Welcome to Portals</Text>

            {/* Feature Bullets */}
            <View style={styles.featureList}>
                <View style={styles.featureItem}>
                    <View style={styles.featureIcon}>
                        <Ionicons name="globe-outline" size={28} color={theme.colors.white} />
                    </View>
                    <View style={styles.featureText}>
                        <Text style={styles.featureTitle}>Explore AR Worlds</Text>
                        <Text style={styles.featureDescription}>
                            Discover augmented reality experiences created by artists and creators around you.
                        </Text>
                    </View>
                </View>

                <View style={styles.featureItem}>
                    <View style={styles.featureIcon}>
                        <Ionicons name="sparkles-outline" size={28} color={theme.colors.white} />
                    </View>
                    <View style={styles.featureText}>
                        <Text style={styles.featureTitle}>Create Immersive Content</Text>
                        <Text style={styles.featureDescription}>
                            Build your own AR scenes with 3D objects, effects, and AI-powered tools.
                        </Text>
                    </View>
                </View>

                <View style={styles.featureItem}>
                    <View style={styles.featureIcon}>
                        <Ionicons name="flame-outline" size={28} color={theme.colors.warning} />
                    </View>
                    <View style={styles.featureText}>
                        <Text style={styles.featureTitle}>Earn FUEL Rewards</Text>
                        <Text style={styles.featureDescription}>
                            Move, explore, and engage to earn FUEL tokens and unlock exclusive content.
                        </Text>
                    </View>
                </View>
            </View>

            {/* CTA Button */}
            <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
                <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
        </View>
    );

    // Page 2: Permissions
    const PermissionsPage = () => (
        <View style={styles.page}>
            {/* Hero */}
            <View style={styles.heroContainer}>
                <View style={[styles.heroCircle, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <Ionicons name="camera" size={64} color={theme.colors.white} />
                </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>Enable Permissions</Text>
            <Text style={styles.subtitle}>
                Portals needs access to your camera, microphone, and location to provide the full AR experience.
            </Text>

            {/* Permission Items */}
            <View style={styles.permissionList}>
                <View style={styles.permissionItem}>
                    <View style={[styles.permissionIcon, permissionsGranted.camera && styles.permissionGranted]}>
                        <Ionicons
                            name={permissionsGranted.camera ? "checkmark" : "camera-outline"}
                            size={24}
                            color={permissionsGranted.camera ? theme.colors.success : theme.colors.white}
                        />
                    </View>
                    <View style={styles.permissionText}>
                        <Text style={styles.permissionTitle}>Camera</Text>
                        <Text style={styles.permissionDescription}>
                            View and create AR experiences
                        </Text>
                    </View>
                </View>

                <View style={styles.permissionItem}>
                    <View style={[styles.permissionIcon, permissionsGranted.microphone && styles.permissionGranted]}>
                        <Ionicons
                            name={permissionsGranted.microphone ? "checkmark" : "mic-outline"}
                            size={24}
                            color={permissionsGranted.microphone ? theme.colors.success : theme.colors.white}
                        />
                    </View>
                    <View style={styles.permissionText}>
                        <Text style={styles.permissionTitle}>Microphone</Text>
                        <Text style={styles.permissionDescription}>
                            Record audio for your creations
                        </Text>
                    </View>
                </View>

                <View style={styles.permissionItem}>
                    <View style={[styles.permissionIcon, permissionsGranted.location && styles.permissionGranted]}>
                        <Ionicons
                            name={permissionsGranted.location ? "checkmark" : "location-outline"}
                            size={24}
                            color={permissionsGranted.location ? theme.colors.success : theme.colors.white}
                        />
                    </View>
                    <View style={styles.permissionText}>
                        <Text style={styles.permissionTitle}>Location</Text>
                        <Text style={styles.permissionDescription}>
                            Discover nearby content and earn FUEL
                        </Text>
                    </View>
                </View>
            </View>

            {/* CTA Button */}
            <TouchableOpacity style={styles.primaryButton} onPress={requestPermissions}>
                <Text style={styles.primaryButtonText}>Enable Access</Text>
            </TouchableOpacity>

            {/* Skip Option */}
            <TouchableOpacity style={styles.skipButton} onPress={handleContinue}>
                <Text style={styles.skipButtonText}>Skip for Now</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <AnimatedBackground />
            <SafeAreaView style={styles.safeArea}>
                {currentPage === 0 ? <WelcomePage /> : <PermissionsPage />}

                {/* Page Indicator */}
                <View style={styles.pageIndicator}>
                    <View style={[styles.dot, currentPage === 0 && styles.dotActive]} />
                    <View style={[styles.dot, currentPage === 1 && styles.dotActive]} />
                </View>
            </SafeAreaView>
        </View>
    );
};

// Helper to check if onboarding is complete
export const checkOnboardingComplete = async (): Promise<boolean> => {
    try {
        const value = await AsyncStorage.getItem(ONBOARDING_KEY);
        console.log('[Onboarding] Check complete:', value);
        return value === 'true';
    } catch {
        return false;
    }
};

// Helper to reset onboarding (for testing)
export const resetOnboarding = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(ONBOARDING_KEY);
        console.log('[Onboarding] Reset complete - will show on next launch');
    } catch (e) {
        console.error('[Onboarding] Reset failed:', e);
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    safeArea: {
        flex: 1,
    },
    page: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    heroContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    heroCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    heroImage: {
        width: 120,
        height: 120,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.colors.white,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.textDim,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    featureList: {
        marginBottom: 40,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.white,
        marginBottom: 4,
    },
    featureDescription: {
        fontSize: 14,
        color: theme.colors.textDim,
        lineHeight: 20,
    },
    permissionList: {
        marginBottom: 32,
    },
    permissionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    permissionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    permissionGranted: {
        backgroundColor: 'rgba(46, 204, 113, 0.2)',
        borderWidth: 1,
        borderColor: theme.colors.success,
    },
    permissionText: {
        flex: 1,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.white,
        marginBottom: 2,
    },
    permissionDescription: {
        fontSize: 13,
        color: theme.colors.textDim,
    },
    primaryButton: {
        backgroundColor: theme.colors.white,
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
        marginHorizontal: 20,
    },
    primaryButtonText: {
        color: theme.colors.background,
        fontSize: 17,
        fontWeight: '600',
    },
    skipButton: {
        marginTop: 16,
        alignItems: 'center',
    },
    skipButtonText: {
        color: theme.colors.textDim,
        fontSize: 15,
    },
    pageIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingBottom: 32,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    dotActive: {
        backgroundColor: theme.colors.white,
        width: 24,
    },
});

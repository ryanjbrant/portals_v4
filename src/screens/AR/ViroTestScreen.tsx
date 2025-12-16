import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme/theme';

/**
 * Simple ViroReact test screen.
 * ViroReact is only loaded when user presses "Start AR"
 * to avoid native module initialization at app startup.
 */
export const ViroTestScreen = () => {
    const navigation = useNavigation<any>();
    const [showAR, setShowAR] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ViroComponent, setViroComponent] = useState<React.ComponentType<any> | null>(null);

    const loadViroReact = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Dynamically require ViroReact only when user clicks
            const viro = require('@reactvision/react-viro');

            // Create a simple scene component
            const SimpleARScene = () => {
                const { ViroARScene, ViroText, ViroAmbientLight } = viro;

                return (
                    <ViroARScene>
                        <ViroAmbientLight color="#ffffff" intensity={200} />
                        <ViroText
                            text="Hello AR!"
                            position={[0, 0, -2]}
                            style={{ fontSize: 30, color: '#ffffff' }}
                        />
                    </ViroARScene>
                );
            };

            // Create navigator component
            const ARNavigator = () => {
                const { ViroARSceneNavigator } = viro;
                return (
                    <ViroARSceneNavigator
                        initialScene={{ scene: SimpleARScene }}
                        style={{ flex: 1 }}
                    />
                );
            };

            setViroComponent(() => ARNavigator);
            setShowAR(true);
        } catch (e: any) {
            console.error('[ViroTest] Failed to load ViroReact:', e);
            setError(e.message || 'Failed to load AR');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const stopAR = useCallback(() => {
        setShowAR(false);
        setViroComponent(null);
    }, []);

    // Show AR view
    if (showAR && ViroComponent) {
        return (
            <View style={styles.container}>
                <ViroComponent />
                <SafeAreaView style={styles.overlay}>
                    <TouchableOpacity style={styles.closeButton} onPress={stopAR}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                </SafeAreaView>
            </View>
        );
    }

    // Show start screen
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Ionicons name="cube-outline" size={80} color={theme.colors.primary} />
                <Text style={styles.title}>ViroReact Test</Text>
                <Text style={styles.subtitle}>
                    Test AR functionality in isolation
                </Text>

                {error && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.startButton}
                    onPress={loadViroReact}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="black" />
                    ) : (
                        <>
                            <Ionicons name="play" size={24} color="black" />
                            <Text style={styles.buttonText}>Start AR</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 24,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.textDim,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 40,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '600',
        color: 'black',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: 16,
    },
    closeButton: {
        alignSelf: 'flex-start',
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    errorBox: {
        backgroundColor: 'rgba(255,0,0,0.1)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
        maxWidth: 300,
    },
    errorText: {
        color: '#FF3B30',
        textAlign: 'center',
    },
});

export default ViroTestScreen;

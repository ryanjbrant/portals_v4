/**
 * VoiceComposerButton.js
 * Floating mic button for voice-controlled scene composition
 * Press-and-hold to record, release to process
 */

import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    TouchableOpacity,
    Text,
    StyleSheet,
    Animated,
    Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AISceneComposer } from '../../../services/aiSceneComposer';

const VoiceComposerButton = ({
    onActionsReceived, // Callback with actions array
    sceneContext, // { objectCount, selectedUuid, objectNames }
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');

    // Animation values
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const pulseLoop = useRef(null);

    // Start pulsing animation
    const startPulseAnimation = useCallback(() => {
        pulseLoop.current = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.3,
                    duration: 600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        pulseLoop.current.start();

        // Glow in
        Animated.timing(glowAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [pulseAnim, glowAnim]);

    // Stop pulsing animation
    const stopPulseAnimation = useCallback(() => {
        if (pulseLoop.current) {
            pulseLoop.current.stop();
        }
        pulseAnim.setValue(1);

        // Glow out
        Animated.timing(glowAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [pulseAnim, glowAnim]);

    // Handle press in - start recording
    const handlePressIn = async () => {
        console.log('[VoiceComposerButton] Press In - Starting recording');
        setIsRecording(true);
        setStatusText('Listening...');
        startPulseAnimation();

        const started = await AISceneComposer.startRecording((metering) => {
            // Optional: Use metering for visual feedback
        });

        if (!started) {
            setIsRecording(false);
            setStatusText('Mic permission denied');
            stopPulseAnimation();
        }
    };

    // Handle press out - stop and process
    const handlePressOut = async () => {
        if (!isRecording) return;

        console.log('[VoiceComposerButton] Press Out - Processing');
        setIsRecording(false);
        setIsProcessing(true);
        setStatusText('Processing...');
        stopPulseAnimation();

        try {
            const result = await AISceneComposer.stopAndProcess(sceneContext);

            console.log('[VoiceComposerButton] Result:', result);

            if (result.success && result.actions.length > 0) {
                setStatusText(result.message);
                onActionsReceived?.(result.actions);
            } else {
                setStatusText(result.message || 'No actions');
            }
        } catch (error) {
            console.error('[VoiceComposerButton] Error:', error);
            setStatusText('Error');
        }

        // Clear status after delay
        setTimeout(() => {
            setIsProcessing(false);
            setStatusText('');
        }, 2000);
    };

    return (
        <View style={styles.container}>
            {/* Status text above button */}
            {(isRecording || isProcessing || statusText) && (
                <View style={styles.statusContainer}>
                    <Text style={styles.statusText}>
                        {statusText}
                    </Text>
                </View>
            )}

            {/* Animated glow ring */}
            <Animated.View
                style={[
                    styles.glowRing,
                    {
                        opacity: glowAnim,
                        transform: [{ scale: pulseAnim }],
                    },
                ]}
            />

            {/* Mic button */}
            <TouchableOpacity
                style={[
                    styles.button,
                    isRecording && styles.buttonRecording,
                    isProcessing && styles.buttonProcessing,
                ]}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.8}
            >
                <Ionicons
                    name="mic"
                    size={24}
                    color={isRecording ? 'white' : 'black'}
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusContainer: {
        position: 'absolute',
        bottom: 60,
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        maxWidth: 200,
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
    glowRing: {
        position: 'absolute',
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 48, 80, 0.3)',
    },
    button: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    buttonRecording: {
        backgroundColor: '#FF3050',
    },
    buttonProcessing: {
        backgroundColor: '#FFD60A',
    },
});

export default VoiceComposerButton;

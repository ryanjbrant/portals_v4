import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Dimensions, Animated, Easing, Alert } from 'react-native';
import { VoiceService } from '../services/voice';
import { useAppStore } from '../store';

const { width } = Dimensions.get('window');

interface VoiceOverlayProps {
    visible: boolean;
    statusText?: string;
    navigationRef?: any;
}

export const VoiceOverlay = ({ visible, statusText = "Listening...", navigationRef }: VoiceOverlayProps) => {
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(0)).current; // Start hidden

    const { voiceContext, toggleLike, setPendingComment } = useAppStore();
    const [transcription, setTranscription] = useState("");

    useEffect(() => {
        if (visible) {
            startSession();
        } else {
            // If it becomes invisible, we stop. 
            // However, usually invisibility is triggered BY the stop. 
            // If the user lifts finger, current flow in BottomTabNavigator sets isVoiceActive=false.
            // We should treat visible=false as "User let go, stop and process".

            // NOTE: We only stop if we were actually recording.
            // But checking internal state inside effect is tricky.
            // We rely on stopAndProcess checking execution.
            stopAndProcess();
        }
    }, [visible]);

    const startSession = async () => {
        setTranscription("");

        // Show Overlay
        Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true
        }).start();

        // Pulsing Animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(scale, {
                    toValue: 1.5,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: true
                }),
                Animated.timing(scale, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: true
                })
            ])
        ).start();

        console.log('[VoiceOverlay] Starting Recording...');
        await VoiceService.startRecording((metering) => {
            // Optional: Use metering for animation power
        });
    };

    const stopAndProcess = async () => {
        // Stop Animation
        scale.stopAnimation();
        scale.setValue(1);

        // We do NOT hide immediately, we wait for processing result to show text?
        // Actually, let's keep it visible while processing, then hide after delay.

        if (!VoiceService.audioRecorder) {
            // Not recording, maybe already processed or never started
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
            return;
        }

        console.log('[VoiceOverlay] Stopping Recording...');
        setTranscription("Processing...");

        try {
            const uri = await VoiceService.stopRecording();
            await handleProcessing(uri);
        } catch (e) {
            console.error("Error stopping/processing:", e);
            setTranscription("Error.");
        }

        // Hide after short delay to show result
        setTimeout(() => {
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }, 200);
    };

    const handleProcessing = async (uri: string | null) => {
        try {
            console.log(`[VoiceOverlay] Processing with context: ${JSON.stringify(voiceContext)}`);

            // Timeout safety
            const resultPromise = VoiceService.processCommand(uri, voiceContext);
            const timeoutPromise = new Promise<{ action: string, text: string }>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 10000)
            );

            const result = await Promise.race([resultPromise, timeoutPromise]) as any;

            console.log("[VoiceOverlay] Result:", result);

            if (result.action === 'navigate' && result.params) {
                const nav = navigationRef?.current || navigationRef;
                if (nav && nav.navigate) {
                    nav.navigate(result.params.screen, result.params.params);
                    setTranscription(result.text || "Navigating...");
                } else {
                    console.warn("Navigation Ref unavailable");
                    setTranscription("Navigation failed.");
                }
            }
            else if (result.action === 'like_post' && result.params?.id) {
                await toggleLike(result.params.id);
                setTranscription("Liked!");
            }
            else if (result.action === 'add_comment') {
                // Handle different param shapes just in case
                const id = result.params?.id || result.params?.postId;
                const text = result.params?.text || result.params?.comment;

                if (id && text) {
                    // Set pending comment to open comment sheet with pre-filled text
                    setPendingComment({ postId: id, text });
                    setTranscription("Opening comments...");
                } else {
                    setTranscription("Couldn't add comment.");
                }
            }
            else {
                setTranscription(result.text || "Done.");
            }
        } catch (e) {
            console.error("Error processing voice command:", e);
            setTranscription("Error.");
        }
    };

    // Optimization removed to avoid private property access
    // if (!visible && (opacity as any)._value === 0) return null;
    // Optimization: if strictly not visible and opacity is 0, don't render. 
    // But opacity is animated. We can rely on pointerEvents or zIndex?
    // Start with pointerEvents.

    return (
        <Animated.View style={[styles.container, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
            {/* Reactive Circle */}
            <Animated.View style={[styles.circle, {
                transform: [{ scale }],
                opacity // Use animated opacity for the circle itself if needed, or container
            }]} />

            {/* Text */}
            <View style={styles.textContainer}>
                <Text style={styles.text}>{transcription || statusText}</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 100,
    },
    circle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(0,0,0,0.1)',
        position: 'absolute',
    },
    textContainer: {
        marginTop: 100,
        height: 40,
        paddingHorizontal: 20
    },
    text: {
        fontSize: 24,
        fontWeight: '300',
        color: '#333',
        textAlign: 'center',
    }
});

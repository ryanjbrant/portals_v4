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
    // const navigation = useNavigation<any>(); // Removed


    const { voiceContext, toggleLike, addComment } = useAppStore();
    const [transcription, setTranscription] = useState("");

    const stopAndProcess = async () => {
        try {
            // Stop any ongoing scale animation
            scale.stopAnimation();
            scale.setValue(1); // Reset scale
            opacity.setValue(0); // Hide overlay

            setTranscription("Processing..."); // Give feedback
            const uri = await VoiceService.stopRecording();
            await handleProcessing(uri);
        } catch (e) {
            console.error("Error stopping recording or processing:", e);
            setTranscription("Error processing voice.");
        }
    };

    // ... (useEffect remains same until handleProcessing) ...

    const handleProcessing = async (uri: string | null) => {
        try {
            const result = await VoiceService.processCommand(uri, voiceContext);

            console.log("Voice Processing Complete", result);

            if (result.action === 'navigate' && result.params) {
                const nav = navigationRef?.current || navigationRef;
                if (nav && nav.navigate) {
                    nav.navigate(result.params.screen, result.params.params);
                } else {
                    console.warn("Navigation Ref unavailable");
                }
            }
            else if (result.action === 'like_post' && result.params?.id) {
                await toggleLike(result.params.id);
                setTranscription("Liked!");
            }
            else if (result.action === 'add_comment' && result.params?.id && result.params?.text) {
                await addComment(result.params.id, result.params.text);
                setTranscription("Comment added!");
            }
            else {
                console.log("Voice Result:", result.text);
                setTranscription(result.text || "Command processed.");
            }
        } catch (e) {
            console.error("Error processing voice command:", e);
            Alert.alert("Error", "Failed to process voice command.");
            setTranscription("Error processing voice.");
        }
    };

    if (!visible) return null;

    return (
        <View style={styles.container}>
            {/* Reactive Circle */}
            <Animated.View style={[styles.circle, {
                transform: [{ scale }],
                opacity
            }]} />

            {/* Core */}
            <View style={styles.core} />

            {/* Text */}
            <View style={styles.textContainer}>
                <Text style={styles.text}>{transcription || statusText}</Text>
            </View>
        </View>
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
    core: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    textContainer: {
        marginTop: 100,
        height: 40, // Fixed height to prevent jump
    },
    text: {
        fontSize: 24,
        fontWeight: '300',
        color: '#333',
        textAlign: 'center',
    }
});

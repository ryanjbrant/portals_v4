/**
 * WorldCaptureOverlay - Overlay for capturing world screenshot
 * 
 * Hides all UI and provides:
 * - Capture button to take screenshot
 * - Preview with Confirm/Retake options
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

const WorldCaptureOverlay = ({
    visible,
    onCapture,
    onConfirm,
    onRetake,
    onCancel,
    capturedImage,
}) => {
    const [isCapturing, setIsCapturing] = useState(false);

    if (!visible) return null;

    const handleCapture = async () => {
        setIsCapturing(true);
        try {
            await onCapture();
        } finally {
            setIsCapturing(false);
        }
    };

    // Preview mode - show captured image with confirm/retake
    if (capturedImage) {
        return (
            <View style={styles.container}>
                <Image source={{ uri: capturedImage }} style={styles.preview} resizeMode="cover" />

                <View style={styles.previewOverlay}>
                    <Text style={styles.previewTitle}>Your World Preview</Text>
                    <Text style={styles.previewSubtitle}>This will be your profile background</Text>

                    <View style={styles.previewButtons}>
                        <TouchableOpacity style={styles.retakeButton} onPress={onRetake}>
                            <Ionicons name="refresh" size={24} color="#fff" />
                            <Text style={styles.retakeText}>Retake</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
                            <Ionicons name="checkmark" size={24} color="#000" />
                            <Text style={styles.confirmText}>Use This</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    // Capture mode - show capture button
    return (
        <View style={styles.captureContainer}>
            {/* Semi-transparent top bar with cancel */}
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.topBarTitle}>Capture Your World</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Instructions */}
            <View style={styles.instructions}>
                <Text style={styles.instructionText}>
                    Position your world, then tap capture
                </Text>
            </View>

            {/* Capture button at bottom */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
                    onPress={handleCapture}
                    disabled={isCapturing}
                >
                    <View style={styles.captureButtonInner}>
                        {isCapturing ? (
                            <Text style={styles.capturingText}>•••</Text>
                        ) : (
                            <Ionicons name="camera" size={32} color="#000" />
                        )}
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 9999,
    },
    captureContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    cancelButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topBarTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    instructions: {
        position: 'absolute',
        top: 140,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    instructionText: {
        color: '#fff',
        fontSize: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        overflow: 'hidden',
    },
    bottomBar: {
        alignItems: 'center',
        paddingBottom: 60,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingTop: 20,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    captureButtonDisabled: {
        opacity: 0.5,
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFD60A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    capturingText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
    },
    preview: {
        width: width,
        height: height,
    },
    previewOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingTop: 30,
        paddingBottom: 50,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    previewTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
    },
    previewSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginBottom: 30,
    },
    previewButtons: {
        flexDirection: 'row',
        gap: 16,
    },
    retakeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 8,
    },
    retakeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFD60A',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        gap: 8,
    },
    confirmText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default WorldCaptureOverlay;

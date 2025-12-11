import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getScene } from '../../api/client';
import { sendMessageToWebView } from '../../bridges/NeedleBridge';

import { EditorContent } from '../Composer/EditorContent';

export const ARViewerScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { sceneId } = route.params || {};
    const webviewRef = useRef<WebView>(null);

    useEffect(() => {
        if (sceneId) {
            loadScene(sceneId);
        }
    }, [sceneId]);

    const loadScene = async (id: string) => {
        try {
            const scene = await getScene(id);
            // Wait for WebView to be ready? We can just try sending after a delay or wait for 'viewer-ready'
            setTimeout(() => {
                sendMessageToWebView(webviewRef, {
                    type: 'load-scene',
                    scene: scene
                });
            }, 1000);
        } catch (e) {
            console.error("Failed to load scene", e);
        }
    };

    return (
        <View style={styles.container}>
            <WebView
                ref={webviewRef}
                style={{ flex: 1, backgroundColor: 'transparent' }} // Transparent for AR camera passthrough if natively supported
                source={{ html: EditorContent }} // Reuse the same engine shell
                originWhitelist={['*']}
                javaScriptEnabled
            />

            <SafeAreaView style={styles.overlay} pointerEvents="box-none">
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>

                <View style={styles.instructionContainer}>
                    <Text style={styles.instructionText}>Move phone to find surface</Text>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', padding: 16 },
    closeButton: { alignSelf: 'flex-start', padding: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
    instructionContainer: { alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 8, marginBottom: 40 },
    instructionText: { color: 'white' }
});

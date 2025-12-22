/**
 * AI Enhancement Panel
 * Sliding panel with tabs for adding reference assets and entering prompts
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Image,
    Animated,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Keyboard,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../theme/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = 400;

interface AIEnhancePanelProps {
    visible: boolean;
    onClose: () => void;
    onGenerate: (prompt: string, assets: string[]) => void;
    isGenerating?: boolean;
    hasExistingGeneration?: boolean;
}

export const AIEnhancePanel: React.FC<AIEnhancePanelProps> = ({
    visible,
    onClose,
    onGenerate,
    isGenerating = false,
    hasExistingGeneration = false,
}) => {
    const [activeTab, setActiveTab] = useState<'assets' | 'prompt'>('prompt');
    const [prompt, setPrompt] = useState('');
    const [assets, setAssets] = useState<string[]>([]);
    const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;

    // Handle panel slide animation
    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 0 : PANEL_HEIGHT,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    }, [visible]);

    // Handle keyboard events - lift panel when keyboard opens
    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                Animated.timing(keyboardOffset, {
                    toValue: -e.endCoordinates.height,
                    duration: Platform.OS === 'ios' ? e.duration : 250,
                    useNativeDriver: true,
                }).start();
            }
        );

        const keyboardWillHide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            (e) => {
                Animated.timing(keyboardOffset, {
                    toValue: 0,
                    duration: Platform.OS === 'ios' ? (e?.duration || 250) : 250,
                    useNativeDriver: true,
                }).start();
            }
        );

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    const pickImage = async (index: number) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const newAssets = [...assets];
            newAssets[index] = result.assets[0].uri;
            setAssets(newAssets);
        }
    };

    const removeAsset = (index: number) => {
        const newAssets = [...assets];
        newAssets.splice(index, 1);
        setAssets(newAssets);
    };

    const handleGenerate = () => {
        if (prompt.trim()) {
            onGenerate(prompt.trim(), assets.filter(Boolean));
        }
    };

    const canGenerate = prompt.trim().length > 0;

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }, { translateY: keyboardOffset }] },
            ]}
        >
            <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
                {/* Handle bar */}
                <View style={styles.handleBar} />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.title}>
                        {hasExistingGeneration ? 'Edit Generation' : 'Enhance with AI'}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Prompt Input (no tabs - Decart uses prompt only) */}
                <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={styles.promptContainer}>
                        <TextInput
                            style={styles.promptInput}
                            placeholder="Describe the transformation you want..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            multiline
                            value={prompt}
                            onChangeText={setPrompt}
                        />
                        <Text style={styles.promptHint}>
                            Describe the style, mood, or transformation you want applied to your video.
                        </Text>
                    </View>
                </ScrollView>

                {/* Generate Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.generateButton,
                            !canGenerate && styles.generateButtonDisabled,
                        ]}
                        onPress={handleGenerate}
                        disabled={!canGenerate || isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <ActivityIndicator color="black" size="small" />
                                <Text style={styles.generateButtonText}>Generating...</Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="sparkles" size={20} color="black" />
                                <Text style={styles.generateButtonText}>
                                    {hasExistingGeneration ? 'Regenerate' : 'Generate'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: PANEL_HEIGHT,
    },
    blurContainer: {
        flex: 1,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    handleBar: {
        width: 36,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 3,
        alignSelf: 'center',
        marginTop: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: 'white',
    },
    tabs: {
        flexDirection: 'row',
        marginHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    activeTab: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.5)',
    },
    activeTabText: {
        color: theme.colors.primary,
    },
    assetBadge: {
        backgroundColor: theme.colors.primary,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 4,
    },
    assetBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: 'black',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    promptContainer: {
        flex: 1,
    },
    promptInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        color: 'white',
        fontSize: 16,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    promptHint: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 12,
        lineHeight: 18,
    },
    assetsContainer: {
        flex: 1,
    },
    assetsHint: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 16,
    },
    assetsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    assetSlot: {
        width: '47%',
        aspectRatio: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    assetSlotText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
    },
    assetImage: {
        width: '100%',
        height: '100%',
    },
    removeButton: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    footer: {
        padding: 16,
        paddingBottom: 32,
    },
    generateButton: {
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
    },
    generateButtonDisabled: {
        opacity: 0.5,
    },
    generateButtonText: {
        fontSize: 17,
        fontWeight: '600',
        color: 'black',
    },
});

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '../../theme/theme';

interface Props {
    visible: boolean;
    onClose: () => void;
    onUpdateMaterial: (key: string, value: any) => void;
    onUpdateAnimation: (type: string, params: any, active: boolean) => void;
}

const ANIMATION_TYPES = ['bounce', 'pulse', 'rotate', 'scale', 'wiggle', 'random'];
const { height } = Dimensions.get('window');
const PANEL_HEIGHT = height * 0.55;

export const ObjectPropertiesPanel = ({ visible, onClose, onUpdateMaterial, onUpdateAnimation }: Props) => {
    const [activeTab, setActiveTab] = useState<'material' | 'animation'>('material');
    const [animations, setAnimations] = useState<{ [key: string]: { active: boolean, intensity: number } }>({});

    // Animation Driver
    const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                damping: 20,
                stiffness: 90
            }).start();
        } else {
            Animated.timing(translateY, {
                toValue: PANEL_HEIGHT,
                duration: 250,
                useNativeDriver: true
            }).start();
        }
    }, [visible]);

    const handlePickImage = async (type: 'mapUri' | 'normalMapUri' | 'roughnessMapUri') => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
        if (!result.canceled && result.assets[0].uri) {
            const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'base64' });
            const uri = `data:image/jpeg;base64,${base64}`;
            onUpdateMaterial(type, uri);
        }
    };

    const toggleAnimation = (type: string) => {
        const current = animations[type] || { active: false, intensity: 1.0 };
        const newState = { ...current, active: !current.active };
        setAnimations({ ...animations, [type]: newState });
        onUpdateAnimation(type, { intensity: newState.intensity }, newState.active);
    };

    const updateIntensity = (type: string, intensity: number) => {
        const current = animations[type] || { active: false, intensity: 1.0 };
        if (!current.active) return;

        const newState = { ...current, intensity };
        setAnimations({ ...animations, [type]: newState });
        onUpdateAnimation(type, { intensity }, true);
    };

    const renderSegmentedControl = () => (
        <View style={styles.segmentContainer}>
            <TouchableOpacity
                style={[styles.segmentBtn, activeTab === 'material' && styles.segmentBtnActive]}
                onPress={() => setActiveTab('material')}
            >
                <Text style={[styles.segmentText, activeTab === 'material' && styles.segmentTextActive]}>Material</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.segmentBtn, activeTab === 'animation' && styles.segmentBtnActive]}
                onPress={() => setActiveTab('animation')}
            >
                <Text style={[styles.segmentText, activeTab === 'animation' && styles.segmentTextActive]}>Animation</Text>
            </TouchableOpacity>
        </View>
    );

    // If not visible and animation finished, we could return null, but for this simple slide
    // we just keep it rendered off-screen or rely on pointerEvents.
    // However, to prevent unintended touches when "closed" (but rendered), we can check visibility for pointerEvents.

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY }] },
            ]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />

            {/* Handle Bar */}
            <View style={styles.handleBarContainer}>
                <View style={styles.handleBar} />
            </View>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>PROPERTIES</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            {renderSegmentedControl()}

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {activeTab === 'material' ? (
                    <View style={styles.section}>
                        <Text style={styles.label}>BASE COLOR</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorRow}>
                            {['#FFFFFF', '#FF3B30', '#34C759', '#007AFF', '#FFD60A', '#AF52DE', '#000000'].map(c => (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.colorSwatch, { backgroundColor: c }]}
                                    onPress={() => onUpdateMaterial('color', c)}
                                />
                            ))}
                        </ScrollView>

                        <Text style={[styles.label, { marginTop: 24 }]}>TEXTURE MAPS</Text>
                        <View style={styles.textureGroup}>
                            {[
                                { label: 'Base Map', key: 'mapUri' },
                                { label: 'Normal Map', key: 'normalMapUri' },
                                { label: 'Roughness', key: 'roughnessMapUri' }
                            ].map((item, i) => (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.textureRow, i !== 2 && styles.textureRowBorder]}
                                    onPress={() => handlePickImage(item.key as any)}
                                >
                                    <Text style={styles.textureLabel}>{item.label}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.uploadText}>Select</Text>
                                        <Ionicons name="chevron-forward" size={16} color="#666" />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={styles.section}>
                        <Text style={styles.label}>ANIMATION LAYERS</Text>
                        {ANIMATION_TYPES.map((type, index) => {
                            const anim = animations[type] || { active: false, intensity: 1.0 };
                            return (
                                <View key={type} style={[styles.animRow, index !== ANIMATION_TYPES.length - 1 && styles.animRowBorder]}>
                                    <View style={styles.animHeader}>
                                        <Text style={styles.animTitle}>{type.toUpperCase()}</Text>
                                        <Switch
                                            value={anim.active}
                                            onValueChange={() => toggleAnimation(type)}
                                            trackColor={{ false: '#333', true: theme.colors.primary }}
                                            ios_backgroundColor="#333"
                                        />
                                    </View>

                                    {anim.active && (
                                        <View style={styles.intensityContainer}>
                                            <Text style={styles.intensityLabel}>Intensity</Text>
                                            <View style={styles.pillContainer}>
                                                {[0.5, 1.0, 2.0].map(val => (
                                                    <TouchableOpacity
                                                        key={val}
                                                        style={[styles.pill, anim.intensity === val && styles.pillActive]}
                                                        onPress={() => updateIntensity(type, val)}
                                                    >
                                                        <Text style={[styles.pillText, anim.intensity === val && styles.pillTextActive]}>{val}x</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
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
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        // Shadow for separation
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    handleBarContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
    handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16
    },
    headerTitle: { color: 'white', fontSize: 13, fontWeight: '700', opacity: 0.7, letterSpacing: 1 },
    closeButton: { padding: 4 },

    // Segmented Control
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(118, 118, 128, 0.24)',
        marginHorizontal: 16,
        padding: 2,
        borderRadius: 9,
        marginBottom: 20
    },
    segmentBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 7 },
    segmentBtnActive: { backgroundColor: '#636366' }, // Use a lighter gray or theme color
    segmentText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },
    segmentTextActive: { color: 'white', fontWeight: '600' },

    content: { flex: 1, paddingHorizontal: 20 },
    section: { marginBottom: 20 },
    label: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 },

    // Color Swatches
    colorRow: { flexDirection: 'row', marginBottom: 8 },
    colorSwatch: { width: 36, height: 36, borderRadius: 18, marginRight: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },

    // Upload Rows
    textureGroup: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden'
    },
    textureRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    textureRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    textureLabel: { color: 'white', fontSize: 15 },
    uploadText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginRight: 4 },

    // Animation List
    animRow: { paddingVertical: 12 },
    animRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    animHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    animTitle: { color: 'white', fontSize: 16, fontWeight: '500' },

    // Intensity Pills
    intensityContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, justifyContent: 'space-between' },
    intensityLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    pillContainer: { flexDirection: 'row', gap: 8 },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
    pillActive: { backgroundColor: theme.colors.primary },
    pillText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
    pillTextActive: { color: 'black' }
});

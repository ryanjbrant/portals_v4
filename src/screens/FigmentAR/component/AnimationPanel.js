/**
 * AnimationPanel.js
 * Animation controls panel for Figment AR objects
 * Adapted from Composer's ObjectPropertiesPanel animation tab
 */

import React, { Component } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const ANIMATION_TYPES = ['bounce', 'pulse', 'rotate', 'scale', 'wiggle', 'random'];
const { height } = Dimensions.get('window');
const PANEL_HEIGHT = height * 0.45;

class AnimationPanel extends Component {
    constructor(props) {
        super(props);
        this.translateY = new Animated.Value(PANEL_HEIGHT);
        this.state = {
            animations: props.currentAnimations || {},
        };
    }

    componentDidUpdate(prevProps) {
        // Handle visibility animation
        if (this.props.visible !== prevProps.visible) {
            if (this.props.visible) {
                Animated.spring(this.translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 20,
                    stiffness: 90,
                }).start();
            } else {
                Animated.timing(this.translateY, {
                    toValue: PANEL_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                }).start();
            }
        }

        // Sync animations when selected object changes
        if (this.props.currentAnimations !== prevProps.currentAnimations) {
            this.setState({ animations: this.props.currentAnimations || {} });
        }
    }

    toggleAnimation = (type) => {
        const current = this.state.animations[type] || { active: false, intensity: 1.0 };
        const newState = { ...current, active: !current.active };
        const newAnimations = { ...this.state.animations, [type]: newState };
        this.setState({ animations: newAnimations });
        this.props.onUpdateAnimation(type, { intensity: newState.intensity }, newState.active);
    };

    updateIntensity = (type, intensity) => {
        const current = this.state.animations[type] || { active: false, intensity: 1.0 };
        if (!current.active) return;

        const newState = { ...current, intensity };
        const newAnimations = { ...this.state.animations, [type]: newState };
        this.setState({ animations: newAnimations });
        this.props.onUpdateAnimation(type, { intensity }, true);
    };

    updateAxis = (type, axisKey) => {
        const current = this.state.animations[type] || {
            active: false,
            intensity: 1.0,
            axis: { x: false, y: true, z: false },
        };
        const currentAxis = current.axis || { x: false, y: true, z: false };
        const newAxis = { ...currentAxis, [axisKey]: !currentAxis[axisKey] };
        const newState = { ...current, axis: newAxis };
        const newAnimations = { ...this.state.animations, [type]: newState };
        this.setState({ animations: newAnimations });
        this.props.onUpdateAnimation(type, { intensity: current.intensity, axis: newAxis }, true);
    };

    renderAxisSelector = (type, currentAxis = { x: false, y: true, z: false }) => (
        <View style={styles.axisContainer}>
            <Text style={styles.intensityLabel}>Axes</Text>
            <View style={styles.pillContainer}>
                {['x', 'y', 'z'].map((key) => {
                    const isActive = currentAxis[key];
                    return (
                        <TouchableOpacity
                            key={key}
                            style={[styles.pill, isActive && styles.pillActive]}
                            onPress={() => this.updateAxis(type, key)}
                        >
                            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                                {key.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    render() {
        const { visible, onClose } = this.props;
        const { animations } = this.state;

        return (
            <Animated.View
                style={[styles.container, { transform: [{ translateY: this.translateY }] }]}
                pointerEvents={visible ? 'auto' : 'none'}
            >
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />

                {/* Handle Bar */}
                <View style={styles.handleBarContainer}>
                    <View style={styles.handleBar} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>ANIMATION</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.label}>ANIMATION LAYERS</Text>
                    {ANIMATION_TYPES.map((type, index) => {
                        const anim = animations[type] || {
                            active: false,
                            intensity: 1.0,
                            axis: { x: false, y: true, z: false },
                        };
                        return (
                            <View
                                key={type}
                                style={[
                                    styles.animRow,
                                    index !== ANIMATION_TYPES.length - 1 && styles.animRowBorder,
                                ]}
                            >
                                <View style={styles.animHeader}>
                                    <Text style={styles.animTitle}>{type.toUpperCase()}</Text>
                                    <Switch
                                        value={anim.active}
                                        onValueChange={() => this.toggleAnimation(type)}
                                        trackColor={{ false: '#333', true: '#FF3050' }}
                                        ios_backgroundColor="#333"
                                    />
                                </View>

                                {anim.active && (
                                    <View>
                                        <View style={styles.intensityContainer}>
                                            <Text style={styles.intensityLabel}>Intensity</Text>
                                            <View style={styles.pillContainer}>
                                                {[0.5, 1.0, 2.0].map((val) => (
                                                    <TouchableOpacity
                                                        key={val}
                                                        style={[styles.pill, anim.intensity === val && styles.pillActive]}
                                                        onPress={() => this.updateIntensity(type, val)}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.pillText,
                                                                anim.intensity === val && styles.pillTextActive,
                                                            ]}
                                                        >
                                                            {val}x
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>

                                        {/* Axis Selector for Rotation */}
                                        {type === 'rotate' && this.renderAxisSelector(type, anim.axis)}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            </Animated.View>
        );
    }
}

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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 1000,
    },
    handleBarContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerTitle: {
        color: 'white',
        fontSize: 13,
        fontWeight: '700',
        opacity: 0.7,
        letterSpacing: 1,
    },
    closeButton: { padding: 4 },
    content: { flex: 1, paddingHorizontal: 20 },
    label: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    animRow: { paddingVertical: 12 },
    animRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    animHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    animTitle: { color: 'white', fontSize: 16, fontWeight: '500' },
    intensityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        justifyContent: 'space-between',
    },
    intensityLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    pillContainer: { flexDirection: 'row', gap: 8 },
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    pillActive: { backgroundColor: '#FF3050' },
    pillText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
    pillTextActive: { color: 'white' },
    axisContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        justifyContent: 'space-between',
    },
});

export default AnimationPanel;

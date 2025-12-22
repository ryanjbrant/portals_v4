/**
 * ObjectPropertiesPanel.js
 * Unified properties panel for Figment AR objects
 * Tabs: Object Details | Animation
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
    TextInput,
    Image,
    Platform,
    ActionSheetIOS,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import PathAnimationTab from './PathAnimationTab';
import VerticalAnimationTab from './VerticalAnimationTab';
import * as ImagePicker from 'expo-image-picker';

const { height, width } = Dimensions.get('window');
const PANEL_HEIGHT = height * 0.55; // Standard panel height
const PATH_PANEL_HEIGHT = height * 0.90; // Taller panel for path editor
const VERTICAL_PANEL_HEIGHT = height * 0.62; // Vertical tab (time vs height graph)

const ANIMATION_TYPES = ['bounce', 'pulse', 'rotate', 'scale', 'wiggle', 'random'];
const ARTIFACT_TYPES = ['Sell', 'Redeem', 'Unlock', 'Collect', 'QR Redeem'];

class ObjectPropertiesPanel extends Component {
    constructor(props) {
        super(props);
        this.translateY = new Animated.Value(PATH_PANEL_HEIGHT);
        this.state = {
            activeTab: 'details', // 'details' | 'animation' | 'path'
            selectedAnimation: null, // Currently selected animation type for editing
            animations: props.currentAnimations || {},
            artifactData: props.currentArtifact || {
                isArtifact: false,
                title: '',
                type: 'Sell',
                value: '', // Price, Reward, etc.
                description: '',
                qrImage: null,
            },
        };
    }

    componentDidUpdate(prevProps) {
        // Handle visibility animation
        if (this.props.visible !== prevProps.visible) {
            console.log('[ObjectPropertiesPanel] Visibility changed:', this.props.visible);
            if (this.props.visible) {
                Animated.spring(this.translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 20,
                    stiffness: 90,
                }).start();
            } else {
                Animated.timing(this.translateY, {
                    toValue: PATH_PANEL_HEIGHT, // Use larger height to ensure full hide
                    duration: 250,
                    useNativeDriver: true,
                }).start();
            }
        }

        // Sync animations when selected object changes
        if (this.props.currentAnimations !== prevProps.currentAnimations) {
            console.log('[ObjectPropertiesPanel] currentAnimations prop changed');
            this.setState({ animations: this.props.currentAnimations || {} });
        }

        // Sync artifact data when selected object changes
        if (JSON.stringify(this.props.currentArtifact) !== JSON.stringify(prevProps.currentArtifact)) {
            console.log('[ObjectPropertiesPanel] currentArtifact prop changed:', this.props.currentArtifact);
            this.setState({
                artifactData: this.props.currentArtifact || {
                    isArtifact: false,
                    title: '',
                    type: 'Sell',
                    value: '',
                    description: '',
                    qrImage: null,
                }
            });
        }

        // Log if selectedItemName changes (could indicate deselection)
        if (this.props.selectedItemName !== prevProps.selectedItemName) {
            console.log('[ObjectPropertiesPanel] selectedItemName changed:', {
                prev: prevProps.selectedItemName,
                current: this.props.selectedItemName,
            });
        }
    }

    // --- Animation Logic ---

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

    updateDistance = (type, distance) => {
        const current = this.state.animations[type] || { active: false, intensity: 1.0, distance: 1.0 };
        if (!current.active) return;

        const newState = { ...current, distance };
        const newAnimations = { ...this.state.animations, [type]: newState };
        this.setState({ animations: newAnimations });
        this.props.onUpdateAnimation(type, { intensity: current.intensity, distance }, true);
    };

    selectAnimation = (type) => {
        this.setState({ selectedAnimation: type });
    };

    // --- Artifact Logic ---

    updateArtifact = (updates) => {
        console.log('[ObjectPropertiesPanel] updateArtifact called:', updates);
        const newData = { ...this.state.artifactData, ...updates };
        console.log('[ObjectPropertiesPanel] New artifact data:', newData);
        this.setState({ artifactData: newData });
        this.props.onUpdateArtifact(newData);
        console.log('[ObjectPropertiesPanel] onUpdateArtifact callback invoked');
    };

    pickArtifactType = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [...ARTIFACT_TYPES, 'Cancel'],
                    cancelButtonIndex: ARTIFACT_TYPES.length,
                    title: 'Select Artifact Type',
                },
                (buttonIndex) => {
                    if (buttonIndex < ARTIFACT_TYPES.length) {
                        this.updateArtifact({ type: ARTIFACT_TYPES[buttonIndex] });
                    }
                }
            );
        } else {
            // Simple alert fallback for Android or implement custom picker
            // For now specific to iOS "Apple UI" request, standard Alert works
            Alert.alert(
                'Select Type',
                'Choose artifact type',
                ARTIFACT_TYPES.map(type => ({
                    text: type,
                    onPress: () => this.updateArtifact({ type })
                })).concat([{ text: 'Cancel', style: 'cancel' }])
            );
        }
    };

    pickQRLayout = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                this.updateArtifact({ qrImage: result.assets[0].uri });
            }
        } catch (error) {
            console.error('QR Picker Error:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    // --- Render Helpers ---

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

    renderArtifactForm() {
        const { artifactData } = this.state;
        const { type } = artifactData;

        return (
            <View style={styles.formContainer}>
                {/* Unified Form Card */}
                <View style={styles.formCard}>
                    {/* Title */}
                    <View style={styles.formRow}>
                        <Text style={styles.formLabel}>Title</Text>
                        <TextInput
                            style={styles.formInput}
                            placeholder="Artifact Name"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={artifactData.title}
                            onChangeText={(text) => this.updateArtifact({ title: text })}
                        />
                    </View>
                    <View style={styles.formDivider} />

                    {/* Type Selector */}
                    <TouchableOpacity style={styles.formRow} onPress={this.pickArtifactType}>
                        <Text style={styles.formLabel}>Type</Text>
                        <View style={styles.selectorValue}>
                            <Text style={styles.selectorText}>{artifactData.type}</Text>
                            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.formDivider} />

                    {/* Dynamic Fields */}
                    {type === 'Sell' && (
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>Price</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="0.00"
                                keyboardType="numeric"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={artifactData.value}
                                onChangeText={(text) => this.updateArtifact({ value: text })}
                            />
                        </View>
                    )}

                    {type === 'Redeem' && (
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>Description</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Redemption info..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={artifactData.description}
                                onChangeText={(text) => this.updateArtifact({ description: text })}
                            />
                        </View>
                    )}

                    {type === 'Unlock' && (
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>Requirement</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="e.g. 1:1 or 5 collections"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={artifactData.value}
                                onChangeText={(text) => this.updateArtifact({ value: text })}
                            />
                        </View>
                    )}

                    {type === 'Collect' && (
                        <View style={styles.formRow}>
                            <Text style={styles.formLabel}>Reward</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Collection reward..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={artifactData.value}
                                onChangeText={(text) => this.updateArtifact({ value: text })}
                            />
                        </View>
                    )}

                    {type === 'QR Redeem' && (
                        <TouchableOpacity style={styles.formRow} onPress={this.pickQRLayout}>
                            <Text style={styles.formLabel}>QR Code</Text>
                            <View style={styles.selectorValue}>
                                {artifactData.qrImage ? (
                                    <Image source={{ uri: artifactData.qrImage }} style={styles.qrPreview} />
                                ) : (
                                    <Text style={styles.selectorText}>Select Image</Text>
                                )}
                                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }

    render() {
        const { visible, onClose } = this.props;
        const { animations, activeTab, artifactData } = this.state;

        // Use different heights for each tab type
        let panelHeight = PANEL_HEIGHT;
        if (activeTab === 'path') panelHeight = PATH_PANEL_HEIGHT;
        else if (activeTab === 'vertical') panelHeight = VERTICAL_PANEL_HEIGHT;

        return (
            <Animated.View
                style={[styles.container, { height: panelHeight, transform: [{ translateY: this.translateY }] }]}
                pointerEvents={visible ? 'auto' : 'none'}
                onStartShouldSetResponder={() => true}
                onResponderRelease={() => { }}
            >
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />

                {/* Handle Bar */}
                <View style={styles.handleBarContainer}>
                    <View style={styles.handleBar} />
                </View>

                {/* Object Name Header */}
                <View style={styles.objectNameContainer}>
                    <Text style={styles.objectNameLabel}>EDITING</Text>
                    <Text style={styles.objectName} numberOfLines={1}>
                        {this.props.selectedItemName || "Selected Object"}
                    </Text>
                </View>

                {/* Tabs Header */}
                <View style={styles.header}>
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'details' && styles.activeTab]}
                            onPress={() => this.setState({ activeTab: 'details' })}
                        >
                            <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>Object Details</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'animation' && styles.activeTab]}
                            onPress={() => this.setState({ activeTab: 'animation' })}
                        >
                            <Text style={[styles.tabText, activeTab === 'animation' && styles.activeTabText]}>Animation</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'path' && styles.activeTab]}
                            onPress={() => this.setState({ activeTab: 'path' })}
                        >
                            <Text style={[styles.tabText, activeTab === 'path' && styles.activeTabText]}>Path</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'vertical' && styles.activeTab]}
                            onPress={() => this.setState({ activeTab: 'vertical' })}
                        >
                            <Text style={[styles.tabText, activeTab === 'vertical' && styles.activeTabText]}>Vertical</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                </View>

                {/* Scrollable content for details/animation tabs */}
                {activeTab !== 'path' && activeTab !== 'vertical' && (
                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                    >
                        {activeTab === 'details' ? (
                            <>
                                <View style={styles.toggleRow}>
                                    <Text style={styles.sectionTitle}>Artifact</Text>
                                    <Switch
                                        value={artifactData.isArtifact}
                                        onValueChange={(val) => this.updateArtifact({ isArtifact: val })}
                                        trackColor={{ false: '#333', true: '#FF3050' }}
                                        ios_backgroundColor="#333"
                                    />
                                </View>
                                <Text style={styles.description}>
                                    Enable to tag this object as an artifact. Artifacts appear in the feed and grid.
                                </Text>

                                {artifactData.isArtifact && this.renderArtifactForm()}

                                {/* Emitter Section */}
                                <View style={[styles.toggleRow, { marginTop: 24 }]}>
                                    <Text style={styles.sectionTitle}>Make Emitter</Text>
                                    <Switch
                                        value={this.props.currentEmitter?.isEmitter || false}
                                        onValueChange={(val) => this.props.onUpdateEmitter?.({
                                            ...(this.props.currentEmitter || {}),
                                            isEmitter: val
                                        })}
                                        trackColor={{ false: '#333', true: '#FF3050' }}
                                        ios_backgroundColor="#333"
                                    />
                                </View>
                                <Text style={styles.description}>
                                    Turn this object into a particle emitter that shoots sprites.
                                </Text>

                                {this.props.currentEmitter?.isEmitter && (
                                    <>
                                        {/* Particle Sprite Picker */}
                                        <TouchableOpacity
                                            style={styles.spritePickerBtn}
                                            onPress={async () => {
                                                const result = await ImagePicker.launchImageLibraryAsync({
                                                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                                    allowsEditing: true,
                                                    aspect: [1, 1],
                                                    quality: 0.8,
                                                });
                                                if (!result.canceled && result.assets?.[0]) {
                                                    this.props.onUpdateEmitter?.({
                                                        ...(this.props.currentEmitter || {}),
                                                        spriteUri: result.assets[0].uri,
                                                    });
                                                }
                                            }}
                                        >
                                            {this.props.currentEmitter?.spriteUri ? (
                                                <View style={styles.spritePreviewContainer}>
                                                    <View style={styles.spritePreview}>
                                                        <Text style={styles.spritePreviewText}>✓</Text>
                                                    </View>
                                                    <Text style={styles.spritePickerText}>Change Sprite</Text>
                                                </View>
                                            ) : (
                                                <>
                                                    <Ionicons name="image-outline" size={24} color="white" />
                                                    <Text style={styles.spritePickerText}>Select Particle Sprite</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>

                                        {/* Is Visible Toggle */}
                                        <View style={[styles.toggleRow, { marginTop: 16 }]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name="eye-outline" size={18} color="white" style={{ marginRight: 8 }} />
                                                <Text style={styles.toggleLabel}>Object Visible</Text>
                                            </View>
                                            <Switch
                                                value={this.props.currentEmitter?.objectVisible !== false}
                                                onValueChange={(val) => this.props.onUpdateEmitter?.({
                                                    ...(this.props.currentEmitter || {}),
                                                    objectVisible: val,
                                                })}
                                                trackColor={{ false: '#333', true: '#FF3050' }}
                                                ios_backgroundColor="#333"
                                            />
                                        </View>
                                        <Text style={[styles.description, { marginTop: 4 }]}>
                                            Hide the object to show only particles.
                                        </Text>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Active Animations Summary */}
                                <View style={styles.activeAnimsContainer}>
                                    <Text style={styles.label}>ACTIVE</Text>
                                    <View style={styles.activeAnimChips}>
                                        {ANIMATION_TYPES.filter(t => animations[t]?.active).map(type => (
                                            <TouchableOpacity
                                                key={type}
                                                style={styles.activeChip}
                                                onPress={() => this.selectAnimation(type)}
                                            >
                                                <Text style={styles.activeChipText}>{type.toUpperCase()}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        {ANIMATION_TYPES.filter(t => animations[t]?.active).length === 0 && (
                                            <Text style={styles.noAnimsText}>None</Text>
                                        )}
                                    </View>
                                </View>

                                {/* Animation Selector Dropdown */}
                                <TouchableOpacity
                                    style={styles.animSelector}
                                    onPress={() => {
                                        if (Platform.OS === 'ios') {
                                            ActionSheetIOS.showActionSheetWithOptions(
                                                {
                                                    options: [...ANIMATION_TYPES.map(t => `${t.toUpperCase()}${animations[t]?.active ? ' ✓' : ''}`), 'Cancel'],
                                                    cancelButtonIndex: ANIMATION_TYPES.length,
                                                    title: 'Select Animation',
                                                },
                                                (buttonIndex) => {
                                                    if (buttonIndex < ANIMATION_TYPES.length) {
                                                        this.selectAnimation(ANIMATION_TYPES[buttonIndex]);
                                                    }
                                                }
                                            );
                                        }
                                    }}
                                >
                                    <Text style={styles.animSelectorLabel}>Edit Animation</Text>
                                    <View style={styles.animSelectorValue}>
                                        <Text style={styles.animSelectorText}>
                                            {this.state.selectedAnimation ? this.state.selectedAnimation.toUpperCase() : 'Select...'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.6)" />
                                    </View>
                                </TouchableOpacity>

                                {/* Selected Animation Properties */}
                                {this.state.selectedAnimation && (() => {
                                    const type = this.state.selectedAnimation;
                                    const anim = animations[type] || { active: false, intensity: 1.0, distance: 1.0, axis: { x: false, y: true, z: false } };
                                    return (
                                        <View style={styles.animPropsCard}>
                                            {/* Enable/Disable Toggle */}
                                            <View style={styles.animToggleRow}>
                                                <Text style={styles.animPropsTitle}>{type.toUpperCase()}</Text>
                                                <Switch
                                                    value={anim.active}
                                                    onValueChange={() => this.toggleAnimation(type)}
                                                    trackColor={{ false: '#333', true: '#FF3050' }}
                                                    ios_backgroundColor="#333"
                                                />
                                            </View>

                                            {anim.active && (
                                                <>
                                                    {/* Intensity */}
                                                    <View style={styles.propRow}>
                                                        <Text style={styles.propLabel}>Intensity</Text>
                                                        <View style={styles.pillContainer}>
                                                            {[0.5, 1.0, 2.0].map((val) => (
                                                                <TouchableOpacity
                                                                    key={val}
                                                                    style={[styles.pill, anim.intensity === val && styles.pillActive]}
                                                                    onPress={() => this.updateIntensity(type, val)}
                                                                >
                                                                    <Text style={[styles.pillText, anim.intensity === val && styles.pillTextActive]}>
                                                                        {val}x
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </View>

                                                    {/* Axis Selector for Rotation */}
                                                    {type === 'rotate' && this.renderAxisSelector(type, anim.axis)}

                                                    {/* Distance for Random */}
                                                    {type === 'random' && (
                                                        <View style={styles.propRow}>
                                                            <Text style={styles.propLabel}>Distance</Text>
                                                            <View style={styles.pillContainer}>
                                                                {[0.5, 1.0, 2.0, 3.0].map((val) => (
                                                                    <TouchableOpacity
                                                                        key={val}
                                                                        style={[styles.pill, (anim.distance || 1.0) === val && styles.pillActive]}
                                                                        onPress={() => this.updateDistance(type, val)}
                                                                    >
                                                                        <Text style={[styles.pillText, (anim.distance || 1.0) === val && styles.pillTextActive]}>
                                                                            {val}x
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </View>
                                                        </View>
                                                    )}
                                                </>
                                            )}
                                        </View>
                                    );
                                })()}
                            </>
                        )}
                    </ScrollView>
                )}

                {/* Path tab - no scroll to avoid drawing interference */}
                {activeTab === 'path' && (
                    <View style={styles.pathContent}>
                        <PathAnimationTab
                            objectPosition={this.props.currentPosition}
                            currentPath={this.props.currentPathAnimation}
                            onApplyPath={this.props.onUpdatePathAnimation}
                        />
                    </View>
                )}

                {/* Vertical tab - height over time curve (no scroll to avoid drawing interference) */}
                {activeTab === 'vertical' && (
                    <View style={styles.pathContent}>
                        <VerticalAnimationTab
                            duration={this.props.currentPathAnimation?.duration || 5}
                            currentVertical={this.props.currentVerticalAnimation}
                            onApplyVertical={this.props.onUpdateVerticalAnimation}
                        />
                    </View>
                )}
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
        // height is set dynamically in render based on activeTab
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
    pathContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },

    handleBarContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    objectNameContainer: {
        alignItems: 'center',
        paddingBottom: 12,
        paddingHorizontal: 20,
    },
    objectNameLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 2,
    },
    objectName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    tabs: {
        flexDirection: 'row',
        gap: 20,
    },
    tab: {
        paddingVertical: 6,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#FF3050',
    },
    tabText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 15,
        fontWeight: '600',
    },
    activeTabText: {
        color: 'white',
    },
    closeButton: { padding: 4 },
    content: { flex: 1, paddingHorizontal: 20 },

    // Artifact Styles
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    sectionTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    description: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        marginTop: 6,
        marginBottom: 20,
    },
    formContainer: {
        marginTop: 10,
    },
    formCard: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        paddingLeft: 16,
        overflow: 'hidden',
    },
    formRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingRight: 16,
    },
    formDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    formLabel: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
    formInput: {
        flex: 2,
        color: 'rgba(255,255,255,0.9)',
        fontSize: 16,
        textAlign: 'right',
    },
    selectorValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    selectorText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
    },
    qrPreview: {
        width: 32,
        height: 32,
        borderRadius: 4,
        backgroundColor: '#333',
    },

    // Animation Styles
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
    // New animation dropdown styles
    activeAnimsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    activeAnimChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    activeChip: {
        backgroundColor: '#FF3050',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    activeChipText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '700',
    },
    noAnimsText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
    },
    animSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    animSelectorLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
    },
    animSelectorValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    animSelectorText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    animPropsCard: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 16,
    },
    animToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    animPropsTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    propRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    propLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    spritePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        paddingVertical: 14,
        marginTop: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderStyle: 'dashed',
    },
    spritePickerText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    spritePreviewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    spritePreview: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#22C55E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spritePreviewText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    toggleLabel: {
        color: 'white',
        fontSize: 15,
        fontWeight: '500',
    },
});

export default ObjectPropertiesPanel;

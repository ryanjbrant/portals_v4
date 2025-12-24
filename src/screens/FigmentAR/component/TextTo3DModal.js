/**
 * TextTo3DModal.js
 * Modal for generating 3D objects from text prompts using Fal.ai
 */

import React, { Component } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Animated,
    Dimensions,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { theme } from '../../../theme/theme';

const { width, height } = Dimensions.get('window');

class TextTo3DModal extends Component {
    constructor(props) {
        super(props);
        this.opacity = new Animated.Value(0);
        this.slideY = new Animated.Value(50);
        this.state = {
            prompt: '',
            isGenerating: false,
            status: '',
            progress: 0,
            error: null,
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.visible !== prevProps.visible) {
            if (this.props.visible) {
                Animated.parallel([
                    Animated.timing(this.opacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.spring(this.slideY, {
                        toValue: 0,
                        useNativeDriver: true,
                        damping: 20,
                    }),
                ]).start();
            } else {
                Animated.parallel([
                    Animated.timing(this.opacity, {
                        toValue: 0,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                    Animated.timing(this.slideY, {
                        toValue: 50,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                ]).start();
            }
        }
    }

    handleGenerate = async () => {
        const { prompt } = this.state;
        if (!prompt.trim()) return;

        this.setState({ isGenerating: true, error: null, status: 'Starting...' });

        try {
            const { generateObjectFromText } = await import('../../../services/textTo3DService');

            const result = await generateObjectFromText(prompt.trim(), (progress) => {
                this.setState({
                    status: progress.message,
                    progress: progress.progress || 0,
                });
            });

            if (result.success) {
                this.setState({ isGenerating: false, status: 'Complete!', prompt: '' });

                // Notify parent to add model to scene
                if (this.props.onModelGenerated) {
                    this.props.onModelGenerated({
                        name: result.modelName,
                        uri: result.modelUrl,
                        type: 'GLB',
                    });
                }

                // Close modal after short delay
                setTimeout(() => {
                    this.props.onClose();
                }, 500);
            } else {
                this.setState({
                    isGenerating: false,
                    error: result.error || 'Generation failed',
                    status: '',
                });
            }
        } catch (error) {
            console.error('[TextTo3DModal] Error:', error);
            this.setState({
                isGenerating: false,
                error: error.message || 'Unknown error',
                status: '',
            });
        }
    };

    handleClose = () => {
        if (!this.state.isGenerating) {
            this.props.onClose();
        }
    };

    render() {
        const { visible } = this.props;
        const { prompt, isGenerating, status, progress, error } = this.state;

        if (!visible) return null;

        return (
            <Animated.View style={[styles.overlay, { opacity: this.opacity }]}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={this.handleClose}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <Animated.View
                        style={[
                            styles.modal,
                            { transform: [{ translateY: this.slideY }] }
                        ]}
                    >
                        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerIcon}>
                                <Ionicons name="sparkles" size={24} color={theme.colors.primary} />
                            </View>
                            <Text style={styles.title}>Generate 3D Object</Text>
                            <TouchableOpacity
                                onPress={this.handleClose}
                                style={styles.closeButton}
                                disabled={isGenerating}
                            >
                                <Ionicons
                                    name="close"
                                    size={24}
                                    color={isGenerating ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)'}
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Description */}
                        <Text style={styles.description}>
                            Describe the 3D object you want to create. Be specific about shape, materials, and style.
                        </Text>

                        {/* Input */}
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                value={prompt}
                                onChangeText={(text) => this.setState({ prompt: text, error: null })}
                                placeholder="A rustic wooden treasure chest with metal bands..."
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                multiline
                                numberOfLines={3}
                                editable={!isGenerating}
                                autoFocus
                            />
                        </View>

                        {/* Example Prompts */}
                        {!isGenerating && !prompt && (
                            <View style={styles.examples}>
                                <Text style={styles.examplesLabel}>Examples:</Text>
                                <TouchableOpacity onPress={() => this.setState({ prompt: 'A glowing crystal orb on a marble pedestal' })}>
                                    <Text style={styles.exampleText}>• Crystal orb on pedestal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => this.setState({ prompt: 'A cartoon robot with big eyes and metallic body' })}>
                                    <Text style={styles.exampleText}>• Cartoon robot</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => this.setState({ prompt: 'An ancient stone archway covered in vines' })}>
                                    <Text style={styles.exampleText}>• Stone archway with vines</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Progress */}
                        {isGenerating && (
                            <View style={styles.progressContainer}>
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                                <Text style={styles.statusText}>{status}</Text>
                                {progress > 0 && (
                                    <View style={styles.progressBar}>
                                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Error */}
                        {error && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        {/* Generate Button */}
                        <TouchableOpacity
                            style={[
                                styles.generateButton,
                                (!prompt.trim() || isGenerating) && styles.generateButtonDisabled
                            ]}
                            onPress={this.handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                        >
                            {isGenerating ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <>
                                    <Ionicons name="cube" size={20} color="#000" />
                                    <Text style={styles.generateButtonText}>Generate 3D Object</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Time Estimate */}
                        <Text style={styles.timeEstimate}>
                            Generation typically takes 30-60 seconds
                        </Text>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Animated.View>
        );
    }
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    keyboardView: {
        width: '100%',
        alignItems: 'center',
    },
    modal: {
        width: width - 40,
        maxWidth: 400,
        backgroundColor: 'rgba(30,30,30,0.95)',
        borderRadius: 20,
        padding: 20,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,217,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.white,
    },
    closeButton: {
        padding: 4,
    },
    description: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 16,
        lineHeight: 20,
    },
    inputContainer: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 12,
    },
    input: {
        color: theme.colors.white,
        fontSize: 16,
        padding: 14,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    examples: {
        marginBottom: 16,
    },
    examplesLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 8,
    },
    exampleText: {
        fontSize: 14,
        color: theme.colors.primary,
        marginBottom: 6,
    },
    progressContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    statusText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        marginTop: 12,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: theme.colors.primary,
        borderRadius: 2,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(231,76,60,0.15)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        color: theme.colors.error,
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.white,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    generateButtonDisabled: {
        opacity: 0.5,
    },
    generateButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    timeEstimate: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginTop: 12,
    },
});

export default TextTo3DModal;

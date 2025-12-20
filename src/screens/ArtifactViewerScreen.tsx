import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    ActivityIndicator,
    Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { Post } from '../types';
import { loadSceneById } from '../services/scene';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ArtifactViewerScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { post }: { post: Post } = route.params || {};

    const [sceneData, setSceneData] = useState<any>(null);
    const [loadingScene, setLoadingScene] = useState(true);
    const [isCollected, setIsCollected] = useState(false);
    const videoRef = useRef<Video>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const collectArtifact = useAppStore(state => state.collectArtifact);
    const collectedArtifacts = useAppStore(state => state.collectedArtifacts);

    // Fetch scene data from R2 to get artifact details
    useEffect(() => {
        const fetchSceneData = async () => {
            if (!post?.sceneId) {
                setSceneData(post?.sceneData || null);
                setLoadingScene(false);
                return;
            }

            try {
                const data = await loadSceneById(post.sceneId);
                setSceneData(data);
            } catch (error) {
                console.error('[ArtifactViewer] Failed to load scene:', error);
            } finally {
                setLoadingScene(false);
            }
        };

        fetchSceneData();
    }, [post?.sceneId]);

    // Check if already collected
    useEffect(() => {
        if (post?.id && collectedArtifacts) {
            const alreadyCollected = collectedArtifacts.some((a: Post) => a.id === post.id);
            setIsCollected(alreadyCollected);
        }
    }, [post?.id, collectedArtifacts]);

    // Fade in UI
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, []);

    // Extract artifact data from scene objects
    const getArtifactData = () => {
        if (!sceneData?.objects) return null;
        const artifactObject = sceneData.objects.find((obj: any) => obj.artifact?.isArtifact);
        return artifactObject?.artifact || null;
    };

    const artifactData = getArtifactData();

    const handleViewScene = () => {
        // Navigate to Figment AR view with the scene
        navigation.navigate('Figment', {
            postData: post,
            isRemix: true,
            viewOnly: true,
        });
    };

    const handleCollect = async () => {
        if (!post || isCollected) return;

        try {
            await collectArtifact(post);
            setIsCollected(true);
        } catch (error) {
            console.error('[ArtifactViewer] Collection failed:', error);
        }
    };

    const handleClose = () => {
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            {/* Video Background */}
            {post?.mediaUri ? (
                <Video
                    ref={videoRef}
                    source={{ uri: post.mediaUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted={false}
                />
            ) : post?.coverImage ? (
                <Image
                    source={{ uri: post.coverImage }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a1a' }]} />
            )}

            {/* Gradient Overlay for readability */}
            <View style={styles.gradient} />

            {/* Header - Close button */}
            <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                <SafeAreaView edges={['top']}>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                </SafeAreaView>
            </Animated.View>

            {/* Loading indicator */}
            {loadingScene && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            )}

            {/* Bottom Content */}
            <Animated.View style={[styles.bottomContent, { opacity: fadeAnim }]}>
                <SafeAreaView edges={['bottom']}>
                    {/* Artifact Info */}
                    <View style={styles.artifactInfo}>
                        <View style={styles.artifactBadge}>
                            <Ionicons name="diamond" size={16} color={theme.colors.secondary} />
                            <Text style={styles.badgeText}>ARTIFACT</Text>
                        </View>

                        <Text style={styles.title}>
                            {artifactData?.title || post?.caption || 'Untitled Artifact'}
                        </Text>

                        {artifactData?.description && (
                            <Text style={styles.description} numberOfLines={2}>
                                {artifactData.description}
                            </Text>
                        )}

                        {/* Creator info */}
                        {post?.user && (
                            <View style={styles.creatorRow}>
                                <Image
                                    source={{ uri: post.user.avatar || 'https://via.placeholder.com/32' }}
                                    style={styles.avatar}
                                />
                                <Text style={styles.creatorName}>@{post.user.username}</Text>
                            </View>
                        )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actions}>
                        {/* View Scene Button - Primary */}
                        <TouchableOpacity
                            style={styles.viewSceneButton}
                            onPress={handleViewScene}
                        >
                            <Ionicons name="cube-outline" size={22} color="black" />
                            <Text style={styles.viewSceneText}>View Scene</Text>
                        </TouchableOpacity>

                        {/* Collect Button - Secondary */}
                        {!isCollected ? (
                            <TouchableOpacity
                                style={styles.collectButton}
                                onPress={handleCollect}
                            >
                                <Ionicons name="add-circle-outline" size={22} color="white" />
                                <Text style={styles.collectText}>Collect</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.collectedBadge}>
                                <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
                                <Text style={styles.collectedText}>Collected</Text>
                            </View>
                        )}
                    </View>
                </SafeAreaView>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        // Simulated gradient overlay
        opacity: 0.6,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingHorizontal: 16,
    },
    closeButton: {
        marginTop: 8,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    bottomContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    artifactInfo: {
        marginBottom: 20,
    },
    artifactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    badgeText: {
        color: theme.colors.secondary,
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 20,
        marginBottom: 12,
    },
    creatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    creatorName: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    viewSceneButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
    },
    viewSceneText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'black',
    },
    collectButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    collectText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
    collectedBadge: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    collectedText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4CAF50',
    },
});

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { theme } from '../theme/theme';
import { ArtifactDetailsPanel } from '../components/ArtifactDetailsPanel';
import { useAppStore } from '../store';
import { Post } from '../types';
import { loadSceneById } from '../services/scene';

// @ts-ignore - FigmentAR is written in JS
import App from './FigmentAR/app';
// @ts-ignore
import reducers from './FigmentAR/redux/reducers';

const store = createStore(reducers);
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ArtifactViewerScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { post }: { post: Post } = route.params || {};

    const [showPanel, setShowPanel] = useState(false);
    const [isCollected, setIsCollected] = useState(false);
    const [sceneData, setSceneData] = useState<any>(null);
    const [loadingScene, setLoadingScene] = useState(true);
    const closeOpacity = useRef(new Animated.Value(0)).current;

    const collectArtifact = useAppStore(state => state.collectArtifact);
    const collectedArtifacts = useAppStore(state => state.collectedArtifacts);

    // Fetch scene data from R2 to get artifact details
    useEffect(() => {
        const fetchSceneData = async () => {
            if (!post?.sceneId) {
                console.log('[ArtifactViewer] No sceneId, using post.sceneData');
                setSceneData(post?.sceneData || null);
                setLoadingScene(false);
                return;
            }

            try {
                console.log('[ArtifactViewer] Fetching scene:', post.sceneId);
                const data = await loadSceneById(post.sceneId);
                console.log('[ArtifactViewer] Scene loaded, objects:', data?.objects?.length);
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

    // Animate in UI after short delay (let AR scene load)
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowPanel(true);
            Animated.timing(closeOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    const handleCollect = async () => {
        if (!post || isCollected) return;

        try {
            await collectArtifact(post);
            setIsCollected(true);

            // Navigate to Artifacts gallery after short delay
            setTimeout(() => {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Tabs', params: { screen: 'Artifacts' } }],
                });
            }, 1200);
        } catch (error) {
            console.error('[ArtifactViewer] Collection failed:', error);
        }
    };

    const handleClose = () => {
        navigation.goBack();
    };

    // Extract artifact data from scene objects
    const getArtifactData = () => {
        if (!sceneData?.objects) return null;

        // Find the first object with artifact data
        const artifactObject = sceneData.objects.find((obj: any) => obj.artifact?.isArtifact);
        if (artifactObject?.artifact) {
            console.log('[ArtifactViewer] Found artifact data:', artifactObject.artifact);
        }
        return artifactObject?.artifact || null;
    };

    const artifactData = getArtifactData();

    return (
        <View style={styles.container}>
            {/* Loading indicator while fetching scene */}
            {loadingScene && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            )}

            {/* AR Scene - FigmentAR in view-only mode */}
            <Provider store={store}>
                <App
                    route={{
                        params: {
                            postData: post,
                            isRemix: true, // Triggers scene loading
                            viewOnly: true, // Custom flag to hide UI
                        }
                    }}
                    navigation={navigation}
                />
            </Provider>

            {/* Minimal Close Button */}
            <Animated.View style={[styles.closeContainer, { opacity: closeOpacity }]}>
                <SafeAreaView edges={['top']}>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                </SafeAreaView>
            </Animated.View>

            {/* Artifact Details Panel */}
            <ArtifactDetailsPanel
                visible={showPanel && !loadingScene}
                post={post}
                artifactData={artifactData}
                isCollected={isCollected}
                onCollect={handleCollect}
                onClose={handleClose}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 50,
    },
    closeContainer: {
        position: 'absolute',
        top: 0,
        right: 16,
        zIndex: 100,
    },
    closeButton: {
        marginTop: 8,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});


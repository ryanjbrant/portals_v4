import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { Post } from '../types';
import { uploadVideo } from '../api/client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { StorageService } from '../services/storage';

export const PostDetailsScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const addPost = useAppStore(state => state.addPost);
    const currentUser = useAppStore(state => state.currentUser);
    const draftPost = useAppStore(state => state.draftPost);
    const setDraftPost = useAppStore(state => state.setDraftPost);
    const updateDraftPost = useAppStore(state => state.updateDraftPost);

    const [tagInput, setTagInput] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);

    const coverImage = route.params?.coverImage;
    const remixedFrom = route.params?.remixedFrom; // Remix attribution if this is a remix

    // Detect artifact in scene
    const hasArtifact = React.useMemo(() => {
        const sceneData = draftPost?.sceneData || route.params?.sceneData;
        if (!sceneData?.objects) {
            console.log('[PostDetails] hasArtifact: No sceneData.objects');
            return false;
        }
        const hasArt = sceneData.objects.some((obj: any) => obj.artifact && obj.artifact.isArtifact);
        console.log('[PostDetails] hasArtifact:', hasArt, 'Objects:', sceneData.objects.map((o: any) => ({
            id: o.id,
            type: o.type,
            hasArtifact: !!o.artifact,
            isArtifact: o.artifact?.isArtifact,
        })));
        return hasArt;
    }, [draftPost?.sceneData, route.params?.sceneData]);

    // Initialize draft on mount
    // Initialize draft on mount
    React.useEffect(() => {
        const incomingVideo = route.params?.videoUri;
        const incomingScene = route.params?.sceneData;

        if (incomingVideo) {
            // Came from Composer with new video
            const baseState = draftPost || {
                caption: '',
                tags: [],
                taggedUsers: [],
                locations: [],
            };

            setDraftPost({
                ...baseState,
                mediaUri: incomingVideo,
                sceneData: incomingScene || baseState.sceneData
            });
        } else if (!draftPost) {
            setDraftPost({
                caption: '',
                tags: [],
                taggedUsers: [],
                locations: [],
            });
        }
    }, [route.params?.videoUri]);

    const caption = draftPost?.caption || '';
    const tags = draftPost?.tags || [];
    const taggedUsers = draftPost?.taggedUsers || [];
    const locations = draftPost?.locations || [];
    const mediaUri = draftPost?.mediaUri;
    const [compressedUri, setCompressedUri] = useState<string | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);

    // Video player for preview
    const player = useVideoPlayer(mediaUri || null, player => {
        player.loop = true;
        player.muted = true;
        player.play();
    });

    React.useEffect(() => {
        // User requested reducing complexity - use raw video
        if (mediaUri) {
            setCompressedUri(mediaUri);
            setIsCompressing(false);
        }
    }, [mediaUri]);

    const [selectedCategory, setSelectedCategory] = useState(draftPost?.category || 'Feed');
    const CHANNELS = ["Live", "Feed", "Friends", "Exclusive", "Creative", "Countdown", "Music", "Sports", "Entertainment"];

    const handlePublish = async () => {
        if (!currentUser || !draftPost) return;
        setIsPublishing(true);

        try {
            let sceneId = draftPost.sceneId;

            // Determine if we need to save the scene (real save to R2)
            if (draftPost.sceneData) {
                // Use the scalable saver - mark as published so it doesn't appear in drafts
                const publishedSceneData = { ...draftPost.sceneData, status: 'published' };
                const { saveSceneToStorage } = require('../services/sceneSaver');
                const { sceneId: savedSceneId } = await saveSceneToStorage(publishedSceneData, coverImage, currentUser.id);
                sceneId = savedSceneId;
            }

            // Upload Media
            let finalMediaUri = compressedUri || mediaUri;
            if (isCompressing) {
                Alert.alert("Please wait", "Video optimization in progress...");
                setIsPublishing(false);
                return;
            }
            if (finalMediaUri && !finalMediaUri.startsWith('http')) {
                const ext = finalMediaUri.split('.').pop() || 'mp4';
                const path = `videos/${currentUser.id}/${Date.now()}.${ext}`;
                console.log("Uploading media...", finalMediaUri);
                try {
                    finalMediaUri = await StorageService.uploadFile(finalMediaUri, path);
                    console.log("Media uploaded:", finalMediaUri);
                } catch (uploadErr) {
                    console.error("Upload failed details:", uploadErr);
                    throw new Error("Failed to upload video.");
                }
            }

            if (!finalMediaUri || !finalMediaUri.startsWith('http')) {
                throw new Error("Invalid Media URI: " + finalMediaUri);
            }

            // Upload Cover
            let finalCoverUri = coverImage;
            if (coverImage && !coverImage.startsWith('http')) {
                const path = `covers/${currentUser.id}/${Date.now()}.jpg`;
                finalCoverUri = await StorageService.uploadFile(coverImage, path);
            }

            const newPostData = {
                userId: currentUser.id,
                user: currentUser,
                caption: caption,
                likes: 0,
                comments: 0,
                shares: 0,
                isLiked: false,
                date: new Date().toISOString(),
                tags: tags,
                taggedUsers: taggedUsers,
                locations: locations,
                music: 'Original Sound',
                category: selectedCategory, // Save Channel
                sceneId: sceneId || null,
                sceneData: null, // CRITICAL: Do NOT store heavy scene JSON in Firestore. Only the ID.
                mediaUri: finalMediaUri || null,
                coverImage: finalCoverUri || null,
                isArtifact: hasArtifact, // Save artifact status for feed/gallery filtering
                remixedFrom: remixedFrom || null, // Save remix attribution if present
                createdAt: serverTimestamp()
            };

            // Debug log for artifact status
            console.log('[PostDetails] Saving post with isArtifact:', hasArtifact);

            // Save to Firestore
            const docRef = await addDoc(collection(db, 'posts'), newPostData);

            // Update local store
            const newPost: Post = {
                ...newPostData,
                id: docRef.id,
                date: 'Just now',
            } as any;

            addPost(newPost);
            setDraftPost(null);
            Alert.alert("Published!", `Your portal is live on #${selectedCategory}.`, [
                { text: "OK", onPress: () => navigation.navigate('Tabs') }
            ]);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to publish post.");
        } finally {
            setIsPublishing(false);
        }
    };

    const addTag = () => {
        if (tagInput.trim()) {
            updateDraftPost({ tags: [...tags, tagInput.trim()] });
            setTagInput('');
        }
    };

    const setCaption = (text: string) => {
        updateDraftPost({ caption: text });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} disabled={isPublishing}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>New Post</Text>
                <TouchableOpacity onPress={handlePublish} disabled={isPublishing}>
                    {isPublishing ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.publishText}>Publish</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Artifact Banner */}
                {hasArtifact && (
                    <View style={styles.artifactBanner}>
                        <Ionicons name="diamond" size={20} color={theme.colors.secondary} />
                        <Text style={styles.artifactBannerText}>This scene contains an Artifact</Text>
                    </View>
                )}
                {/* Remix Attribution Banner */}
                {remixedFrom && (
                    <View style={styles.remixBanner}>
                        <Ionicons name="git-branch" size={20} color={theme.colors.primary} />
                        <Image source={{ uri: remixedFrom.avatar }} style={styles.remixBannerAvatar} />
                        <Text style={styles.remixBannerText}>Remixed from @{remixedFrom.username}</Text>
                    </View>
                )}
                <View style={styles.mediaPreview}>
                    {mediaUri ? (
                        <>
                            <VideoView
                                style={{
                                    width: 100,
                                    height: 150,
                                    borderRadius: 12,
                                    marginRight: 16,
                                    backgroundColor: theme.colors.surfaceHighlight
                                }}
                                player={player}
                                contentFit="cover"
                                nativeControls={false}
                            />
                            {isCompressing && (
                                <View style={{
                                    position: 'absolute',
                                    bottom: 8,
                                    left: 8,
                                    backgroundColor: 'rgba(0,0,0,0.6)',
                                    padding: 6,
                                    borderRadius: 6,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6
                                }}>
                                    <ActivityIndicator size="small" color="white" />
                                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '600' }}>Optimizing</Text>
                                </View>
                            )}
                        </>
                    ) : coverImage ? (
                        <Image
                            style={{
                                width: 100,
                                height: 150,
                                borderRadius: 12,
                                marginRight: 16,
                                backgroundColor: theme.colors.surfaceHighlight
                            }}
                            source={{ uri: coverImage }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.placeholderMedia}>
                            <Ionicons name="image" size={48} color={theme.colors.textDim} />
                            <Text style={styles.mediaText}>Cover Selected</Text>
                        </View>
                    )}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.captionInput}
                            placeholder="Write a caption..."
                            placeholderTextColor={theme.colors.textDim}
                            multiline
                            value={caption}
                            onChangeText={setCaption}
                        />
                    </View>
                </View>

                {/* Channel Selector */}
                <View style={styles.channelContainer}>
                    <Text style={styles.sectionTitle}>Publish to Channel</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelsScroll}>
                        {CHANNELS.map((channel) => (
                            <TouchableOpacity
                                key={channel}
                                style={[
                                    styles.channelChip,
                                    selectedCategory === channel && styles.channelChipActive
                                ]}
                                onPress={() => setSelectedCategory(channel)}
                            >
                                <Text style={[
                                    styles.channelText,
                                    selectedCategory === channel && styles.channelTextActive
                                ]}>
                                    {channel}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.row}>
                    <Ionicons name="pricetag" size={20} color={theme.colors.text} />
                    <TextInput
                        style={styles.rowInput}
                        placeholder="Add tags (enter to add)"
                        placeholderTextColor={theme.colors.textDim}
                        value={tagInput}
                        onChangeText={setTagInput}
                        onSubmitEditing={addTag}
                    />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginBottom: 16 }}>
                    {tags.map((tag, index) => (
                        <View key={index} style={styles.tagChip}>
                            <Text style={styles.tagText}>#{tag}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('TagPeople')}>
                    <Ionicons name="people" size={20} color={theme.colors.text} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel}>Tag People</Text>
                        {taggedUsers.length > 0 && (
                            <Text style={styles.rowSubLabel}>{taggedUsers.length} people tagged</Text>
                        )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textDim} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('LocationPicker')}>
                    <Ionicons name="location" size={20} color={theme.colors.text} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel}>Add Locations</Text>
                        {locations.length > 0 && (
                            <Text style={styles.rowSubLabel}>
                                {locations.length} locations selected
                            </Text>
                        )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textDim} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.surfaceHighlight,
    },
    title: {
        ...theme.typography.h2,
        color: theme.colors.text,
    },
    publishText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    content: {
        flex: 1,
    },
    mediaPreview: {
        flexDirection: 'row',
        padding: theme.spacing.m,
        marginBottom: theme.spacing.m,
    },
    placeholderMedia: {
        width: 100,
        height: 150,
        backgroundColor: theme.colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: theme.borderRadius.m,
        marginRight: theme.spacing.m,
    },
    mediaText: {
        color: theme.colors.textDim,
        marginTop: 8,
        fontSize: 10,
    },
    inputContainer: {
        flex: 1,
    },
    captionInput: {
        flex: 1,
        color: theme.colors.text,
        fontSize: 16,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.m,
        gap: 12,
    },
    rowInput: {
        flex: 1,
        color: theme.colors.text,
        fontSize: 16,
    },
    rowLabel: {
        color: theme.colors.text,
        fontSize: 16,
    },
    rowSubLabel: {
        color: theme.colors.primary,
        fontSize: 12,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.surfaceHighlight,
        marginHorizontal: theme.spacing.m,
    },
    tagChip: {
        backgroundColor: theme.colors.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 8,
        marginBottom: 8,
    },
    tagText: {
        color: theme.colors.primary,
    },
    artifactBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        padding: 12,
        borderRadius: 8,
        marginHorizontal: theme.spacing.m,
        marginBottom: theme.spacing.m,
        gap: 8,
        borderWidth: 1,
        borderColor: theme.colors.secondary,
    },
    artifactBannerText: {
        color: theme.colors.secondary,
        fontWeight: '600',
        fontSize: 14,
    },
    channelContainer: {
        marginBottom: theme.spacing.m,
        paddingHorizontal: theme.spacing.m,
    },
    sectionTitle: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
    },
    channelsScroll: {
        paddingRight: 16,
        gap: 8,
    },
    channelChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: theme.colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    channelChipActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    channelText: {
        color: theme.colors.textDim,
        fontSize: 14,
        fontWeight: '500',
    },
    channelTextActive: {
        color: theme.colors.black,
        fontWeight: '600',
    },
    remixBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 121, 255, 0.15)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: theme.colors.primary,
    },
    remixBannerAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    remixBannerText: {
        color: theme.colors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
});

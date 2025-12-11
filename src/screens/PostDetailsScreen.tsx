import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { Post } from '../types';
import { saveScene, uploadVideo } from '../api/client';
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

    React.useEffect(() => {
        // User requested reducing complexity - use raw video
        if (mediaUri) {
            setCompressedUri(mediaUri);
            setIsCompressing(false);
        }
    }, [mediaUri]);

    const handlePublish = async () => {
        if (!currentUser || !draftPost) return;
        setIsPublishing(true);

        try {
            let sceneId = draftPost.sceneId;

            // Determine if we need to save the scene (mock for scene data)
            if (draftPost.sceneData) {
                const sceneRes = await saveScene(draftPost.sceneData);
                sceneId = sceneRes.sceneId;
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
                sceneId: sceneId || null,
                sceneData: draftPost.sceneData || null,
                mediaUri: finalMediaUri || null,
                coverImage: finalCoverUri || null,
                createdAt: serverTimestamp()
            };

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
            Alert.alert("Published!", "Your portal is live.", [
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
                <View style={styles.mediaPreview}>
                    {mediaUri ? (
                        <>
                            <Video
                                style={{
                                    width: 100,
                                    height: 150,
                                    borderRadius: 12,
                                    marginRight: 16,
                                    backgroundColor: theme.colors.surfaceHighlight
                                }}
                                source={{ uri: mediaUri }}
                                resizeMode={ResizeMode.COVER}
                                shouldPlay
                                isLooping
                                isMuted
                                posterSource={coverImage ? { uri: coverImage } : undefined}
                                usePoster={!!coverImage}
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
    }
});

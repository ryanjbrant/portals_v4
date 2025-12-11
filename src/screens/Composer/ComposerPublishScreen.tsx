import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../../theme/theme';
import { createPostWithScene, saveScene, uploadVideo } from '../../api/client';
import { useAppStore } from '../../store';

export const ComposerPublishScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { scene, videoUri } = route.params || {};

    const [caption, setCaption] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const addPost = useAppStore(state => state.addPost);

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            // 1. Save Scene
            const { sceneId } = await saveScene(scene);

            // 2. Upload Video
            const { videoId } = await uploadVideo(videoUri);

            // 3. Create Post
            // In a real app, this returns the post object. 
            // Here we'll just mock adding it to the store.
            const newPost = {
                id: Date.now().toString(),
                user: { id: 'u1', username: 'me', avatar: 'https://via.placeholder.com/150' },
                caption: caption,
                videoUri: videoUri, // Local for now
                likes: 0,
                comments: 0,
                shares: 0,
                isLiked: false,
                sceneId: sceneId // Link to scene 
            };

            // Using existing addPost action (which expects a different shape, but we force it for now)
            addPost(newPost as any);

            Alert.alert("Published!", "Your scene is live.", [
                { text: "OK", onPress: () => navigation.navigate('PostFeed') }
            ]);

        } catch (error) {
            Alert.alert("Error", "Failed to publish");
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.title}>New Post</Text>
                <TouchableOpacity onPress={handlePublish} disabled={isPublishing}>
                    <Text style={[styles.publishText, isPublishing && { color: 'gray' }]}>
                        {isPublishing ? 'Posting...' : 'Post'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.mediaRow}>
                    {/* Placeholder for video thumb since we don't have video component handy in this file context, usually use expo-video */}
                    <View style={styles.thumbPlaceholder}>
                        <Text style={{ color: 'white' }}>Video Preview</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder="Write a caption..."
                        placeholderTextColor="#999"
                        multiline
                        value={caption}
                        onChangeText={setCaption}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
    title: { color: 'white', fontWeight: 'bold', fontSize: 18 },
    publishText: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 16 },
    content: { padding: 16 },
    mediaRow: { flexDirection: 'row', gap: 16 },
    thumbPlaceholder: { width: 80, height: 120, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
    input: { flex: 1, color: 'white', fontSize: 16, paddingTop: 8 }
});

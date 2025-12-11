import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { Post } from '../types';

export const PostDetailsScreen = () => {
    const navigation = useNavigation<any>();
    const addPost = useAppStore(state => state.addPost);
    const currentUser = useAppStore(state => state.currentUser);
    const draftPost = useAppStore(state => state.draftPost);
    const setDraftPost = useAppStore(state => state.setDraftPost);
    const updateDraftPost = useAppStore(state => state.updateDraftPost);

    const [tagInput, setTagInput] = useState('');

    // Initialize draft on mount
    React.useEffect(() => {
        if (!draftPost) {
            setDraftPost({
                caption: '',
                tags: [],
                taggedUsers: [],
                locations: [],
            });
        }
    }, []);

    const caption = draftPost?.caption || '';
    const tags = draftPost?.tags || [];
    const taggedUsers = draftPost?.taggedUsers || [];
    const locations = draftPost?.locations || [];

    const handlePublish = () => {
        if (!currentUser || !draftPost) return;

        const newPost: Post = {
            id: Date.now().toString(),
            userId: currentUser.id,
            user: currentUser,
            caption: caption,
            likes: 0,
            comments: 0,
            shares: 0,
            isLiked: false,
            date: 'Just now',
            tags: tags,
            taggedUsers: taggedUsers,
            locations: locations,
            music: 'Original Sound'
        };

        addPost(newPost);
        setDraftPost(null); // Clear draft
        Alert.alert("Published!", "Your post is live.", [
            { text: "OK", onPress: () => navigation.navigate('Home') }
        ]);
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
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>New Post</Text>
                <TouchableOpacity onPress={handlePublish}>
                    <Text style={styles.publishText}>Publish</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.mediaPreview}>
                    <View style={styles.placeholderMedia}>
                        <Ionicons name="image" size={48} color={theme.colors.textDim} />
                        <Text style={styles.mediaText}>Cover Selected</Text>
                    </View>
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

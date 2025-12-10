import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { Post } from '../types';

export const PostDetailsScreen = () => {
    const navigation = useNavigation<any>();
    const addPost = useAppStore(state => state.addPost);
    const currentUser = useAppStore(state => state.currentUser);

    const [caption, setCaption] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    const handlePublish = () => {
        if (!currentUser) return;

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
            music: 'Original Sound'
        };

        addPost(newPost);
        Alert.alert("Published!", "Your post is live.", [
            { text: "OK", onPress: () => navigation.navigate('Home') } // Navigate to Feed via Tab
        ]);
    };

    const addTag = () => {
        if (tagInput.trim()) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
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

                <View style={styles.row}>
                    <Ionicons name="people" size={20} color={theme.colors.text} />
                    <Text style={styles.rowLabel}>Tag People</Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textDim} style={{ marginLeft: 'auto' }} />
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                    <Ionicons name="location" size={20} color={theme.colors.text} />
                    <Text style={styles.rowLabel}>Add Location</Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textDim} style={{ marginLeft: 'auto' }} />
                </View>

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

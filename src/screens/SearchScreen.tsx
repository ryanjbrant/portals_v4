import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, Dimensions, ActivityIndicator, SafeAreaView, StatusBar, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { SearchService } from '../services/search';
import { User, Post } from '../types';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_WIDTH = width / COLUMN_COUNT;

export const SearchScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const [users, setUsers] = useState<User[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [tags, setTags] = useState<string[]>([]);

    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    // Initial Search from Params (e.g. Voice)
    useEffect(() => {
        if (route.params?.query) {
            handleSearch(route.params.query);
        }
    }, [route.params?.query]);

    const handleSearch = (text: string) => {
        setQuery(text);

        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (!text.trim()) {
            setUsers([]);
            setPosts([]);
            setTags([]);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            setLoading(true);
            try {
                const [userResults, postResults, tagResults] = await Promise.all([
                    SearchService.searchUsers(text),
                    SearchService.searchPosts(text),
                    SearchService.searchTags(text)
                ]);
                setUsers(userResults);
                setPosts(postResults);
                setTags(tagResults);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 500); // Debounce
    };

    const navigateToProfile = (userId: string) => {
        navigation.navigate('UserProfile', { userId });
    };

    const navigateToPostFeed = (index: number) => {
        navigation.navigate('PostFeed', { posts, initialIndex: index, title: query ? `"${query}"` : 'Search' });
    };

    const renderUserItem = ({ item }: { item: User }) => (
        <TouchableOpacity style={styles.userItem} onPress={() => navigateToProfile(item.id)}>
            <Image source={{ uri: item.avatar || 'https://i.pravatar.cc/150' }} style={styles.userAvatar} />
            <Text style={styles.userName} numberOfLines={1}>{item.username}</Text>
        </TouchableOpacity>
    );

    const renderPostItem = ({ item, index }: { item: Post, index: number }) => (
        <TouchableOpacity style={styles.postItem} onPress={() => navigateToPostFeed(index)}>
            {/* Placeholder for Video Thumbnail - using gradient or mock image if available */}
            <LinearGradient
                colors={['#2A2A2A', '#1A1A1A']}
                style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.postCaption} numberOfLines={2}>{item.caption}</Text>
            <View style={styles.postStats}>
                <Ionicons name="play-outline" size={12} color="white" />
                <Text style={styles.statText}>{item.likes}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Search Header */}
            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={theme.colors.textDim} />
                    <TextInput
                        style={styles.input}
                        placeholder="Search users, videos, tags..."
                        placeholderTextColor={theme.colors.textDim}
                        value={query}
                        onChangeText={handleSearch}
                        autoFocus
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Ionicons name="close-circle" size={20} color={theme.colors.textDim} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            </View>

            {loading && <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 20 }} />}

            {/* Content */}
            <FlatList
                data={posts} // Main list is posts grid
                keyExtractor={item => item.id}
                numColumns={3}
                renderItem={renderPostItem}
                ListHeaderComponent={
                    <View>
                        {/* Users Section */}
                        {users.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Users</Text>
                                <FlatList
                                    data={users}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    renderItem={renderUserItem}
                                    keyExtractor={item => item.id}
                                    contentContainerStyle={{ paddingHorizontal: 16 }}
                                />
                            </View>
                        )}

                        {/* Tags Section (Simple Chips) */}
                        {tags.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Tags</Text>
                                <View style={styles.tagContainer}>
                                    {tags.map(tag => (
                                        <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => handleSearch(tag)}>
                                            <Text style={styles.tagText}>#{tag}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Posts Title */}
                        {posts.length > 0 && <Text style={[styles.sectionTitle, { marginLeft: 16, marginBottom: 8 }]}>Videos</Text>}
                    </View>
                }
                ListEmptyComponent={
                    !loading && query.length > 2 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No results found.</Text>
                        </View>
                    ) : null
                }
            />
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
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.surfaceHighlight,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
    },
    input: {
        flex: 1,
        color: theme.colors.white,
        marginLeft: 8,
        fontSize: 16,
    },
    cancelText: {
        color: theme.colors.white,
        fontSize: 16,
    },
    section: {
        marginBottom: 24,
        marginTop: 16,
    },
    sectionTitle: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        marginLeft: 16,
    },
    userItem: {
        alignItems: 'center',
        marginRight: 16,
        width: 70,
    },
    userAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#333',
        marginBottom: 4,
    },
    userName: {
        color: theme.colors.textDim,
        fontSize: 12,
        textAlign: 'center',
    },
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        gap: 8,
    },
    tagChip: {
        backgroundColor: theme.colors.surfaceHighlight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    tagText: {
        color: theme.colors.text,
        fontSize: 14,
    },
    postItem: {
        width: ITEM_WIDTH - 2,
        height: ITEM_WIDTH * 1.5,
        backgroundColor: '#333',
        margin: 1,
        justifyContent: 'flex-end',
        padding: 8,
    },
    postCaption: {
        color: 'white',
        fontSize: 12,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowRadius: 2,
    },
    postStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statText: {
        color: 'white',
        fontSize: 10,
        marginLeft: 4,
    },
    emptyContainer: {
        paddingTop: 100,
        alignItems: 'center',
    },
    emptyText: {
        color: theme.colors.textDim,
        fontSize: 16,
    }
});

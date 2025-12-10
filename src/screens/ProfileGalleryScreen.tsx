import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { Post, Draft } from '../types';
import { POSTS, DRAFTS } from '../mock';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 3;

type GalleryTab = 'posts' | 'artifacts' | 'likes' | 'drafts';

export const ProfileGalleryScreen = () => {
    const navigation = useNavigation<any>();
    const currentUser = useAppStore(state => state.currentUser);
    const feed = useAppStore(state => state.feed); // Using full feed for demo purpose of "Likes" etc.

    const [activeTab, setActiveTab] = useState<GalleryTab>('posts');

    if (!currentUser) return null;

    // Filter Logic
    const getTabContent = () => {
        switch (activeTab) {
            case 'posts':
                // For mock purposes, using all posts or filtering by user is fine. 
                // Let's assume some posts are mine.
                return feed.filter(p => p.userId === currentUser.id || p.userId === 'u1');
            case 'artifacts':
                // Mock artifacts - just subset of posts to show differentiation
                return feed.slice(0, 2);
            case 'likes':
                // Posts I have liked
                return feed.filter(p => p.isLiked);
            case 'drafts':
                return DRAFTS;
            default:
                return [];
        }
    };

    const data = getTabContent();

    const handleItemPress = (item: any, index: number) => {
        if (activeTab === 'drafts') {
            // Draft behavior might be different, maybe open composer
            navigation.navigate('Compose'); // Or some draft editor
        } else {
            // Open Feed Viewer
            navigation.navigate('PostFeed', {
                posts: data,
                initialIndex: index,
                title: activeTab === 'likes' ? 'Liked Videos' : activeTab === 'artifacts' ? 'Artifacts' : 'Posts'
            });
        }
    };

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        if (activeTab === 'drafts') {
            return (
                <TouchableOpacity style={styles.draftItem} onPress={() => handleItemPress(item, index)}>
                    <View style={styles.draftPreview}>
                        <Ionicons name="construct-outline" size={32} color={theme.colors.textDim} />
                    </View>
                    <Text style={styles.draftTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.draftDate}>{item.date}</Text>
                </TouchableOpacity>
            );
        }

        // Standard Post Thumbnail
        // Using picsum for mock thumbnail if post doesn't have one (our Post type uses video placeholder usually)
        // Let's assume item.user.avatar is a placeholder for the thumbnail or use a gradient
        return (
            <TouchableOpacity style={styles.gridItem} onPress={() => handleItemPress(item, index)}>
                {/* Simulate thumbnail with random image based on ID */}
                <Image
                    source={{ uri: `https://picsum.photos/300/500?random=${item.id}` }}
                    style={styles.thumbnail}
                />

                {activeTab === 'artifacts' && (
                    <View style={styles.diamondBadge}>
                        <Ionicons name="diamond" size={12} color={theme.colors.secondary} />
                    </View>
                )}

                <View style={styles.statsOverlay}>
                    <Ionicons name="play-outline" size={12} color="white" />
                    <Text style={styles.statsText}>{item.likes}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const TabIcon = ({ tab, icon, color }: { tab: GalleryTab, icon: any, color?: string }) => (
        <TouchableOpacity
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
        >
            <Ionicons
                name={icon}
                size={24}
                color={activeTab === tab ? (color || theme.colors.text) : theme.colors.textDim}
            />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    <Text style={styles.headerTitle}>{currentUser.username}</Text>
                </TouchableOpacity>
                <TouchableOpacity><Ionicons name="stats-chart" size={24} color={theme.colors.text} /></TouchableOpacity>
            </View>

            <View style={styles.tabs}>
                <TabIcon tab="posts" icon="grid" />
                <TabIcon tab="artifacts" icon="diamond" />
                <TabIcon tab="likes" icon="heart" />
                <TabIcon tab="drafts" icon="documents-outline" />
            </View>

            <FlatList
                data={data}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={3}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No {activeTab} yet.</Text>
                    </View>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.m,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.colors.surfaceHighlight,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        ...theme.typography.h2,
        color: theme.colors.text,
        fontSize: 18,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.surfaceHighlight,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: theme.colors.text,
    },
    listContent: {
        paddingBottom: 40,
    },
    gridItem: {
        width: ITEM_WIDTH,
        height: ITEM_WIDTH * 1.4,
        padding: 1,
        position: 'relative',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: theme.colors.surfaceHighlight,
    },
    statsOverlay: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statsText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'black',
        textShadowRadius: 2,
    },
    diamondBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        borderRadius: 4,
    },
    draftItem: {
        width: ITEM_WIDTH,
        height: ITEM_WIDTH * 1.4,
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: theme.colors.surfaceHighlight,
    },
    draftPreview: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: theme.colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    draftTitle: {
        color: theme.colors.text,
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 4,
    },
    draftDate: {
        color: theme.colors.textDim,
        fontSize: 10,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: theme.colors.textDim,
        fontSize: 16,
    }
});

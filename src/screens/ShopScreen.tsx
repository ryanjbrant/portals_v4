import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, Image, TouchableOpacity, ScrollView, StatusBar, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { POSTS, ARTIFACTS } from '../mock';
import { Post } from '../types';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2; // 16 padding on sides + 16 gap

export const ShopScreen = () => {
    const navigation = useNavigation<any>();
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

    // Filter posts that have artifacts
    const shopPosts = POSTS.filter(p => p.linkedArtifact);
    const featuredPosts = shopPosts.slice(0, 3); // Top 3 as featured

    const categories = ['All', 'Digital', 'Unlocks', 'Fashion', 'Skins', 'Keys'];

    const renderFeaturedItem = ({ item }: { item: Post }) => (
        <TouchableOpacity style={styles.featuredItem} onPress={() => { }}>
            <Image source={{ uri: item.linkedArtifact?.image }} style={styles.featuredImage} />
            <View style={styles.featuredOverlay}>
                <Text style={styles.featuredTitle}>{item.linkedArtifact?.name}</Text>
                <Text style={styles.featuredPrice}>{item.linkedArtifact?.price} 💎</Text>
            </View>
        </TouchableOpacity>
    );

    const renderGridItem = ({ item }: { item: Post }) => (
        <TouchableOpacity style={styles.gridItem} onPress={() => { }}>
            <Image source={{ uri: item.linkedArtifact?.image }} style={styles.gridImage} />
            <View style={styles.gridOverlay}>
                <View style={styles.videoBadge}>
                    <Ionicons name="play" size={10} color="white" />
                </View>
            </View>
            <View style={styles.gridInfo}>
                <Text style={styles.gridTitle} numberOfLines={1}>{item.linkedArtifact?.name}</Text>
                <Text style={styles.gridPrice}>{item.linkedArtifact?.price} 💎</Text>
            </View>
            {/* Mini User Avatar */}
            <View style={styles.gridUser}>
                <Image source={{ uri: item.user.avatar }} style={styles.gridAvatar} />
                <Text style={styles.gridUsername} numberOfLines={1}>@{item.user.username}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Artifacts</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity>
                        <Ionicons name="cart-outline" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search artifacts..."
                    placeholderTextColor={theme.colors.textDim}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Categories */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesList} contentContainerStyle={{ paddingHorizontal: 16 }}>
                    {categories.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.categoryChip, activeCategory === cat && styles.activeCategory]}
                            onPress={() => setActiveCategory(cat)}
                        >
                            <Text style={[styles.categoryText, activeCategory === cat && styles.activeCategoryText]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Featured Drops */}
                <Text style={styles.sectionTitle}>Featured Drops</Text>
                <FlatList
                    data={featuredPosts}
                    renderItem={renderFeaturedItem}
                    keyExtractor={item => 'feat-' + item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                    style={styles.featuredList}
                />

                {/* Grid */}
                <Text style={styles.sectionTitle}>Just For You</Text>
                <View style={styles.gridContainer}>
                    {shopPosts.map(post => (
                        <View key={post.id} style={{ marginBottom: 16 }}>
                            {renderGridItem({ item: post })}
                        </View>
                    ))}
                </View>
                <View style={{ height: 100 }} />
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
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text,
        fontFamily: theme.typography.h1.fontFamily,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceHighlight,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginHorizontal: 16,
        marginBottom: 16,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: theme.colors.text,
        fontSize: 16,
    },
    categoriesList: {
        marginBottom: 24,
    },
    categoryChip: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        marginRight: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    activeCategory: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    categoryText: {
        color: theme.colors.textSecondary,
        fontWeight: '600',
    },
    activeCategoryText: {
        color: '#000',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
        marginLeft: 16,
        marginBottom: 12,
    },
    featuredList: {
        marginBottom: 24,
    },
    featuredItem: {
        width: 280,
        height: 160,
        borderRadius: 12,
        marginRight: 16,
        overflow: 'hidden',
        backgroundColor: '#333',
    },
    featuredImage: {
        width: '100%',
        height: '100%',
        opacity: 0.8,
    },
    featuredOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    featuredTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    featuredPrice: {
        color: theme.colors.primary,
        fontWeight: '700',
        marginTop: 4,
    },
    // Grid
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        justifyContent: 'space-between',
    },
    gridItem: {
        width: COLUMN_WIDTH,
        marginBottom: 8,
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        overflow: 'hidden',
        paddingBottom: 8,
    },
    gridImage: {
        width: '100%',
        height: COLUMN_WIDTH, // Square aspect for artifact? Or 4:5?
        backgroundColor: '#333',
    },
    gridOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    videoBadge: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 4,
        borderRadius: 4,
    },
    gridInfo: {
        padding: 8,
    },
    gridTitle: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    gridPrice: {
        color: theme.colors.primary,
        fontSize: 12,
        fontWeight: '700',
    },
    gridUser: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingBottom: 4,
    },
    gridAvatar: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 4,
    },
    gridUsername: {
        color: theme.colors.textDim,
        fontSize: 10,
    },
});

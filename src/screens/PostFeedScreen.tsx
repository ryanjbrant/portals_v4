import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, StatusBar, TouchableOpacity, Text } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { FeedItem } from '../components/FeedItem';
import { Post } from '../types';
import { theme } from '../theme/theme';
import { Ionicons } from '@expo/vector-icons';

export const PostFeedScreen = () => {
    const route = useRoute<any>();
    const navigation = useNavigation();
    const { posts, initialIndex = 0, title } = route.params || {};
    const flatListRef = useRef<FlatList>(null);

    // Scroll to initial index on mount
    useEffect(() => {
        if (flatListRef.current && initialIndex > 0) {
            // Small timeout to ensure layout is ready
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
            }, 100);
        }
    }, [initialIndex]);

    const renderItem = ({ item }: { item: Post }) => (
        <FeedItem post={item} onCommentPress={() => { }} />
    );

    const getItemLayout = (_: any, index: number) => ({
        length: theme.dimensions.height, // Assuming full screen height items
        offset: theme.dimensions.height * index,
        index,
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent />

            {/* Header Overlay */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={32} color={theme.colors.white} />
                    {title && <Text style={styles.headerTitle}>{title}</Text>}
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={posts}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
                onScrollToIndexFailed={info => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                    });
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 10,
        zIndex: 10,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
        paddingRight: 12,
        paddingLeft: 4,
        paddingVertical: 4,
    },
    headerTitle: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
        marginLeft: -4,
    }
});

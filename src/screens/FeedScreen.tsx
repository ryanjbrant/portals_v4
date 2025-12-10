import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, StatusBar, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { FeedItem } from '../components/FeedItem';
import { CommentsSheet } from '../components/CommentsSheet'; // Creating this next

export const FeedScreen = () => {
    const navigation = useNavigation<any>();
    const feed = useAppStore(state => state.feed);
    const [activeTab, setActiveTab] = useState('FRIENDS');
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const setVoiceContext = useAppStore(state => state.setVoiceContext);

    const renderItem = ({ item }: { item: any }) => (
        <FeedItem post={item} onCommentPress={() => setSelectedPostId(item.id)} />
    );

    // Track visible item for Voice Context
    const onViewableItemsChanged = React.useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            const currentItem = viewableItems[0];
            if (currentItem) {
                setVoiceContext({
                    currentScreen: 'Feed',
                    currentType: 'post',
                    currentId: currentItem.key || currentItem.item.id
                });
            }
        }
    }).current;

    const viewabilityConfig = React.useRef({
        itemVisiblePercentThreshold: 50
    }).current;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent />

            {/* Top Tabs Overlay */}
            <View style={styles.topTabs}>
                {['LIVE', 'FRIENDS', 'FASHION'].map((tab) => (
                    <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)}>
                        <Text style={[
                            styles.tabText,
                            activeTab === tab && styles.activeTabText
                        ]}>
                            {tab}
                        </Text>
                        {activeTab === tab && <View style={styles.indicator} />}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Search Button */}
            <TouchableOpacity
                style={styles.searchButton}
                onPress={() => navigation.navigate('Search')}
            >
                <Ionicons name="search" size={28} color="white" />
            </TouchableOpacity>

            <FlatList
                data={feed}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={Dimensions.get('window').height - 80} // Adjusting for tab bar roughly
                snapToAlignment="start"
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
            />

            <CommentsSheet
                visible={!!selectedPostId}
                postId={selectedPostId}
                onClose={() => setSelectedPostId(null)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background
    },
    topTabs: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        zIndex: 10,
        gap: 20,
    },
    tabText: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        fontSize: 16,
    },
    activeTabText: {
        color: theme.colors.white,
        fontWeight: '700',
        fontSize: 16,
    },
    indicator: {
        height: 2,
        backgroundColor: theme.colors.white,
        marginTop: 4,
        borderRadius: 2,
        width: '60%',
        alignSelf: 'center',
    },
    searchButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 20,
    }
});

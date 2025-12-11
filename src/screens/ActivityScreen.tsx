import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Image, TouchableOpacity, ScrollView } from 'react-native';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { Notification } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type FilterType = 'All' | 'Collabs' | 'Mentions';

export const ActivityScreen = () => {
    const navigation = useNavigation<any>();
    const notifications = useAppStore(state => state.notifications);
    const respondToRequest = useAppStore(state => state.respondToRequest);
    const markAsRead = useAppStore(state => state.markAsRead);

    // Filter State
    const [activeFilter, setActiveFilter] = useState<FilterType>('All');

    // Derived State
    const filteredNotifications = notifications.filter(n => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Collabs') return n.type === 'collab_invite';
        if (activeFilter === 'Mentions') return n.type === 'mention' || n.type === 'like_comment';
        return true;
    });

    const handleAction = (id: string, action: 'accepted' | 'declined') => {
        respondToRequest(id, action);
        markAsRead(id);
    };

    const handleNotificationPress = (item: Notification) => {
        markAsRead(item.id);
        if (item.type === 'message') {
            navigation.navigate('Chat', { userId: item.user.id });
        } else if (item.data?.postId) {
            // navigation.navigate('PostDetail', { postId: item.data.postId }); // Placeholder
        }
    };

    const renderItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.row, item.read ? null : styles.unreadRow]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.avatarContainer}>
                <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
                {renderIconBadge(item.type)}
            </View>

            <View style={styles.content}>
                <View style={styles.textContainer}>
                    <Text style={styles.text}>
                        <Text style={styles.username}>{item.user.name || item.user.username}</Text>{' '}
                        {item.message}
                    </Text>
                    <Text style={styles.timestamp}>{item.timestamp}</Text>
                </View>

                {/* Collab Actions */}
                {item.type === 'collab_invite' && item.actionStatus === 'pending' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => handleAction(item.id, 'accepted')}>
                            <Text style={styles.btnText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => handleAction(item.id, 'declined')}>
                            <Text style={[styles.btnText, styles.declineText]}>Decline</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Collab Status */}
                {item.type === 'collab_invite' && item.actionStatus !== 'pending' && (
                    <Text style={styles.statusText}>
                        {item.actionStatus === 'accepted' ? 'Accepted' : 'Declined'}
                    </Text>
                )}

                {/* Message Reply Action */}
                {item.type === 'message' && (
                    <TouchableOpacity style={styles.replyBtn} onPress={() => handleNotificationPress(item)}>
                        <Ionicons name="arrow-undo" size={14} color={theme.colors.textDim} />
                        <Text style={styles.replyText}>Reply</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Media Preview (Right Side) */}
            {item.data?.previewMedia && (
                <Image source={{ uri: item.data.previewMedia }} style={styles.postPreview} />
            )}
        </TouchableOpacity>
    );

    const renderIconBadge = (type: string) => {
        let icon = 'notifications';
        let color = theme.colors.primary;
        let iconColor = 'white';

        switch (type) {
            case 'like_post': icon = 'heart'; color = '#E91E63'; break;
            case 'collab_invite': icon = 'people'; color = '#9C27B0'; break;
            case 'mention': icon = 'at'; color = '#2196F3'; break;
            case 'message': icon = 'chatbubble'; color = '#4CAF50'; break;
            case 'follow':
                icon = 'person-add';
                color = theme.colors.primary;
                iconColor = 'black'; // Fix visibility on yellow
                break;
        }

        return (
            <View style={[styles.iconBadge, { backgroundColor: color }]}>
                <Ionicons name={icon as any} size={10} color={iconColor} />
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    {navigation.canGoBack() && (
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
                        </TouchableOpacity>
                    )}
                    <Text style={styles.title}>Activity</Text>
                </View>
            </View>

            {/* Filter Tabs */}
            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
                    {(['All', 'Collabs', 'Mentions'] as FilterType[]).map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            style={[styles.tab, activeFilter === filter && styles.activeTab]}
                            onPress={() => setActiveFilter(filter)}
                        >
                            <Text style={[styles.tabText, activeFilter === filter && styles.activeTabText]}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredNotifications}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
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
        paddingHorizontal: theme.spacing.m,
        paddingTop: theme.spacing.m,
        paddingBottom: theme.spacing.s,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: theme.spacing.s,
        padding: 4,
    },
    title: {
        ...theme.typography.h2,
        color: theme.colors.text,
        fontSize: 28,
    },
    tabsContainer: {
        marginBottom: theme.spacing.s,
    },
    tabsContent: {
        paddingHorizontal: theme.spacing.m,
        gap: 12,
    },
    tab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    activeTab: {
        backgroundColor: theme.colors.white,
        borderColor: theme.colors.white,
    },
    tabText: {
        color: theme.colors.textDim,
        fontWeight: '600',
        fontSize: 14,
    },
    activeTabText: {
        color: theme.colors.background,
    },
    list: {
        paddingVertical: theme.spacing.s,
    },
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: theme.spacing.m,
        alignItems: 'flex-start',
    },
    unreadRow: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    avatarContainer: {
        marginRight: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.surface,
    },
    iconBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.colors.background,
    },
    content: {
        flex: 1,
        marginRight: 12,
    },
    textContainer: {
        marginBottom: 4,
    },
    text: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
    username: {
        color: theme.colors.text,
        fontWeight: '700',
    },
    timestamp: {
        color: theme.colors.textDim,
        fontSize: 12,
        marginTop: 2,
    },
    postPreview: {
        width: 48,
        height: 64, // Portrait Aspect
        borderRadius: 4,
        backgroundColor: theme.colors.surfaceHighlight,
    },
    actionRow: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    acceptBtn: {
        backgroundColor: theme.colors.primary,
    },
    declineBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    btnText: {
        color: 'black',
        fontWeight: '600',
        fontSize: 12,
    },
    declineText: {
        color: theme.colors.textDim,
    },
    statusText: {
        marginTop: 6,
        color: theme.colors.textDim,
        fontSize: 12,
        fontStyle: 'italic',
    },
    replyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    replyText: {
        color: theme.colors.textDim,
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    }
});

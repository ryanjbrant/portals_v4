import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, Image, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { USERS } from '../mock';
import { useRoute } from '@react-navigation/native';

export const PeopleScreen = () => {
    const route = useRoute<any>();
    const initialTab = route.params?.tab || 'Friends';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [users, setUsers] = useState(USERS);
    const [search, setSearch] = useState('');

    // Local state for actions
    const [connectedUsers, setConnectedUsers] = useState<Set<string>>(new Set());
    const [unfollowingIds, setUnfollowingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (route.params?.tab) setActiveTab(route.params.tab);
    }, [route.params]);

    useEffect(() => {
        // Reset users when tab changes if needed, or filter?
        // For now, we use the same mock USERS list for all tabs to demonstrate logic,
        // but in real app 'Invites' would fetch invites, etc.
        setUsers(USERS);
        setUnfollowingIds(new Set());
    }, [activeTab]);

    // Actions
    const handleConnect = (userId: string) => {
        setConnectedUsers(prev => {
            const next = new Set(prev);
            const isConnected = next.has(userId);
            if (isConnected) {
                next.delete(userId);
                console.log(`[DB] Disconnected from user ${userId}`);
            } else {
                next.add(userId);
                console.log(`[DB] Connected with user ${userId}`);
            }
            return next;
        });
    };

    const handleUnfollowRequest = (userId: string) => {
        Alert.alert(
            "Unfollow",
            "Are you sure you want to unfollow this person?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Unfollow", style: 'destructive', onPress: () => performUnfollow(userId) }
            ]
        );
    };

    const performUnfollow = (userId: string) => {
        console.log(`[DB] Unfollowing user ${userId}`);
        setUsers(prev => prev.filter(u => u.id !== userId));
    };

    const handleFollowingTap = (userId: string) => {
        if (unfollowingIds.has(userId)) return; // Already processing

        // Toggle to "Unfollowed" visually
        setUnfollowingIds(prev => new Set(prev).add(userId));
        console.log(`[DB] Marked user ${userId} as Unfollowed`);

        // Remove after 3 seconds
        setTimeout(() => {
            setUsers(prev => prev.filter(u => u.id !== userId));
            // Cleanup ID from set not strictly needed if user is gone, but good practice
            setUnfollowingIds(prev => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        }, 3000);
    };

    const renderItem = ({ item }: { item: any }) => {
        const isConnected = connectedUsers.has(item.id);
        const isUnfollowing = unfollowingIds.has(item.id);

        return (
            <View style={styles.userRow}>
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
                <View style={styles.userInfo}>
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.userStatus}>Online now</Text>
                </View>

                {/* --- TEAM TAB --- */}
                {activeTab === 'Team' && (
                    <TouchableOpacity
                        style={[styles.actionButton, isConnected && styles.connectedButton]}
                        onPress={() => handleConnect(item.id)}
                    >
                        <Text style={[styles.actionText, isConnected && styles.connectedText]}>
                            {isConnected ? 'Disconnected' : 'Connected'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* --- FRIENDS TAB --- */}
                {activeTab === 'Friends' && (
                    <>
                        <TouchableOpacity style={styles.actionButton}>
                            <Text style={styles.actionText}>Message</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleUnfollowRequest(item.id)}>
                            <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </>
                )}

                {/* --- INVITES TAB --- */}
                {activeTab === 'Invites' && (
                    <View style={styles.inviteContainer}>
                        <TouchableOpacity style={[styles.inviteButton, { backgroundColor: theme.colors.primary }]}>
                            <Text style={styles.actionText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.inviteButton, { backgroundColor: '#333' }]}>
                            <Text style={[styles.actionText, { color: '#FFF' }]}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* --- FOLLOWING TAB --- */}
                {activeTab === 'Following' && (
                    <TouchableOpacity
                        style={[styles.actionButton, isUnfollowing && styles.unfollowedButton]}
                        onPress={() => handleFollowingTap(item.id)}
                    >
                        <Text style={[styles.actionText, isUnfollowing && styles.unfollowedText]}>
                            {isUnfollowing ? 'Unfollowed' : 'Following'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>People</Text>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for a person"
                        placeholderTextColor={theme.colors.textDim}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            <View style={styles.tabs}>
                {['Team', 'Friends', 'Invites', 'Following'].map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={users}
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
        padding: theme.spacing.m,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text,
        marginBottom: theme.spacing.m,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceHighlight,
        borderRadius: theme.borderRadius.m,
        paddingHorizontal: theme.spacing.m,
    },
    searchIcon: {
        marginRight: theme.spacing.s,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        color: theme.colors.text,
        fontSize: 16,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing.m,
        gap: 12,
        marginBottom: theme.spacing.m,
    },
    tab: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: theme.borderRadius.l,
        backgroundColor: theme.colors.surface,
    },
    activeTab: {
        backgroundColor: theme.colors.white,
    },
    tabText: {
        color: theme.colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: theme.colors.background,
    },
    list: {
        padding: theme.spacing.m,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.l,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: theme.spacing.m,
    },
    userInfo: {
        flex: 1,
    },
    username: {
        color: theme.colors.text,
        fontWeight: '600',
        fontSize: 16,
    },
    userStatus: {
        color: theme.colors.textDim,
        fontSize: 12,
    },
    actionButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 4,
        marginRight: theme.spacing.m,
    },
    connectedButton: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    actionText: {
        color: '#000', // Default black as requested
        fontWeight: '600',
        fontSize: 12,
    },
    connectedText: {
        color: theme.colors.text,
    },

    // Updated Styles
    unfollowedButton: {
        backgroundColor: '#FF6B6B', // Warm Red/Salmon
    },
    unfollowedText: {
        color: '#FFF',
    },

    // Invite Styles
    inviteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        marginRight: theme.spacing.m,
        overflow: 'hidden',
        // Optional: height to match actionButton if needed
    },
    inviteButton: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 0, // Ensure they butt up against each other
    },
    // Divider removed
});

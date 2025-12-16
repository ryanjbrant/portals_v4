import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, Image, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { USERS } from '../mock';
import { useRoute, useNavigation } from '@react-navigation/native';

import { useAppStore } from '../store';
import { User } from '../types';

export const PeopleScreen = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const initialTab = route.params?.tab || 'Friends';
    const targetUserId = route.params?.userId || useAppStore.getState().currentUser?.id;
    const currentUser = useAppStore(state => state.currentUser);
    const isSelf = targetUserId === currentUser?.id;

    const [activeTab, setActiveTab] = useState(initialTab);
    const [search, setSearch] = useState('');

    // Store State
    const relationships = useAppStore(state => state.relationships);
    const approveInvite = useAppStore(state => state.approveInvite);
    const rejectInvite = useAppStore(state => state.rejectInvite);
    const followUser = useAppStore(state => state.followUser);
    const unfollowUser = useAppStore(state => state.unfollowUser);
    const removeTeamMember = useAppStore(state => state.removeTeamMember);

    // Filter Users based on Tab
    const getTabUsers = () => {
        let filteredIds: string[] = [];

        // If viewing someone else, we don't have their relationships in store.
        // For MVP Demo: Mock return some users so the list isn't empty.
        if (!isSelf) {
            // Mock data for others: simply return a subset of USERS excluding self
            // In real app: await fetchUserRelationships(targetUserId)
            const allIds = USERS.map(u => u.id).filter(id => id !== targetUserId);
            filteredIds = allIds.slice(0, 3); // Just show 3 random people as followers/following

            // Allow searching full directory if tab is Friends/Following to simulate "Network"
        } else {
            // Viewing Self
            switch (activeTab) {
                case 'Team': filteredIds = relationships.team; break;
                case 'Invites': filteredIds = relationships.invites; break;
                case 'Friends': filteredIds = relationships.friends; break;
                case 'Following': filteredIds = relationships.following; break;
                default: filteredIds = [];
            }
        }

        // If tab is 'Friends' and we want to show "Suggested" if empty, we can handle that.
        // But strictly:
        const list = USERS.filter(u => filteredIds.includes(u.id));

        // Search Filter
        if (search) {
            return list.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase()));
        }
        return list;
    };

    const displayUsers = getTabUsers();

    // Actions
    const onApprove = (id: string) => {
        approveInvite(id);
        Alert.alert("Success", "User added to your Team!");
    };

    const onReject = (id: string) => {
        Alert.alert(
            "Reject Invitation",
            "Are you sure you want to reject this invitation?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reject",
                    style: 'destructive',
                    onPress: () => {
                        rejectInvite(id);
                        // TODO: Log to DB and notify user (Handled by Store action conceptually)
                    }
                }
            ]
        );
    };

    const handleUnfollowRequest = (userId: string) => {
        Alert.alert(
            "Unfollow",
            "Are you sure you want to unfollow this person?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Unfollow", style: 'destructive', onPress: () => unfollowUser(userId) }
            ]
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        // const isConnected = connectedUsers.has(item.id); // Replaced by store logic
        // const isUnfollowing = unfollowingIds.has(item.id); // Replaced by store logic

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
                        style={[styles.actionButton, styles.connectedButton]}
                        onPress={() => removeTeamMember(item.id)}
                    >
                        <Text style={[styles.actionText, styles.connectedText]}>Remove</Text>
                    </TouchableOpacity>
                )}

                {/* --- FRIENDS TAB --- */}
                {activeTab === 'Friends' && (
                    <>
                        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Chat', { userId: item.id })}>
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
                        <TouchableOpacity
                            style={[styles.inviteButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => onApprove(item.id)}
                        >
                            <Text style={styles.actionText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.inviteButton, { backgroundColor: '#333' }]}
                            onPress={() => onReject(item.id)}
                        >
                            <Text style={[styles.actionText, { color: '#FFF' }]}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* --- FOLLOWING TAB --- */}
                {activeTab === 'Following' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.connectedButton]}
                        onPress={() => handleUnfollowRequest(item.id)}
                    >
                        <Text style={[styles.actionText, styles.connectedText]}>Following</Text>
                    </TouchableOpacity>
                )}
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
                    <Text style={styles.title}>People</Text>
                </View>

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
                data={displayUsers}
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
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    backButton: {
        marginRight: theme.spacing.m,
        padding: 4,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text,
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

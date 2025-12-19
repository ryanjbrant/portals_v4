import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Image, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { User } from '../types';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface CollaboratorModalProps {
    visible: boolean;
    onClose: () => void;
    draftId?: string;
    draftTitle?: string;
    currentCollaborators?: string[];
}

export const CollaboratorModal: React.FC<CollaboratorModalProps> = ({
    visible,
    onClose,
    draftId,
    draftTitle = 'Untitled Scene',
    currentCollaborators = []
}) => {
    const relationships = useAppStore(state => state.relationships);
    const currentUser = useAppStore(state => state.currentUser);
    const sendInvite = useAppStore(state => state.sendCollaborationInvite);

    const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [followingUsers, setFollowingUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch following users from Firestore when modal opens
    useEffect(() => {
        if (!visible || !currentUser?.id) return;

        const fetchFollowingUsers = async () => {
            setLoading(true);
            try {
                const followingRef = collection(db, 'users', currentUser.id, 'following');
                const snapshot = await getDocs(followingRef);
                const followingIds = snapshot.docs.map(d => d.id);

                // Fetch user details for each following ID
                const userPromises = followingIds.map(async (userId) => {
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    if (userDoc.exists()) {
                        return { id: userId, ...userDoc.data() } as User;
                    }
                    return null;
                });

                const users = (await Promise.all(userPromises)).filter(Boolean) as User[];
                setFollowingUsers(users);
            } catch (e) {
                console.error('[CollaboratorModal] Error fetching following users:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchFollowingUsers();
    }, [visible, currentUser?.id]);

    // Filter users by search query
    const filteredUsers = followingUsers.filter(user =>
        user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Track loading state for each user being invited
    const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());

    const handleInvite = async (userId: string) => {
        console.log('[CollaboratorModal] handleInvite called:', { userId, draftId, draftTitle });

        if (!draftId) {
            console.error('[CollaboratorModal] No draftId! Cannot send invite.');
            return;
        }

        // Set loading state
        setInvitingIds(prev => new Set(prev).add(userId));

        try {
            console.log('[CollaboratorModal] Calling sendInvite...');
            await sendInvite(draftId, userId, draftTitle);
            console.log('[CollaboratorModal] sendInvite completed successfully!');
            // Mark as invited after success
            setInvitedIds(prev => new Set(prev).add(userId));
        } catch (e) {
            console.error('[CollaboratorModal] Invite failed:', e);
        } finally {
            setInvitingIds(prev => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
        }
    };

    const isCollaborator = (userId: string) => currentCollaborators.includes(userId);
    const isInvited = (userId: string) => invitedIds.has(userId);
    const isInviting = (userId: string) => invitingIds.has(userId);

    const renderItem = ({ item }: { item: User }) => {
        const alreadyAdded = isCollaborator(item.id);
        const justInvited = isInvited(item.id);
        const currentlyInviting = isInviting(item.id);

        return (
            <View style={styles.userRow}>
                <Image source={{ uri: item.avatar || 'https://i.pravatar.cc/150' }} style={styles.avatar} />
                <View style={styles.userInfo}>
                    <Text style={styles.username}>@{item.username}</Text>
                    {item.name && <Text style={styles.subtext}>{item.name}</Text>}
                </View>

                <TouchableOpacity
                    style={[
                        styles.inviteButton,
                        (alreadyAdded || justInvited) && styles.invitedButton,
                        justInvited && styles.sentButton
                    ]}
                    onPress={() => handleInvite(item.id)}
                    disabled={alreadyAdded || justInvited || currentlyInviting}
                >
                    {currentlyInviting ? (
                        <ActivityIndicator size="small" color="black" />
                    ) : justInvited ? (
                        <View style={styles.sentContainer}>
                            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                            <Text style={styles.sentText}>Sent!</Text>
                        </View>
                    ) : (
                        <Text style={[
                            styles.inviteText,
                            alreadyAdded && styles.invitedText
                        ]}>
                            {alreadyAdded ? "Joined" : "Invite"}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Collaborate</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.subtitle}>Invite friends to edit "{draftTitle}" with you.</Text>

                    {/* Search Input */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={18} color={theme.colors.textDim} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search friends..."
                            placeholderTextColor={theme.colors.textDim}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color={theme.colors.textDim} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                            <Text style={styles.loadingText}>Loading friends...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredUsers}
                            renderItem={renderItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>
                                    {searchQuery ? 'No matching friends found.' : 'No friends to invite. Follow people to collaborate!'}
                                </Text>
                            }
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        height: '60%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitle: {
        color: theme.colors.textDim,
        fontSize: 14,
        marginBottom: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2A2A',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        color: 'white',
        fontSize: 16,
        marginLeft: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: theme.colors.textDim,
        marginTop: 8,
    },
    listContent: {
        paddingBottom: 20,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        backgroundColor: '#333'
    },
    userInfo: {
        flex: 1,
    },
    username: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
    },
    subtext: {
        color: theme.colors.textDim,
        fontSize: 12,
    },
    inviteButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 70,
        alignItems: 'center',
        justifyContent: 'center',
    },
    invitedButton: {
        backgroundColor: '#333',
        borderWidth: 1,
        borderColor: '#555'
    },
    sentButton: {
        backgroundColor: '#1E3A1E',
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    inviteText: {
        color: 'black',
        fontWeight: 'bold',
        fontSize: 12
    },
    invitedText: {
        color: 'white'
    },
    sentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    sentText: {
        color: '#4CAF50',
        fontWeight: 'bold',
        fontSize: 12,
    },
    emptyText: {
        color: theme.colors.textDim,
        textAlign: 'center',
        marginTop: 20
    }
});

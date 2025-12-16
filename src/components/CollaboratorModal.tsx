import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { User } from '../types';

interface CollaboratorModalProps {
    visible: boolean;
    onClose: () => void;
    draftId?: string;
    currentCollaborators?: string[];
}

export const CollaboratorModal: React.FC<CollaboratorModalProps> = ({ visible, onClose, draftId, currentCollaborators = [] }) => {
    const relationships = useAppStore(state => state.relationships);
    const sendInvite = useAppStore(state => state.sendCollaborationInvite);
    const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

    // Mock friend objects since store only has IDs
    // In real app, we would select from a users cache or fetch details
    const friends: User[] = [
        { id: 'u3', username: 'ryan_b', avatar: 'https://i.pravatar.cc/150?u=ryan_b', followers: 120, following: 50, friends: 10, flames: 500 },
        { id: 'u4', username: 'sarah_dev', avatar: 'https://i.pravatar.cc/150?u=sarah_dev', followers: 200, following: 100, friends: 20, flames: 800 },
        { id: 'u5', username: 'alex_art', avatar: 'https://i.pravatar.cc/150?u=alex_art', followers: 50, following: 20, friends: 5, flames: 100 },
    ].filter(u => relationships.friends.includes(u.id) || relationships.following.includes(u.id)); // Using following as proxy for friends list demo

    const handleInvite = async (userId: string) => {
        if (!draftId) return;
        setInvitedIds(prev => new Set(prev).add(userId));
        await sendInvite(draftId, userId);
    };

    const isCollaborator = (userId: string) => currentCollaborators.includes(userId);
    const isInvited = (userId: string) => invitedIds.has(userId);

    const renderItem = ({ item }: { item: User }) => {
        const alreadyAdded = isCollaborator(item.id);
        const justInvited = isInvited(item.id);

        return (
            <View style={styles.userRow}>
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
                <View style={styles.userInfo}>
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.subtext}>Friend</Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.inviteButton,
                        (alreadyAdded || justInvited) && styles.invitedButton
                    ]}
                    onPress={() => handleInvite(item.id)}
                    disabled={alreadyAdded || justInvited}
                >
                    <Text style={[
                        styles.inviteText,
                        (alreadyAdded || justInvited) && styles.invitedText
                    ]}>
                        {alreadyAdded ? "Joined" : justInvited ? "Invited" : "Invite"}
                    </Text>
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
                        <Text style={styles.title}>Collaborators</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.subtitle}>Invite friends to edit this scene with you.</Text>

                    <FlatList
                        data={friends}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No friends found to invite.</Text>
                        }
                    />
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
        marginBottom: 20,
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
    },
    invitedButton: {
        backgroundColor: '#333',
        borderWidth: 1,
        borderColor: '#555'
    },
    inviteText: {
        color: 'black',
        fontWeight: 'bold',
        fontSize: 12
    },
    invitedText: {
        color: 'white'
    },
    emptyText: {
        color: theme.colors.textDim,
        textAlign: 'center',
        marginTop: 20
    }
});

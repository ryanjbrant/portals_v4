import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Platform, Keyboard, Animated, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { FeedService } from '../services/feed';
import { Comment } from '../types';

interface CommentsSheetProps {
    visible: boolean;
    postId: string | null;
    onClose: () => void;
}

const CommentItem = ({ item, onReply, depth = 0 }: { item: Comment, onReply: (username: string, id: string) => void, depth?: number }) => {
    const [showReplies, setShowReplies] = useState(false);
    const [isLiked, setIsLiked] = useState(item.isLiked);
    const [likes, setLikes] = useState(item.likes);

    const toggleLike = () => {
        setIsLiked(!isLiked);
        setLikes(prev => isLiked ? prev - 1 : prev + 1);
        // In real app, call API
    };

    if (!item || !item.user) return null;

    return (
        <View style={[styles.commentRow, { marginLeft: depth * 40 }]}>
            <Image source={{ uri: item.user.avatar || 'https://i.pravatar.cc/150' }} style={[styles.avatar, depth > 0 && styles.replyAvatar]} />

            <View style={styles.commentContent}>
                <Text style={styles.username}>
                    {item.user.username || 'User'}
                    {/* Simplified verification badge logic */}
                    {item.user.followers > 1000 && <Ionicons name="checkmark-circle" size={12} color="#20D5D2" style={{ marginLeft: 4 }} />}
                </Text>

                <Text style={styles.commentText}>{item.text}</Text>

                <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{item.timestamp || 'now'}</Text>
                    <TouchableOpacity onPress={() => onReply(item.user.username, item.id)}>
                        <Text style={styles.replyButtonText}>Reply</Text>
                    </TouchableOpacity>
                </View>

                {/* View Replies Toggle */}
                {item.replies && item.replies.length > 0 && (
                    <TouchableOpacity
                        style={styles.viewRepliesContainer}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setShowReplies(!showReplies);
                        }}
                    >
                        <View style={styles.dash} />
                        <Text style={styles.viewRepliesText}>
                            {showReplies ? 'Hide replies' : `View ${item.replies.length} replies`}
                        </Text>
                        <Ionicons name={showReplies ? "chevron-up" : "chevron-down"} size={12} color={theme.colors.textDim} />
                    </TouchableOpacity>
                )}

                {/* Nested Replies */}
                {showReplies && item.replies && (
                    <View style={styles.repliesList}>
                        {item.replies.map(reply => (
                            <CommentItem
                                key={reply.id}
                                item={reply}
                                onReply={onReply}
                                depth={depth + 1}
                            />
                        ))}
                    </View>
                )}
            </View>

            {/* Like Button */}
            <TouchableOpacity style={styles.likeContainer} onPress={toggleLike}>
                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={16} color={isLiked ? "#ff4444" : theme.colors.textDim} />
                <Text style={styles.likeCount}>{likes}</Text>
            </TouchableOpacity>
        </View>
    );
};

export const CommentsSheet = ({ visible, postId, onClose }: CommentsSheetProps) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ username: string, id: string } | null>(null);

    const currentUser = useAppStore(state => state.currentUser);
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    // Subscribe to comments when sheet opens
    useEffect(() => {
        if (visible && postId) {
            const unsubscribe = FeedService.subscribeToComments(postId, (updatedComments) => {
                setComments(updatedComments);
            });
            return () => unsubscribe();
        } else {
            setComments([]);
            setReplyingTo(null);
        }
    }, [visible, postId]);

    const handleReply = (username: string, id: string) => {
        setReplyingTo({ username, id });
        setNewComment(`@${username} `);
        inputRef.current?.focus();
    };

    const handleSend = async () => {
        if (!newComment.trim() || !currentUser || !postId) return;

        const text = newComment;
        setNewComment('');
        setReplyingTo(null);
        Keyboard.dismiss();

        try {
            await FeedService.addComment(
                postId,
                currentUser.id,
                text,
                currentUser.avatar || '',
                currentUser.username
            );

            // Increment local feed count in store
            useAppStore.getState().addComment(postId, text);

            // Scroll to bottom? No, usually stay. Maybe scroll to top if new?
            // For now, simple behavior.
        } catch (error) {
            console.error("Failed to send comment:", error);
        }
    };

    const renderComment = ({ item }: { item: Comment }) => (
        <CommentItem item={item} onReply={handleReply} />
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.dismissArea} onPress={onClose} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.sheet}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ width: 24 }} />
                        <Text style={styles.headerTitle}>
                            {comments.length > 0 ? `${comments.length} comments` : 'Comments'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* List */}
                    <FlatList
                        ref={flatListRef}
                        data={comments}
                        renderItem={renderComment}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No comments yet. Start the conversation!</Text>
                            </View>
                        }
                    />

                    {/* Input Area */}
                    <View style={styles.inputContainer}>
                        <Image
                            source={{ uri: currentUser?.avatar || 'https://i.pravatar.cc/150' }}
                            style={styles.inputAvatar}
                        />
                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : "Add a comment..."}
                            placeholderTextColor={theme.colors.textDim}
                            value={newComment}
                            onChangeText={setNewComment}
                            multiline
                            maxLength={500}
                        />
                        <View style={styles.inputActions}>
                            <TouchableOpacity style={styles.actionIcon}>
                                <Ionicons name="at" size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionIcon}>
                                <Ionicons name="happy-outline" size={20} color={theme.colors.text} />
                            </TouchableOpacity>

                            {newComment.trim().length > 0 && (
                                <TouchableOpacity onPress={handleSend}>
                                    <Ionicons name="arrow-up-circle" size={32} color="#FE2C55" />
                                    {/* Using TikTok-ish red/pink color or primary */}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <View style={{ height: Platform.OS === 'ios' ? 20 : 0, backgroundColor: theme.colors.surface }} />
                </KeyboardAvoidingView>
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
    dismissArea: {
        flex: 1,
    },
    sheet: {
        backgroundColor: '#121212', // Darker background
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        height: '75%',
        paddingTop: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 80,
    },
    emptyContainer: {
        paddingTop: 60,
        alignItems: 'center',
    },
    emptyText: {
        color: theme.colors.textDim,
        fontSize: 14,
    },

    // Comment Row
    commentRow: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 12,
        backgroundColor: '#333',
    },
    replyAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 8,
    },
    commentContent: {
        flex: 1,
        marginRight: 8,
    },
    username: {
        color: '#AAA',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
    },
    commentText: {
        color: '#FFF',
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '400',
    },
    metaRow: {
        flexDirection: 'row',
        marginTop: 6,
        alignItems: 'center',
    },
    metaText: {
        color: '#666',
        fontSize: 12,
        marginRight: 16,
    },
    replyButtonText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },

    // Replies Toggle
    viewRepliesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    dash: {
        width: 24,
        height: 1,
        backgroundColor: '#444',
        marginRight: 12,
    },
    viewRepliesText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
        marginRight: 4,
    },
    repliesList: {
        marginTop: 12,
    },

    // Likes
    likeContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 4,
    },
    likeCount: {
        color: '#666',
        fontSize: 10,
        marginTop: 2,
    },

    // Input
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        paddingHorizontal: 16,
        borderTopWidth: 0.5,
        borderTopColor: '#333',
        backgroundColor: '#121212',
    },
    inputAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: 40,
        color: '#fff',
        fontSize: 15,
    },
    inputActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionIcon: {
        opacity: 0.8,
    }
});

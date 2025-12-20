// ... imports
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Platform, Keyboard, Animated, LayoutAnimation, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { FeedService } from '../services/feed';
import { NotificationService } from '../services/notifications';
import { Comment, User } from '../types';
import { ReportModal } from './ReportModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.5; // Reduced from 0.7 to show more video

const QUICK_EMOJIS = ['🔥', '❤️', '😂', '👏', '😮', '😢', '😡', '👍', '🎉', '💯'];

interface CommentsSheetProps {
    visible: boolean;
    postId: string | null;
    onClose: () => void;
}

// ... CommentItem component with delete and report support
const CommentItem = ({
    item,
    onReply,
    onDelete,
    onReport,
    currentUserId,
    depth = 0,
    parentCommentId
}: {
    item: Comment,
    onReply: (username: string, id: string, parentId?: string) => void,
    onDelete?: (commentId: string) => void,
    onReport?: (comment: Comment) => void,
    currentUserId?: string,
    depth?: number,
    parentCommentId?: string  // The root parent comment ID for nested replies
}) => {
    // ... existing code ...
    const [showReplies, setShowReplies] = useState(false);
    const [isLiked, setIsLiked] = useState(item.isLiked);
    const [likes, setLikes] = useState(item.likes);

    const toggleLike = () => {
        setIsLiked(!isLiked);
        setLikes(prev => isLiked ? prev - 1 : prev + 1);
        // In real app, call API
    };

    const handleLongPress = () => {
        const isAuthor = currentUserId && item.user?.id === currentUserId;

        if (isAuthor) {
            // Own comment - show delete option
            Alert.alert(
                'Comment Options',
                'What would you like to do?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => onDelete?.(item.id)
                    }
                ]
            );
        } else {
            // Other's comment - show report option
            Alert.alert(
                'Comment Options',
                'What would you like to do?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Report',
                        onPress: () => {
                            console.log('[CommentItem] Report pressed for comment:', item.id, 'onReport:', !!onReport);
                            onReport?.(item);
                        }
                    }
                ]
            );
        }
    };

    if (!item || !item.user) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={handleLongPress}
            delayLongPress={500}
        >
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
                        {/* Hide Reply button beyond depth 2 (TikTok-style max 3 levels) */}
                        {depth < 2 && (
                            <TouchableOpacity onPress={() => {
                                // For nested replies, use the parentCommentId (passed from parent)
                                // For top-level comments (depth === 0), use this comment's ID
                                const rootParentId = depth === 0 ? item.id : parentCommentId;
                                onReply(item.user.username, item.id, rootParentId);
                            }}>
                                <Text style={styles.replyButtonText}>Reply</Text>
                            </TouchableOpacity>
                        )}
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
                                    onDelete={onDelete}
                                    onReport={onReport}
                                    currentUserId={currentUserId}
                                    depth={depth + 1}
                                    parentCommentId={depth === 0 ? item.id : parentCommentId}  // Pass down the root parent ID
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
        </TouchableOpacity>
    );
};

export const CommentsSheet = ({ visible, postId, onClose }: CommentsSheetProps) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [showUserList, setShowUserList] = useState(false);
    const [showEmojiList, setShowEmojiList] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ username: string, id: string, parentId?: string } | null>(null);
    const [reportingComment, setReportingComment] = useState<Comment | null>(null);

    // Internal state to keep modal mounted during close animation
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Animation values
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

    const currentUser = useAppStore(state => state.currentUser);
    const feed = useAppStore(state => state.feed);
    const addNotification = useAppStore(state => state.addNotification);
    const pendingComment = useAppStore(state => state.pendingComment);
    const setPendingComment = useAppStore(state => state.setPendingComment);
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    // Get real followers from store
    const followingUsers = useAppStore(state => state.followingUsers);
    const fetchFollowingUsers = useAppStore(state => state.fetchFollowingUsers);

    // Fetch following users when sheet opens and list is empty
    useEffect(() => {
        if (visible && followingUsers.length === 0) {
            fetchFollowingUsers();
        }
    }, [visible]);

    // Custom animation: sheet slides in/out (no opacity change)
    useEffect(() => {
        if (visible) {
            // Show modal first, then animate sheet up
            setIsModalVisible(true);
            overlayOpacity.setValue(1); // Instantly show overlay
            Animated.timing(sheetTranslateY, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else if (isModalVisible) {
            // Animate sheet down, then hide modal
            Animated.timing(sheetTranslateY, {
                toValue: SHEET_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }).start(() => {
                // Hide modal and reset overlay only after animation completes
                overlayOpacity.setValue(0);
                setIsModalVisible(false);
            });
        }
    }, [visible]);

    // Keyboard handling - move sheet up when keyboard opens
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                setKeyboardHeight(e.endCoordinates.height);
            }
        );
        const keyboardWillHide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardHeight(0);
            }
        );

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    // Subscribe to comments
    useEffect(() => {
        if (visible && postId) {
            const unsubscribe = FeedService.subscribeToComments(postId, (updatedComments) => {
                setComments(updatedComments);
            });
            return () => unsubscribe();
        } else {
            setComments([]);
            setReplyingTo(null);
            setShowUserList(false);
            setShowEmojiList(false);
        }
    }, [visible, postId]);

    // Handle pending comment from voice (pre-fill input)
    useEffect(() => {
        if (visible && pendingComment && pendingComment.postId === postId) {
            setNewComment(pendingComment.text);
            setPendingComment(null); // Clear after using
            inputRef.current?.focus();
        }
    }, [visible, pendingComment, postId]);

    const handleReply = (username: string, id: string, parentId?: string) => {
        // If parentId is provided, use it (for nested replies)
        // Otherwise, use the id itself (for top-level comments)
        setReplyingTo({ username, id, parentId: parentId || id });
        setNewComment(`@${username} `);
        inputRef.current?.focus();
    };

    const handleTagUser = (user: User) => {
        setNewComment(prev => prev + `@${user.username} `);
        setShowUserList(false);
        inputRef.current?.focus();
    };

    const handleEmoji = (emoji: string) => {
        setNewComment(prev => prev + emoji);
    };

    const toggleEmojiList = () => {
        if (showUserList) setShowUserList(false);
        setShowEmojiList(!showEmojiList);
    };

    const toggleUserList = () => {
        if (showEmojiList) setShowEmojiList(false);
        setShowUserList(!showUserList);
    };

    const handleSend = async () => {
        if (!newComment.trim() || !currentUser || !postId) return;

        const text = newComment; // Capture text before clearing
        setNewComment('');
        setReplyingTo(null);
        setShowUserList(false);
        setShowEmojiList(false);
        Keyboard.dismiss();

        try {
            // 1. Logic to find tagged users and notify them
            const taggedUsernames = text.match(/@(\w+)/g)?.map(t => t.substring(1)) || [];
            if (taggedUsernames.length > 0 && postId) {
                // Look up user IDs from followingUsers
                for (const username of taggedUsernames) {
                    const taggedUser = followingUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
                    if (taggedUser && taggedUser.id !== currentUser.id) {
                        console.log(`[Notification] Sending mention notification to ${taggedUser.username}`);
                        await NotificationService.sendMentionNotification(
                            currentUser,
                            taggedUser.id,
                            postId,
                            text
                        );
                    }
                }
            }

            // 2. Add Comment or Reply
            if (replyingTo) {
                // Add as a reply to parent comment
                // Use parentId (the root comment's Firestore doc ID) for the updateDoc call
                const parentCommentId = replyingTo.parentId || replyingTo.id;
                await FeedService.addReply(
                    postId,
                    parentCommentId,
                    currentUser.id,
                    text,
                    currentUser.avatar || '',
                    currentUser.username
                );
            } else {
                // Add as top-level comment
                await FeedService.addComment(
                    postId,
                    currentUser.id,
                    text,
                    currentUser.avatar || '',
                    currentUser.username
                );

                // Send notification to post owner
                const post = feed.find(p => p.id === postId);
                if (post && post.userId !== currentUser.id) {
                    await NotificationService.sendCommentNotification(
                        currentUser,
                        postId,
                        post.userId,
                        text
                    );
                }
            }

            // Note: Don't call addComment to local store - the Firestore real-time listener
            // (subscribeToComments) will automatically pick up the new comment and update the UI

        } catch (error) {
            console.error("Failed to send comment:", error);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!postId) return;

        try {
            await FeedService.deleteComment(postId, commentId);
            console.log(`Deleted comment: ${commentId}`);
        } catch (error) {
            console.error("Failed to delete comment:", error);
            Alert.alert('Error', 'Failed to delete comment. Please try again.');
        }
    };

    const renderComment = ({ item }: { item: Comment }) => (
        <CommentItem
            item={item}
            onReply={handleReply}
            onDelete={handleDeleteComment}
            onReport={(comment) => {
                console.log('[CommentsSheet] onReport called, setting reportingComment:', comment.id);
                setReportingComment(comment);
            }}
            currentUserId={currentUser?.id}
        />
    );

    const renderUserItem = ({ item }: { item: User }) => (
        <TouchableOpacity style={styles.userItem} onPress={() => handleTagUser(item)}>
            <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
            <Text style={styles.userUsername}>{item.username}</Text>
        </TouchableOpacity>
    );

    const renderEmojiItem = ({ item }: { item: string }) => (
        <TouchableOpacity style={styles.emojiItem} onPress={() => handleEmoji(item)}>
            <Text style={styles.emojiText}>{item}</Text>
        </TouchableOpacity>
    );

    return (
        <>
            <Modal
                visible={isModalVisible}
                animationType="none"
                transparent={true}
                onRequestClose={onClose}
            >
                <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
                    <TouchableOpacity style={styles.dismissArea} onPress={onClose} />

                    <Animated.View style={[
                        styles.sheet,
                        {
                            transform: [{ translateY: sheetTranslateY }],
                            paddingBottom: keyboardHeight > 0 ? keyboardHeight - 20 : 0
                        }
                    ]}>
                        <View style={{ flex: 1 }}>
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

                            {/* Tagging User List Popup */}
                            {showUserList && (
                                <View style={styles.userListContainer}>
                                    <Text style={styles.userListHeader}>Following</Text>
                                    <FlatList
                                        data={followingUsers.filter(u => u.id !== currentUser?.id)}
                                        renderItem={renderUserItem}
                                        keyExtractor={item => item.id}
                                        style={{ maxHeight: 150 }}
                                        ListEmptyComponent={
                                            <Text style={{ color: theme.colors.textDim, padding: 16, textAlign: 'center' }}>
                                                Follow users to tag them in comments
                                            </Text>
                                        }
                                    />
                                </View>
                            )}

                            {/* Emoji List Popup */}
                            {showEmojiList && (
                                <View style={styles.userListContainer}>
                                    <FlatList
                                        data={QUICK_EMOJIS}
                                        renderItem={renderEmojiItem}
                                        keyExtractor={item => item}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{ paddingHorizontal: 4 }}
                                    />
                                </View>
                            )}

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
                                    <TouchableOpacity style={styles.actionIcon} onPress={toggleUserList}>
                                        <Ionicons name="at" size={20} color={showUserList ? theme.colors.primary : theme.colors.text} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.actionIcon} onPress={toggleEmojiList}>
                                        <Ionicons name="happy-outline" size={20} color={showEmojiList ? theme.colors.primary : theme.colors.text} />
                                    </TouchableOpacity>

                                    {newComment.trim().length > 0 && (
                                        <TouchableOpacity onPress={handleSend}>
                                            <Ionicons name="arrow-up-circle" size={32} color="#FE2C55" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                            <View style={{ height: Platform.OS === 'ios' ? 20 : 0, backgroundColor: theme.colors.surface }} />
                        </View>
                    </Animated.View>

                    {/* Report Modal - rendered INSIDE parent modal for proper layering */}
                    {reportingComment && currentUser && postId && (
                        <ReportModal
                            visible={!!reportingComment}
                            onClose={() => setReportingComment(null)}
                            contentType="comments"
                            contentId={reportingComment.id}
                            contentText={reportingComment.text}
                            postId={postId}
                            reportedUserId={reportingComment.user?.id || ''}
                            reporterId={currentUser.id}
                        />
                    )}
                </Animated.View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'transparent', // No dim overlay
        justifyContent: 'flex-end',
    },
    dismissArea: {
        flex: 1,
    },
    sheet: {
        backgroundColor: '#121212',
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

    // User Tagging List & Emoji List
    userListContainer: {
        position: 'absolute',
        bottom: 80,
        left: 16,
        right: 16,
        backgroundColor: '#222',
        borderRadius: 12,
        padding: 8,
        borderWidth: 1,
        borderColor: '#333',
        zIndex: 10,
    },
    userListHeader: {
        color: theme.colors.textDim,
        fontSize: 12,
        marginBottom: 8,
        marginLeft: 8,
        fontWeight: '600',
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 12,
    },
    userUsername: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '500',
    },
    // Styles for Emoji Picker
    emojiItem: {
        padding: 10,
        marginHorizontal: 4,
        borderRadius: 8,
        backgroundColor: '#333',
    },
    emojiText: {
        fontSize: 24,
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
        padding: 4,
    }
});

import { db } from '../config/firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, limit, onSnapshot, Unsubscribe, where, writeBatch, updateDoc } from 'firebase/firestore';
import { User, Notification, Post, Comment } from '../types';

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

export const NotificationService = {
    /**
     * Send a follow notification to the followed user
     */
    async sendFollowNotification(follower: User, followedUserId: string): Promise<void> {
        if (!follower?.id || !followedUserId) return;
        if (follower.id === followedUserId) return; // Don't notify yourself

        const notificationRef = doc(collection(db, 'users', followedUserId, 'notifications'));

        await setDoc(notificationRef, {
            id: notificationRef.id,
            type: 'follow',
            fromUserId: follower.id,
            fromUser: {
                id: follower.id,
                username: follower.username,
                avatar: follower.avatar,
                isVerified: follower.isVerified || false,
            },
            message: 'started following you',
            timestamp: Date.now(),
            read: false,
        });

        console.log('[NotificationService] Follow notification sent to', followedUserId);
    },

    /**
     * Send a like notification to the post author
     */
    async sendLikeNotification(liker: User, post: Post): Promise<void> {
        if (!liker?.id || !post?.userId) return;
        if (liker.id === post.userId) return; // Don't notify yourself

        const notificationRef = doc(collection(db, 'users', post.userId, 'notifications'));

        await setDoc(notificationRef, {
            id: notificationRef.id,
            type: 'like_post',
            fromUserId: liker.id,
            fromUser: {
                id: liker.id,
                username: liker.username,
                avatar: liker.avatar,
                isVerified: liker.isVerified || false,
            },
            message: 'liked your video',
            timestamp: Date.now(),
            read: false,
            data: {
                postId: post.id,
                previewMedia: post.coverImage || post.mediaUri,
            },
        });

        console.log('[NotificationService] Like notification sent to', post.userId);
    },

    /**
     * Send a comment notification to the post author
     */
    async sendCommentNotification(commenter: User, postId: string, postOwnerId: string, commentText: string): Promise<void> {
        if (!commenter?.id || !postOwnerId) return;
        if (commenter.id === postOwnerId) return; // Don't notify yourself

        const notificationRef = doc(collection(db, 'users', postOwnerId, 'notifications'));

        const previewText = commentText.length > 50 ? commentText.substring(0, 50) + '...' : commentText;

        await setDoc(notificationRef, {
            id: notificationRef.id,
            type: 'comment',
            fromUserId: commenter.id,
            fromUser: {
                id: commenter.id,
                username: commenter.username,
                avatar: commenter.avatar,
                isVerified: commenter.isVerified || false,
            },
            message: `commented: "${previewText}"`,
            timestamp: Date.now(),
            read: false,
            data: {
                postId,
            },
        });

        console.log('[NotificationService] Comment notification sent to', postOwnerId);
    },

    /**
     * Send a message notification to the recipient
     */
    async sendMessageNotification(sender: User, recipientId: string, messageText: string): Promise<void> {
        if (!sender?.id || !recipientId) return;
        if (sender.id === recipientId) return; // Don't notify yourself

        const notificationRef = doc(collection(db, 'users', recipientId, 'notifications'));

        const previewText = messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText;

        await setDoc(notificationRef, {
            id: notificationRef.id,
            type: 'message',
            fromUserId: sender.id,
            fromUser: {
                id: sender.id,
                username: sender.username,
                avatar: sender.avatar,
                isVerified: sender.isVerified || false,
            },
            message: `sent you a message: "${previewText}"`,
            timestamp: Date.now(),
            read: false,
        });

        console.log('[NotificationService] Message notification sent to', recipientId);
    },

    /**
     * Fetch notifications for a user (one-time)
     */
    async fetchNotifications(userId: string): Promise<Notification[]> {
        if (!userId) return [];

        const notificationsRef = collection(db, 'users', userId, 'notifications');
        const q = query(notificationsRef, orderBy('timestamp', 'desc'), limit(50));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                type: data.type,
                user: data.fromUser,
                message: data.message,
                timestamp: formatTimestamp(data.timestamp),
                read: data.read,
                data: data.data,
                actionStatus: data.actionStatus,
            } as Notification;
        });
    },

    /**
     * Subscribe to real-time notification updates
     */
    subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void): Unsubscribe {
        const notificationsRef = collection(db, 'users', userId, 'notifications');
        const q = query(notificationsRef, orderBy('timestamp', 'desc'), limit(50));

        return onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: data.type,
                    user: data.fromUser,
                    message: data.message,
                    timestamp: formatTimestamp(data.timestamp),
                    read: data.read,
                    data: data.data,
                    actionStatus: data.actionStatus,
                } as Notification;
            });
            console.log(`[NotificationService] Received ${notifications.length} notifications for ${userId}`);
            callback(notifications);
        });
    },

    /**
     * Mark a notification as read
     */
    async markAsRead(userId: string, notificationId: string): Promise<void> {
        const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
        await updateDoc(notificationRef, { read: true });
        console.log('[NotificationService] Marked notification as read:', notificationId);
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<void> {
        const notificationsRef = collection(db, 'users', userId, 'notifications');
        const q = query(notificationsRef, where('read', '==', false));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
            batch.update(docSnap.ref, { read: true });
        });
        await batch.commit();

        console.log(`[NotificationService] Marked ${snapshot.size} notifications as read`);
    },

    /**
     * Send collaboration invite notification
     */
    async sendCollabInviteNotification(
        sender: User,
        recipientId: string,
        draftId: string,
        draftTitle: string
    ): Promise<string> {
        console.log('[NotificationService] sendCollabInviteNotification called:', {
            senderId: sender?.id,
            recipientId,
            draftId,
            draftTitle
        });

        if (!sender?.id || !recipientId) {
            console.error('[NotificationService] Missing sender or recipient:', { sender, recipientId });
            return '';
        }
        if (sender.id === recipientId) {
            console.log('[NotificationService] Sender === recipient, skipping');
            return ''; // Don't notify yourself
        }

        try {
            const notificationRef = doc(collection(db, 'users', recipientId, 'notifications'));

            const notificationData = {
                id: notificationRef.id,
                type: 'collab_invite',
                fromUserId: sender.id,
                fromUser: {
                    id: sender.id,
                    username: sender.username,
                    avatar: sender.avatar,
                    isVerified: sender.isVerified || false,
                },
                message: `invited you to collaborate on "${draftTitle}"`,
                timestamp: Date.now(),
                read: false,
                actionStatus: 'pending',
                data: {
                    postId: draftId, // Using postId field for draftId
                },
            };

            console.log('[NotificationService] Writing to Firestore:', notificationData);
            await setDoc(notificationRef, notificationData);

            console.log('[NotificationService] Collab invite SUCCESSFULLY sent to', recipientId);
            return notificationRef.id;
        } catch (error) {
            console.error('[NotificationService] Error writing collab invite to Firestore:', error);
            throw error;
        }
    },

    /**
     * Send collaboration response notification (accept/decline)
     */
    async sendCollabResponseNotification(
        responder: User,
        inviterId: string,
        accepted: boolean,
        draftTitle: string
    ): Promise<void> {
        if (!responder?.id || !inviterId) return;
        if (responder.id === inviterId) return;

        const notificationRef = doc(collection(db, 'users', inviterId, 'notifications'));

        const action = accepted ? 'accepted' : 'declined';

        await setDoc(notificationRef, {
            id: notificationRef.id,
            type: 'collab_invite',
            fromUserId: responder.id,
            fromUser: {
                id: responder.id,
                username: responder.username,
                avatar: responder.avatar,
                isVerified: responder.isVerified || false,
            },
            message: `${action} your invite to collaborate on "${draftTitle}"`,
            timestamp: Date.now(),
            read: false,
            actionStatus: action,
        });

        console.log(`[NotificationService] Collab response (${action}) sent to`, inviterId);
    },

    /**
     * Send notification to all collaborators when a scene is updated
     */
    async sendCollabUpdateNotification(
        editor: User,
        collaboratorIds: string[],
        sceneId: string,
        sceneTitle: string,
        revision: number
    ): Promise<void> {
        if (!editor?.id || !collaboratorIds?.length) return;

        for (const collaboratorId of collaboratorIds) {
            // Don't notify the person who made the edit
            if (collaboratorId === editor.id) continue;

            try {
                const notificationRef = doc(collection(db, 'users', collaboratorId, 'notifications'));

                await setDoc(notificationRef, {
                    id: notificationRef.id,
                    type: 'collab_update',
                    fromUserId: editor.id,
                    fromUser: {
                        id: editor.id,
                        username: editor.username,
                        avatar: editor.avatar,
                        isVerified: editor.isVerified || false,
                    },
                    message: `updated "${sceneTitle}" (v${revision})`,
                    timestamp: Date.now(),
                    read: false,
                    data: {
                        postId: sceneId,
                        revision,
                    },
                });

                console.log(`[NotificationService] Collab update sent to ${collaboratorId}`);
            } catch (e) {
                console.error(`[NotificationService] Failed to notify ${collaboratorId}:`, e);
            }
        }
    },
};

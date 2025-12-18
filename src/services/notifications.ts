import { db } from '../config/firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, limit, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { User, Notification, Post } from '../types';

export const NotificationService = {
    /**
     * Send a follow notification to the followed user
     */
    async sendFollowNotification(follower: User, followedUserId: string): Promise<void> {
        if (!follower?.id || !followedUserId) return;

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
        // Don't notify yourself
        if (liker.id === post.userId) return;

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
                timestamp: new Date(data.timestamp).toISOString(),
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
                    timestamp: new Date(data.timestamp).toISOString(),
                    read: data.read,
                    data: data.data,
                    actionStatus: data.actionStatus,
                } as Notification;
            });
            callback(notifications);
        });
    },

    /**
     * Mark a notification as read
     */
    async markAsRead(userId: string, notificationId: string): Promise<void> {
        const { updateDoc } = await import('firebase/firestore');
        const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
        await updateDoc(notificationRef, { read: true });
    },
};

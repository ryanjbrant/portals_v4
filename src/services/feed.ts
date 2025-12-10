
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    orderBy,
    increment,
    setDoc,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Post, Comment } from '../types';

import { COMMENTS } from '../mock';

export const FeedService = {
    // Like / Unlike Post
    async toggleLike(postId: string, userId: string, isLiked: boolean): Promise<void> {
        if (!postId || !userId) return;

        const postRef = doc(db, 'posts', postId);
        const likeRef = doc(db, 'posts', postId, 'likes', userId);

        try {
            if (isLiked) {
                // Unlike: Remove like doc and decrement count
                await deleteDoc(likeRef);
                await updateDoc(postRef, {
                    likes: increment(-1)
                });
            } else {
                // Like: Add like doc and increment count
                await setDoc(likeRef, {
                    userId,
                    timestamp: serverTimestamp()
                });
                await setDoc(postRef, { likes: increment(1) }, { merge: true });
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            throw error;
        }
    },

    // Check if user liked post
    async checkIsLiked(postId: string, userId: string): Promise<boolean> {
        if (!postId || !userId) return false;
        const likeRef = doc(db, 'posts', postId, 'likes', userId);
        const snap = await getDoc(likeRef);
        return snap.exists();
    },

    // Add Comment
    async addComment(postId: string, userId: string, text: string, userAvatar: string, username: string): Promise<Comment> {
        if (!text.trim()) throw new Error("Comment empty");

        const commentsRef = collection(db, 'posts', postId, 'comments');
        const postRef = doc(db, 'posts', postId);

        const newCommentData = {
            userId,
            username,
            avatar: userAvatar,
            text,
            timestamp: new Date().toISOString(), // Use string for UI consistency or handle serverTimestamp
            likes: 0,
            replies: []
        };

        const docRef = await addDoc(commentsRef, newCommentData);
        await setDoc(postRef, { comments: increment(1) }, { merge: true });

        // Return a valid Comment object matching the interface
        return {
            id: docRef.id,
            text,
            timestamp: 'Just now',
            likes: 0,
            isLiked: false,
            userId, // Keep flat for reference if needed
            user: {
                id: userId,
                username,
                avatar: userAvatar,
                followers: 0,
                following: 0,
                friends: 0,
                flames: 0
            }
        } as Comment;
    },

    // Real-time subscribe to comments
    subscribeToComments(postId: string, onUpdate: (comments: Comment[]) => void) {
        const commentsRef = collection(db, 'posts', postId, 'comments');
        // Simple query, sorting client side might be easier if mixing with mock
        const q = query(commentsRef, orderBy('timestamp', 'asc'));

        return onSnapshot(q, (snapshot) => {
            const firestoreComments = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    text: data.text,
                    timestamp: typeof data.timestamp === 'string' ? 'Just now' : 'Just now', // Simplified date fmt
                    likes: data.likes || 0,
                    isLiked: false,
                    replies: [],
                    userId: data.userId,
                    user: {
                        id: data.userId,
                        username: data.username,
                        avatar: data.avatar,
                        followers: 0,
                        following: 0,
                        friends: 0,
                        flames: 0
                    }
                } as Comment;
            });

            // Merge with Mock Data if p1
            let allComments = firestoreComments;
            if (postId === 'p1') {
                // Deduplicate based on ID (though mock IDs are c1, c2, existing won't collide usually)
                allComments = [...COMMENTS, ...firestoreComments];
            }

            onUpdate(allComments);
        });
    }
};

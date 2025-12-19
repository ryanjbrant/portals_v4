
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
            timestamp: new Date().toISOString(),
            likes: 0,
            replies: []
        };

        const docRef = await addDoc(commentsRef, newCommentData);
        await setDoc(postRef, { comments: increment(1) }, { merge: true });

        return {
            id: docRef.id,
            text,
            timestamp: 'Just now',
            likes: 0,
            isLiked: false,
            userId,
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

    // Add Reply to a Comment
    async addReply(postId: string, parentCommentId: string, userId: string, text: string, userAvatar: string, username: string): Promise<Comment> {
        if (!text.trim()) throw new Error("Reply empty");

        const { arrayUnion } = await import('firebase/firestore');
        const commentRef = doc(db, 'posts', postId, 'comments', parentCommentId);
        const postRef = doc(db, 'posts', postId);

        const replyId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newReply = {
            id: replyId,
            userId,
            username,
            avatar: userAvatar,
            text,
            timestamp: new Date().toISOString(),
            likes: 0,
            isLiked: false,
        };

        // Add reply to parent comment's replies array
        await updateDoc(commentRef, {
            replies: arrayUnion(newReply)
        });
        await setDoc(postRef, { comments: increment(1) }, { merge: true });

        return {
            id: replyId,
            text,
            timestamp: 'Just now',
            likes: 0,
            isLiked: false,
            userId,
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
            const firestoreComments = snapshot.docs
                // Filter out flagged comments
                .filter(doc => !doc.data().flagged)
                .map(doc => {
                    const data = doc.data();
                    // Parse replies with user objects (also filter flagged replies)
                    const replies = (data.replies || [])
                        .filter((reply: any) => !reply.flagged)
                        .map((reply: any) => ({
                            id: reply.id,
                            text: reply.text,
                            timestamp: 'Just now',
                            likes: reply.likes || 0,
                            isLiked: false,
                            userId: reply.userId,
                            user: {
                                id: reply.userId,
                                username: reply.username,
                                avatar: reply.avatar,
                                followers: 0,
                                following: 0,
                                friends: 0,
                                flames: 0
                            }
                        }));

                    return {
                        id: doc.id,
                        text: data.text,
                        timestamp: 'Just now',
                        likes: data.likes || 0,
                        isLiked: false,
                        replies,
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
    },

    // Delete a comment
    async deleteComment(postId: string, commentId: string): Promise<void> {
        const commentRef = doc(db, 'posts', postId, 'comments', commentId);
        const postRef = doc(db, 'posts', postId);

        try {
            await deleteDoc(commentRef);
            await updateDoc(postRef, {
                comments: increment(-1)
            });
        } catch (error) {
            console.error("Error deleting comment:", error);
            throw error;
        }
    }
};

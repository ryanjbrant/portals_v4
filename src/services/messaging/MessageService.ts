import { db } from '../../config/firebase';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    limit,
} from 'firebase/firestore';
import { Message, Conversation } from '../../types';

/**
 * MessageService - Firebase Firestore messaging service
 * 
 * Collection Structure:
 * conversations/{conversationId}
 *   - participantIds: string[]
 *   - lastMessage: string
 *   - lastMessageTime: Timestamp
 *   - createdAt: Timestamp
 *   └── messages/{messageId}
 *       - senderId: string
 *       - text: string
 *       - timestamp: Timestamp
 *       - read: boolean
 *       - deleted: boolean
 */
export class MessageService {
    private static conversationsRef = collection(db, 'conversations');

    /**
     * Generate a deterministic conversation ID from two user IDs
     * This ensures the same conversation ID regardless of who initiates
     */
    private static getConversationId(userId1: string, userId2: string): string {
        const sortedIds = [userId1, userId2].sort();
        return `${sortedIds[0]}_${sortedIds[1]}`;
    }

    /**
     * Get or create a conversation between two users
     * Uses deterministic ID so we don't need to query
     */
    static async getOrCreateConversation(userId1: string, userId2: string): Promise<string> {
        const conversationId = this.getConversationId(userId1, userId2);
        const conversationRef = doc(db, 'conversations', conversationId);

        // Check if conversation already exists
        const snapshot = await getDoc(conversationRef);

        if (snapshot.exists()) {
            return conversationId;
        }

        // Create new conversation with the deterministic ID
        const sortedIds = [userId1, userId2].sort();
        await setDoc(conversationRef, {
            participantIds: sortedIds,
            lastMessage: '',
            lastMessageTime: Date.now(),
            createdAt: Date.now(),
        });

        return conversationId;
    }

    /**
     * Send a message in a conversation
     */
    static async sendMessage(
        conversationId: string,
        senderId: string,
        text: string
    ): Promise<string> {
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');

        const message = {
            senderId,
            text,
            timestamp: Date.now(),
            read: false,
            deleted: false,
        };

        const docRef = await addDoc(messagesRef, message);

        // Update conversation's last message
        const conversationRef = doc(db, 'conversations', conversationId);
        await updateDoc(conversationRef, {
            lastMessage: text,
            lastMessageTime: Date.now(),
        });

        return docRef.id;
    }

    /**
     * Subscribe to real-time message updates for a conversation
     * Returns unsubscribe function
     */
    static subscribeToMessages(
        conversationId: string,
        callback: (messages: Message[]) => void
    ): () => void {
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        return onSnapshot(q, (snapshot) => {
            const messages: Message[] = snapshot.docs
                .map((doc) => ({
                    id: doc.id,
                    conversationId,
                    ...doc.data(),
                } as Message))
                .filter((msg) => !msg.deleted); // Filter out soft-deleted messages

            callback(messages);
        });
    }

    /**
     * Subscribe to user's conversations list
     * Returns unsubscribe function
     */
    static subscribeToConversations(
        userId: string,
        callback: (conversations: Conversation[]) => void
    ): () => void {
        const q = query(
            this.conversationsRef,
            where('participantIds', 'array-contains', userId),
            orderBy('lastMessageTime', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const conversations: Conversation[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            } as Conversation));

            callback(conversations);
        });
    }

    /**
     * Mark all messages in a conversation as read for a user
     */
    static async markAsRead(conversationId: string, userId: string): Promise<void> {
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        const q = query(
            messagesRef,
            where('senderId', '!=', userId),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);

        const updates = snapshot.docs.map((msgDoc) =>
            updateDoc(doc(db, 'conversations', conversationId, 'messages', msgDoc.id), {
                read: true,
            })
        );

        await Promise.all(updates);
    }

    /**
     * Soft delete a message (for moderation)
     * Message remains in database but won't be shown to users
     */
    static async deleteMessage(conversationId: string, messageId: string): Promise<void> {
        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
        await updateDoc(messageRef, { deleted: true });
    }

    /**
     * Get conversation details by ID
     */
    static async getConversation(conversationId: string): Promise<Conversation | null> {
        const conversationRef = doc(db, 'conversations', conversationId);
        const snapshot = await getDoc(conversationRef);

        if (!snapshot.exists()) {
            return null;
        }

        return {
            id: snapshot.id,
            ...snapshot.data(),
        } as Conversation;
    }
}

import { create } from 'zustand';
import { Post, User, Notification, Comment, Draft, User as UserType } from '../types';
import { POSTS, CURRENT_USER, NOTIFICATIONS, DRAFTS, COMMENTS } from '../mock';
import { collection, query, orderBy, getDocs, limit, deleteDoc, doc, addDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Voice Context
interface VoiceContext {
    currentScreen: string;
    currentId?: string; // postId or userId
    currentType?: 'post' | 'profile' | 'feed' | 'other';
}

interface AppState {
    // Session
    currentUser: User | null;
    isAuthenticated: boolean;
    setAuthenticated: (value: boolean) => void;
    setCurrentUser: (user: User | null) => void;
    login: () => void;
    logout: () => void;
    updateProfile: (updates: Partial<User>) => void;

    // Feed
    feed: Post[];
    toggleLike: (postId: string) => Promise<void>;
    addPost: (post: Post) => void;
    fetchFeed: () => Promise<void>;
    createPost: (post: Omit<Post, 'id' | 'likes' | 'comments' | 'timestamp'>) => Promise<void>;
    deletePost: (postId: string) => Promise<void>;

    // Comments
    comments: Record<string, Comment[]>; // Map postId to comments
    addComment: (postId: string, text: string) => Promise<void>;
    addReply: (postId: string, parentCommentId: string, reply: Comment) => void;

    // Notifications
    // Notifications
    notifications: Notification[];
    respondToRequest: (notificationId: string, status: 'accepted' | 'declined') => void;
    addNotification: (notification: Notification) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;

    // Social Relationships
    relationships: {
        team: string[];
        invites: string[];
        friends: string[];
        following: string[];
        blocked: string[];
    };
    sendInvite: (userId: string) => void;
    approveInvite: (userId: string) => void;
    rejectInvite: (userId: string) => void;
    removeTeamMember: (userId: string) => void;
    followUser: (userId: string) => void;
    unfollowUser: (userId: string) => void;

    // Drafts
    drafts: Draft[];
    draftPost: Partial<Post> | null;
    setDraftPost: (draft: Partial<Post> | null) => void;
    saveDraft: (sceneData: any, coverImage?: string) => Promise<void>;
    fetchDrafts: () => Promise<void>;
    deleteDraft: (id: string) => Promise<void>;
    updateDraftPost: (updates: Partial<Post>) => void;

    // Voice
    isVoiceActive: boolean;
    setVoiceActive: (active: boolean) => void;
    voiceContext: VoiceContext;
    setVoiceContext: (context: Partial<VoiceContext>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    // Session
    currentUser: null,
    isAuthenticated: false,
    setAuthenticated: (value) => set({ isAuthenticated: value }),
    setCurrentUser: (user) => set({ currentUser: user }),
    login: () => set({ isAuthenticated: true, currentUser: CURRENT_USER }),
    logout: () => set({ isAuthenticated: false, currentUser: null }),
    updateProfile: (updates) => set((state) => ({
        currentUser: state.currentUser ? { ...state.currentUser, ...updates } : null
    })),

    // Feed
    feed: POSTS,
    toggleLike: async (postId) => {
        const state = get();
        const post = state.feed.find(p => p.id === postId);
        if (!post) return;

        const isLiked = post.isLiked;
        // Optimistic Update
        set((state) => ({
            feed: state.feed.map((p) =>
                p.id === postId
                    ? { ...p, isLiked: !isLiked, likes: isLiked ? p.likes - 1 : p.likes + 1 }
                    : p
            )
        }));
    },
    addPost: (post) => set((state) => ({ feed: [post, ...state.feed] })),
    fetchFeed: async () => {
        try {
            console.log("[Store] Fetching feed from Firestore...");
            let querySnapshot;

            try {
                // Try sorted query
                const q = query(
                    collection(db, "posts"),
                    orderBy("createdAt", "desc"),
                    limit(20)
                );
                querySnapshot = await getDocs(q);
            } catch (err: any) {
                console.warn("[Store] Sorted query failed (likely missing index), falling back to unsorted.", err.message);
                const fallbackQ = query(collection(db, "posts"), limit(20));
                querySnapshot = await getDocs(fallbackQ);
            }

            const posts: Post[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                posts.push({
                    id: doc.id,
                    userId: data.userId,
                    user: data.user,
                    caption: data.caption,
                    likes: data.likes || 0,
                    comments: data.comments || 0,
                    shares: data.shares || 0,
                    isLiked: data.isLiked || false,
                    date: data.date,
                    tags: data.tags || [],
                    taggedUsers: data.taggedUsers || [],
                    locations: data.locations || [],
                    music: data.music || 'Original Sound',
                    mediaUri: data.mediaUri,
                    coverImage: data.coverImage,
                    sceneId: data.sceneId,
                    sceneData: data.sceneData
                } as Post);
            });

            console.log(`[Store] Fetched ${posts.length} posts.`);
            if (posts.length > 0) {
                set({ feed: posts });
            } else {
                console.log("[Store] No posts found.");
            }
        } catch (e) {
            console.error("[Store] Error fetching feed:", e);
        }
    },
    createPost: async (post) => { }, // Placeholder
    deletePost: async (postId) => {
        try {
            console.log(`[Store] Deleting post ${postId}...`);
            await deleteDoc(doc(db, "posts", postId));
            set((state) => ({
                feed: state.feed.filter((p) => p.id !== postId)
            }));
            console.log(`[Store] Deleted post ${postId}`);
        } catch (e) {
            console.error("[Store] Error deleting post:", e);
        }
    },

    // Comments
    comments: { 'p1': COMMENTS }, // Initialize with mock comments mapped to p1 for demo
    addComment: async (postId, text) => {
        console.log(`[Store] Adding comment to ${postId}: ${text}`);
        // In a real app, you would create a Comment object and add it to state.comments
        // For now, we update the feed count optimistically
        set((state) => ({
            feed: state.feed.map(p => p.id === postId ? { ...p, comments: p.comments + 1 } : p)
        }));
    },
    addReply: (postId, parentCommentId, reply) => set((state) => {
        const postComments = state.comments[postId] || [];
        const updatedComments = postComments.map(c => {
            if (c.id === parentCommentId) {
                return { ...c, replies: [...(c.replies || []), reply] };
            }
            return c;
        });

        return {
            comments: {
                ...state.comments,
                [postId]: updatedComments
            },
            feed: state.feed.map(p => p.id === postId ? { ...p, comments: p.comments + 1 } : p)
        };
    }),

    // Notifications
    notifications: NOTIFICATIONS,
    respondToRequest: (id, status) => set((state) => ({
        notifications: state.notifications.map(n =>
            n.id === id ? { ...n, actionStatus: status } : n
        )
    })),
    addNotification: (n) => set((state) => ({ notifications: [n, ...state.notifications] })),
    markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    })),
    markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true }))
    })),

    // Social Relationships
    relationships: {
        team: [],
        invites: ['u2', 'u3', 'u4'], // Mock: Everyone invited us for demo
        friends: ['u3'],
        following: ['u3', 'u4'],
        blocked: []
    },
    sendInvite: (userId) => set((state) => ({
        relationships: { ...state.relationships, invites: [...state.relationships.invites, userId] } // Self-invite? Or outgoing? Assuming incoming for this demo context or we just add to team? 
        // Real app would send API request.
    })),
    approveInvite: (userId) => set((state) => ({
        relationships: {
            ...state.relationships,
            invites: state.relationships.invites.filter(id => id !== userId),
            team: [...state.relationships.team, userId]
        }
    })),
    rejectInvite: (userId) => set((state) => ({
        relationships: {
            ...state.relationships,
            invites: state.relationships.invites.filter(id => id !== userId),
            blocked: [...state.relationships.blocked, userId] // Optional: Add to blocked or just remove
        }
    })),
    removeTeamMember: (userId) => set((state) => ({
        relationships: {
            ...state.relationships,
            team: state.relationships.team.filter(id => id !== userId)
        }
    })),
    followUser: (userId) => set((state) => ({
        relationships: {
            ...state.relationships,
            following: [...state.relationships.following, userId]
        }
    })),
    unfollowUser: (userId) => set((state) => ({
        relationships: {
            ...state.relationships,
            following: state.relationships.following.filter(id => id !== userId)
        }
    })),

    // Drafts
    drafts: DRAFTS,
    draftPost: null,
    setDraftPost: (draft) => set({ draftPost: draft }),
    updateDraftPost: (updates) => set((state) => ({
        draftPost: state.draftPost ? { ...state.draftPost, ...updates } : updates
    })),
    saveDraft: async (sceneData, coverImage) => {
        try {
            console.log("[Store] Saving draft...");
            const state = get();
            const newDraft = {
                userId: state.currentUser?.id || 'anonymous',
                user: state.currentUser,
                sceneData: sceneData,
                coverImage: coverImage,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            await addDoc(collection(db, "drafts"), newDraft);
            console.log("[Store] Draft saved.");
            // Refresh drafts
            await state.fetchDrafts();
        } catch (e) {
            console.error("[Store] Error saving draft:", e);
        }
    },
    fetchDrafts: async () => {
        try {
            const state = get();
            if (!state.currentUser) return;

            console.log("[Store] Fetching drafts...");
            const q = query(
                collection(db, "drafts"),
                where("userId", "==", state.currentUser.id),
                orderBy("updatedAt", "desc")
            );

            const snapshot = await getDocs(q);
            const drafts: Draft[] = [];
            snapshot.forEach(doc => {
                drafts.push({ id: doc.id, ...doc.data() } as Draft);
            });

            set({ drafts });
            console.log(`[Store] Fetched ${drafts.length} drafts.`);
        } catch (e) {
            console.error("[Store] Error fetching drafts:", e);
        }
    },
    deleteDraft: async (id) => {
        try {
            await deleteDoc(doc(db, "drafts", id));
            set(state => ({ drafts: state.drafts.filter(d => d.id !== id) }));
        } catch (e) { console.error("Error deleting draft:", e); }
    },

    // Voice
    isVoiceActive: false,
    setVoiceActive: (active) => set({ isVoiceActive: active }),
    voiceContext: { currentScreen: 'Home', currentType: 'feed' },
    setVoiceContext: (context) => set((state) => ({
        voiceContext: { ...state.voiceContext, ...context }
    })),
}));

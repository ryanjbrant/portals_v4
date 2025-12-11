import { create } from 'zustand';
import { Post, User, Notification, Comment, Draft, User as UserType } from '../types';
import { POSTS, CURRENT_USER, NOTIFICATIONS, DRAFTS, COMMENTS } from '../mock';

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
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Shuffle feed to simulate new content
        const shuffled = [...POSTS].sort(() => Math.random() - 0.5);
        set({ feed: shuffled });
    },
    createPost: async (post) => { }, // Placeholder

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

    // Voice
    isVoiceActive: false,
    setVoiceActive: (active) => set({ isVoiceActive: active }),
    voiceContext: { currentScreen: 'Home', currentType: 'feed' },
    setVoiceContext: (context) => set((state) => ({
        voiceContext: { ...state.voiceContext, ...context }
    })),
}));

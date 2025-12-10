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
    notifications: Notification[];
    respondToRequest: (notificationId: string, status: 'accepted' | 'declined') => void;

    // Drafts
    drafts: Draft[];

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
    fetchFeed: async () => { }, // Placeholder
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
            n.id === id ? { ...n, status } : n
        )
    })),

    // Drafts
    drafts: DRAFTS,

    // Voice
    isVoiceActive: false,
    setVoiceActive: (active) => set({ isVoiceActive: active }),
    voiceContext: { currentScreen: 'Home', currentType: 'feed' },
    setVoiceContext: (context) => set((state) => ({
        voiceContext: { ...state.voiceContext, ...context }
    })),
}));

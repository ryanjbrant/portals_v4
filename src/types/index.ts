export interface User {
    id: string;
    username: string;
    email?: string;
    name?: string;
    avatar: string;
    isVerified?: boolean;
    bio?: string;
    followers: number;
    following: number;
    friends: number; // For "Friends" count specifically if different from following
    flames: number; // Total likes received
}

export interface Post {
    id: string;
    userId: string;
    user: User;
    caption: string;
    likes: number;
    comments: number;
    shares: number;
    isLiked: boolean;
    date: string;
    tags: string[];
    music?: string;
}

export interface Comment {
    id: string;
    userId: string;
    user: User;
    text: string;
    timestamp: string;
    likes: number;
    isLiked: boolean;
    replies?: Comment[];
}

export interface Notification {
    id: string;
    type: 'like' | 'comment' | 'follow' | 'request' | 'mention';
    user: User;
    message: string;
    timestamp: string;
    status?: 'pending' | 'accepted' | 'declined';
    read: boolean;
}

export interface Draft {
    id: string;
    title: string;
    date: string;
    coverImage?: string;
}

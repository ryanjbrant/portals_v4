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

export interface Artifact {
    id: string;
    name: string;
    price: number;
    image: string;
    description: string;
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
    taggedUsers?: string[]; // IDs of tagged users
    locations?: {
        name?: string;
        latitude: number;
        longitude: number;
    }[];
    music?: string;
    mediaUri?: string; // Video or Image URI
    coverImage?: string; // Thumbnail/Poster
    sceneData?: any; // Serialized Scene Data
    sceneId?: string; // ID if already saved
    linkedArtifact?: Artifact;
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
    type: 'like_post' | 'like_comment' | 'follow' | 'comment' | 'mention' | 'collab_invite' | 'message' | 'system';
    user: User;
    message: string;
    timestamp: string;
    read: boolean;
    data?: {
        postId?: string;
        commentId?: string;
        previewMedia?: string; // URL for thumbnail
    };
    actionStatus?: 'pending' | 'accepted' | 'declined'; // For invites
}

export interface Draft {
    id: string;
    title: string;
    date: string;
    coverImage?: string;
}

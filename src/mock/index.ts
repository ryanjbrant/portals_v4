import { User, Post, Notification, Comment, Draft } from '../types';

export const CURRENT_USER: User = {
    id: 'u1',
    username: 'antigravity_dev',
    name: 'Antigravity Developer',
    avatar: 'https://i.pravatar.cc/150?u=antigravity_dev',
    bio: 'Building the future of social apps 🚀',
    followers: 4500,
    following: 124,
    friends: 120,
    flames: 3486,
};

export const USERS: User[] = [
    CURRENT_USER,
    {
        id: 'u2',
        username: 'gucci_official',
        name: 'Gucci',
        avatar: 'https://i.pravatar.cc/150?u=gucci',
        followers: 1000000,
        following: 500,
        friends: 50,
        flames: 9000,
    },
    {
        id: 'u3',
        username: 'skater_boi',
        name: 'Skate Pro',
        avatar: 'https://i.pravatar.cc/150?u=skater',
        followers: 1200,
        following: 300,
        friends: 300,
        flames: 200,
    },
    {
        id: 'u4',
        username: 'art_lover',
        name: 'Digital Artist',
        avatar: 'https://i.pravatar.cc/150?u=art',
        followers: 5000,
        following: 400,
        friends: 400,
        flames: 500,
    },
];

export const POSTS: Post[] = [
    {
        id: 'p1',
        userId: 'u2',
        user: USERS[1],
        caption: 'New collection dropping soon! 🔥 #fashion #gucci #style',
        likes: 12400,
        comments: 579,
        shares: 400,
        isLiked: false,
        date: '2-28',
        tags: ['fashion', 'gucci', 'style'],
        music: 'Gucci Gang - Lil Pump',
    },
    {
        id: 'p2',
        userId: 'u3',
        user: USERS[2],
        caption: 'Kickflip practice at the park 🛹',
        likes: 850,
        comments: 42,
        shares: 15,
        isLiked: true,
        date: 'Yesterday',
        tags: ['skate', 'tricks'],
        music: 'Original Sound',
    },
    {
        id: 'p3',
        userId: 'u4',
        user: USERS[3],
        caption: 'Check out this digital art piece I made!',
        likes: 2300,
        comments: 120,
        shares: 89,
        isLiked: false,
        date: 'Just now',
        tags: ['art', 'digital'],
        music: 'Lo-Fi Chill',
    },
];

export const COMMENTS: Comment[] = [
    {
        id: 'c1',
        userId: 'u3',
        user: USERS[2],
        text: 'This is fire! 🔥',
        timestamp: '2h',
        likes: 45,
        isLiked: false,
        replies: [
            {
                id: 'c1-r1',
                userId: 'u1',
                user: CURRENT_USER,
                text: 'Agreed!',
                timestamp: '1h',
                likes: 2,
                isLiked: false,
            }
        ]
    },
    {
        id: 'c2',
        userId: 'u4',
        user: USERS[3],
        text: 'Love the vibe ❤️',
        timestamp: '3h',
        likes: 12,
        isLiked: true,
    }
];

export const NOTIFICATIONS: Notification[] = [
    {
        id: 'n1',
        type: 'request',
        user: USERS[2],
        message: 'sent you a friend request.',
        timestamp: '2m',
        status: 'pending',
        read: false,
    },
    {
        id: 'n2',
        type: 'like',
        user: USERS[3],
        message: 'liked your post.',
        timestamp: '1h',
        read: true,
    },
    {
        id: 'n3',
        type: 'comment',
        user: USERS[1],
        message: 'commented: "Nice work!"',
        timestamp: '3h',
        read: true,
    },
];

export const DRAFTS: Draft[] = [
    {
        id: 'd1',
        title: 'Latest Draft',
        date: '2025-12-08',
    },
    {
        id: 'd2',
        title: 'Draft 2',
        date: '2025-12-05',
    },
];

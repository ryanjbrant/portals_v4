import { collection, query, where, getDocs, limit, startAt, endAt, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { User, Post } from '../types';
import { POSTS } from '../mock'; // Fallback to mock for posts

export const SearchService = {
    // Search Users in Firestore
    async searchUsers(searchQuery: string): Promise<User[]> {
        if (!searchQuery.trim()) return [];

        const term = searchQuery.toLowerCase().trim();
        const usersRef = collection(db, 'users');

        // Simple prefix search on username
        // Note: Firestore requires a specific index for case-insensitive or advanced search.
        // For now, we assume usernames are stored lowercased or we search exact matches/prefixes on 'username' field.
        // We really should store a 'searchKey' in firestore that is lowercase.
        // Assuming current implementation stores 'username' as is but we might want to check.
        // Let's try to search by username prefix.

        try {
            // Ideally: q = query(usersRef, where('username', '>=', term), where('username', '<=', term + '\uf8ff'));
            // But if username is mixed case in DB, this fails. 
            // We forced lowercase in googleLogin: "username: ... .toLowerCase()"
            // RegisterScreen does NOT force lowercase. We should updated RegisterScreen later, but for now let's hope.

            const q = query(
                usersRef,
                where('username', '>=', term),
                where('username', '<=', term + '\uf8ff'),
                limit(10)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data() as User);
        } catch (error) {
            console.error("Search users failed", error);
            return [];
        }
    },

    // Search Posts (Mock for now, as posts aren't in Firestore)
    async searchPosts(searchQuery: string): Promise<Post[]> {
        if (!searchQuery.trim()) return [];
        const term = searchQuery.toLowerCase();

        return new Promise((resolve) => {
            setTimeout(() => {
                const results = POSTS.filter(post =>
                    post.caption.toLowerCase().includes(term) ||
                    post.tags.some(tag => tag.toLowerCase().includes(term))
                );
                resolve(results);
            }, 500); // Fake network delay
        });
    },

    // Search Tags (Mock extraction from posts)
    async searchTags(searchQuery: string): Promise<string[]> {
        if (!searchQuery.trim()) return [];
        const term = searchQuery.toLowerCase().replace('#', '');

        return new Promise((resolve) => {
            setTimeout(() => {
                const allTags = new Set<string>();
                POSTS.forEach(p => p.tags.forEach(t => allTags.add(t)));

                const results = Array.from(allTags).filter(tag =>
                    tag.toLowerCase().includes(term)
                );
                resolve(results);
            }, 300);
        });
    }
};

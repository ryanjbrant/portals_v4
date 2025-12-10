import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import { User } from '../types';

export const AuthService = {
    // Register new user
    async registerUser(email: string, password: string, username: string, avatarUri?: string, phone?: string): Promise<User> {
        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            let avatarUrl = 'https://i.pravatar.cc/150?u=' + username; // Default fallback

            // 2. Upload Avatar if provided
            if (avatarUri) {
                try {
                    const response = await fetch(avatarUri);
                    const blob = await response.blob();
                    const fileRef = ref(storage, `avatars/${firebaseUser.uid}`);
                    await uploadBytes(fileRef, blob);
                    avatarUrl = await getDownloadURL(fileRef);
                } catch (e) {
                    console.error("Error uploading avatar:", e);
                }
            }

            // 3. Update Auth Profile
            await updateProfile(firebaseUser, {
                displayName: username,
                photoURL: avatarUrl,
            });

            // 4. Create User Document in Firestore
            const newUser: User = {
                id: firebaseUser.uid,
                username: username,
                name: username, // Default to username if no name
                email: email,
                avatar: avatarUrl,
                bio: '',
                followers: 0,
                following: 0,
                friends: 0,
                flames: 0,
                isVerified: false,
            };

            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);

            return newUser;
        } catch (error: any) {
            throw new Error(error.message || 'Registration failed');
        }
    },

    // Login user
    async loginUser(email: string, password: string): Promise<User> {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            // Fetch user profile from Firestore
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

            if (userDoc.exists()) {
                return userDoc.data() as User;
            } else {
                // Fallback struct if data missing (shouldn't happen)
                return {
                    id: firebaseUser.uid,
                    username: firebaseUser.displayName || 'User',
                    name: firebaseUser.displayName || 'User',
                    email: firebaseUser.email || email,
                    avatar: firebaseUser.photoURL || 'https://i.pravatar.cc/150',
                    followers: 0,
                    following: 0,
                    friends: 0,
                    flames: 0,
                };
            }
        } catch (error: any) {
            throw new Error(error.message || 'Login failed');
        }
    },

    async logout(): Promise<void> {
        await signOut(auth);
    },

    // Google Login
    async googleLogin(idToken: string): Promise<User> {
        try {
            // Move imports to top if possible, or dynamicaly import if strict
            const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
            const credential = GoogleAuthProvider.credential(idToken);
            const userCredential = await signInWithCredential(auth, credential);
            const firebaseUser = userCredential.user;

            // Fetch or Create user profile
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                return userDoc.data() as User;
            } else {
                // New Google User - Create Profile
                const newUser: User = {
                    id: firebaseUser.uid,
                    username: firebaseUser.displayName?.replace(/\s+/g, '').toLowerCase() || 'user' + Math.floor(Math.random() * 10000),
                    name: firebaseUser.displayName || 'User',
                    email: firebaseUser.email || '',
                    avatar: firebaseUser.photoURL || 'https://i.pravatar.cc/150',
                    bio: '',
                    followers: 0,
                    following: 0,
                    friends: 0,
                    flames: 0,
                    isVerified: false,
                };
                await setDoc(userDocRef, newUser);
                return newUser;
            }
        } catch (error: any) {
            throw new Error(error.message || 'Google Login failed');
        }
    },

    // Social Graph
    async followUser(currentUserId: string, targetUserId: string): Promise<void> {
        if (!currentUserId || !targetUserId) return;
        const { increment, updateDoc } = await import('firebase/firestore');
        const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
        const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

        // Create the graph relationship
        await setDoc(followingRef, { timestamp: Date.now() });
        await setDoc(followerRef, { timestamp: Date.now() });

        // Update the counts
        const currentUserRef = doc(db, 'users', currentUserId);
        const targetUserRef = doc(db, 'users', targetUserId);

        await updateDoc(currentUserRef, { following: increment(1) });
        await updateDoc(targetUserRef, { followers: increment(1) });
    },

    async unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
        if (!currentUserId || !targetUserId) return;
        const { deleteDoc, increment, updateDoc } = await import('firebase/firestore');
        const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
        const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

        // Remove the graph relationship
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);

        // Update the counts
        const currentUserRef = doc(db, 'users', currentUserId);
        const targetUserRef = doc(db, 'users', targetUserId);

        await updateDoc(currentUserRef, { following: increment(-1) });
        await updateDoc(targetUserRef, { followers: increment(-1) });
    },

    async checkIsFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
        if (!currentUserId || !targetUserId) return false;
        const docRef = doc(db, 'users', currentUserId, 'following', targetUserId);
        const snap = await getDoc(docRef);
        return snap.exists();
    }
};

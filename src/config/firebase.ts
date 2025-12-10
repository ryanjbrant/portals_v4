import { getAI } from "firebase/ai";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getStorage } from "firebase/storage";
// @ts-ignore
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBKwIKvt1lG0ROHk6LaD4cHtNlijudXcNs",
    authDomain: "portals-bb9d9.firebaseapp.com",
    projectId: "portals-bb9d9",
    storageBucket: "portals-bb9d9.firebasestorage.app",
    messagingSenderId: "498765366652",
    appId: "1:498765366652:web:b3858c80d4e094b78e50f9",
    measurementId: "G-1S2783VTJR"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const vertexAI = getAI(app);

// Initialize Analytics (conditionally)
let analytics: any;
isSupported().then((supported) => {
    if (supported) {
        analytics = getAnalytics(app);
    }
});

// Initialize Auth with Persistence
let auth;
try {
    auth = initializeAuth(app, {
        // @ts-ignore
        persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
} catch (e) {
    auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, analytics, vertexAI };

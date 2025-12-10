import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { BottomTabNavigator } from './BottomTabNavigator';
import { SearchScreen } from '../screens/SearchScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ProfileGalleryScreen } from '../screens/ProfileGalleryScreen';
import { ProfileSettingsScreen } from '../screens/ProfileSettingsScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { PostFeedScreen } from '../screens/PostFeedScreen';
import { useAppStore } from '../store';
import { View, Text, ActivityIndicator } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types';
import { theme } from '../theme/theme';
import { VoiceOverlay } from '../components/VoiceOverlay';

// Stub or Reuse Screen
const UserProfileScreen = ProfileScreen; // Reuse for now, ideally refactor later

const Stack = createNativeStackNavigator();

const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
);

// Main Stack to support global pushes (above tabs)
const MainStack = createNativeStackNavigator();

const MainStackScreen = () => (
    <MainStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <MainStack.Screen name="Tabs" component={BottomTabNavigator} />
        <MainStack.Screen name="Search" component={SearchScreen} />
        <MainStack.Screen name="UserProfile" component={ProfileScreen} />
        <MainStack.Screen name="ProfileGallery" component={ProfileGalleryScreen} />
        <MainStack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
        <MainStack.Screen name="Activity" component={ActivityScreen} />
        <MainStack.Screen name="PostFeed" component={PostFeedScreen} />
    </MainStack.Navigator>
);

export const RootNavigator = () => {
    const isAuthenticated = useAppStore((state) => state.isAuthenticated);
    const [isLoading, setIsLoading] = useState(true);
    const isVoiceActive = useAppStore(state => state.isVoiceActive);
    const navigationRef = useNavigationContainerRef();

    useEffect(() => {
        // ... (auth logic same)
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const docRef = doc(db, 'users', firebaseUser.uid);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const user = snap.data() as User;
                        useAppStore.setState({ currentUser: user, isAuthenticated: true });
                    }
                } catch (e) {
                    console.error("Auto-login failed", e);
                }
            } else {
                useAppStore.setState({ currentUser: null, isAuthenticated: false });
            }
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <NavigationContainer ref={navigationRef}>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    {!isAuthenticated ? (
                        <Stack.Screen name="Auth" component={AuthStack} />
                    ) : (
                        <Stack.Screen name="Main" component={MainStackScreen} />
                    )}
                </Stack.Navigator>
            </NavigationContainer>

            {/* Voice Overlay on top of everything */}
            <VoiceOverlay visible={isVoiceActive} navigationRef={navigationRef} />
        </View>
    );
};


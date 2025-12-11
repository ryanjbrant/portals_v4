import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';

import { useRoute } from '@react-navigation/native';
import { AuthService } from '../services/auth';
import { User } from '../types';
import { doc, getDoc } from 'firebase/firestore'; // Import directly for speed or use AuthService helper if we made one (we didn't make getById)
import { db } from '../config/firebase';

export const ProfileScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const currentUser = useAppStore(state => state.currentUser);
    const notifications = useAppStore(state => state.notifications);
    const hasUnread = notifications.some(n => !n.read);

    // Params: userId can be passed to view others. If null, view self.
    const targetUserId = route.params?.userId || currentUser?.id;
    const isSelf = targetUserId === currentUser?.id;

    const [profileUser, setProfileUser] = React.useState<User | null>(isSelf ? currentUser : null);
    const [isFollowing, setIsFollowing] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const loadProfile = async () => {
            if (isSelf) {
                setProfileUser(currentUser);
                return;
            }

            setLoading(true);
            try {
                // Fetch user doc
                const snap = await getDoc(doc(db, 'users', targetUserId));
                if (snap.exists()) {
                    setProfileUser(snap.data() as User);
                }

                // Check following status
                if (currentUser) {
                    const following = await AuthService.checkIsFollowing(currentUser.id, targetUserId);
                    setIsFollowing(following);
                }
            } catch (e) {
                console.error("Failed to load profile", e);
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [targetUserId, currentUser, isSelf]);

    const handleFollowToggle = async () => {
        if (!currentUser || !profileUser) return;
        try {
            if (isFollowing) {
                await AuthService.unfollowUser(currentUser.id, profileUser.id);
                setIsFollowing(false);
                // Optimistic update
                setProfileUser(prev => prev ? ({ ...prev, followers: Math.max(0, prev.followers - 1) }) : null);
            } else {
                await AuthService.followUser(currentUser.id, profileUser.id);
                setIsFollowing(true);
                // Optimistic update
                setProfileUser(prev => prev ? ({ ...prev, followers: prev.followers + 1 }) : null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (!profileUser) return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: 'white' }}>Loading...</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[theme.colors.surfaceHighlight, theme.colors.background]}
                style={styles.background}
            />

            {isSelf && (
                <SafeAreaView style={styles.topNav}>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Activity')}>
                        <Ionicons name="notifications-outline" size={26} color={theme.colors.white} />
                        {hasUnread && <View style={styles.redDot} />}
                    </TouchableOpacity>
                </SafeAreaView>
            )}

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <Image source={{ uri: profileUser.avatar }} style={styles.avatar} />
                        {profileUser.isVerified && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark" size={12} color={theme.colors.white} />
                            </View>
                        )}
                    </View>

                    <Text style={styles.name}>{profileUser.name || profileUser.username}</Text>
                    <Text style={styles.username}>@{profileUser.username}</Text>

                    {/* Stats Row */}
                    <View style={styles.statsContainer}>
                        <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('People', { tab: 'Following' })}>
                            <Text style={styles.statNumber}>{profileUser.following}</Text>
                            <Text style={styles.statLabel}>Following</Text>
                        </TouchableOpacity>
                        <View style={styles.statDivider} />
                        <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('People', { tab: 'Followers' })}>
                            <Text style={styles.statNumber}>{profileUser.followers}</Text>
                            <Text style={styles.statLabel}>Followers</Text>
                        </TouchableOpacity>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{profileUser.flames}</Text>
                            <Text style={styles.statLabel}>Flames</Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionContainer}>
                        {isSelf ? (
                            <>
                                <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('ProfileSettings')}>
                                    <Text style={styles.primaryButtonText}>Edit Profile</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('ComposerEditor')}>
                                    <Text style={styles.secondaryButtonText}>Create World</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.primaryButton, isFollowing && { backgroundColor: theme.colors.surface }]}
                                    onPress={handleFollowToggle}
                                >
                                    <Text style={[styles.primaryButtonText, isFollowing && { color: theme.colors.textDim }]}>
                                        {isFollowing ? 'Following' : 'Follow'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.secondaryButton}>
                                    <Text style={styles.secondaryButtonText}>Message</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {/* Gallery or Private Lock */}
                    {(isSelf || !profileUser.isPrivate || (profileUser.isPrivate && isFollowing)) ? (
                        <TouchableOpacity style={styles.galleryButton} onPress={() => navigation.navigate('ProfileGallery')}>
                            <LinearGradient
                                colors={[theme.colors.primary, theme.colors.primary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.galleryGradient}
                            >
                                <Ionicons name="images" size={24} color={theme.colors.black} />
                                <Text style={[styles.galleryButtonText, { color: theme.colors.black }]}>Open Gallery</Text>
                                <Ionicons name="arrow-forward" size={20} color={theme.colors.black} />
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.galleryButton, { backgroundColor: theme.colors.surfaceHighlight }]}>
                            <View style={styles.galleryGradient}>
                                <Ionicons name="lock-closed" size={24} color={theme.colors.textDim} />
                                <Text style={[styles.galleryButtonText, { color: theme.colors.textDim }]}>Private Account</Text>
                            </View>
                        </View>
                    )}

                </View>

                <View style={styles.bioContainer}>
                    <Text style={styles.bioTitle}>About</Text>
                    <Text style={styles.bioText}>{profileUser.bio || "No bio yet."}</Text>
                </View>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 300,
    },
    content: {
        paddingTop: 60,
        paddingBottom: 40,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: theme.spacing.l,
        marginBottom: theme.spacing.xl,
    },
    avatarContainer: {
        marginBottom: theme.spacing.m,
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: theme.colors.surface,
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: theme.colors.primary,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.colors.background,
    },
    name: {
        ...theme.typography.h1,
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: 4,
    },
    username: {
        color: theme.colors.textDim,
        fontSize: 16,
        marginBottom: theme.spacing.l,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: theme.borderRadius.l,
        marginBottom: theme.spacing.l,
        width: '100%',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: theme.colors.surfaceHighlight,
    },
    statNumber: {
        color: theme.colors.text,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        color: theme.colors.textDim,
        fontSize: 12,
    },
    actionContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginBottom: 16,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: theme.colors.surfaceHighlight,
        paddingVertical: 14,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: theme.colors.text,
        fontWeight: '600',
        fontSize: 16,
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: 14,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: theme.colors.text,
        fontWeight: '600',
        fontSize: 16,
    },
    galleryButton: {
        width: '100%',
        borderRadius: theme.borderRadius.m,
        overflow: 'hidden',
        marginTop: 8,
    },
    galleryGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    galleryButtonText: {
        color: theme.colors.white,
        fontWeight: '700',
        fontSize: 16,
        flex: 1,
        marginLeft: 12,
    },
    topNav: {
        position: 'absolute',
        top: 50, // Approximate Status Bar height + padding
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    iconBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 22,
    },
    redDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF3B30',
        borderWidth: 1,
        borderColor: theme.colors.surface,
    },
    bioContainer: {
        width: '100%',
        paddingHorizontal: theme.spacing.l,
    },
    bioTitle: {
        color: theme.colors.text,
        fontWeight: '600',
        fontSize: 18,
        marginBottom: 8,
    },
    bioText: {
        color: theme.colors.textSecondary,
        lineHeight: 24,
        fontSize: 15,
    }
});

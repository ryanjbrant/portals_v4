import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Share, Animated } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '../types';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { AuthService } from '../services/auth';

const { width, height } = Dimensions.get('window');
// Height correction for tab bar
const SCREEN_HEIGHT = height - 80;

const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
};

interface FeedItemProps {
    post: Post;
    onCommentPress: () => void;
    hideControls?: boolean;
}

export const FeedItem = ({ post, onCommentPress, hideControls }: FeedItemProps) => {
    const navigation = useNavigation<any>();
    const currentUser = useAppStore(state => state.currentUser);
    const toggleLike = useAppStore(state => state.toggleLike);
    const [isFollowing, setIsFollowing] = useState(false);

    // Loading states
    const [videoReady, setVideoReady] = useState(false);
    const [avatarLoaded, setAvatarLoaded] = useState(false);

    // Animated values for fade-in
    const videoOpacity = useRef(new Animated.Value(0)).current;
    const avatarOpacity = useRef(new Animated.Value(0)).current;
    const skeletonPulse = useRef(new Animated.Value(0.3)).current;

    // Heart animation
    const heartScale = useRef(new Animated.Value(1)).current;
    const sparksOpacity = useRef(new Animated.Value(0)).current;
    const spark1 = useRef(new Animated.Value(0)).current;
    const spark2 = useRef(new Animated.Value(0)).current;
    const spark3 = useRef(new Animated.Value(0)).current;
    const spark4 = useRef(new Animated.Value(0)).current;

    const handleLike = () => {
        toggleLike(post.id);

        // Springy heart animation
        Animated.sequence([
            Animated.timing(heartScale, { toValue: 0.6, duration: 80, useNativeDriver: true }),
            Animated.spring(heartScale, { toValue: 1.3, friction: 3, tension: 400, useNativeDriver: true }),
            Animated.spring(heartScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
        ]).start();

        // Spark burst animation
        sparksOpacity.setValue(1);
        spark1.setValue(0);
        spark2.setValue(0);
        spark3.setValue(0);
        spark4.setValue(0);

        Animated.parallel([
            Animated.timing(spark1, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(spark2, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(spark3, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(spark4, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(sparksOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
    };

    // Skeleton pulse animation
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(skeletonPulse, { toValue: 0.6, duration: 800, useNativeDriver: true }),
                Animated.timing(skeletonPulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // Fade in video when ready
    useEffect(() => {
        if (videoReady) {
            Animated.timing(videoOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [videoReady]);

    // Fade in avatar when loaded
    useEffect(() => {
        if (avatarLoaded) {
            Animated.timing(avatarOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [avatarLoaded]);

    // Check if already following on mount
    useEffect(() => {
        if (currentUser && post.user.id !== currentUser.id) {
            AuthService.checkIsFollowing(currentUser.id, post.user.id)
                .then(setIsFollowing)
                .catch(console.error);
        }
    }, [currentUser?.id, post.user.id]);

    // Video player for feed item
    const player = useVideoPlayer(post.mediaUri || null, player => {
        player.loop = true;
        player.muted = false;
        player.play();
    });

    // Listen for video playing state
    useEffect(() => {
        if (player && post.mediaUri) {
            const checkPlaying = setInterval(() => {
                if (player.playing) {
                    setVideoReady(true);
                    clearInterval(checkPlaying);
                }
            }, 100);
            // Fallback: mark as ready after 2s
            const timeout = setTimeout(() => {
                setVideoReady(true);
                clearInterval(checkPlaying);
            }, 2000);
            return () => {
                clearInterval(checkPlaying);
                clearTimeout(timeout);
            };
        }
    }, [player, post.mediaUri]);

    const handleFollow = async () => {
        if (!currentUser) return;
        setIsFollowing(true); // Optimistic hide
        try {
            const { AuthService } = await import('../services/auth');
            await AuthService.followUser(currentUser.id, post.user.id);
        } catch (error) {
            console.error(error);
            setIsFollowing(false); // Revert
        }
    };

    const handleShare = async () => {
        try {
            const shareOptions: { message: string; url?: string; title?: string } = {
                message: `Check out this post from @${post.user.username}\n\n"${post.caption}"\n\nSent via Portals`,
                title: `@${post.user.username}'s Portal`,
            };

            // If there's a video URL, include it so users can save/download it
            if (post.mediaUri) {
                shareOptions.url = post.mediaUri;
            }

            await Share.share(shareOptions);
        } catch (error: any) {
            console.error(error.message);
        }
    };

    const handleProfilePress = () => {
        navigation.navigate('UserProfile', { userId: post.user.id });
    };

    return (
        <View style={styles.container}>
            {/* Skeleton Background - always visible, fades out when video ready */}
            <Animated.View style={[styles.skeletonContainer, { opacity: skeletonPulse }]}>
                <LinearGradient
                    colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>

            {/* Cover Image - shown while video loads */}
            {post.coverImage && !videoReady && (
                <Image
                    source={{ uri: post.coverImage }}
                    style={styles.coverImage}
                    resizeMode="cover"
                />
            )}

            {/* Video - fades in when ready */}
            {post.mediaUri && (
                <Animated.View style={[styles.mediaContainer, { opacity: videoOpacity }]}>
                    <VideoView
                        style={StyleSheet.absoluteFillObject}
                        player={player}
                        contentFit="cover"
                        nativeControls={false}
                    />
                </Animated.View>
            )}

            {/* Right Action Bar - hidden when comments open */}
            {!hideControls && (
                <View style={styles.rightContainer}>
                    <View style={styles.actionButton}>
                        <View style={styles.avatarContainer}>
                            {/* Skeleton for avatar */}
                            <Animated.View style={[styles.avatarSkeleton, { opacity: skeletonPulse }]} />
                            <TouchableOpacity onPress={handleProfilePress}>
                                <Animated.View style={{ opacity: avatarOpacity }}>
                                    <Image
                                        source={{ uri: post.user.avatar }}
                                        style={styles.avatar}
                                        onLoad={() => setAvatarLoaded(true)}
                                    />
                                </Animated.View>
                            </TouchableOpacity>

                            {!isFollowing && currentUser?.id !== post.user.id && (
                                <TouchableOpacity style={styles.followBadge} onPress={handleFollow}>
                                    <Ionicons name="add" size={12} color="#000" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                        <View style={styles.heartContainer}>
                            {/* Spark particles */}
                            <Animated.View style={[styles.spark, {
                                opacity: sparksOpacity,
                                transform: [
                                    { translateY: spark1.interpolate({ inputRange: [0, 1], outputRange: [0, -25] }) },
                                    { scale: spark1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.2, 0] }) },
                                ],
                            }]} />
                            <Animated.View style={[styles.spark, {
                                opacity: sparksOpacity,
                                transform: [
                                    { translateY: spark2.interpolate({ inputRange: [0, 1], outputRange: [0, 25] }) },
                                    { scale: spark2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.2, 0] }) },
                                ],
                            }]} />
                            <Animated.View style={[styles.spark, {
                                opacity: sparksOpacity,
                                transform: [
                                    { translateX: spark3.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) },
                                    { translateY: spark3.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) },
                                    { scale: spark3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) },
                                ],
                            }]} />
                            <Animated.View style={[styles.spark, {
                                opacity: sparksOpacity,
                                transform: [
                                    { translateX: spark4.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) },
                                    { translateY: spark4.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) },
                                    { scale: spark4.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) },
                                ],
                            }]} />
                            {/* Animated heart */}
                            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                                <Ionicons
                                    name="heart"
                                    size={35}
                                    color={post.isLiked ? theme.colors.primary : theme.colors.white}
                                />
                            </Animated.View>
                        </View>
                        <Text style={styles.actionText}>{post.likes}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={onCommentPress}>
                        <Ionicons name="chatbubble-ellipses" size={35} color={theme.colors.white} />
                        <Text style={styles.actionText}>{post.comments}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                        <Ionicons name="share-social" size={35} color={theme.colors.white} />
                        <Text style={styles.actionText}>{post.shares}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => {
                        // Navigate to Figment to view/remix the AR scene
                        if (post.sceneId) {
                            navigation.navigate('Figment', {
                                postData: post,
                                isRemix: true
                            });
                        } else {
                            navigation.navigate('ARViewer', { sceneId: 'demo_scene' });
                        }
                    }}>
                        <Ionicons name="eye" size={35} color={theme.colors.white} />
                        <Text style={styles.actionText}>View</Text>
                    </TouchableOpacity>

                </View>
            )}

            {/* Bottom Info Overlay */}
            <View style={styles.bottomContainer}>
                <View style={styles.userInfoRow}>
                    <Text style={styles.username}>@{post.user.username}</Text>
                    <Text style={styles.dateText}>• {getRelativeTime(post.date)}</Text>
                </View>
                <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text>
                {/* Remix Attribution */}
                {post.remixedFrom && (
                    <TouchableOpacity
                        style={styles.remixRow}
                        onPress={() => navigation.navigate('PostDetails', { postId: post.remixedFrom?.postId })}
                    >
                        <Image source={{ uri: post.remixedFrom.avatar }} style={styles.remixAvatar} />
                        <Text style={styles.remixText}>Remixed from @{post.remixedFrom.username}</Text>
                    </TouchableOpacity>
                )}
                {post.tags && post.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                        {post.tags.map((tag, i) => (
                            <Text key={i} style={styles.tagText}>#{tag}</Text>
                        ))}
                    </View>
                )}
                {post.isArtifact && (
                    <View style={styles.artifactTag}>
                        <Ionicons name="diamond" size={12} color={theme.colors.secondary} />
                        <Text style={styles.artifactText}>ARTIFACT</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        height: SCREEN_HEIGHT,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: '#333',
        fontWeight: 'bold',
        fontSize: 24,
    },
    skeletonContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    coverImage: {
        ...StyleSheet.absoluteFillObject,
    },
    avatarSkeleton: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#333',
    },
    rightContainer: {
        position: 'absolute',
        right: 8,
        bottom: 120, // Increased bottom margin to clear tab bar safely
        alignItems: 'center',
    },
    actionButton: {
        alignItems: 'center',
        marginBottom: 20,
    },
    heartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    spark: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.primary,
    },
    avatarContainer: {
        marginBottom: 10,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: theme.colors.white,
    },
    followBadge: {
        position: 'absolute',
        bottom: -8,
        alignSelf: 'center',
        backgroundColor: theme.colors.primary,
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        color: theme.colors.white,
        fontSize: 12,
        marginTop: 4,
        fontWeight: '600',
    },
    bottomContainer: {
        position: 'absolute',
        left: 10,
        bottom: 20,
        right: 80, // Leave room for right actions
    },
    username: {
        color: theme.colors.white,
        fontWeight: '700',
        fontSize: 16,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    userInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    dateText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: '500',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
        gap: 6,
    },
    tagText: {
        color: theme.colors.primary, // Or white/dim based on preference. Primary feels "tagged".
        fontSize: 13,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    caption: {
        color: theme.colors.white,
        fontSize: 14,
        lineHeight: 20,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },


    artifactTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.2)', // Gold tint background
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: theme.colors.secondary,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginTop: 8,
        gap: 4,
    },
    artifactText: {
        color: theme.colors.secondary,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    remixRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    remixAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
    },
    remixText: {
        color: theme.colors.primary,
        fontSize: 12,
        fontWeight: '500',
    },

});

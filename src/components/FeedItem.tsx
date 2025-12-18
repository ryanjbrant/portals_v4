import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Share } from 'react-native';
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
}

export const FeedItem = ({ post, onCommentPress }: FeedItemProps) => {
    const navigation = useNavigation<any>();
    const currentUser = useAppStore(state => state.currentUser);
    const toggleLike = useAppStore(state => state.toggleLike);
    const [isFollowing, setIsFollowing] = React.useState(false);

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
            {/* Background Media */}
            {post.mediaUri ? (
                <VideoView
                    style={styles.mediaContainer}
                    player={player}
                    contentFit="cover"
                    nativeControls={false}
                />
            ) : (
                <LinearGradient
                    colors={['#1c0f24', '#0f1724']}
                    style={styles.mediaContainer}
                >
                    <Text style={styles.placeholderText}>Video Placeholder</Text>
                </LinearGradient>
            )}

            {/* Right Action Bar */}
            <View style={styles.rightContainer}>
                <View style={styles.actionButton}>
                    <View style={styles.avatarContainer}>
                        <TouchableOpacity onPress={handleProfilePress}>
                            <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
                        </TouchableOpacity>

                        {!isFollowing && currentUser?.id !== post.user.id && (
                            <TouchableOpacity style={styles.followBadge} onPress={handleFollow}>
                                <Ionicons name="add" size={12} color="#000" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike(post.id)}>
                    <Ionicons
                        name="heart"
                        size={35}
                        color={post.isLiked ? theme.colors.primary : theme.colors.white}
                    />
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

                <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ARViewer', { sceneId: post.sceneId || 'demo_scene' })}>
                    <Ionicons name="eye" size={35} color={theme.colors.white} />
                    <Text style={styles.actionText}>View</Text>
                </TouchableOpacity>


            </View>

            {/* Bottom Info Overlay */}
            <View style={styles.bottomContainer}>
                <View style={styles.userInfoRow}>
                    <Text style={styles.username}>@{post.user.username}</Text>
                    <Text style={styles.dateText}>• {getRelativeTime(post.date)}</Text>
                </View>
                <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text>
                {post.tags && post.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                        {post.tags.map((tag, i) => (
                            <Text key={i} style={styles.tagText}>#{tag}</Text>
                        ))}
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

});

import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Share } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '../types';
import { theme } from '../theme/theme';
import { useAppStore } from '../store';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
// Height correction for tab bar
const SCREEN_HEIGHT = height - 80;

interface FeedItemProps {
    post: Post;
    onCommentPress: () => void;
}

export const FeedItem = ({ post, onCommentPress }: FeedItemProps) => {
    const navigation = useNavigation<any>();
    const currentUser = useAppStore(state => state.currentUser);
    const toggleLike = useAppStore(state => state.toggleLike);
    const [isFollowing, setIsFollowing] = React.useState(false);

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
            await Share.share({
                message: `Check out this post from @${post.user.username}\n\n"${post.caption}"\n\nSent via Portals`,
            });
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
                <Video
                    style={styles.mediaContainer}
                    source={{ uri: post.mediaUri }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={true}
                    isLooping={true}
                    isMuted={false}
                    onError={(e) => console.error("Video Playback Error:", e, post.mediaUri)}
                    onLoad={() => console.log("Video Loaded:", post.mediaUri)}
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
                <Text style={styles.username}>@{post.user.username} • {post.date}</Text>
                <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text>
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
        marginBottom: 8,
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

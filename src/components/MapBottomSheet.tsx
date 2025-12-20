import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    PanResponder,
    Dimensions,
    TouchableOpacity,
    Image,
    Platform,
    ScrollView
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { Post } from '../types';
import LocationService from '../services/LocationService';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Tab bar height is ~60 + safe area (~34) = ~94
const TAB_BAR_HEIGHT = 94;

const SNAP_POINTS = {
    COLLAPSED: SCREEN_HEIGHT - 180, // Showing just the "Nearby" header or small list
    PARTIAL: SCREEN_HEIGHT - 350,   // Showing half list
    DETAILS: SCREEN_HEIGHT - 520,   // Gamified detail view - higher to reveal button above tab bar
    EXPANDED: 150,                  // Partial expansion, not full screen
};

interface MapBottomSheetProps {
    posts: Post[];
    selectedPost: Post | null;
    onPostSelect: (post: Post) => void;
    onNavigate: (post: Post) => void;
    onCloseSelection: () => void;
}

export const MapBottomSheet = ({
    posts,
    selectedPost,
    onPostSelect,
    onNavigate,
    onCloseSelection
}: MapBottomSheetProps) => {
    const panY = useRef(new Animated.Value(SNAP_POINTS.COLLAPSED)).current;
    const [currentSnap, setCurrentSnap] = useState(SNAP_POINTS.COLLAPSED);
    const [userLoc, setUserLoc] = useState<{ lat: number, lon: number } | null>(null);

    useEffect(() => {
        LocationService.getCurrentLocation().then(loc => {
            if (loc) setUserLoc({ lat: loc.latitude, lon: loc.longitude });
        });
    }, []);

    // Effect: If a post is selected, snap to DETAILS view to show navigate button immediately
    useEffect(() => {
        if (selectedPost) {
            animateTo(SNAP_POINTS.DETAILS);
        } else {
            // If deselected, go back to collapsed ? Or stay ?
            // Let's stay provided we aren't fully expanded covering the map
        }
    }, [selectedPost]);

    const animateTo = (y: number) => {
        Animated.spring(panY, {
            toValue: y,
            useNativeDriver: false, // height/layout animation not supported by native driver usually
            friction: 7,
            tension: 40
        }).start(() => setCurrentSnap(y));
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only capture vertical swipes
                return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 10;
            },
            onPanResponderGrant: () => {
                panY.extractOffset();
            },
            onPanResponderMove: Animated.event(
                [null, { dy: panY }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (_, gesture) => {
                panY.flattenOffset();

                // Determine next snap point
                const currentPos = currentSnap + gesture.dy;
                let nextPos = SNAP_POINTS.COLLAPSED;

                // Threshold logic
                if (gesture.vy < -0.5 || currentPos < SNAP_POINTS.PARTIAL - 100) {
                    nextPos = SNAP_POINTS.EXPANDED;
                } else if (currentPos < SNAP_POINTS.COLLAPSED - 100) {
                    nextPos = SNAP_POINTS.PARTIAL;
                } else {
                    nextPos = SNAP_POINTS.COLLAPSED;
                }

                animateTo(nextPos);
            }
        })
    ).current;

    const renderHeader = () => (
        <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View style={styles.handle} />
        </View>
    );

    const renderContent = () => {
        if (selectedPost) {
            // === GAMIFIED DETAIL VIEW ===
            const distKm = userLoc && selectedPost.locations?.[0]
                ? LocationService.calculateDistance(
                    userLoc.lat, userLoc.lon,
                    selectedPost.locations[0].latitude,
                    selectedPost.locations[0].longitude
                )
                : null;
            const distDisplay = distKm !== null
                ? (distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`)
                : 'Unknown';
            // Estimate walking time: ~5km/h average = 12 min/km
            const walkMins = distKm !== null ? Math.round(distKm * 12) : null;
            const fuelReward = selectedPost.fuelReward || 50;

            return (
                <View style={styles.detailContainer}>
                    {/* Header row with back button */}
                    <View style={styles.detailHeader} {...panResponder.panHandlers}>
                        <TouchableOpacity onPress={onCloseSelection} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.detailTitle} numberOfLines={1}>Portal Details</Text>
                        <View style={{ width: 36 }} />
                    </View>

                    {/* Main Card: Thumbnail + Info */}
                    <View style={styles.portalCard}>
                        <Image
                            source={{ uri: selectedPost.coverImage || selectedPost.mediaUri }}
                            style={styles.portalThumb}
                            resizeMode="cover"
                        />
                        <View style={styles.portalInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.portalName} numberOfLines={2}>{selectedPost.caption || 'Untitled Portal'}</Text>
                                {selectedPost.isArtifact && (
                                    <View style={styles.artifactBadge}>
                                        <Ionicons name="diamond" size={12} color={theme.colors.secondary} />
                                        <Text style={styles.artifactBadgeText}>Artifact</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.portalCreator}>by @{selectedPost.user?.username || 'creator'}</Text>

                            {/* Stats Row */}
                            <View style={styles.statBadges}>
                                <View style={styles.statBadge}>
                                    <Ionicons name="walk" size={14} color={theme.colors.primary} />
                                    <Text style={styles.statBadgeText}>{distDisplay}</Text>
                                </View>
                                {walkMins !== null && (
                                    <View style={styles.statBadge}>
                                        <Ionicons name="time" size={14} color={theme.colors.textDim} />
                                        <Text style={styles.statBadgeText}>{walkMins} min</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Fuel Reward Banner */}
                    <View style={styles.rewardBanner}>
                        <Ionicons name="flame" size={24} color={theme.colors.warning} />
                        <View style={styles.rewardInfo}>
                            <Text style={styles.rewardTitle}>FUEL Reward</Text>
                            <Text style={styles.rewardAmount}>+{fuelReward} XP</Text>
                        </View>
                        <Text style={styles.rewardHint}>Collect at location</Text>
                    </View>

                    {/* Navigate Button */}
                    <TouchableOpacity style={styles.navigateButton} onPress={() => onNavigate(selectedPost)}>
                        <LinearGradientView>
                            <Ionicons name="navigate" size={20} color="black" />
                            <Text style={styles.navigateText}>Start Journey</Text>
                        </LinearGradientView>
                    </TouchableOpacity>
                </View>
            );
        }

        // === LIST VIEW (Nearby) ===
        return (
            <View style={styles.listContainer}>
                <View {...panResponder.panHandlers}>
                    <Text style={styles.sectionTitle}>Nearby Portals</Text>
                </View>
                <ScrollView
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    {posts.map((post, idx) => (
                        <TouchableOpacity
                            key={post.id}
                            style={styles.listItem}
                            onPress={() => onPostSelect(post)}
                        >
                            <Image source={{ uri: post.coverImage || post.mediaUri }} style={styles.listThumb} />
                            <View style={styles.listInfo}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.listTitle} numberOfLines={1}>{post.caption || 'Untitled Portal'}</Text>
                                    {post.isArtifact && (
                                        <Ionicons name="diamond" size={12} color={theme.colors.secondary} />
                                    )}
                                </View>
                                <Text style={styles.listSubtitle}>@{post.user.username}</Text>
                                <View style={styles.listMeta}>
                                    <Ionicons name="flame" size={12} color={theme.colors.warning} />
                                    <Text style={styles.metaText}>{post.fuelReward || 50}</Text>
                                    <Text style={styles.dot}>•</Text>
                                    <Text style={styles.metaText}>
                                        {post.locations?.[0] && userLoc
                                            ? `${LocationService.calculateDistance(
                                                userLoc.lat, userLoc.lon,
                                                post.locations[0].latitude,
                                                post.locations[0].longitude
                                            ).toFixed(1)} km`
                                            : 'Unknown'}
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.colors.textDim} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: panY }] }
            ]}
        >
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="dark" style={StyleSheet.absoluteFill} />
            {renderHeader()}
            {renderContent()}
        </Animated.View>
    );
};

// Mock gradient wrapper if component not available in file
const LinearGradientView = ({ children }: { children: React.ReactNode }) => (
    <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        padding: 16,
        borderRadius: 24,
        gap: 8,
        width: '100%'
    }}>
        {children}
    </View>
);

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT,
        backgroundColor: 'rgba(15, 15, 20, 0.65)', // More transparent for glass effect
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    handleContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    handle: {
        width: 36,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderRadius: 3,
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        ...theme.typography.h2,
        fontSize: 22,
        color: theme.colors.white,
        marginBottom: 16,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 12,
    },
    listThumb: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#333',
    },
    listInfo: {
        flex: 1,
        marginLeft: 12,
    },
    listTitle: {
        color: theme.colors.white,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    listSubtitle: {
        color: theme.colors.textDim,
        fontSize: 14,
    },
    listMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    metaText: {
        color: theme.colors.textDim,
        fontSize: 12,
        fontWeight: '500',
    },
    dot: {
        color: theme.colors.textDim,
        fontSize: 12,
    },
    // Detail
    detailContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    detailActionButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    detailTitle: {
        ...theme.typography.h2,
        color: theme.colors.white,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    // Compact inline layout
    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 10,
        marginBottom: 12,
        gap: 12,
    },
    inlineThumb: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#333',
    },
    inlineInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    inlineStats: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    inlineStatText: {
        color: theme.colors.textDim,
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 4,
    },
    detailImage: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        backgroundColor: '#222',
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statText: {
        color: theme.colors.white,
        fontWeight: '600',
        fontSize: 14,
    },
    detailDescription: {
        color: theme.colors.textDim,
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 24,
    },
    navigateButton: {
        width: '100%',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    navigateText: {
        color: 'black',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    // Gamified Portal Card
    portalCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        gap: 12,
    },
    portalThumb: {
        width: 90,
        height: 90,
        borderRadius: 12,
        backgroundColor: '#333',
    },
    portalInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    portalName: {
        color: theme.colors.white,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    portalCreator: {
        color: theme.colors.textDim,
        fontSize: 13,
        marginBottom: 8,
    },
    statBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    statBadgeText: {
        color: theme.colors.white,
        fontSize: 13,
        fontWeight: '600',
    },
    // Fuel Reward Banner
    rewardBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,200,0,0.15)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        gap: 10,
    },
    rewardInfo: {
        flex: 1,
    },
    rewardTitle: {
        color: theme.colors.warning,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    rewardAmount: {
        color: theme.colors.warning,
        fontSize: 22,
        fontWeight: '800',
    },
    rewardHint: {
        color: theme.colors.textDim,
        fontSize: 11,
        textAlign: 'right',
    },
    artifactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 193, 7, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    artifactBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.secondary,
    },
});

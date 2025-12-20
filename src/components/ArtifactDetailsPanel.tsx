import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Image,
    Dimensions,
    ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { Post } from '../types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.55;

interface ArtifactDetailsPanelProps {
    visible: boolean;
    post: Post;
    artifactData: {
        isArtifact?: boolean;
        title?: string;
        type?: string;
        value?: string;
        description?: string;
        qrImage?: string;
    } | null;
    isCollected: boolean;
    onCollect: () => void;
    onClose: () => void;
}

export const ArtifactDetailsPanel = ({
    visible,
    post,
    artifactData,
    isCollected,
    onCollect,
    onClose,
}: ArtifactDetailsPanelProps) => {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;

    useEffect(() => {
        Animated.spring(translateY, {
            toValue: visible ? 0 : PANEL_HEIGHT,
            useNativeDriver: true,
            damping: 20,
            stiffness: 90,
        }).start();
    }, [visible]);

    if (!post) return null;

    const { user } = post;
    const title = artifactData?.title || post.caption || 'Untitled Artifact';
    const type = artifactData?.type || 'Collect';
    const description = artifactData?.description || '';
    const qrImage = artifactData?.qrImage;
    const value = artifactData?.value;

    // Get type-specific label
    const getTypeLabel = () => {
        switch (type) {
            case 'Sell': return `Price: ${value || 'N/A'}`;
            case 'Redeem': return 'Redeemable';
            case 'Unlock': return `Requirement: ${value || 'N/A'}`;
            case 'QR Redeem': return 'QR Redemption';
            default: return 'Collectible';
        }
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY }], paddingBottom: insets.bottom + 16 },
            ]}
        >
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

            {/* Handle Bar */}
            <View style={styles.handleBarContainer}>
                <View style={styles.handleBar} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Creator Info */}
                <View style={styles.creatorRow}>
                    <Image
                        source={{ uri: user?.avatar || 'https://via.placeholder.com/40' }}
                        style={styles.avatar}
                    />
                    <View style={styles.creatorInfo}>
                        <Text style={styles.creatorName}>{user?.username || 'Creator'}</Text>
                        <View style={styles.badgeRow}>
                            <View style={styles.typeBadge}>
                                <Ionicons name="diamond" size={12} color={theme.colors.secondary} />
                                <Text style={styles.typeBadgeText}>{type}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Title */}
                <Text style={styles.title}>{title}</Text>

                {/* Content Embed (QR or Media) */}
                {qrImage && (
                    <View style={styles.contentEmbed}>
                        <Image
                            source={{ uri: qrImage }}
                            style={styles.qrImage}
                            resizeMode="contain"
                        />
                    </View>
                )}

                {/* Type Label */}
                <View style={styles.typeRow}>
                    <Ionicons name="pricetag" size={16} color={theme.colors.primary} />
                    <Text style={styles.typeLabel}>{getTypeLabel()}</Text>
                </View>

                {/* Description */}
                {description ? (
                    <Text style={styles.description}>{description}</Text>
                ) : null}

                {/* Additional Info for QR Redeem */}
                {type === 'QR Redeem' && (
                    <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Redemption Info</Text>
                        <Text style={styles.infoText}>
                            Present this artifact at the location to redeem your reward.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Collect Button */}
            <TouchableOpacity
                style={[
                    styles.collectButton,
                    isCollected && styles.collectButtonCollected,
                ]}
                onPress={onCollect}
                disabled={isCollected}
                activeOpacity={0.8}
            >
                {isCollected ? (
                    <>
                        <Ionicons name="checkmark-circle" size={24} color="black" />
                        <Text style={styles.collectButtonText}>Collected</Text>
                    </>
                ) : (
                    <>
                        <Ionicons name="diamond" size={24} color="black" />
                        <Text style={styles.collectButtonText}>Collect Artifact</Text>
                    </>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: PANEL_HEIGHT,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    handleBarContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    creatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    creatorInfo: {
        marginLeft: 12,
        flex: 1,
    },
    creatorName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    badgeRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 193, 7, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.secondary,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
    },
    contentEmbed: {
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    qrImage: {
        width: SCREEN_WIDTH * 0.4,
        height: SCREEN_WIDTH * 0.4,
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    typeLabel: {
        fontSize: 14,
        color: theme.colors.textDim,
    },
    description: {
        fontSize: 14,
        color: theme.colors.textDim,
        lineHeight: 20,
        marginBottom: 16,
    },
    infoBox: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    infoLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.textDim,
        marginBottom: 4,
    },
    infoText: {
        fontSize: 14,
        color: theme.colors.text,
        lineHeight: 20,
    },
    collectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.colors.primary,
        marginHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 30,
    },
    collectButtonCollected: {
        backgroundColor: theme.colors.success || '#4CAF50',
    },
    collectButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'black',
    },
});

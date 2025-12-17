/**
 * PortalBackgroundPanel.js
 * Panel for selecting portal backgrounds - 360 videos and spherical images
 * Similar to AnimationPanel but with two tabs: Video and Image
 */

import React, { Component } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as PSConstants from './PSConstants';

const { height, width } = Dimensions.get('window');
const PANEL_HEIGHT = height * 0.5;
const THUMB_SIZE = (width - 60) / 3;

// 360 Video data - these are full spherical videos
const VIDEOS_360 = [
    {
        id: 'dinosaurs',
        name: 'Dinosaurs',
        thumbnail: require('../res/360/thumbs/Dinosaurs.jpg'),
        source: require('../res/360/Dinosaurs.mp4'),
    },
    {
        id: 'mcqueen',
        name: 'McQueen',
        thumbnail: require('../res/360/thumbs/AlexanderMcQueen.jpg'),
        source: require('../res/360/AlexanderMcQueen.mp4'),
    },
    {
        id: 'dali',
        name: 'Dalí Dreams',
        thumbnail: require('../res/360/thumbs/Dali.jpg'),
        source: require('../res/360/Dali.mp4'),
    },
    {
        id: 'avatar',
        name: 'Avatar',
        thumbnail: require('../res/360/thumbs/Avatar.jpg'),
        source: require('../res/360/Avatar.mp4'),
    },
    {
        id: 'galaxy',
        name: 'Galaxy',
        thumbnail: require('../res/360/thumbs/Galaxy.jpg'),
        source: require('../res/360/Galaxy.mp4'),
    },
    {
        id: 'it',
        name: 'IT',
        thumbnail: require('../res/360/thumbs/IT.jpg'),
        source: require('../res/360/IT.mp4'),
    },
];

// Spherical sky images for portal backgrounds
const IMAGES_360 = [
    { id: 'sky01', name: 'Sky 1', thumbnail: require('../res/portals-dome/thumbs/pure-sky-01.jpg'), source: require('../res/portals-dome/pure-sky-01.jpg') },
    { id: 'sky02', name: 'Sky 2', thumbnail: require('../res/portals-dome/thumbs/pure-sky-02.jpg'), source: require('../res/portals-dome/pure-sky-02.jpg') },
    { id: 'sky03', name: 'Sky 3', thumbnail: require('../res/portals-dome/thumbs/pure-sky-03.jpg'), source: require('../res/portals-dome/pure-sky-03.jpg') },
    { id: 'sky04', name: 'Sky 4', thumbnail: require('../res/portals-dome/thumbs/pure-sky-04.jpg'), source: require('../res/portals-dome/pure-sky-04.jpg') },
    { id: 'sky05', name: 'Sky 5', thumbnail: require('../res/portals-dome/thumbs/pure-sky-05.jpg'), source: require('../res/portals-dome/pure-sky-05.jpg') },
    { id: 'sky06', name: 'Sky 6', thumbnail: require('../res/portals-dome/thumbs/pure-sky-06.jpg'), source: require('../res/portals-dome/pure-sky-06.jpg') },
    { id: 'sky07', name: 'Sky 7', thumbnail: require('../res/portals-dome/thumbs/pure-sky-07.jpg'), source: require('../res/portals-dome/pure-sky-07.jpg') },
    { id: 'sky08', name: 'Sky 8', thumbnail: require('../res/portals-dome/thumbs/pure-sky-08.jpg'), source: require('../res/portals-dome/pure-sky-08.jpg') },
    { id: 'sky09', name: 'Sky 9', thumbnail: require('../res/portals-dome/thumbs/pure-sky-09.jpg'), source: require('../res/portals-dome/pure-sky-09.jpg') },
    { id: 'sky10', name: 'Sky 10', thumbnail: require('../res/portals-dome/thumbs/pure-sky-10.jpg'), source: require('../res/portals-dome/pure-sky-10.jpg') },
    { id: 'sky11', name: 'Sky 11', thumbnail: require('../res/portals-dome/thumbs/pure-sky-11.jpg'), source: require('../res/portals-dome/pure-sky-11.jpg') },
    { id: 'sky12', name: 'Sky 12', thumbnail: require('../res/portals-dome/thumbs/pure-sky-12.jpg'), source: require('../res/portals-dome/pure-sky-12.jpg') },
    { id: 'sky13', name: 'Sky 13', thumbnail: require('../res/portals-dome/thumbs/pure-sky-13.jpg'), source: require('../res/portals-dome/pure-sky-13.jpg') },
    { id: 'sky14', name: 'Sky 14', thumbnail: require('../res/portals-dome/thumbs/pure-sky-14.jpg'), source: require('../res/portals-dome/pure-sky-14.jpg') },
    { id: 'sky15', name: 'Sky 15', thumbnail: require('../res/portals-dome/thumbs/pure-sky-15.jpg'), source: require('../res/portals-dome/pure-sky-15.jpg') },
    { id: 'sky16', name: 'Sky 16', thumbnail: require('../res/portals-dome/thumbs/pure-sky-16.jpg'), source: require('../res/portals-dome/pure-sky-16.jpg') },
    { id: 'sky17', name: 'Sky 17', thumbnail: require('../res/portals-dome/thumbs/pure-sky-17.jpg'), source: require('../res/portals-dome/pure-sky-17.jpg') },
    { id: 'sky18', name: 'Sky 18', thumbnail: require('../res/portals-dome/thumbs/pure-sky-18.jpg'), source: require('../res/portals-dome/pure-sky-18.jpg') },
    { id: 'sky19', name: 'Sky 19', thumbnail: require('../res/portals-dome/thumbs/pure-sky-19.jpg'), source: require('../res/portals-dome/pure-sky-19.jpg') },
    { id: 'sky20', name: 'Sky 20', thumbnail: require('../res/portals-dome/thumbs/pure-sky-20.jpg'), source: require('../res/portals-dome/pure-sky-20.jpg') },
    { id: 'sky21', name: 'Sky 21', thumbnail: require('../res/portals-dome/thumbs/pure-sky-21.jpg'), source: require('../res/portals-dome/pure-sky-21.jpg') },
    { id: 'sky22', name: 'Sky 22', thumbnail: require('../res/portals-dome/thumbs/pure-sky-22.jpg'), source: require('../res/portals-dome/pure-sky-22.jpg') },
    { id: 'sky23', name: 'Sky 23', thumbnail: require('../res/portals-dome/thumbs/pure-sky-23.jpg'), source: require('../res/portals-dome/pure-sky-23.jpg') },
    { id: 'sky24', name: 'Sky 24', thumbnail: require('../res/portals-dome/thumbs/pure-sky-24.jpg'), source: require('../res/portals-dome/pure-sky-24.jpg') },
    { id: 'sky25', name: 'Sky 25', thumbnail: require('../res/portals-dome/thumbs/pure-sky-25.jpg'), source: require('../res/portals-dome/pure-sky-25.jpg') },
];

class PortalBackgroundPanel extends Component {
    constructor(props) {
        super(props);
        this.translateY = new Animated.Value(PANEL_HEIGHT);
        this.state = {
            activeTab: 'video', // 'video' or 'image'
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.visible !== prevProps.visible) {
            if (this.props.visible) {
                Animated.spring(this.translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 20,
                    stiffness: 90,
                }).start();
            } else {
                Animated.timing(this.translateY, {
                    toValue: PANEL_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                }).start();
            }
        }
    }

    handleSelect = (item, type) => {
        const photoSource = {
            source: item.source,
            type: type === 'video' ? PSConstants.PS_TYPE_360_VIDEO : PSConstants.PS_TYPE_360_PHOTO,
            width: 2, // 360 content has 2:1 aspect ratio
            height: 1,
        };
        this.props.onSelectBackground(photoSource);
        this.props.onClose();
    };

    renderVideoGrid() {
        return (
            <View style={styles.grid}>
                {VIDEOS_360.map((video) => (
                    <TouchableOpacity
                        key={video.id}
                        style={styles.gridItem}
                        onPress={() => this.handleSelect(video, 'video')}
                        activeOpacity={0.7}
                    >
                        <Image source={video.thumbnail} style={styles.thumbnail} resizeMode="cover" />
                        <View style={styles.videoOverlay}>
                            <Ionicons name="play-circle" size={28} color="white" />
                        </View>
                        <Text style={styles.itemName} numberOfLines={1}>{video.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    }

    renderImageGrid() {
        return (
            <View style={styles.grid}>
                {IMAGES_360.map((image) => (
                    <TouchableOpacity
                        key={image.id}
                        style={styles.gridItem}
                        onPress={() => this.handleSelect(image, 'image')}
                        activeOpacity={0.7}
                    >
                        <Image source={image.thumbnail} style={styles.thumbnail} resizeMode="cover" />
                        <Text style={styles.itemName} numberOfLines={1}>{image.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    }

    render() {
        const { visible, onClose } = this.props;
        const { activeTab } = this.state;

        return (
            <Animated.View
                style={[styles.container, { transform: [{ translateY: this.translateY }] }]}
                pointerEvents={visible ? 'auto' : 'none'}
            >
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />

                {/* Handle Bar */}
                <View style={styles.handleBarContainer}>
                    <View style={styles.handleBar} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>PORTAL BACKGROUND</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'video' && styles.tabActive]}
                        onPress={() => this.setState({ activeTab: 'video' })}
                    >
                        <Ionicons
                            name="videocam"
                            size={20}
                            color={activeTab === 'video' ? 'white' : 'rgba(255,255,255,0.5)'}
                        />
                        <Text style={[styles.tabText, activeTab === 'video' && styles.tabTextActive]}>
                            Video
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'image' && styles.tabActive]}
                        onPress={() => this.setState({ activeTab: 'image' })}
                    >
                        <Ionicons
                            name="image"
                            size={20}
                            color={activeTab === 'image' ? 'white' : 'rgba(255,255,255,0.5)'}
                        />
                        <Text style={[styles.tabText, activeTab === 'image' && styles.tabTextActive]}>
                            Image
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 'video' ? this.renderVideoGrid() : this.renderImageGrid()}
                </ScrollView>
            </Animated.View>
        );
    }
}

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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 1000,
    },
    handleBarContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    headerTitle: {
        color: 'white',
        fontSize: 13,
        fontWeight: '700',
        opacity: 0.7,
        letterSpacing: 1,
    },
    closeButton: { padding: 4 },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    tabActive: {
        backgroundColor: '#FF3050',
    },
    tabText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        color: 'white',
    },
    content: { flex: 1, paddingHorizontal: 16 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    gridItem: {
        width: THUMB_SIZE,
        marginBottom: 16,
        alignItems: 'center',
    },
    thumbnail: {
        width: THUMB_SIZE,
        height: THUMB_SIZE * 0.6,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    videoOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: THUMB_SIZE * 0.6,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemName: {
        color: 'white',
        fontSize: 11,
        marginTop: 6,
        opacity: 0.8,
        textAlign: 'center',
    },
});

export default PortalBackgroundPanel;

/**
 * ModelLibraryPanel.js
 * Premium panel for selecting 3D models from "Personal" library (uploads) or "Starter" library (bundled)
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
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { uploadToR2 } from '../../../services/storage/r2';
import { auth, db } from '../../../config/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

import * as ModelData from '../model/ModelItems';
import { theme } from '../../../theme/theme';

const { height, width } = Dimensions.get('window');
const PANEL_HEIGHT = height * 0.6; // Slightly taller than background panel
const COLUMNS = 3;
const SPACING = 12;
const HORIZONTAL_PADDING = 16;
// Calculate precise tile size to fill width
const THUMB_SIZE = (width - (HORIZONTAL_PADDING * 2) - (SPACING * (COLUMNS - 1))) / COLUMNS;

// Public base URL for R2 
const R2_PUBLIC_BASE = 'https://pub-e804e6eafc2a40ff80713d15ef76076e.r2.dev';

class ModelLibraryPanel extends Component {
    constructor(props) {
        super(props);
        this.translateY = new Animated.Value(PANEL_HEIGHT);
        this.state = {
            activeTab: 'objects', // 'objects', 'video', 'images', 'audio'
            searchQuery: '',
            personalModels: [],
            videoItems: [],
            imageItems: [],
            audioItems: [],
            isUploading: false,
            isLoading: false,
        };
        this.unsubscribeModels = null;
        this.unsubscribeVideos = null;
        this.unsubscribeImages = null;
        this.unsubscribeAudio = null;
    }

    componentDidMount() {
        this.subscribeToAllMedia();
    }

    componentWillUnmount() {
        // Unsubscribe from all listeners
        if (this.unsubscribeModels) this.unsubscribeModels();
        if (this.unsubscribeVideos) this.unsubscribeVideos();
        if (this.unsubscribeImages) this.unsubscribeImages();
        if (this.unsubscribeAudio) this.unsubscribeAudio();
    }

    componentDidUpdate(prevProps) {
        if (this.props.visible !== prevProps.visible) {
            if (this.props.visible) {
                // Panel opening
                this.subscribeToAllMedia();
                Animated.spring(this.translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 20,
                    stiffness: 90,
                }).start();
            } else {
                // Panel closing
                Animated.timing(this.translateY, {
                    toValue: PANEL_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                }).start();
            }
        }
    }

    // Subscribe to all uploads (single collection with type field)
    subscribeToAllMedia = () => {
        this.subscribeToUserModels();
        this.subscribeToUploadsByType('video', 'videoItems', 'unsubscribeVideos');
        this.subscribeToUploadsByType('images', 'imageItems', 'unsubscribeImages');
        this.subscribeToUploadsByType('audio', 'audioItems', 'unsubscribeAudio');
    };

    // Subscribe to uploads filtered by type (all in users/{userId}/uploads)
    subscribeToUploadsByType = (mediaType, stateKey, unsubKey) => {
        const user = auth.currentUser;
        if (!user) return;

        // Unsubscribe from previous listener
        if (this[unsubKey]) this[unsubKey]();

        // Single collection: users/{userId}/uploads, filter by type
        const uploadsRef = collection(db, "users", user.uid, "uploads");
        const q = query(uploadsRef, where("type", "==", mediaType), orderBy("createdAt", "desc"));

        this[unsubKey] = onSnapshot(q, (snapshot) => {
            const items = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() });
            });
            this.setState({ [stateKey]: items });
        }, (error) => {
            console.log(`[Library] ${mediaType} listener error:`, error);
            // Fallback to unordered query if index missing
            if (error.code === 'failed-precondition') {
                const qSimple = query(uploadsRef, where("type", "==", mediaType));
                this[unsubKey] = onSnapshot(qSimple, (snapshot) => {
                    const items = [];
                    snapshot.forEach((doc) => {
                        items.push({ id: doc.id, ...doc.data() });
                    });
                    items.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    this.setState({ [stateKey]: items });
                });
            }
        });
    };

    // Subscribe to user models (in uploads collection with type filter)
    subscribeToUserModels = () => {
        const user = auth.currentUser;
        if (!user) return;

        // Unsubscribe from previous listener if exists
        if (this.unsubscribeModels) {
            this.unsubscribeModels();
        }

        this.setState({ isLoading: true });

        // Single collection: users/{userId}/uploads, filter by type='3D_MODEL'
        const uploadsRef = collection(db, "users", user.uid, "uploads");
        const qParsed = query(uploadsRef, where("type", "==", "3D_MODEL"), orderBy("createdAt", "desc"));

        // Setup listener
        this.unsubscribeModels = onSnapshot(qParsed, (snapshot) => {
            const models = [];
            snapshot.forEach((doc) => {
                models.push({ id: doc.id, ...doc.data() });
            });
            this.setState({ personalModels: models, isLoading: false });
        }, (error) => {
            console.log("Firestore Listener Error:", error);
            // If index is missing, fallback to simple query
            if (error.code === 'failed-precondition') {
                console.log("Falling back to unordered query...");
                const qSimple = query(uploadsRef, where("type", "==", "3D_MODEL"));
                this.unsubscribeModels = onSnapshot(qSimple, (snapshot) => {
                    const models = [];
                    snapshot.forEach((doc) => {
                        models.push({ id: doc.id, ...doc.data() });
                    });
                    // Sort client-side since index is missing
                    models.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    this.setState({ personalModels: models, isLoading: false });
                });
            } else {
                this.setState({ isLoading: false });
            }
        });
    };

    handleSelect = (item, type) => {
        // If it's a personal model, we need to construct the source object differently
        let source;
        if (type === 'personal') {
            source = { uri: item.uri }; // Remote URL
        } else {
            // Starter model (bundled) pass index or object
            source = item;
        }

        this.props.onSelectModel(item, type);
        this.props.onClose();
    };

    handleDelete = async (model) => {
        const user = auth.currentUser;
        if (!user) return;

        Alert.alert(
            "Delete Model",
            `Are you sure you want to delete "${model.name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            console.log('[ModelLibrary] Deleting model:', model.id);
                            await deleteDoc(doc(db, "users", user.uid, "uploads", model.id));
                            console.log('[ModelLibrary] Model deleted from Firestore');
                            // onSnapshot will automatically update the list
                        } catch (error) {
                            console.error('[ModelLibrary] Delete failed:', error);
                            Alert.alert("Delete Failed", error.message);
                        }
                    }
                }
            ]
        );
    };

    handleUpload = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert("Please Log In", "You must be logged in to upload models.");
            return;
        }

        try {
            console.log('[ModelLibrary] Starting file picker...');
            const result = await DocumentPicker.getDocumentAsync({
                type: ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'text/plain'], // .glb, .gltf, .obj
                copyToCacheDirectory: true,
            });

            if (result.canceled) {
                console.log('[ModelLibrary] File picker canceled');
                return;
            }

            const asset = result.assets[0];
            const { uri, name, mimeType, size } = asset;
            console.log('[ModelLibrary] File selected:', { name, mimeType, size, uri });

            // Validate extension - GLB works with remote URLs!
            const ext = name.split('.').pop().toLowerCase();
            const allowed = ['glb', 'gltf', 'obj'];
            if (!allowed.includes(ext)) {
                Alert.alert(
                    "Unsupported Format",
                    "Please upload .glb, .gltf, or .obj files.",
                    [{ text: "OK" }]
                );
                return;
            }

            this.setState({ isUploading: true });

            // 1. Upload to R2: portals/assets/models/{timestamp}_{filename}
            const timestamp = Date.now();
            const cleanName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const key = `portals/assets/models/${timestamp}_${cleanName}`;
            const contentType = mimeType || 'application/octet-stream';

            console.log('[ModelLibrary] Uploading to R2...');
            console.log('[ModelLibrary] Key:', key);
            console.log('[ModelLibrary] ContentType:', contentType);
            console.log('[ModelLibrary] URI:', uri);

            await uploadToR2(uri, key, contentType);
            console.log('[ModelLibrary] R2 upload completed successfully');

            // 2. Save metadata to Firestore subcollection: users/{userId}/models
            const publicUrl = `${R2_PUBLIC_BASE}/${key}`;
            console.log('[ModelLibrary] Saving to Firestore with URL:', publicUrl);

            await addDoc(collection(db, "users", user.uid, "uploads"), {
                name: name,
                uri: publicUrl,
                type: '3D_MODEL', // Generic type
                extension: ext,
                size: size,
                createdAt: serverTimestamp(),
            });

            console.log('[ModelLibrary] Firestore save complete');

            // No need to manually fetch, onSnapshot will pick it up

            this.setState({ isUploading: false });
            Alert.alert("Success", "Model uploaded to your library.");

        } catch (error) {
            console.error("[ModelLibrary] Upload failed:", error);
            console.error("[ModelLibrary] Error details:", error.message, error.stack);
            this.setState({ isUploading: false });
            Alert.alert("Upload Failed", `Error: ${error.message || 'Unknown error'}`);
        }
    };

    categorizeModels(models) {
        const categories = {
            'Primitives': [],
            'Emojis': [],
            'Animated': [],
            'Objects': []
        };

        models.forEach((model, index) => {
            const m = { ...model, originalIndex: index }; // Keep track of original index
            const name = m.name?.toLowerCase() || '';
            const isAnim = m.animation || name.includes('anim');

            if (name.includes('cube') || name.includes('sphere') || name.includes('cylinder') || name.includes('torus') || name.includes('cone') || name.includes('plane') || name.includes('capsule')) {
                // Check if it's a "fancy" object that happens to contain "cube" logic (like cube_doodad)
                if (name.includes('doodad')) {
                    categories['Objects'].push(m);
                } else {
                    categories['Primitives'].push(m);
                }
            } else if (name.includes('emoji')) {
                categories['Emojis'].push(m);
            } else if (isAnim) {
                categories['Animated'].push(m);
            } else {
                categories['Objects'].push(m);
            }
        });

        // Remove empty categories
        Object.keys(categories).forEach(key => {
            if (categories[key].length === 0) delete categories[key];
        });

        return categories;
    }

    renderStarterGrid() {
        const models = ModelData.getModelArray();
        const { searchQuery } = this.state;

        // If searching, show flat list for clarity
        if (searchQuery && searchQuery.length > 0) {
            const filteredModels = models
                .map((m, i) => ({ ...m, originalIndex: i }))
                .filter(m => m.name?.toLowerCase().includes(searchQuery.toLowerCase()));

            return (
                <View style={styles.grid}>
                    {filteredModels.map((model) => (
                        this.renderModelItem(model, model.originalIndex, 'starter')
                    ))}
                </View>
            );
        }

        // Categorized View
        const categories = this.categorizeModels(models);

        return (
            <View style={{ paddingBottom: 20 }}>
                {Object.keys(categories).map(category => (
                    <View key={category} style={styles.sectionContainer}>
                        <Text style={styles.sectionHeader}>{category.toUpperCase()}</Text>
                        <View style={styles.grid}>
                            {categories[category].map((model) => (
                                this.renderModelItem(model, model.originalIndex, 'starter')
                            ))}
                        </View>
                    </View>
                ))}
            </View>
        );
    }

    renderModelItem(model, indexOrItem, type) {
        // Determine name to show
        const displayName = model.name || (type === 'personal' ? 'Untitled' : `Model`);
        const isPersonal = type === 'personal';

        return (
            <TouchableOpacity
                key={`${type}_${indexOrItem}_${model.id || ''}`}
                style={styles.gridItem}
                onPress={() => this.handleSelect(isPersonal ? model : indexOrItem, type)}
                onLongPress={isPersonal ? () => this.handleDelete(model) : undefined}
                delayLongPress={500}
                activeOpacity={0.7}
            >
                <View style={styles.thumbnailContainer}>
                    {/* Use local image for starter, generic icon for personal (unless we have thumb) */}
                    {type === 'starter' && model.icon_img ? (
                        <Image source={model.icon_img} style={styles.thumbnail} resizeMode="contain" />
                    ) : (
                        <Ionicons name="cube" size={32} color="rgba(255,255,255,0.8)" />
                    )}
                </View>
                <Text style={styles.itemName} numberOfLines={1}>{displayName}</Text>
                {isPersonal && (
                    <Text style={styles.longPressHint}>Hold to delete</Text>
                )}
            </TouchableOpacity>
        );
    }

    renderUploadCard() {
        return (
            <TouchableOpacity
                key="upload-card"
                style={[styles.gridItem, styles.uploadCard]}
                onPress={this.handleUpload}
                activeOpacity={0.7}
                disabled={this.state.isUploading}
            >
                <View style={styles.uploadCardInner}>
                    {this.state.isUploading ? (
                        <ActivityIndicator size="small" color="#000" />
                    ) : (
                        <Ionicons name="add" size={32} color="rgba(0,0,0,0.8)" />
                    )}
                </View>
                <Text style={styles.uploadCardText}>
                    {this.state.isUploading ? "Uploading..." : "New"}
                </Text>
            </TouchableOpacity>
        );
    }

    renderPersonalGrid() {
        return (
            <View style={styles.grid}>
                {/* Upload Card is always first */}
                {this.renderUploadCard()}

                {/* Render Personal Models */}
                {this.state.personalModels.map((model) => (
                    this.renderModelItem(model, model, 'personal')
                ))}
            </View>
        );
    }

    // Render grid for Video/Images/Audio tabs
    renderMediaGrid(mediaType) {
        const typeConfig = {
            video: { title: 'Videos', icon: 'videocam', stateKey: 'videoItems', collection: 'user_videos' },
            images: { title: 'Images', icon: 'image', stateKey: 'imageItems', collection: 'user_images' },
            audio: { title: 'Audio', icon: 'musical-notes', stateKey: 'audioItems', collection: 'user_audio' },
        };
        const config = typeConfig[mediaType];
        const items = this.state[config.stateKey] || [];

        return (
            <View style={styles.grid}>
                {/* Upload Card */}
                <TouchableOpacity
                    key={`upload-${mediaType}`}
                    style={[styles.gridItem, styles.uploadCard]}
                    onPress={() => this.handleMediaUpload(mediaType)}
                    activeOpacity={0.7}
                    disabled={this.state.isUploading}
                >
                    <View style={styles.uploadCardInner}>
                        {this.state.isUploading ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <Ionicons name="add" size={32} color="rgba(0,0,0,0.8)" />
                        )}
                    </View>
                    <Text style={styles.uploadCardText}>
                        {this.state.isUploading ? "Uploading..." : `Add ${config.title}`}
                    </Text>
                </TouchableOpacity>

                {/* Render Items */}
                {items.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.gridItem}
                        onPress={() => this.handleMediaSelect(item, mediaType)}
                        onLongPress={() => this.handleMediaDelete(item, config.collection)}
                        delayLongPress={500}
                        activeOpacity={0.7}
                    >
                        <View style={styles.thumbnailContainer}>
                            {mediaType === 'images' ? (
                                <Image source={{ uri: item.url }} style={styles.thumbnail} resizeMode="cover" />
                            ) : mediaType === 'video' ? (
                                // Show thumbnail if available, otherwise show placeholder
                                item.thumbnailUrl ? (
                                    <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
                                ) : (
                                    <View style={[styles.mediaThumbnail, styles.videoThumbnail]}>
                                        <Ionicons name="videocam" size={32} color="rgba(255,255,255,0.5)" />
                                    </View>
                                )
                            ) : (
                                <View style={[styles.mediaThumbnail, styles.audioThumbnail]}>
                                    <Ionicons name="musical-notes" size={36} color="rgba(255,255,255,0.8)" />
                                </View>
                            )}
                        </View>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name || 'Untitled'}</Text>
                        <Text style={styles.longPressHint}>Hold to delete</Text>
                    </TouchableOpacity>
                ))}

                {/* Empty State - only show if no items */}
                {items.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name={config.icon} size={48} color="rgba(255,255,255,0.2)" />
                        <Text style={styles.emptyStateText}>No {config.title.toLowerCase()} uploaded yet</Text>
                        <Text style={styles.emptyStateSubtext}>Tap + to add from your device</Text>
                    </View>
                )}
            </View>
        );
    }

    // Handle media upload for Video/Images/Audio
    handleMediaUpload = async (mediaType) => {
        this.setState({ isUploading: true });

        try {
            const user = auth.currentUser;
            if (!user) {
                Alert.alert('Error', 'Please log in to upload media.');
                this.setState({ isUploading: false });
                return;
            }

            let result;
            let fileUri, fileName, mimeType;

            if (mediaType === 'audio') {
                // Use DocumentPicker for audio
                result = await DocumentPicker.getDocumentAsync({
                    type: 'audio/*',
                    copyToCacheDirectory: true,
                });

                if (result.canceled || !result.assets || result.assets.length === 0) {
                    this.setState({ isUploading: false });
                    return;
                }

                const asset = result.assets[0];
                fileUri = asset.uri;
                fileName = asset.name || `audio_${Date.now()}.mp3`;
                mimeType = asset.mimeType || 'audio/mpeg';
            } else {
                // Use ImagePicker for video/images
                const mediaTypes = mediaType === 'video' ? 'videos' : 'images';
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: mediaTypes,
                    allowsEditing: false,
                    quality: 1,
                });

                if (result.canceled || !result.assets || result.assets.length === 0) {
                    this.setState({ isUploading: false });
                    return;
                }

                const asset = result.assets[0];
                fileUri = asset.uri;

                // Preserve original file extension
                let ext = mediaType === 'video' ? 'mp4' : 'jpg'; // fallback
                if (asset.fileName) {
                    const parts = asset.fileName.split('.');
                    if (parts.length > 1) {
                        ext = parts.pop().toLowerCase();
                    }
                } else if (fileUri) {
                    // Try to get extension from URI
                    const uriParts = fileUri.split('.');
                    if (uriParts.length > 1) {
                        const uriExt = uriParts.pop().toLowerCase().split('?')[0]; // remove query params
                        if (['mp4', 'mov', 'webm', 'avi', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(uriExt)) {
                            ext = uriExt;
                        }
                    }
                }

                fileName = asset.fileName || `${mediaType}_${Date.now()}.${ext}`;

                // Set mimeType based on actual extension
                const mimeTypes = {
                    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', avi: 'video/x-msvideo',
                    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp'
                };
                mimeType = asset.mimeType || mimeTypes[ext] || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');

                // Store dimensions for aspect ratio preservation
                this._uploadWidth = asset.width || 1;
                this._uploadHeight = asset.height || 1;
            }

            console.log(`[Library] Uploading ${mediaType}:`, fileName);

            // R2 path: portals/assets/{type}/{filename}
            const r2PathMap = {
                video: 'portals/assets/video',
                images: 'portals/assets/images',
                audio: 'portals/assets/audio',
            };
            const r2Key = `${r2PathMap[mediaType]}/${fileName}`;

            // Upload to R2 - returns the key
            const uploadedKey = await uploadToR2(fileUri, r2Key, mimeType);

            if (!uploadedKey) {
                throw new Error('Upload failed - no key returned');
            }

            // Construct public URL
            const publicUrl = `${R2_PUBLIC_BASE}/${uploadedKey}`;

            // For videos, extract and upload a thumbnail
            let thumbnailUrl = null;
            if (mediaType === 'video') {
                try {
                    console.log('[Library] Extracting video thumbnail...');
                    const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(fileUri, {
                        time: 500, // Get frame at 0.5 seconds
                        quality: 0.7,
                    });

                    // Upload thumbnail to R2
                    const thumbFileName = `thumb_${Date.now()}.jpg`;
                    const thumbKey = `portals/assets/thumbnails/${thumbFileName}`;
                    const thumbUploadedKey = await uploadToR2(thumbUri, thumbKey, 'image/jpeg');

                    if (thumbUploadedKey) {
                        thumbnailUrl = `${R2_PUBLIC_BASE}/${thumbUploadedKey}`;
                        console.log('[Library] Thumbnail uploaded:', thumbnailUrl);
                    }
                } catch (thumbError) {
                    console.warn('[Library] Thumbnail extraction failed:', thumbError);
                    // Continue without thumbnail - video will show placeholder
                }
            }

            // Save to Firebase: users/{userId}/uploads
            await addDoc(collection(db, "users", user.uid, "uploads"), {
                name: fileName,
                url: publicUrl,
                thumbnailUrl: thumbnailUrl, // Video thumbnail or null
                type: mediaType,
                width: this._uploadWidth || 1,
                height: this._uploadHeight || 1,
                createdAt: serverTimestamp(),
            });

            console.log(`[Library] ${mediaType} uploaded successfully`);
        } catch (error) {
            console.error(`[Library] ${mediaType} upload failed:`, error);
            Alert.alert('Upload Failed', error.message || 'Please try again.');
        } finally {
            this.setState({ isUploading: false });
        }
    };

    // Handle media selection to add to AR scene
    handleMediaSelect = (item, mediaType) => {
        console.log(`[Library] Selected ${mediaType}:`, item.name);

        // Call props callback if available
        if (this.props.onSelectMedia) {
            this.props.onSelectMedia(item, mediaType);
        }

        this.props.onClose();
    };

    // Handle media deletion (subcollection: users/{userId}/{subCollection})
    handleMediaDelete = async (item, subCollectionName) => {
        const user = auth.currentUser;
        if (!user) return;

        Alert.alert(
            "Delete Item",
            `Are you sure you want to delete "${item.name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            console.log(`[Library] Deleting from users/${user.uid}/${subCollectionName}:`, item.id);
                            await deleteDoc(doc(db, "users", user.uid, "uploads", item.id));
                            console.log('[Library] Item deleted');
                        } catch (error) {
                            console.error('[Library] Delete failed:', error);
                            Alert.alert('Error', 'Failed to delete. Please try again.');
                        }
                    }
                }
            ]
        );
    };


    handleClearAll = () => {
        const user = auth.currentUser;
        if (!user || this.state.personalModels.length === 0) return;

        Alert.alert(
            "Clear Library",
            "Are you sure you want to delete ALL your uploaded models? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear All",
                    style: "destructive",
                    onPress: async () => {
                        this.setState({ isUploading: true }); // Show loading state
                        try {
                            const models = this.state.personalModels;
                            console.log(`[ModelLibrary] Clearing all ${models.length} models...`);

                            // Delete one by one from subcollection
                            const deletePromises = models.map(model =>
                                deleteDoc(doc(db, "users", user.uid, "uploads", model.id))
                            );

                            await Promise.all(deletePromises);

                            console.log('[ModelLibrary] All models deleted');
                            Alert.alert("Success", "Your library has been cleared.");
                        } catch (error) {
                            console.error('[ModelLibrary] Clear all failed:', error);
                            Alert.alert("Error", "Failed to clear library. Please try again.");
                        } finally {
                            this.setState({ isUploading: false });
                        }
                    }
                }
            ]
        );
    };

    render() {
        const { visible, onClose } = this.props;
        const { activeTab, searchQuery } = this.state;

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
                    <Text style={styles.headerTitle}>LIBRARY</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Clear All Button (Only for Objects Tab) */}
                        {activeTab === 'objects' && this.state.personalModels.length > 0 && (
                            <TouchableOpacity
                                onPress={this.handleClearAll}
                                style={{ marginRight: 16, padding: 4 }}
                                disabled={this.state.isUploading}
                            >
                                <Text style={{ color: '#FF453A', fontSize: 13, fontWeight: '600' }}>Clear All</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Tabs - 4 media types */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'objects' && styles.tabActive]}
                        onPress={() => this.setState({ activeTab: 'objects' })}
                    >
                        <Ionicons
                            name="cube"
                            size={16}
                            color={activeTab === 'objects' ? 'black' : 'rgba(255,255,255,0.5)'}
                        />
                        <Text style={[styles.tabText, activeTab === 'objects' && styles.tabTextActive]}>
                            Objects
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'video' && styles.tabActive]}
                        onPress={() => this.setState({ activeTab: 'video' })}
                    >
                        <Ionicons
                            name="videocam"
                            size={16}
                            color={activeTab === 'video' ? 'black' : 'rgba(255,255,255,0.5)'}
                        />
                        <Text style={[styles.tabText, activeTab === 'video' && styles.tabTextActive]}>
                            Video
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'images' && styles.tabActive]}
                        onPress={() => this.setState({ activeTab: 'images' })}
                    >
                        <Ionicons
                            name="image"
                            size={16}
                            color={activeTab === 'images' ? 'black' : 'rgba(255,255,255,0.5)'}
                        />
                        <Text style={[styles.tabText, activeTab === 'images' && styles.tabTextActive]}>
                            Images
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'audio' && styles.tabActive]}
                        onPress={() => this.setState({ activeTab: 'audio' })}
                    >
                        <Ionicons
                            name="musical-notes"
                            size={16}
                            color={activeTab === 'audio' ? 'black' : 'rgba(255,255,255,0.5)'}
                        />
                        <Text style={[styles.tabText, activeTab === 'audio' && styles.tabTextActive]}>
                            Audio
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar - Temporarily disabled due to keyboard/AR incompatibility */}
                {/* TODO: Re-enable with KeyboardAvoidingView wrapper
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search..."
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={searchQuery}
                        onChangeText={(text) => this.setState({ searchQuery: text })}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => this.setState({ searchQuery: '' })}>
                            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
                        </TouchableOpacity>
                    )}
                </View>
                */}

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 'objects' && this.renderPersonalGrid()}
                    {activeTab === 'video' && this.renderMediaGrid('video')}
                    {activeTab === 'images' && this.renderMediaGrid('images')}
                    {activeTab === 'audio' && this.renderMediaGrid('audio')}
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
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
    },
    tabActive: {
        backgroundColor: 'rgb(247, 255, 168)', // Global accent (Pale Yellow from theme)
        borderColor: 'rgb(247, 255, 168)',
    },
    tabText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        color: 'black', // Black text on yellow background
        fontWeight: '700',
    },
    sectionContainer: {
        marginBottom: 8,
    },
    sectionHeader: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 16,
        marginTop: 24,
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
        flex: 1,
        color: 'white',
        fontSize: 14,
        height: '100%',
    },
    content: { flex: 1, paddingHorizontal: 16 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: SPACING,
    },
    // Fallback for older RN if gap isn't supported, use margin on items
    gridItem: {
        width: THUMB_SIZE,
        marginBottom: SPACING,
        alignItems: 'center',
    },
    thumbnailContainer: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
        overflow: 'hidden', // Ensure image doesn't bleed
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    mediaThumbnail: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    videoThumbnail: {
        backgroundColor: 'rgba(139, 92, 246, 0.3)', // Purple tint for video
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.4)',
    },
    audioThumbnail: {
        backgroundColor: 'rgba(236, 72, 153, 0.3)', // Pink tint for audio
        borderWidth: 1,
        borderColor: 'rgba(236, 72, 153, 0.4)',
    },
    videoOverlayText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        marginTop: 6,
        fontWeight: '600',
        textAlign: 'center',
    },
    itemName: {
        color: 'rgba(255,255,255,0.9)', // Clean white text
        fontSize: 12,
        marginTop: 6,
        fontWeight: '500',
        lineHeight: 16,
        textAlign: 'center',
        width: '100%',
    },
    longPressHint: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        marginTop: 2,
    },

    // Upload Card Styles
    uploadCard: {
        // Inherits gridItem sizing
    },
    uploadCardInner: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)', // Glassy look
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        borderStyle: 'dashed',
    },
    uploadCardText: {
        color: 'white',
        fontSize: 12,
        marginTop: 6,
        fontWeight: '600',
        textAlign: 'center',
    },

    emptyState: {
        width: '100%',
        padding: 20,
        alignItems: 'center',
    },
    emptyStateText: {
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 20,
    },
    emptyStateSubtext: {
        color: 'rgba(255,255,255,0.3)',
        textAlign: 'center',
        fontSize: 12,
        marginTop: 4,
    },
});

export default ModelLibraryPanel;

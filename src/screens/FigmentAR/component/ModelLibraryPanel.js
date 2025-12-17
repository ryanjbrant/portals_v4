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
            activeTab: 'personal', // 'personal' or 'starter'
            searchQuery: '',
            personalModels: [],
            isUploading: false,
            isLoading: false,
        };
        this.unsubscribe = null;
    }

    componentDidMount() {
        this.subscribeToUserModels();
    }

    componentWillUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.visible !== prevProps.visible) {
            if (this.props.visible) {
                // Panel opening
                this.subscribeToUserModels();
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

    // Real-time subscription to user models
    subscribeToUserModels = () => {
        const user = auth.currentUser;
        if (!user) return;

        // Unsubscribe from previous listener if exists
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.setState({ isLoading: true });

        // Try ordered query first
        const qParsed = query(
            collection(db, "user_models"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        // Setup listener
        this.unsubscribe = onSnapshot(qParsed, (snapshot) => {
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
                const qSimple = query(collection(db, "user_models"), where("userId", "==", user.uid));
                this.unsubscribe = onSnapshot(qSimple, (snapshot) => {
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
                            await deleteDoc(doc(db, "user_models", model.id));
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

            // 1. Upload to R2
            // path: assets/models/{userId}/{timestamp}_{filename}
            const timestamp = Date.now();
            const cleanName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const key = `assets/models/${user.uid}/${timestamp}_${cleanName}`;
            const contentType = mimeType || 'application/octet-stream';

            console.log('[ModelLibrary] Uploading to R2...');
            console.log('[ModelLibrary] Key:', key);
            console.log('[ModelLibrary] ContentType:', contentType);
            console.log('[ModelLibrary] URI:', uri);

            await uploadToR2(uri, key, contentType);
            console.log('[ModelLibrary] R2 upload completed successfully');

            // 2. Save metadata to Firestore
            const publicUrl = `${R2_PUBLIC_BASE}/${key}`;
            console.log('[ModelLibrary] Saving to Firestore with URL:', publicUrl);

            await addDoc(collection(db, "user_models"), {
                userId: user.uid,
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




    handleClearAll = () => {
        if (this.state.personalModels.length === 0) return;

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

                            // Delete one by one (or use batch if we imported writeBatch)
                            // Using Promise.all for parallel deletion
                            const deletePromises = models.map(model =>
                                deleteDoc(doc(db, "user_models", model.id))
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
                    <Text style={styles.headerTitle}>MODEL LIBRARY</Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Clear All Button (Only for Personal Tab) */}
                        {activeTab === 'personal' && this.state.personalModels.length > 0 && (
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

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'personal' && styles.tabActive]}
                        onPress={() => this.setState({ activeTab: 'personal' })}
                    >
                        <Ionicons
                            name="person"
                            size={16}
                            color={activeTab === 'personal' ? 'white' : 'rgba(255,255,255,0.5)'}
                        />
                        <Text style={[styles.tabText, activeTab === 'personal' && styles.tabTextActive]}>
                            Personal
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'starter' && styles.tabActive]}
                        onPress={() => this.setState({ activeTab: 'starter' })}
                    >
                        <Ionicons
                            name="cube"
                            size={16}
                            color={activeTab === 'starter' ? 'white' : 'rgba(255,255,255,0.5)'}
                        />
                        <Text style={[styles.tabText, activeTab === 'starter' && styles.tabTextActive]}>
                            Starter
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search models..."
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

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === 'starter' ? this.renderStarterGrid() : this.renderPersonalGrid()}
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
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tabText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        color: 'black', // Black text on yellow prompt
        fontWeight: '700',
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

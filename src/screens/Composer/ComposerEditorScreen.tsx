import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Dimensions, Image as RNImage } from 'react-native';
import { WebView } from 'react-native-webview';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '../../theme/theme';
import { NeedleEditorOutboundMessage, NeedleEditorInboundMessage, parseInboundMessage, sendMessageToWebView } from '../../bridges/NeedleBridge';
import { ObjectPropertiesPanel } from './ObjectPropertiesPanel';
import { useAppStore } from '../../store';
import { SerializedScene } from '../../types/scene';
import { EditorContent } from './EditorContent';
// @ts-ignore
import { Asset } from 'expo-asset';

const HDRI_MAPS = [
    { id: '01', name: 'Studio', source: require('../../../assets/hdri/01.jpg') },
    { id: '02', name: 'Outdoor', source: require('../../../assets/hdri/02.jpg') },
    { id: '03', name: 'Sunset', source: require('../../../assets/hdri/03.jpg') },
    { id: '04', name: 'Night', source: require('../../../assets/hdri/04.jpg') },
    { id: '05', name: 'Bright', source: require('../../../assets/hdri/05.jpg') },
];
import { Svg, Circle, Line } from 'react-native-svg';

export const ComposerEditorScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const webviewRef = useRef<WebView>(null);
    const [segments, setSegments] = useState<any[]>([]);
    const [pauseMarkers, setPauseMarkers] = useState<number[]>([]); // Cumulative durations at each pause
    const [isRecording, setIsRecording] = useState(false);
    const [facing, setFacing] = useState<'front' | 'back'>('back');

    // Revamped UI State
    const [fileName, setFileName] = useState("Untitled Scene");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);

    const [duration, setDuration] = useState(0);
    const recordingStartRef = useRef<number>(0);
    const accumulatedRef = useRef<number>(0);
    const chunkBuffersRef = useRef<string[]>([]);
    const MAX_DURATION = 15000; // 15 seconds max

    // Ref for draft save flag (must be before handleMessage)
    const isDraftSaveRef = useRef(false);

    // Camera Permissions
    const [permission, requestPermission] = useCameraPermissions();

    useEffect(() => {
        if (!permission) {
            requestPermission();
        }
    }, [permission]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording) {
            recordingStartRef.current = Date.now();

            interval = setInterval(() => {
                const now = Date.now();
                const currentSegmentDuration = now - recordingStartRef.current;
                const totalDuration = accumulatedRef.current + currentSegmentDuration;

                if (totalDuration >= MAX_DURATION) {
                    setDuration(MAX_DURATION);
                    setIsRecording(false);
                    accumulatedRef.current = MAX_DURATION;
                    sendMessageToWebView(webviewRef, { type: 'stop-recording-segment' });
                } else {
                    setDuration(totalDuration);
                }
            }, 50);
        } else {
            // Update accumulated time to current UI duration
            // (Strict sync happens when segment is returned from WebView)
            accumulatedRef.current = duration;
        }
        return () => clearInterval(interval);
    }, [isRecording, MAX_DURATION]);

    const handleMessage = async (event: any) => {
        const msg = parseInboundMessage(event);
        if (!msg) return;

        switch (msg.type) {
            case 'log':
                console.log("[WebView]", msg.message);
                break;
            case 'recording-paused':
                // Update accumulated duration from WebView's authoritative value
                if (msg.durationMs) {
                    accumulatedRef.current = msg.durationMs;
                    setDuration(msg.durationMs);
                    // Add pause marker for timeline UI
                    setPauseMarkers(prev => [...prev, msg.durationMs]);
                    console.log("Recording paused at:", msg.durationMs, "ms");
                }
                break;

            case 'recording-complete':
                if (msg.data) {
                    const fileName = `rec_${Date.now()}.mp4`;
                    const fileUri = (FileSystem.cacheDirectory || "") + fileName;
                    const parts = msg.data.split(',');
                    const base64Data = parts.length > 1 ? parts[1] : parts[0];

                    FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 })
                        .then(() => {
                            console.log("Saved complete video:", fileUri, "Duration:", msg.durationMs, "ms");
                            // For continuous recording, we only have ONE final segment
                            const newSegment = { uri: fileUri, durationMs: msg.durationMs, data: null };
                            setSegments([newSegment]); // Replace all segments with the final one
                            accumulatedRef.current = msg.durationMs || 0;
                            setDuration(msg.durationMs || 0);
                        }).catch(e => console.error("Save Error", e));
                }
                break;
            case 'export-complete':
                console.log("[Composer] Export Complete. isDraftSave:", isDraftSaveRef.current);

                if (isDraftSaveRef.current) {
                    // === DRAFT SAVE ===
                    const { scene, coverImageURI } = msg;
                    useAppStore.getState().saveDraft({ ...scene, title: fileName }, coverImageURI);
                    isDraftSaveRef.current = false;

                    // Navigate to Profile Gallery -> Drafts tab
                    navigation.navigate('ProfileGallery', { initialTab: 'drafts' });
                } else {
                    // === VIDEO EXPORT (Publish Flow) ===
                    let finalUri = msg.finalVideoUri;
                    if (segments.length > 0) {
                        finalUri = segments[segments.length - 1].uri;
                        console.log("Using latest recorded segment:", finalUri);
                    }

                    navigation.navigate('PostDetails', {
                        videoUri: finalUri,
                        coverImage: msg.coverImageURI,
                        sceneData: msg.scene
                    });
                }
                break;

            case 'object-selected':
                setSelectedObjectId(msg.id);
                // Open panel if an object is selected? Or just let user open it manually?
                // User said "contextual button... will reveal". So we just update state.
                if (msg.id) {
                    console.log("Selected Object:", msg.id);
                }
                break;
        }
    };

    const handleUpdateMaterial = (key: string, value: any) => {
        if (!selectedObjectId) return;
        sendMessageToWebView(webviewRef, {
            type: 'update-object-material',
            id: selectedObjectId,
            material: { [key]: value }
        });
    };

    const handleUpdateAnimation = (type: string, params: any, active: boolean) => {
        if (!selectedObjectId) return;
        if (active) {
            sendMessageToWebView(webviewRef, {
                type: 'add-object-animation',
                id: selectedObjectId,
                animation: { type, params, active }
            });
        } else {
            // Send update to disable or remove? 
            // For now assume update works
            sendMessageToWebView(webviewRef, {
                type: 'update-object-animation',
                id: selectedObjectId,
                animationId: type, // Using type as ID for simplicity in this mock
                params: { active: false }
            });
        }
    };
    const handleAddPrimitive = (type: 'cube' | 'sphere' | 'plane') => {
        const id = Date.now().toString();
        setSelectedObjectId(id);
        sendMessageToWebView(webviewRef, {
            type: 'add-primitive',
            id: id,
            primitive: type
        } as any);
    };

    // ... (existing imports)

    const [showEnvPicker, setShowEnvPicker] = useState(false);

    const loadEnvironment = async (assetSource: any) => {
        try {
            const asset = Asset.fromModule(assetSource);
            await asset.downloadAsync();
            if (asset.localUri) {
                const base64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: 'base64' });
                const uri = `data:image/jpeg;base64,${base64}`;
                sendMessageToWebView(webviewRef, { type: 'set-environment', uri });
            }
        } catch (e) {
            console.error("Failed to load environment", e);
        }
    };

    // Load default environment on mount
    useEffect(() => {
        // Delay slightly to ensure WebView is ready
        setTimeout(() => {
            loadEnvironment(HDRI_MAPS[0].source);
        }, 1000);
    }, []);

    // Load Draft if present
    useEffect(() => {
        if (route.params?.draftData) {
            console.log("Loading draft into Composer...");
            // Use drafted title if available (assuming we saved it, though draftData is just scene currently, 
            // so we might need to pass title separately or change structure. For now, use params or default)
            // Ideally drafts in store have a title.
            // Let's assume we can pass it via route for now.
            if (route.params.draftTitle) setFileName(route.params.draftTitle);

            // Small delay to ensure WebView is ready (or use viewer-ready message if implemented)
            setTimeout(() => {
                sendMessageToWebView(webviewRef, {
                    type: 'load-scene',
                    scene: route.params.draftData
                });
            }, 1500);
        }
    }, [route.params?.draftData]);

    const handleRename = () => {
        Alert.prompt(
            "Rename Scene",
            "Enter a new name for your scene",
            [
                { text: "Cancel", style: "cancel" },
                { text: "OK", onPress: (name?: string) => name && setFileName(name) }
            ],
            "plain-text",
            fileName
        );
    };

    const handleSaveDraft = () => {
        if (isRecording) {
            Alert.alert("Recording in progress", "Please stop recording before saving.");
            return;
        }

        const proceedToSave = (name: string) => {
            Alert.alert(
                "Save Draft",
                `Save scene as "${name}"?`,
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Save",
                        onPress: () => {
                            // Request export from WebView to get current scene data and screenshot
                            // We reuse the 'request-export' flow but flag it for draft
                            isDraftSaveRef.current = true;
                            // Ensure filename state is up to date if changed via prompt
                            if (name !== fileName) setFileName(name);
                            sendMessageToWebView(webviewRef, { type: 'request-export' });
                        }
                    }
                ]
            );
        };

        if (fileName === "Untitled Scene" || fileName.trim() === "") {
            Alert.prompt(
                "Name Your Scene",
                "Enter a name for this draft:",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "OK", onPress: (name?: string) => proceedToSave(name || "Untitled Scene") }
                ],
                "plain-text",
                fileName === "Untitled Scene" ? "" : fileName
            );
        } else {
            proceedToSave(fileName);
        }
    };

    const handleAddImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
        if (!result.canceled && result.assets[0].uri) {
            try {
                // Convert to Base64 to ensure WebView can load it
                const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'base64' });
                const uri = `data:image/jpeg;base64,${base64}`;
                const id = Date.now().toString();

                setSelectedObjectId(id);
                sendMessageToWebView(webviewRef, {
                    type: 'add-image',
                    id: id,
                    uri: uri
                });
            } catch (e) {
                console.error("Failed to load image", e);
            }
        }
    };

    const handleRecordIn = () => {
        setIsRecording(true);
        sendMessageToWebView(webviewRef, { type: 'start-recording-segment' });
    };

    const handleRecordOut = () => {
        setIsRecording(false);
        sendMessageToWebView(webviewRef, { type: 'stop-recording-segment' });
    };

    const handleNext = () => {
        sendMessageToWebView(webviewRef, { type: 'request-export' });
    };

    const handleReset = () => {
        sendMessageToWebView(webviewRef, { type: 'reset-scene' });
        setSegments([]);
        setPauseMarkers([]); // Clear cut markers
        setDuration(0); // Reset timer
        accumulatedRef.current = 0;
    };

    if (!permission) {
        // Camera permissions are still loading
        return <View style={styles.container} />;
    }

    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    const getProgressCircle = () => {
        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (duration / MAX_DURATION) * circumference;
        return { circumference, strokeDashoffset };
    };

    const { circumference, strokeDashoffset } = getProgressCircle();

    return (
        <View style={styles.container}>
            <CameraView style={StyleSheet.absoluteFillObject} facing={facing} />

            <View style={styles.webviewContainer}>
                {/* Transparent Background for AR effect */}
                <WebView
                    ref={webviewRef}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    source={{ html: EditorContent }}
                    originWhitelist={['*']}
                    onMessage={handleMessage}
                    javaScriptEnabled
                    domStorageEnabled
                />
            </View>

            <SafeAreaView style={styles.overlay} pointerEvents="box-none">
                {/* Header */}
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity onPress={handleRename}>
                            <Text style={styles.title}>{fileName}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setIsMenuOpen(!isMenuOpen)} style={{ padding: 8 }}>
                            <Ionicons name={isMenuOpen ? "chevron-up" : "chevron-down"} size={16} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.headerRight}>
                        <TouchableOpacity onPress={toggleCameraFacing} style={styles.iconButton}>
                            <Ionicons name="camera-reverse" size={24} color="white" />
                        </TouchableOpacity>
                        {/* Reset moved to Menu */}
                    </View>
                </View>

                {/* Scene Menu Modal / Dropdown */}
                {isMenuOpen && (
                    <View style={styles.menuDropdown}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); handleSaveDraft(); }}>
                            <Ionicons name="save-outline" size={20} color="white" />
                            <Text style={styles.menuText}>Save Draft</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); handleReset(); }}>
                            <Ionicons name="refresh-outline" size={20} color="white" />
                            <Text style={styles.menuText}>New Scene</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuOpen(false); /* Export Placeholder */ }}>
                            <Ionicons name="share-outline" size={20} color="white" />
                            <Text style={styles.menuText}>Export Scene</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Timeline */}
                <View style={styles.timelineContainer}>
                    <Text style={styles.timelineText}>{(duration / 1000).toFixed(1)}s / 15.0s</Text>
                </View>

                {/* Footer Controls */}
                <View style={styles.footer}>
                    {/* Toolbar hides when recording or reviewing */}
                    {!isRecording && segments.length === 0 && (
                        <View style={styles.toolbar}>
                            {/* Save removed */}
                            <TouchableOpacity style={styles.toolButton} onPress={() => handleAddPrimitive('cube')}>
                                <Ionicons name="cube-outline" size={24} color="white" />
                                <Text style={styles.toolLabel}>Cube</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.toolButton} onPress={() => handleAddPrimitive('sphere')}>
                                <Ionicons name="basketball-outline" size={24} color="white" />
                                <Text style={styles.toolLabel}>Sphere</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.toolButton} onPress={handleAddImage}>
                                <Ionicons name="image-outline" size={24} color="white" />
                                <Text style={styles.toolLabel}>Image</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.toolButton} onPress={() => setShowEnvPicker(!showEnvPicker)}>
                                <Ionicons name="sunny-outline" size={24} color="white" />
                                <Text style={styles.toolLabel}>Light</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Environment Picker */}
                    {showEnvPicker && !isRecording && (
                        <View style={styles.envPicker}>
                            {HDRI_MAPS.map((map) => (
                                <TouchableOpacity
                                    key={map.id}
                                    style={styles.envOption}
                                    onPress={() => {
                                        loadEnvironment(map.source);
                                        setShowEnvPicker(false);
                                    }}
                                >
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', overflow: 'hidden', borderWidth: 1, borderColor: 'white' }}>
                                        <RNImage source={map.source} style={{ width: '100%', height: '100%' }} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Record / Confirm Controls */}
                    <View style={styles.recordControls}>
                        {/* Clear Button - show when duration > 0 and NOT recording */}
                        {duration > 0 && !isRecording && (
                            <TouchableOpacity onPress={handleReset} style={styles.actionButton}>
                                <Ionicons name="close" size={24} color="black" />
                            </TouchableOpacity>
                        )}

                        {/* Left Contextual Button - Properties (Only when NOT recording and NO duration? Or just NOT recording?) 
                            User said: "These buttons will remain on until the user taps record" 
                            So they should be visible when !isRecording. 
                            But they replace the Delete/Confirm buttons? 
                            "then these buttons will be removed so that the delete or confirm button can be operational" 
                            This implies they exist when Delete/Confirm do NOT exist? 
                            Or they sit ALONGSIDE Delete/Confirm until record? 
                            "They will sit on the left and the right of the record button."
                            "until the user taps record, then... removed so delete or confirm... can be operational"
                            This implies MUTUAL EXCLUSIVITY with Delete/Confirm? 
                            Delete/Confirm usually appear AFTER recording (duration > 0).
                            So:
                            IF duration == 0 AND !isRecording -> Show Props/Filters
                            IF duration > 0  AND !isRecording -> Show Delete/Confirm (Review mode)
                            IF isRecording -> Show nothing (or just Record button)
                        */}
                        {duration === 0 && !isRecording && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => setIsPropertiesPanelOpen(true)}
                            >
                                <Ionicons name="options" size={24} color="black" />
                            </TouchableOpacity>
                        )}

                        {/* Record Button */}
                        <TouchableOpacity
                            onPressIn={handleRecordIn}
                            onPressOut={handleRecordOut}
                            activeOpacity={1}
                            disabled={duration >= MAX_DURATION}
                        >
                            <Svg height="100" width="100" viewBox="0 0 100 100">
                                <Circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.3)" strokeWidth="6" fill="none" />
                                {duration > 0 && (
                                    <Circle
                                        cx="50" cy="50" r="45"
                                        stroke="#FF3050"
                                        strokeWidth="6"
                                        fill="none"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={strokeDashoffset}
                                        strokeLinecap="round"
                                        rotation="-90"
                                        origin="50, 50"
                                    />
                                )}
                                {/* Cut markers at pause points */}
                                {pauseMarkers.map((markerDuration: number, i: number) => {
                                    const progress = markerDuration / MAX_DURATION;
                                    const angle = progress * 360 - 90;
                                    const rad = (angle * Math.PI) / 180;
                                    const x1 = 50 + 38 * Math.cos(rad);
                                    const y1 = 50 + 38 * Math.sin(rad);
                                    const x2 = 50 + 52 * Math.cos(rad);
                                    const y2 = 50 + 52 * Math.sin(rad);
                                    return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="2" />;
                                })}
                                <Circle
                                    cx="50" cy="50" r={isRecording ? "35" : "40"}
                                    fill={isRecording ? "#FF3050" : "white"}
                                />
                            </Svg>
                        </TouchableOpacity>

                        {/* Confirm Button - show when recording has started */}
                        {duration > 0 && !isRecording && (
                            <TouchableOpacity onPress={handleNext} style={[styles.actionButton, { backgroundColor: '#FF3050' }]}>
                                <Ionicons name="checkmark" size={24} color="white" />
                            </TouchableOpacity>
                        )}

                        {/* Right Contextual Button - Face Filters (Placeholder) */}
                        {duration === 0 && !isRecording && (
                            <TouchableOpacity style={styles.actionButton} onPress={() => {/* Placeholder */ }}>
                                <Ionicons name="happy-outline" size={24} color="black" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </SafeAreaView>

            <ObjectPropertiesPanel
                visible={isPropertiesPanelOpen}
                onClose={() => setIsPropertiesPanelOpen(false)}
                onUpdateMaterial={handleUpdateMaterial}
                onUpdateAnimation={handleUpdateAnimation}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    webviewContainer: { ...StyleSheet.absoluteFillObject },
    overlay: { flex: 1, justifyContent: 'space-between' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    iconButton: { padding: 8 },
    nextButton: {
        flexDirection: 'row',
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        alignItems: 'center',
        gap: 4,
    },
    nextText: { fontWeight: 'bold', color: 'black' },
    timelineContainer: { alignItems: 'center', marginTop: 20 },
    timelineText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    footer: { alignItems: 'center', paddingBottom: 40 },
    toolbar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 30,
        padding: 8,
        marginBottom: 20,
        gap: 16,
    },
    toolButton: { alignItems: 'center', padding: 8 },
    toolLabel: { color: 'white', fontSize: 10, marginTop: 4 },
    recordControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        marginBottom: 20,
    },
    actionButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    // Remnants of old styles can be cleaned up or repurposed 
    recordButton: {}, // Deprecated by new structure
    recordInner: {},
    envPicker: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 20,
        padding: 10,
        marginBottom: 20,
        gap: 12,
    },
    envOption: {
        alignItems: 'center',
    },
    menuDropdown: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 8,
        minWidth: 180,
        zIndex: 100,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#333'
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 12,
    },
    menuText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 4,
    }
});

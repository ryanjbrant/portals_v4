/**
 * AR Paint System - Main AR Scene Component
 * Integrates ViroARScene with touch handling, camera tracking, and paint UI
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    PanResponder,
} from 'react-native';
import {
    ViroARScene,
    ViroNode,
    ViroARSceneNavigator,
    ViroImage,
} from '@reactvision/react-viro';
import { Ionicons } from '@expo/vector-icons';

import { BrushMode, InputMode, TexturePreset, Vec3 } from './types';
import { useStrokeEngine } from './StrokeEngine';
import { updateCameraState, getImmediateHit } from './raycast';
import { TextureBrushRenderer } from './brushes/TextureBrush';
import { TubeBrushRenderer } from './brushes/TubeBrush';
import { ParticleBrushRenderer } from './brushes/ParticleBrush';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============ Colors ============

const PAINT_COLORS = [
    '#FF3366', // Pink
    '#FF6633', // Orange
    '#FFCC00', // Yellow
    '#33CC66', // Green
    '#3399FF', // Blue
    '#9933FF', // Purple
    '#FFFFFF', // White
    '#000000', // Black
];

// ============ AR Scene ============

interface ARPaintSceneInnerProps {
    onCameraUpdate: (position: Vec3, rotation: Vec3, forward: Vec3) => void;
    strokes: any[];
    activeChunks: any[];
    brushMode: BrushMode;
    color: string;
    texturePreset: TexturePreset;
    isPainting: boolean;
}

const ARPaintSceneInner: React.FC<ARPaintSceneInnerProps> = ({
    onCameraUpdate,
    strokes,
    activeChunks,
    brushMode,
    color,
    texturePreset,
    isPainting,
}) => {
    const handleCameraTransformUpdate = useCallback((cameraTransform: any) => {
        if (cameraTransform) {
            const position = cameraTransform.position || [0, 0, 0];
            const rotation = cameraTransform.rotation || [0, 0, 0];
            const forward = cameraTransform.forward || [0, 0, -1];
            onCameraUpdate(position, rotation, forward);
        }
    }, [onCameraUpdate]);

    const renderBrush = useCallback((stroke: any, chunks: any[]) => {
        const strokeChunks = chunks.filter(c => c.strokeId === stroke.id);

        switch (stroke.mode) {
            case BrushMode.TEXTURE:
                return (
                    <TextureBrushRenderer
                        key={stroke.id}
                        chunks={strokeChunks.length > 0 ? strokeChunks : [{ strokeId: stroke.id, chunkIndex: 0, points: stroke.points, isFirst: true, isLast: true }]}
                        config={{ ...stroke.config, mode: BrushMode.TEXTURE, preset: texturePreset }}
                        color={stroke.color}
                        seed={stroke.seed}
                    />
                );
            case BrushMode.TUBE:
                return (
                    <TubeBrushRenderer
                        key={stroke.id}
                        chunks={strokeChunks.length > 0 ? strokeChunks : [{ strokeId: stroke.id, chunkIndex: 0, points: stroke.points, isFirst: true, isLast: true }]}
                        config={{ ...stroke.config, mode: BrushMode.TUBE }}
                        color={stroke.color}
                    />
                );
            case BrushMode.PARTICLE:
                return (
                    <ParticleBrushRenderer
                        key={stroke.id}
                        chunks={strokeChunks.length > 0 ? strokeChunks : [{ strokeId: stroke.id, chunkIndex: 0, points: stroke.points, isFirst: true, isLast: true }]}
                        config={{ ...stroke.config, mode: BrushMode.PARTICLE }}
                        color={stroke.color}
                        seed={stroke.seed}
                        isActive={isPainting}
                    />
                );
            default:
                return null;
        }
    }, [texturePreset, isPainting]);

    return (
        <ViroARScene onCameraTransformUpdate={handleCameraTransformUpdate}>
            <ViroNode>
                {/* Completed strokes */}
                {strokes.map(stroke => renderBrush(stroke, []))}

                {/* Active stroke chunks */}
                {activeChunks.length > 0 && (
                    <>
                        {brushMode === BrushMode.TEXTURE && (
                            <TextureBrushRenderer
                                chunks={activeChunks}
                                config={{ mode: BrushMode.TEXTURE, preset: texturePreset } as any}
                                color={color}
                                seed={Date.now()}
                            />
                        )}
                        {brushMode === BrushMode.TUBE && (
                            <TubeBrushRenderer
                                chunks={activeChunks}
                                config={{ mode: BrushMode.TUBE } as any}
                                color={color}
                            />
                        )}
                        {brushMode === BrushMode.PARTICLE && (
                            <ParticleBrushRenderer
                                chunks={activeChunks}
                                config={{ mode: BrushMode.PARTICLE } as any}
                                color={color}
                                seed={Date.now()}
                                isActive={isPainting}
                            />
                        )}
                    </>
                )}
            </ViroNode>
        </ViroARScene>
    );
};

// ============ Main Component ============

interface ARPaintSceneProps {
    onClose?: () => void;
}

export const ARPaintScene: React.FC<ARPaintSceneProps> = ({ onClose }) => {
    const [state, actions] = useStrokeEngine();
    const [touchActive, setTouchActive] = useState(false);
    const [reticlePainting, setReticlePainting] = useState(false);
    const touchPosRef = useRef({ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 });

    // Camera update handler
    const handleCameraUpdate = useCallback((position: Vec3, rotation: Vec3, forward: Vec3) => {
        updateCameraState(position, rotation, forward);
    }, []);

    // Touch handlers via PanResponder
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,

            onPanResponderGrant: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                touchPosRef.current = { x: locationX, y: locationY };
                setTouchActive(true);

                // Start stroke
                const hit = getImmediateHit(true, locationX, locationY, SCREEN_WIDTH, SCREEN_HEIGHT);
                actions.startStroke(hit.position, hit.normal);
            },

            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                touchPosRef.current = { x: locationX, y: locationY };

                // Extend stroke
                const hit = getImmediateHit(true, locationX, locationY, SCREEN_WIDTH, SCREEN_HEIGHT);
                actions.extendStroke(hit.position, hit.normal);
            },

            onPanResponderRelease: () => {
                setTouchActive(false);
                actions.endStroke();
            },

            onPanResponderTerminate: () => {
                setTouchActive(false);
                actions.endStroke();
            },
        })
    ).current;

    // Reticle painting mode
    useEffect(() => {
        if (!reticlePainting) return;

        const hit = getImmediateHit(false, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        actions.startStroke(hit.position, hit.normal);

        const interval = setInterval(() => {
            const hit = getImmediateHit(false, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
            actions.extendStroke(hit.position, hit.normal);
        }, 33);

        return () => {
            clearInterval(interval);
            actions.endStroke();
        };
    }, [reticlePainting]);

    return (
        <View style={styles.container}>
            {/* AR Scene */}
            <View style={styles.arContainer} {...panResponder.panHandlers}>
                <ViroARSceneNavigator
                    autofocus={true}
                    initialScene={{
                        scene: () => (
                            <ARPaintSceneInner
                                onCameraUpdate={handleCameraUpdate}
                                strokes={state.strokes}
                                activeChunks={state.activeChunks}
                                brushMode={state.brushMode}
                                color={state.color}
                                texturePreset={state.texturePreset}
                                isPainting={state.isPainting}
                            />
                        ),
                    }}
                    style={StyleSheet.absoluteFillObject}
                />

                {/* Reticle */}
                <View style={styles.reticle}>
                    <View style={styles.reticleH} />
                    <View style={styles.reticleV} />
                </View>
            </View>

            {/* UI Overlay */}
            <View style={styles.overlay}>
                {/* Top bar */}
                <View style={styles.topBar}>
                    {onClose && (
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={28} color="white" />
                        </TouchableOpacity>
                    )}
                    <Text style={styles.title}>AR Paint</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Brush selector */}
                <View style={styles.brushSelector}>
                    {Object.values(BrushMode).map((mode) => (
                        <TouchableOpacity
                            key={mode}
                            style={[styles.brushBtn, state.brushMode === mode && styles.brushBtnActive]}
                            onPress={() => actions.setBrushMode(mode)}
                        >
                            <Ionicons
                                name={mode === BrushMode.TEXTURE ? 'brush' : mode === BrushMode.TUBE ? 'git-commit' : 'sparkles'}
                                size={20}
                                color={state.brushMode === mode ? '#000' : '#fff'}
                            />
                            <Text style={[styles.brushBtnText, state.brushMode === mode && styles.brushBtnTextActive]}>
                                {mode === BrushMode.TEXTURE ? 'Paint' : mode === BrushMode.TUBE ? 'Tube' : 'Particle'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Texture presets (only for texture brush) */}
                {state.brushMode === BrushMode.TEXTURE && (
                    <View style={styles.presetRow}>
                        <TouchableOpacity
                            style={[styles.presetBtn, state.texturePreset === TexturePreset.WET && styles.presetBtnActive]}
                            onPress={() => actions.setTexturePreset(TexturePreset.WET)}
                        >
                            <Text style={styles.presetBtnText}>Wet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.presetBtn, state.texturePreset === TexturePreset.DRY && styles.presetBtnActive]}
                            onPress={() => actions.setTexturePreset(TexturePreset.DRY)}
                        >
                            <Text style={styles.presetBtnText}>Dry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Color picker */}
                <View style={styles.colorPicker}>
                    {PAINT_COLORS.map((c) => (
                        <TouchableOpacity
                            key={c}
                            style={[
                                styles.colorBtn,
                                { backgroundColor: c },
                                state.color === c && styles.colorBtnActive,
                            ]}
                            onPress={() => actions.setColor(c)}
                        />
                    ))}
                </View>

                {/* Bottom actions */}
                <View style={styles.bottomActions}>
                    <TouchableOpacity
                        style={[styles.reticlePaintBtn, reticlePainting && styles.reticlePaintBtnActive]}
                        onPress={() => setReticlePainting(!reticlePainting)}
                    >
                        <Ionicons name="radio-button-on" size={20} color={reticlePainting ? '#000' : '#fff'} />
                        <Text style={[styles.actionBtnText, reticlePainting && { color: '#000' }]}>
                            {reticlePainting ? 'Stop' : 'Reticle Paint'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={actions.undoLastStroke}>
                        <Ionicons name="arrow-undo" size={20} color="#fff" />
                        <Text style={styles.actionBtnText}>Undo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={actions.clearAllStrokes}>
                        <Ionicons name="trash" size={20} color="#fff" />
                        <Text style={styles.actionBtnText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// ============ Styles ============

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    arContainer: {
        flex: 1,
    },
    reticle: {
        position: 'absolute',
        top: SCREEN_HEIGHT / 2 - 15,
        left: SCREEN_WIDTH / 2 - 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reticleH: {
        position: 'absolute',
        width: 20,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: 1,
    },
    reticleV: {
        position: 'absolute',
        width: 2,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: 1,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'box-none',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 16,
        pointerEvents: 'box-none',
    },
    closeBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    brushSelector: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 16,
        gap: 8,
    },
    brushBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    brushBtnActive: {
        backgroundColor: '#FFD60A',
    },
    brushBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    brushBtnTextActive: {
        color: '#000',
    },
    presetRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
        gap: 8,
    },
    presetBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    presetBtnActive: {
        backgroundColor: '#FF3366',
    },
    presetBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    colorPicker: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
        gap: 8,
    },
    colorBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorBtnActive: {
        borderColor: '#fff',
        transform: [{ scale: 1.2 }],
    },
    bottomActions: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    reticlePaintBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    reticlePaintBtnActive: {
        backgroundColor: '#FFD60A',
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});

export default ARPaintScene;

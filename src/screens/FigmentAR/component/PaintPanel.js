/**
 * AR Paint Panel - Device painting with camera tracking
 * Uses camera transform from Redux for accurate brush positioning
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    PanResponder,
    Modal,
} from 'react-native';
import { connect } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import {
    addPaintPoint,
    endPaintStroke,
    undoPaintStroke,
    clearPaint,
    setPaintColor,
    setPaintBrush,
} from '../redux/actions';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAINT_DISTANCE = 0.4; // 40cm in front of camera
const POINT_INTERVAL = 50; // ms between points (higher = smoother, less responsive)

// ============ Custom Slider ============

const CustomSlider = ({ value, onValueChange, minimumValue = 0, maximumValue = 100, trackColor = '#fff' }) => {
    const [sliderWidth, setSliderWidth] = useState(200);
    const range = maximumValue - minimumValue;
    const position = ((value - minimumValue) / range) * sliderWidth;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const newValue = minimumValue + (evt.nativeEvent.locationX / sliderWidth) * range;
                onValueChange(Math.max(minimumValue, Math.min(maximumValue, newValue)));
            },
            onPanResponderMove: (evt) => {
                const newValue = minimumValue + (evt.nativeEvent.locationX / sliderWidth) * range;
                onValueChange(Math.max(minimumValue, Math.min(maximumValue, newValue)));
            },
        })
    ).current;

    return (
        <View
            style={sliderStyles.container}
            onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
            {...panResponder.panHandlers}
        >
            <View style={sliderStyles.track}>
                <View style={[sliderStyles.fill, { width: position, backgroundColor: trackColor }]} />
            </View>
            <View style={[sliderStyles.thumb, { left: Math.max(0, position - 10) }]} />
        </View>
    );
};

const sliderStyles = StyleSheet.create({
    container: { height: 40, justifyContent: 'center' },
    track: { height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    thumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', borderWidth: 2, borderColor: '#333', top: 10 },
});

// ============ Color Grid ============

const COLOR_GRID = [
    ['#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6', '#42A5F5', '#2196F3', '#1E88E5', '#1976D2', '#1565C0', '#0D47A1'],
    ['#F3E5F5', '#E1BEE7', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0', '#8E24AA', '#7B1FA2', '#6A1B9A', '#4A148C'],
    ['#FCE4EC', '#F8BBD9', '#F48FB1', '#F06292', '#EC407A', '#E91E63', '#D81B60', '#C2185B', '#AD1457', '#880E4F'],
    ['#FFEBEE', '#FFCDD2', '#EF9A9A', '#E57373', '#EF5350', '#F44336', '#E53935', '#D32F2F', '#C62828', '#B71C1C'],
    ['#FFF3E0', '#FFE0B2', '#FFCC80', '#FFB74D', '#FFA726', '#FF9800', '#FB8C00', '#F57C00', '#EF6C00', '#E65100'],
    ['#FFFDE7', '#FFF9C4', '#FFF59D', '#FFF176', '#FFEE58', '#FFEB3B', '#FDD835', '#FBC02D', '#F9A825', '#F57F17'],
    ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50', '#43A047', '#388E3C', '#2E7D32', '#1B5E20'],
    ['#E0F2F1', '#B2DFDB', '#80CBC4', '#4DB6AC', '#26A69A', '#009688', '#00897B', '#00796B', '#00695C', '#004D40'],
    ['#FFFFFF', '#F5F5F5', '#EEEEEE', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#616161', '#424242', '#212121'],
];

// ============ Color Picker Modal ============

const ColorPickerModal = ({ visible, currentColor, opacity: initialOpacity, onClose, onConfirm }) => {
    const [activeTab, setActiveTab] = useState('grid');
    const [selectedColor, setSelectedColor] = useState(currentColor);
    const [opacity, setOpacity] = useState(initialOpacity);
    const [rgb, setRgb] = useState({ r: 255, g: 51, b: 102 });

    useEffect(() => {
        const hex = selectedColor.replace('#', '');
        setRgb({
            r: parseInt(hex.substr(0, 2), 16) || 0,
            g: parseInt(hex.substr(2, 2), 16) || 0,
            b: parseInt(hex.substr(4, 2), 16) || 0,
        });
    }, [selectedColor]);

    const rgbToHex = (r, g, b) => {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('').toUpperCase();
    };

    const handleRgbChange = (channel, value) => {
        const newRgb = { ...rgb, [channel]: value };
        setRgb(newRgb);
        setSelectedColor(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={pickerStyles.overlay}>
                <View style={pickerStyles.container}>
                    <View style={pickerStyles.header}>
                        <Text style={pickerStyles.title}>Brush Color</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#888" />
                        </TouchableOpacity>
                    </View>

                    <View style={pickerStyles.tabs}>
                        {['grid', 'spectrum', 'slider'].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[pickerStyles.tab, activeTab === tab && pickerStyles.tabActive]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text style={[pickerStyles.tabText, activeTab === tab && pickerStyles.tabTextActive]}>
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={pickerStyles.content}>
                        {activeTab === 'grid' && (
                            <View style={pickerStyles.grid}>
                                {COLOR_GRID.map((row, rowIdx) => (
                                    <View key={rowIdx} style={pickerStyles.gridRow}>
                                        {row.map((color) => (
                                            <TouchableOpacity
                                                key={color}
                                                style={[pickerStyles.gridCell, { backgroundColor: color }, selectedColor === color && pickerStyles.gridCellSelected]}
                                                onPress={() => setSelectedColor(color)}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </View>
                        )}

                        {activeTab === 'spectrum' && (
                            <View style={pickerStyles.spectrum}>
                                <View style={pickerStyles.spectrumGradient}>
                                    <Text style={pickerStyles.spectrumHint}>Select from Grid or Slider tabs</Text>
                                    <View style={[pickerStyles.spectrumPreview, { backgroundColor: selectedColor }]} />
                                </View>
                            </View>
                        )}

                        {activeTab === 'slider' && (
                            <View style={pickerStyles.sliders}>
                                <View style={pickerStyles.sliderRow}>
                                    <Text style={pickerStyles.sliderLabel}>RED</Text>
                                    <View style={pickerStyles.sliderTrack}>
                                        <CustomSlider value={rgb.r} onValueChange={(v) => handleRgbChange('r', v)} minimumValue={0} maximumValue={255} trackColor="#F44336" />
                                    </View>
                                    <Text style={pickerStyles.sliderValue}>{Math.round(rgb.r)}</Text>
                                </View>
                                <View style={pickerStyles.sliderRow}>
                                    <Text style={pickerStyles.sliderLabel}>GREEN</Text>
                                    <View style={pickerStyles.sliderTrack}>
                                        <CustomSlider value={rgb.g} onValueChange={(v) => handleRgbChange('g', v)} minimumValue={0} maximumValue={255} trackColor="#4CAF50" />
                                    </View>
                                    <Text style={pickerStyles.sliderValue}>{Math.round(rgb.g)}</Text>
                                </View>
                                <View style={pickerStyles.sliderRow}>
                                    <Text style={pickerStyles.sliderLabel}>BLUE</Text>
                                    <View style={pickerStyles.sliderTrack}>
                                        <CustomSlider value={rgb.b} onValueChange={(v) => handleRgbChange('b', v)} minimumValue={0} maximumValue={255} trackColor="#2196F3" />
                                    </View>
                                    <Text style={pickerStyles.sliderValue}>{Math.round(rgb.b)}</Text>
                                </View>
                                <Text style={pickerStyles.hexValue}>Hex: {selectedColor}</Text>
                            </View>
                        )}
                    </View>

                    <View style={pickerStyles.opacityRow}>
                        <Text style={pickerStyles.opacityLabel}>OPACITY</Text>
                        <View style={pickerStyles.opacityTrack}>
                            <CustomSlider value={opacity} onValueChange={setOpacity} minimumValue={0} maximumValue={100} trackColor={selectedColor} />
                        </View>
                        <Text style={pickerStyles.opacityValue}>{Math.round(opacity)}%</Text>
                    </View>

                    <View style={pickerStyles.buttons}>
                        <TouchableOpacity style={pickerStyles.btnConfirm} onPress={() => onConfirm(selectedColor, opacity)}>
                            <Text style={pickerStyles.btnConfirmText}>Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={pickerStyles.btnCancel} onPress={onClose}>
                            <Text style={pickerStyles.btnCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const pickerStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    container: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
    title: { color: '#fff', fontSize: 18, fontWeight: '600' },
    tabs: { flexDirection: 'row', padding: 12, gap: 8 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
    tabActive: { backgroundColor: '#555' },
    tabText: { color: '#888', fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    content: { minHeight: 220, paddingHorizontal: 12 },
    grid: { gap: 4 },
    gridRow: { flexDirection: 'row', gap: 4 },
    gridCell: { flex: 1, aspectRatio: 1, borderRadius: 4 },
    gridCellSelected: { borderWidth: 2, borderColor: '#fff' },
    spectrum: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    spectrumGradient: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
    spectrumHint: { color: '#666', fontSize: 12 },
    spectrumPreview: { width: 60, height: 60, borderRadius: 30, marginTop: 16, borderWidth: 3, borderColor: '#fff' },
    sliders: { gap: 16, paddingVertical: 12 },
    sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sliderLabel: { color: '#888', fontSize: 11, width: 50, fontWeight: '600' },
    sliderTrack: { flex: 1 },
    sliderValue: { color: '#fff', fontSize: 13, width: 30, textAlign: 'right' },
    hexValue: { color: '#4FC3F7', fontSize: 12, textAlign: 'center', marginTop: 8 },
    opacityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#333' },
    opacityLabel: { color: '#888', fontSize: 11, width: 60, fontWeight: '600' },
    opacityTrack: { flex: 1 },
    opacityValue: { color: '#fff', fontSize: 13, width: 45, textAlign: 'right' },
    buttons: { flexDirection: 'row', paddingHorizontal: 12, gap: 12 },
    btnConfirm: { flex: 1, backgroundColor: '#fff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    btnConfirmText: { color: '#000', fontSize: 15, fontWeight: '600' },
    btnCancel: { flex: 1, backgroundColor: '#333', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    btnCancelText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

// ============ Main Paint Panel ============

const PaintPanel = ({
    paintColor,
    paintBrushType,
    paintStrokes,
    cameraTransform,
    dispatchAddPaintPoint,
    dispatchEndPaintStroke,
    dispatchUndoPaintStroke,
    dispatchClearPaint,
    dispatchSetPaintColor,
    dispatchSetPaintBrush,
}) => {
    const [isPainting, setIsPainting] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [opacity, setOpacity] = useState(100);
    const lastPointTime = useRef(0);
    const cameraRef = useRef(cameraTransform);

    // Keep camera ref updated
    useEffect(() => {
        cameraRef.current = cameraTransform;
    }, [cameraTransform]);

    // Calculate paint point from touch position + camera
    const getTouchPaintPoint = useCallback((touchX, touchY) => {
        const cam = cameraRef.current;

        // Normalized screen coords (-1 to 1) centered
        // touchX/Y are relative to the paint area, not full screen
        const nx = (touchX / SCREEN_WIDTH) * 2 - 1;
        const ny = -((touchY / SCREEN_HEIGHT) * 2 - 1);

        if (!cam || !cam.position || !cam.forward || !cam.up) {
            // Fallback: simple screen-to-world on fixed plane
            return [nx * 0.3, ny * 0.4, -PAINT_DISTANCE];
        }

        // Calculate right vector from forward × up
        const fx = cam.forward[0], fy = cam.forward[1], fz = cam.forward[2];
        const ux = cam.up[0], uy = cam.up[1], uz = cam.up[2];
        const rx = fy * uz - fz * uy;
        const ry = fz * ux - fx * uz;
        const rz = fx * uy - fy * ux;

        // Normalize right vector
        const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz);
        const rightX = rx / rLen;
        const rightY = ry / rLen;
        const rightZ = rz / rLen;

        // Screen aspect ratio
        const aspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT;

        // Horizontal and vertical FOV scaling
        // Typical phone camera FOV is ~60-70 degrees vertical
        const vFov = Math.tan(35 * Math.PI / 180); // half vertical FOV in radians
        const hFov = vFov * aspectRatio; // horizontal FOV scaled by aspect

        // Scale factors for screen position to world offset
        const worldX = nx * hFov * PAINT_DISTANCE;
        const worldY = ny * vFov * PAINT_DISTANCE;

        // Final point: camera + forward*distance + right*worldX + up*worldY
        return [
            cam.position[0] + fx * PAINT_DISTANCE + rightX * worldX + ux * worldY,
            cam.position[1] + fy * PAINT_DISTANCE + rightY * worldX + uy * worldY,
            cam.position[2] + fz * PAINT_DISTANCE + rightZ * worldX + uz * worldY,
        ];
    }, []);

    const startPainting = useCallback((touchX, touchY) => {
        setIsPainting(true);
        lastPointTime.current = Date.now();

        // Add initial point at finger position
        const point = getTouchPaintPoint(touchX, touchY);
        dispatchAddPaintPoint(point);
    }, [getTouchPaintPoint, dispatchAddPaintPoint]);

    const movePainting = useCallback((touchX, touchY) => {
        const now = Date.now();
        // Throttle points to avoid too many
        if (now - lastPointTime.current < POINT_INTERVAL) return;

        lastPointTime.current = now;
        const point = getTouchPaintPoint(touchX, touchY);
        dispatchAddPaintPoint(point);
    }, [getTouchPaintPoint, dispatchAddPaintPoint]);

    const stopPainting = useCallback(() => {
        setIsPainting(false);
        dispatchEndPaintStroke();
    }, [dispatchEndPaintStroke]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                startPainting(locationX, locationY);
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                movePainting(locationX, locationY);
            },
            onPanResponderRelease: () => {
                stopPainting();
            },
            onPanResponderTerminate: () => {
                stopPainting();
            },
        })
    ).current;

    const handleColorConfirm = (color, newOpacity) => {
        dispatchSetPaintColor(color);
        setOpacity(newOpacity);
        setShowColorPicker(false);
    };

    return (
        <View style={styles.container}>
            {/* Touch area for painting */}
            <View style={styles.paintArea} {...panResponder.panHandlers} />

            {/* Right sidebar */}
            <View style={styles.sidebar}>
                <TouchableOpacity style={[styles.colorSwatch, { backgroundColor: paintColor }]} onPress={() => setShowColorPicker(true)} />
                <View style={styles.divider} />

                <TouchableOpacity style={[styles.brushBtn, paintBrushType === 'texture' && styles.brushBtnActive]} onPress={() => dispatchSetPaintBrush('texture')}>
                    <Ionicons name="brush" size={18} color={paintBrushType === 'texture' ? '#000' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.brushBtn, paintBrushType === 'tube' && styles.brushBtnActive]} onPress={() => dispatchSetPaintBrush('tube')}>
                    <Ionicons name="git-commit" size={18} color={paintBrushType === 'tube' ? '#000' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.brushBtn, paintBrushType === 'particle' && styles.brushBtnActive]} onPress={() => dispatchSetPaintBrush('particle')}>
                    <Ionicons name="sparkles" size={18} color={paintBrushType === 'particle' ? '#000' : '#fff'} />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.actionBtn} onPress={dispatchUndoPaintStroke} disabled={paintStrokes.length === 0}>
                    <Ionicons name="arrow-undo" size={16} color={paintStrokes.length > 0 ? '#fff' : '#555'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={dispatchClearPaint} disabled={paintStrokes.length === 0}>
                    <Ionicons name="trash" size={16} color={paintStrokes.length > 0 ? '#fff' : '#555'} />
                </TouchableOpacity>

                <View style={styles.strokeBadge}>
                    <Text style={styles.strokeCount}>{paintStrokes.length}</Text>
                </View>
            </View>

            <ColorPickerModal visible={showColorPicker} currentColor={paintColor} opacity={opacity} onClose={() => setShowColorPicker(false)} onConfirm={handleColorConfirm} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { ...StyleSheet.absoluteFillObject, pointerEvents: 'box-none' },
    paintArea: { flex: 1, marginRight: 56 },
    sidebar: { position: 'absolute', right: 8, top: 110, width: 40, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 20, paddingVertical: 10, alignItems: 'center', gap: 6 },
    colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff' },
    divider: { width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 2 },
    brushBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    brushBtnActive: { backgroundColor: '#FFD60A' },
    actionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    strokeBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 2 },
    strokeCount: { color: '#888', fontSize: 9, fontWeight: '600' },
});

function mapStateToProps(store) {
    return {
        paintColor: store.arobjects.paintColor || '#FF3366',
        paintBrushType: store.arobjects.paintBrushType || 'tube',
        paintStrokes: store.arobjects.paintStrokes || [],
        cameraTransform: store.arobjects.cameraTransform || { position: [0, 0, 0], forward: [0, 0, -1], up: [0, 1, 0] },
    };
}

function mapDispatchToProps(dispatch) {
    return {
        dispatchAddPaintPoint: (point) => dispatch(addPaintPoint(point)),
        dispatchEndPaintStroke: () => dispatch(endPaintStroke()),
        dispatchUndoPaintStroke: () => dispatch(undoPaintStroke()),
        dispatchClearPaint: () => dispatch(clearPaint()),
        dispatchSetPaintColor: (color) => dispatch(setPaintColor(color)),
        dispatchSetPaintBrush: (brushType) => dispatch(setPaintBrush(brushType)),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PaintPanel);

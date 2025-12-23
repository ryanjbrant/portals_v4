/**
 * PathAnimationTab.js
 * Overhead XZ grid view for drawing object movement paths
 * 10m x 10m grid with user at center (0,0)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SIZE = SCREEN_WIDTH - 40; // Padding on sides
const DEFAULT_GRID_METERS = 5; // 5m x 5m grid default (was 10)

const GRID_SCALE_OPTIONS = [
    { value: 1, label: '1m' },
    { value: 5, label: '5m' },
    { value: 10, label: '10m' },
];

const PLAY_MODES = [
    { key: 'once', label: 'Once', icon: 'play' },
    { key: 'loop', label: 'Loop', icon: 'repeat' },
    { key: 'pingpong', label: 'Ping-Pong', icon: 'swap-horizontal' },
];

// Ramer-Douglas-Peucker path simplification algorithm
// Reduces number of points while preserving shape
const simplifyPath = (points, epsilon = 0.3) => {
    if (points.length <= 2) return points;

    // Find the point with the maximum distance from line between first and last
    let maxDist = 0;
    let maxIndex = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const dist = perpendicularDistance(points[i], first, last);
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (maxDist > epsilon) {
        const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
        const right = simplifyPath(points.slice(maxIndex), epsilon);
        return [...left.slice(0, -1), ...right];
    } else {
        return [first, last];
    }
};

// Calculate perpendicular distance from point to line
const perpendicularDistance = (point, lineStart, lineEnd) => {
    const dx = lineEnd.x - lineStart.x;
    const dz = lineEnd.z - lineStart.z;
    const lineLengthSq = dx * dx + dz * dz;

    if (lineLengthSq === 0) {
        // lineStart and lineEnd are the same point
        return Math.sqrt((point.x - lineStart.x) ** 2 + (point.z - lineStart.z) ** 2);
    }

    const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.z - lineStart.z) * dz) / lineLengthSq));
    const projX = lineStart.x + t * dx;
    const projZ = lineStart.z + t * dz;

    return Math.sqrt((point.x - projX) ** 2 + (point.z - projZ) ** 2);
};

const PathAnimationTab = ({
    objectPosition = [0, 0, -2], // Current object [x, y, z]
    currentPath = null, // Existing path animation data
    onApplyPath, // Callback to apply path
}) => {
    // Path points in meters (XZ plane)
    const [pathPoints, setPathPoints] = useState(
        currentPath?.points || []
    );
    const [playMode, setPlayMode] = useState(currentPath?.playMode || 'loop');
    const [duration, setDuration] = useState(currentPath?.duration || 5);
    const [interpolation, setInterpolation] = useState(currentPath?.interpolation || 'smooth');
    const [followPath, setFollowPath] = useState(currentPath?.followPath ?? true); // Object faces path direction
    const [isDrawing, setIsDrawing] = useState(false);
    const [gridMeters, setGridMeters] = useState(DEFAULT_GRID_METERS); // Grid scale (1m, 5m, 10m)

    // Dynamic meters-to-pixels conversion based on gridMeters
    const metersToPixelsRatio = GRID_SIZE / gridMeters;

    // Use a ref to track the current ratio so panResponder always uses latest value
    const metersToPixelsRatioRef = useRef(metersToPixelsRatio);
    useEffect(() => {
        metersToPixelsRatioRef.current = metersToPixelsRatio;
    }, [metersToPixelsRatio]);

    // Reset state when currentPath changes (different object selected)
    useEffect(() => {
        setPathPoints(currentPath?.points || []);
        setPlayMode(currentPath?.playMode || 'loop');
        setDuration(currentPath?.duration || 5);
        setInterpolation(currentPath?.interpolation || 'smooth');
        setFollowPath(currentPath?.followPath ?? true);
    }, [currentPath]);

    // Convert meters to grid pixels (center is 0,0)
    // Note: Z is positive upward on screen (negative Z in AR = forward = UP on grid)
    const metersToPixels = useCallback((x, z) => {
        return {
            px: (GRID_SIZE / 2) + (x * metersToPixelsRatio),
            py: (GRID_SIZE / 2) + (z * metersToPixelsRatio), // Forward (negative Z) = UP on screen
        };
    }, [metersToPixelsRatio]);

    // Convert pixels to meters - uses ref so panResponder gets latest value
    const pixelsToMeters = useCallback((px, py) => {
        const ratio = metersToPixelsRatioRef.current;
        return {
            x: (px - GRID_SIZE / 2) / ratio,
            z: (py - GRID_SIZE / 2) / ratio, // UP on screen = negative Z (forward)
        };
    }, []);

    // Object position in pixels
    const objPixelPos = metersToPixels(objectPosition[0], objectPosition[2]);

    // Pan responder for drawing
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                setIsDrawing(true);
                const { locationX, locationY } = evt.nativeEvent;
                const point = pixelsToMeters(locationX, locationY);
                setPathPoints([point]);
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                const point = pixelsToMeters(locationX, locationY);
                setPathPoints(prev => {
                    // Only add point if it's far enough from last point (reduce noise)
                    if (prev.length === 0) return [point];
                    const last = prev[prev.length - 1];
                    const dist = Math.sqrt((point.x - last.x) ** 2 + (point.z - last.z) ** 2);
                    if (dist > 0.2) { // 20cm minimum distance during drawing
                        return [...prev, point];
                    }
                    return prev;
                });
            },
            onPanResponderRelease: () => {
                setIsDrawing(false);
                // Simplify the path to reduce points and smooth it
                setPathPoints(prev => {
                    if (prev.length >= 3) {
                        const simplified = simplifyPath(prev, 0.25); // 25cm tolerance
                        console.log('[PathAnimationTab] Simplified path from', prev.length, 'to', simplified.length, 'points');
                        return simplified;
                    }
                    return prev;
                });
            },
        })
    ).current;

    // Generate SVG path string - supports linear or smooth curves
    const getPathD = () => {
        if (pathPoints.length < 2) return '';

        // For smooth mode, generate a smooth curve through all points
        if (interpolation === 'smooth' && pathPoints.length >= 3) {
            return getSmoothPathD();
        }

        // Linear mode - straight lines between points
        let d = '';
        pathPoints.forEach((point, i) => {
            const { px, py } = metersToPixels(point.x, point.z);
            if (i === 0) {
                d += `M ${px} ${py}`;
            } else {
                d += ` L ${px} ${py}`;
            }
        });
        // Close path back to start
        if (pathPoints.length >= 2) {
            const { px, py } = metersToPixels(pathPoints[0].x, pathPoints[0].z);
            d += ` L ${px} ${py}`;
        }
        return d;
    };

    // Generate smooth SVG path using cubic bezier curves (Catmull-Rom to Bezier conversion)
    const getSmoothPathD = () => {
        if (pathPoints.length < 3) return '';

        // Close the path by wrapping points
        const points = [...pathPoints, pathPoints[0], pathPoints[1]];
        const pixelPoints = points.map(p => metersToPixels(p.x, p.z));

        let d = '';
        const { px: startX, py: startY } = pixelPoints[0];
        d = `M ${startX} ${startY}`;

        // Convert Catmull-Rom to cubic bezier for each segment
        for (let i = 0; i < pathPoints.length; i++) {
            const p0 = pixelPoints[i === 0 ? pathPoints.length - 1 : i - 1];
            const p1 = pixelPoints[i];
            const p2 = pixelPoints[i + 1];
            const p3 = pixelPoints[i + 2];

            // Catmull-Rom to Bezier conversion
            // Control point 1: p1 + (p2 - p0) / 6
            // Control point 2: p2 - (p3 - p1) / 6
            const cp1x = p1.px + (p2.px - p0.px) / 6;
            const cp1y = p1.py + (p2.py - p0.py) / 6;
            const cp2x = p2.px - (p3.px - p1.px) / 6;
            const cp2y = p2.py - (p3.py - p1.py) / 6;

            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.px} ${p2.py}`;
        }

        return d;
    };

    // Apply path animation
    const handleApply = () => {
        if (pathPoints.length < 2) return;

        // Close the path by adding first point at end
        const closedPath = [...pathPoints, pathPoints[0]];

        onApplyPath?.({
            active: true,
            points: closedPath,
            playMode,
            duration,
            interpolation,
            followPath,
        });
    };

    // Clear path
    const handleClear = () => {
        setPathPoints([]);
        onApplyPath?.({
            active: false,
            points: [],
            playMode: 'loop',
            duration: 5,
        });
    };

    // Render grid lines
    const renderGrid = () => {
        const lines = [];
        const step = GRID_SIZE / gridMeters; // Dynamic based on gridMeters

        // Vertical lines
        for (let i = 0; i <= gridMeters; i++) {
            const x = i * step;
            const isCenter = i === gridMeters / 2;
            lines.push(
                <Line
                    key={`v${i}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={GRID_SIZE}
                    stroke={isCenter ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={isCenter ? 2 : 1}
                />
            );
        }

        // Horizontal lines
        for (let i = 0; i <= gridMeters; i++) {
            const y = i * step;
            const isCenter = i === gridMeters / 2;
            lines.push(
                <Line
                    key={`h${i}`}
                    x1={0}
                    y1={y}
                    x2={GRID_SIZE}
                    y2={y}
                    stroke={isCenter ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={isCenter ? 2 : 1}
                />
            );
        }

        return lines;
    };

    return (
        <View style={styles.container}>
            {/* Grid Canvas */}
            <View style={styles.gridContainer} {...panResponder.panHandlers}>
                <Svg width={GRID_SIZE} height={GRID_SIZE}>
                    {/* Grid lines */}
                    <G>{renderGrid()}</G>

                    {/* Drawn path */}
                    {pathPoints.length >= 2 && (
                        <Path
                            d={getPathD()}
                            stroke="#FF3050"
                            strokeWidth={3}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}

                    {/* Path points */}
                    {pathPoints.map((point, i) => {
                        const { px, py } = metersToPixels(point.x, point.z);
                        return (
                            <Circle
                                key={i}
                                cx={px}
                                cy={py}
                                r={4}
                                fill={i === 0 ? '#00FF00' : '#FF3050'}
                            />
                        );
                    })}

                    {/* User icon at center */}
                    <Circle
                        cx={GRID_SIZE / 2}
                        cy={GRID_SIZE / 2}
                        r={12}
                        fill="#007AFF"
                        stroke="white"
                        strokeWidth={2}
                    />

                    {/* Object icon */}
                    <Circle
                        cx={objPixelPos.px}
                        cy={objPixelPos.py}
                        r={10}
                        fill="#FFCC00"
                        stroke="white"
                        strokeWidth={2}
                    />
                </Svg>

                {/* Grid labels - dynamic based on gridMeters */}
                {/* Top = forward (negative Z), Bottom = behind (positive Z) */}
                <Text style={[styles.gridLabel, styles.gridLabelTop]}>+{gridMeters / 2}m</Text>
                <Text style={[styles.gridLabel, styles.gridLabelBottom]}>-{gridMeters / 2}m</Text>
                <Text style={[styles.gridLabel, styles.gridLabelLeft]}>-{gridMeters / 2}m</Text>
                <Text style={[styles.gridLabel, styles.gridLabelRight]}>+{gridMeters / 2}m</Text>

                {/* Legend - overlayed on top-right of grid */}
                <View style={styles.legendOverlay}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
                        <Text style={styles.legendText}>You</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#FFCC00' }]} />
                        <Text style={styles.legendText}>Object</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#00FF00' }]} />
                        <Text style={styles.legendText}>Start</Text>
                    </View>
                </View>

                {/* Grid Scale Selector - bottom-right of grid */}
                <View style={styles.scaleButtonGroup}>
                    {GRID_SCALE_OPTIONS.map((opt, index) => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[
                                styles.scaleButton,
                                index === 0 && styles.scaleButtonFirst,
                                index === GRID_SCALE_OPTIONS.length - 1 && styles.scaleButtonLast,
                                gridMeters === opt.value && styles.scaleButtonActive,
                            ]}
                            onPress={() => setGridMeters(opt.value)}
                        >
                            <Text style={[styles.scaleButtonText, gridMeters === opt.value && styles.scaleButtonTextActive]}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Settings Card */}
            <View style={styles.formCard}>
                {/* Mode Row */}
                <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Mode</Text>
                    <View style={styles.pillContainer}>
                        {PLAY_MODES.map((mode) => (
                            <TouchableOpacity
                                key={mode.key}
                                style={[styles.pill, playMode === mode.key && styles.pillActive]}
                                onPress={() => setPlayMode(mode.key)}
                            >
                                <Text style={[styles.pillText, playMode === mode.key && styles.pillTextActive]}>
                                    {mode.key === 'pingpong' ? '⇄' : mode.key === 'loop' ? '↻' : '▶'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.formDivider} />

                {/* Style Row */}
                <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Style</Text>
                    <View style={styles.pillContainer}>
                        <TouchableOpacity
                            style={[styles.pill, interpolation === 'linear' && styles.pillActive]}
                            onPress={() => setInterpolation('linear')}
                        >
                            <Text style={[styles.pillText, interpolation === 'linear' && styles.pillTextActive]}>Linear</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.pill, interpolation === 'smooth' && styles.pillActive]}
                            onPress={() => setInterpolation('smooth')}
                        >
                            <Text style={[styles.pillText, interpolation === 'smooth' && styles.pillTextActive]}>Smooth</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.formDivider} />

                {/* Duration Row */}
                <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Duration</Text>
                    <View style={styles.durationStepper}>
                        <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => setDuration(d => Math.max(2, d - 1))}
                        >
                            <Ionicons name="remove" size={16} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.stepperValue}>{duration}s</Text>
                        <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => setDuration(d => Math.min(30, d + 1))}
                        >
                            <Ionicons name="add" size={16} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.formDivider} />

                {/* Follow Path Row */}
                <View style={styles.formRow}>
                    <Text style={styles.formLabel}>Follow Path</Text>
                    <TouchableOpacity
                        style={[styles.toggleTrack, followPath && styles.toggleTrackActive]}
                        onPress={() => setFollowPath(!followPath)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.toggleThumb, followPath && styles.toggleThumbActive]} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.applyBtn, pathPoints.length < 2 && styles.applyBtnDisabled]}
                    onPress={handleApply}
                    disabled={pathPoints.length < 2}
                >
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.applyBtnText}>Apply Path</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gridContainer: {
        width: GRID_SIZE,
        height: GRID_SIZE,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    gridLabel: {
        position: 'absolute',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
    },
    gridLabelTop: { top: 4, alignSelf: 'center', left: GRID_SIZE / 2 - 10 },
    gridLabelBottom: { bottom: 4, alignSelf: 'center', left: GRID_SIZE / 2 - 10 },
    gridLabelLeft: { left: 4, top: GRID_SIZE / 2 - 6 },
    gridLabelRight: { right: 4, top: GRID_SIZE / 2 - 6 },
    legendOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        padding: 6,
        paddingHorizontal: 8,
        gap: 4,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
    },
    section: {
        marginTop: 16,
    },
    sectionLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    pillContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    pillActive: {
        backgroundColor: '#FFD60A',
    },
    pillText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
    },
    pillTextActive: {
        color: 'black',
    },
    compactRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    compactFieldMode: {
        flex: 3, // MODE gets more space for 3 buttons
    },
    compactFieldStyle: {
        flex: 2, // STYLE has 2 buttons
    },
    compactField: {
        flex: 1,
    },
    compactLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        overflow: 'hidden',
    },
    segmentedOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentedFirst: {
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
    },
    segmentedLast: {
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
    },
    segmentedOptionActive: {
        backgroundColor: '#FFD60A',
    },
    segmentedText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
    },
    segmentedTextActive: {
        color: 'black',
    },
    compactLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    scaleButtonGroup: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 6,
        overflow: 'hidden',
    },
    scaleButton: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    scaleButtonFirst: {
        borderTopLeftRadius: 6,
        borderBottomLeftRadius: 6,
    },
    scaleButtonLast: {
        borderTopRightRadius: 6,
        borderBottomRightRadius: 6,
    },
    scaleButtonActive: {
        backgroundColor: '#007AFF',
    },
    scaleButtonText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '600',
    },
    scaleButtonTextActive: {
        color: 'white',
    },
    dropdownContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        overflow: 'hidden',
    },
    dropdownOption: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
    },
    dropdownOptionActive: {
        backgroundColor: '#FFD60A',
    },
    dropdownText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '600',
    },
    dropdownTextActive: {
        color: 'black',
    },
    durationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    durationBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    durationValue: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        minWidth: 50,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    clearBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    clearBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    applyBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#FFD60A',
    },
    applyBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    applyBtnText: {
        color: 'black',
        fontSize: 16,
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    toggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toggleLabel: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    toggleHint: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        marginTop: 4,
    },
    toggleTrack: {
        width: 44,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    toggleTrackActive: {
        backgroundColor: '#FFD60A',
    },
    toggleThumb: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'white',
    },
    toggleThumbActive: {
        alignSelf: 'flex-end',
    },
    // FormCard styles (matching Object Details panel)
    formCard: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        marginTop: 16,
        overflow: 'hidden',
    },
    formRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    formLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '500',
    },
    formDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 16,
    },
    durationStepper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepperBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperValue: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        minWidth: 36,
        textAlign: 'center',
    },
});

export default PathAnimationTab;

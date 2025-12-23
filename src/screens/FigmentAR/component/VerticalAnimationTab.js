/**
 * VerticalAnimationTab.js
 * Time vs Height graph for drawing Y position animations
 * X axis: Time (0 to duration), Y axis: Height (0 to 3m)
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
import Svg, { Path, Circle, Line, G, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRAPH_WIDTH = SCREEN_WIDTH - 60; // Padding on sides + labels
const GRAPH_HEIGHT = 200;
const MAX_HEIGHT_METERS = 3; // 0 to 3 meters on Y axis

// Ramer-Douglas-Peucker path simplification algorithm
const simplifyPath = (points, epsilon = 0.05) => {
    if (points.length <= 2) return points;

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

    if (maxDist > epsilon) {
        const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
        const right = simplifyPath(points.slice(maxIndex), epsilon);
        return [...left.slice(0, -1), ...right];
    } else {
        return [first, last];
    }
};

const perpendicularDistance = (point, lineStart, lineEnd) => {
    const dx = lineEnd.t - lineStart.t;
    const dy = lineEnd.y - lineStart.y;
    const lineLengthSq = dx * dx + dy * dy;

    if (lineLengthSq === 0) {
        return Math.sqrt((point.t - lineStart.t) ** 2 + (point.y - lineStart.y) ** 2);
    }

    const t = Math.max(0, Math.min(1, ((point.t - lineStart.t) * dx + (point.y - lineStart.y) * dy) / lineLengthSq));
    const projT = lineStart.t + t * dx;
    const projY = lineStart.y + t * dy;

    return Math.sqrt((point.t - projT) ** 2 + (point.y - projY) ** 2);
};

// Curve Presets - common Y-position patterns
const CURVE_PRESETS = [
    {
        name: 'Sine', icon: 'pulse', generate: () => {
            const points = [];
            for (let i = 0; i <= 16; i++) {
                const t = i / 16;
                const y = Math.sin(t * Math.PI * 2) * 1.0 + 1.0;
                points.push({ t, y });
            }
            points[points.length - 1].y = points[0].y;
            return points;
        }
    },
    {
        name: 'Bounce', icon: 'basketball', generate: () => [
            { t: 0, y: 0 }, { t: 0.15, y: 2.0 }, { t: 0.30, y: 0 },
            { t: 0.40, y: 1.2 }, { t: 0.50, y: 0 }, { t: 0.58, y: 0.7 },
            { t: 0.66, y: 0 }, { t: 0.72, y: 0.35 }, { t: 0.78, y: 0 },
            { t: 0.84, y: 0.15 }, { t: 0.90, y: 0 }, { t: 1.0, y: 0 },
        ]
    },
    {
        name: 'Sawtooth', icon: 'caret-up', generate: () => [
            { t: 0, y: 0 }, { t: 0.45, y: 2.0 }, { t: 0.50, y: 0 },
            { t: 0.95, y: 2.0 }, { t: 1.0, y: 0 },
        ]
    },
    {
        name: 'Triangle', icon: 'triangle', generate: () => [
            { t: 0, y: 0 }, { t: 0.25, y: 2.0 }, { t: 0.50, y: 0 },
            { t: 0.75, y: 2.0 }, { t: 1.0, y: 0 },
        ]
    },
    {
        name: 'Hop', icon: 'arrow-up', generate: () => [
            { t: 0, y: 0 }, { t: 0.10, y: 1.5 }, { t: 0.45, y: 1.5 },
            { t: 0.55, y: 0 }, { t: 1.0, y: 0 },
        ]
    },
    {
        name: 'Pulse', icon: 'flash', generate: () => [
            { t: 0, y: 0 }, { t: 0.20, y: 0 }, { t: 0.25, y: 2.5 },
            { t: 0.30, y: 0 }, { t: 0.70, y: 0 }, { t: 0.75, y: 2.5 },
            { t: 0.80, y: 0 }, { t: 1.0, y: 0 },
        ]
    },
    {
        name: 'Float', icon: 'cloud', generate: () => {
            const points = [];
            for (let i = 0; i <= 20; i++) {
                const t = i / 20;
                const y = 1.0 + Math.sin(t * Math.PI * 4) * 0.3 + Math.sin(t * Math.PI * 2.5) * 0.2;
                points.push({ t, y: Math.max(0, y) });
            }
            points[points.length - 1].y = points[0].y;
            return points;
        }
    },
    {
        name: 'Step', icon: 'git-commit', generate: () => [
            { t: 0, y: 0 }, { t: 0.24, y: 0 }, { t: 0.25, y: 1.0 },
            { t: 0.49, y: 1.0 }, { t: 0.50, y: 2.0 }, { t: 0.74, y: 2.0 },
            { t: 0.75, y: 1.0 }, { t: 0.99, y: 1.0 }, { t: 1.0, y: 0 },
        ]
    },
    {
        name: 'Ease', icon: 'swap-horizontal', generate: () => {
            const points = [];
            for (let i = 0; i <= 12; i++) {
                const t = i / 12;
                const y = (1 - Math.cos(t * Math.PI * 2)) * 1.0;
                points.push({ t, y });
            }
            points[points.length - 1].y = points[0].y;
            return points;
        }
    },
];

const VerticalAnimationTab = ({
    duration = 5, // Duration from path tab or default 5 seconds
    currentVertical = null, // Existing vertical animation data
    onApplyVertical, // Callback to apply vertical animation
}) => {
    // Curve points as {t: 0-1 (normalized time), y: 0-3 (meters)}
    const [curvePoints, setCurvePoints] = useState(
        currentVertical?.points || []
    );
    const [interpolation, setInterpolation] = useState(currentVertical?.interpolation || 'smooth');
    const [isDrawing, setIsDrawing] = useState(false);
    const [showPresetPicker, setShowPresetPicker] = useState(false);

    // Reset state when currentVertical changes (different object selected)
    useEffect(() => {
        setCurvePoints(currentVertical?.points || []);
        setInterpolation(currentVertical?.interpolation || 'smooth');
    }, [currentVertical]);

    // Convert normalized values to pixel coordinates
    const toPixels = useCallback((t, y) => {
        return {
            px: t * GRAPH_WIDTH,
            py: GRAPH_HEIGHT - (y / MAX_HEIGHT_METERS) * GRAPH_HEIGHT,
        };
    }, []);

    // Convert pixels to normalized values
    const fromPixels = useCallback((px, py) => {
        return {
            t: Math.max(0, Math.min(1, px / GRAPH_WIDTH)),
            y: Math.max(0, Math.min(MAX_HEIGHT_METERS, (1 - py / GRAPH_HEIGHT) * MAX_HEIGHT_METERS)),
        };
    }, []);

    // Pan responder for drawing
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                setIsDrawing(true);
                const { locationX, locationY } = evt.nativeEvent;
                const point = fromPixels(locationX, locationY);
                setCurvePoints([point]);
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                const point = fromPixels(locationX, locationY);
                setCurvePoints(prev => {
                    if (prev.length === 0) return [point];
                    const last = prev[prev.length - 1];
                    // Only add if moving forward in time
                    if (point.t > last.t + 0.01) {
                        return [...prev, point];
                    }
                    return prev;
                });
            },
            onPanResponderRelease: () => {
                setIsDrawing(false);
                // Simplify and ensure we have start and end points
                setCurvePoints(prev => {
                    if (prev.length < 2) return prev;

                    // Ensure curve starts at t=0 and ends at t=1
                    let points = [...prev];
                    if (points[0].t > 0.05) {
                        points.unshift({ t: 0, y: points[0].y });
                    }
                    if (points[points.length - 1].t < 0.95) {
                        points.push({ t: 1, y: points[points.length - 1].y });
                    }

                    // Simplify
                    const simplified = simplifyPath(points, 0.03);

                    // AUTO-CLOSE LOOP: Make last point's Y match first point's Y for seamless looping
                    if (simplified.length >= 2) {
                        simplified[simplified.length - 1] = {
                            ...simplified[simplified.length - 1],
                            y: simplified[0].y,
                        };
                    }

                    console.log('[VerticalAnimationTab] Simplified from', prev.length, 'to', simplified.length, 'points (loop closed)');
                    return simplified;
                });
            },
        })
    ).current;

    // Generate SVG path string
    const getPathD = () => {
        if (curvePoints.length < 2) return '';

        if (interpolation === 'smooth' && curvePoints.length >= 3) {
            return getSmoothPathD();
        }

        // Linear
        let d = '';
        curvePoints.forEach((point, i) => {
            const { px, py } = toPixels(point.t, point.y);
            if (i === 0) {
                d += `M ${px} ${py}`;
            } else {
                d += ` L ${px} ${py}`;
            }
        });
        return d;
    };

    // Smooth path using cubic bezier
    const getSmoothPathD = () => {
        if (curvePoints.length < 3) return '';

        const pixelPoints = curvePoints.map(p => toPixels(p.t, p.y));
        let d = `M ${pixelPoints[0].px} ${pixelPoints[0].py}`;

        for (let i = 0; i < pixelPoints.length - 1; i++) {
            const p0 = pixelPoints[Math.max(0, i - 1)];
            const p1 = pixelPoints[i];
            const p2 = pixelPoints[i + 1];
            const p3 = pixelPoints[Math.min(pixelPoints.length - 1, i + 2)];

            const cp1x = p1.px + (p2.px - p0.px) / 6;
            const cp1y = p1.py + (p2.py - p0.py) / 6;
            const cp2x = p2.px - (p3.px - p1.px) / 6;
            const cp2y = p2.py - (p3.py - p1.py) / 6;

            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.px} ${p2.py}`;
        }

        return d;
    };

    // Apply vertical animation
    const handleApply = () => {
        if (curvePoints.length < 2) return;

        onApplyVertical?.({
            active: true,
            points: curvePoints,
            interpolation,
        });
    };

    // Clear curve
    const handleClear = () => {
        setCurvePoints([]);
        onApplyVertical?.({
            active: false,
            points: [],
            interpolation: 'smooth',
        });
    };

    // Render grid lines
    const renderGrid = () => {
        const lines = [];

        // Vertical lines (time divisions)
        for (let i = 0; i <= 5; i++) {
            const x = (i / 5) * GRAPH_WIDTH;
            lines.push(
                <Line
                    key={`v${i}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={GRAPH_HEIGHT}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1}
                />
            );
        }

        // Horizontal lines (height divisions - 0, 1m, 2m, 3m)
        for (let i = 0; i <= 3; i++) {
            const y = GRAPH_HEIGHT - (i / MAX_HEIGHT_METERS) * GRAPH_HEIGHT;
            lines.push(
                <Line
                    key={`h${i}`}
                    x1={0}
                    y1={y}
                    x2={GRAPH_WIDTH}
                    y2={y}
                    stroke={i === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={i === 0 ? 2 : 1}
                />
            );
        }

        return lines;
    };

    return (
        <View style={styles.container}>
            {/* Info */}
            <Text style={styles.infoText}>
                Draw left to right to control height over {duration}s
            </Text>

            {/* Graph Canvas */}
            <View style={styles.graphContainer}>
                {/* Y Axis Labels */}
                <View style={styles.yLabels}>
                    <Text style={styles.axisLabel}>3m</Text>
                    <Text style={styles.axisLabel}>2m</Text>
                    <Text style={styles.axisLabel}>1m</Text>
                    <Text style={styles.axisLabel}>0</Text>
                </View>

                <View style={styles.graphArea} {...panResponder.panHandlers}>
                    <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
                        {/* Grid */}
                        <G>{renderGrid()}</G>

                        {/* Drawn curve */}
                        {curvePoints.length >= 2 && (
                            <Path
                                d={getPathD()}
                                stroke="#FF3050"
                                strokeWidth={3}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}

                        {/* Points */}
                        {curvePoints.map((point, i) => {
                            const { px, py } = toPixels(point.t, point.y);
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
                    </Svg>
                </View>
            </View>

            {/* X Axis Labels */}
            <View style={styles.xLabels}>
                <Text style={styles.axisLabel}>0s</Text>
                <Text style={styles.axisLabel}>{Math.round(duration / 2)}s</Text>
                <Text style={styles.axisLabel}>{duration}s</Text>
            </View>

            {/* Curve Style + Presets Row */}
            <View style={styles.section}>
                <View style={styles.stylePresetsRow}>
                    {/* Left: Curve Style */}
                    <View style={styles.curveStyleGroup}>
                        <Text style={styles.sectionLabel}>CURVE STYLE</Text>
                        <View style={styles.pillContainer}>
                            <TouchableOpacity
                                style={[styles.pill, interpolation === 'linear' && styles.pillActive]}
                                onPress={() => setInterpolation('linear')}
                            >
                                <Ionicons
                                    name="analytics"
                                    size={14}
                                    color={interpolation === 'linear' ? 'white' : 'rgba(255,255,255,0.5)'}
                                />
                                <Text style={[styles.pillText, interpolation === 'linear' && styles.pillTextActive]}>
                                    Linear
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.pill, interpolation === 'smooth' && styles.pillActive]}
                                onPress={() => setInterpolation('smooth')}
                            >
                                <Ionicons
                                    name="water"
                                    size={14}
                                    color={interpolation === 'smooth' ? 'white' : 'rgba(255,255,255,0.5)'}
                                />
                                <Text style={[styles.pillText, interpolation === 'smooth' && styles.pillTextActive]}>
                                    Smooth
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Right: Presets Dropdown */}
                    <View style={styles.presetsGroup}>
                        <Text style={styles.sectionLabel}>PRESET</Text>
                        <TouchableOpacity
                            style={styles.presetDropdown}
                            onPress={() => setShowPresetPicker(!showPresetPicker)}
                        >
                            <Ionicons name="shapes" size={14} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.presetDropdownText}>Select...</Text>
                            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Presets Dropdown Menu */}
                {showPresetPicker && (
                    <View style={styles.presetMenu}>
                        {CURVE_PRESETS.map((preset) => (
                            <TouchableOpacity
                                key={preset.name}
                                style={styles.presetMenuItem}
                                onPress={() => {
                                    setCurvePoints(preset.generate());
                                    setShowPresetPicker(false);
                                }}
                            >
                                <Ionicons name={preset.icon} size={16} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.presetMenuText}>{preset.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.applyBtn, curvePoints.length < 2 && styles.applyBtnDisabled]}
                    onPress={handleApply}
                    disabled={curvePoints.length < 2}
                >
                    <Ionicons name="checkmark" size={20} color="white" />
                    <Text style={styles.applyBtnText}>Apply Height</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    infoText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 12,
    },
    graphContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
    },
    yLabels: {
        width: 30,
        height: GRAPH_HEIGHT,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingRight: 4,
    },
    graphArea: {
        width: GRAPH_WIDTH,
        height: GRAPH_HEIGHT,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        overflow: 'hidden',
    },
    xLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginLeft: 30,
        marginTop: 4,
        width: GRAPH_WIDTH,
        alignSelf: 'center',
    },
    axisLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
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
        backgroundColor: '#FF3050',
    },
    pillText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
    },
    pillTextActive: {
        color: 'white',
    },
    stylePresetsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    curveStyleGroup: {
        flex: 1,
    },
    presetsGroup: {
        marginLeft: 16,
    },
    presetDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    presetDropdownText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '500',
    },
    presetMenu: {
        marginTop: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 12,
    },
    presetMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    presetMenuText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontWeight: '500',
    },
    presetBtnText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontWeight: '500',
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
        backgroundColor: '#FF3050',
    },
    applyBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    applyBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default VerticalAnimationTab;

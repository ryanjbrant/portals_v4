/**
 * SceneLayersTab.js
 * Hierarchical list of scene objects with drag-to-parent functionality
 * Uses long-press to initiate drag to avoid scroll conflicts
 */

import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ROW_HEIGHT = 52;
const INDENT_SIZE = 24;

const SceneLayersTab = ({
    modelItems = {},
    onSelectObject,
    onSetParent,
}) => {
    const [selectedForMove, setSelectedForMove] = useState(null);

    // Build hierarchy from flat modelItems
    const buildHierarchy = () => {
        const items = Object.values(modelItems).filter(item => item && !item.hidden);
        const topLevel = [];
        const childrenMap = {};

        // Group children by parent
        items.forEach(item => {
            if (item.parentId) {
                if (!childrenMap[item.parentId]) {
                    childrenMap[item.parentId] = [];
                }
                childrenMap[item.parentId].push(item);
            } else {
                topLevel.push(item);
            }
        });

        // Build flat list with depth info
        const flatList = [];
        const addWithChildren = (item, depth) => {
            flatList.push({ ...item, depth });
            const children = childrenMap[item.uuid] || [];
            children.forEach(child => addWithChildren(child, depth + 1));
        };

        topLevel.forEach(item => addWithChildren(item, 0));
        return flatList;
    };

    const items = buildHierarchy();

    // Get icon based on object name/type
    const getIcon = (item) => {
        const name = (item.name || '').toLowerCase();
        if (name.includes('sphere')) return 'ellipse';
        if (name.includes('cube') || name.includes('box')) return 'cube';
        if (name.includes('cylinder')) return 'square';
        if (name.includes('torus')) return 'radio-button-off';
        if (name.includes('plane')) return 'remove';
        if (name.includes('cone')) return 'caret-up';
        if (name.includes('capsule') || name.includes('pill')) return 'tablet-portrait';
        return 'shapes';
    };

    // Handle tap - select object or set parent if in move mode
    const handleTap = useCallback((item) => {
        if (selectedForMove) {
            if (selectedForMove === item.uuid) {
                // Tapped same item - cancel
                setSelectedForMove(null);
            } else {
                // Set parent relationship
                onSetParent?.(selectedForMove, item.uuid);
                setSelectedForMove(null);
            }
        } else {
            // Normal tap - select object
            onSelectObject?.(item.uuid);
        }
    }, [selectedForMove, onSelectObject, onSetParent]);

    // Long press to start move mode
    const handleLongPress = useCallback((uuid) => {
        setSelectedForMove(uuid);
    }, []);

    // Unparent - make top level
    const handleUnparent = useCallback((uuid) => {
        onSetParent?.(uuid, null);
    }, [onSetParent]);

    // Render empty state
    if (items.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Ionicons name="layers-outline" size={48} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyText}>No objects in scene</Text>
                <Text style={styles.emptySubtext}>Add objects to see them here</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Instructions */}
            {selectedForMove ? (
                <View style={styles.moveMode}>
                    <Ionicons name="arrow-forward-circle" size={16} color="#FFD60A" />
                    <Text style={styles.moveModeText}>Tap an object to make it the parent</Text>
                    <TouchableOpacity onPress={() => setSelectedForMove(null)} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <Text style={styles.hint}>Long press to move • Tap to select</Text>
            )}

            {/* Object List */}
            <View style={styles.list}>
                {items.map((item, index) => {
                    const isMoving = selectedForMove === item.uuid;
                    const hasParent = !!item.parentId;

                    return (
                        <TouchableOpacity
                            key={item.uuid}
                            style={[
                                styles.row,
                                { marginLeft: item.depth * INDENT_SIZE },
                                isMoving && styles.rowMoving,
                                selectedForMove && !isMoving && styles.rowDropTarget,
                            ]}
                            onPress={() => handleTap(item)}
                            onLongPress={() => handleLongPress(item.uuid)}
                            delayLongPress={300}
                            activeOpacity={0.7}
                        >
                            {/* Indent indicator */}
                            {item.depth > 0 && (
                                <View style={styles.indentLine}>
                                    <Text style={styles.indentDash}>—</Text>
                                </View>
                            )}

                            {/* Icon */}
                            <View style={[
                                styles.iconContainer,
                                isMoving && styles.iconContainerMoving,
                                selectedForMove && !isMoving && styles.iconContainerTarget
                            ]}>
                                <Ionicons name={getIcon(item)} size={18} color={isMoving ? 'black' : 'white'} />
                            </View>

                            {/* Name */}
                            <View style={styles.nameContainer}>
                                <Text style={[styles.name, isMoving && styles.nameMoving]} numberOfLines={1}>
                                    {item.name || 'Untitled'}
                                </Text>
                            </View>

                            {/* Unparent button (if has parent) */}
                            {hasParent && !selectedForMove && (
                                <TouchableOpacity
                                    style={styles.unparentBtn}
                                    onPress={() => handleUnparent(item.uuid)}
                                >
                                    <Ionicons name="return-up-back" size={18} color="rgba(255,255,255,0.5)" />
                                </TouchableOpacity>
                            )}

                            {/* Move indicator */}
                            {isMoving && (
                                <View style={styles.movingIndicator}>
                                    <Ionicons name="move" size={18} color="#FFD60A" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Cancel move mode bar */}
            {selectedForMove && (
                <TouchableOpacity
                    style={styles.unparentBar}
                    onPress={() => {
                        onSetParent?.(selectedForMove, null);
                        setSelectedForMove(null);
                    }}
                >
                    <Ionicons name="arrow-up-outline" size={18} color="white" />
                    <Text style={styles.unparentBarText}>Make Top Level (No Parent)</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    hint: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 12,
    },
    moveMode: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 214, 10, 0.15)',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginBottom: 12,
    },
    moveModeText: {
        color: '#FFD60A',
        fontSize: 13,
        fontWeight: '500',
    },
    cancelBtn: {
        marginLeft: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 6,
    },
    cancelBtnText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    list: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        height: ROW_HEIGHT,
        paddingHorizontal: 12,
        marginBottom: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
    },
    rowMoving: {
        backgroundColor: '#FFD60A',
        transform: [{ scale: 1.02 }],
    },
    rowDropTarget: {
        borderWidth: 1,
        borderColor: 'rgba(255, 214, 10, 0.5)',
        borderStyle: 'dashed',
    },
    indentLine: {
        marginRight: 4,
    },
    indentDash: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 14,
    },
    iconContainer: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    iconContainerMoving: {
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    iconContainerTarget: {
        backgroundColor: 'rgba(255, 214, 10, 0.2)',
    },
    nameContainer: {
        flex: 1,
    },
    name: {
        color: 'white',
        fontSize: 15,
        fontWeight: '500',
    },
    nameMoving: {
        color: 'black',
    },
    unparentBtn: {
        padding: 8,
    },
    movingIndicator: {
        padding: 8,
    },
    unparentBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 12,
    },
    unparentBarText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
        marginTop: 12,
    },
    emptySubtext: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        marginTop: 4,
    },
});

export default SceneLayersTab;

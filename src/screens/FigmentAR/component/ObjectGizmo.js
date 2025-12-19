/**
 * ObjectGizmo.js
 * 
 * Ground ring gizmo for 3D object manipulation.
 * - Ground ring: Drag to move object on X/Z plane
 * - Vertical stem: Visual connection between ring and object
 * 
 * The object itself handles Y-only drag (height control).
 */
'use strict';

import React from 'react';
import {
    ViroNode,
    ViroImage,
    ViroPolyline,
    ViroMaterials,
} from '@reactvision/react-viro';

// Create gizmo materials
ViroMaterials.createMaterials({
    gizmoStem: {
        diffuseColor: '#00FFFF',
        lightingModel: 'Constant',
    },
});

var createReactClass = require('create-react-class');

// Gizmo ring asset
const GIZMO_RING = require('../res/gizmo_ring.png');

/**
 * ObjectGizmo Component
 * 
 * Props:
 * - onXZDrag: (deltaX, deltaZ) => void - Called when ground ring is dragged (X/Z plane movement)
 * - onRotate: (rotateState, rotationFactor, source) => void - Called when ring is rotated
 * - onPinch: (pinchState, scaleFactor, source) => void - Called when ring is pinched
 * - scale: number - Base scale for gizmo size (default 1.0)
 * - yOffset: number - Height of object above the ring (for stem)
 * - isSelected: boolean - Whether object is currently selected
 */
var ObjectGizmo = createReactClass({
    getInitialState() {
        return {
            ringActive: false,
            initialDragPos: null,
        };
    },

    // Ground ring drag - controls X/Z position
    _onRingDrag(dragState, position, source) {
        if (dragState === 1) {
            // Drag started - capture initial position
            this.setState({
                ringActive: true,
                initialDragPos: { x: position[0], z: position[2] },
            });
        } else if (dragState === 2) {
            // Dragging - calculate delta X/Z
            if (this.state.initialDragPos && this.props.onXZDrag) {
                const deltaX = position[0] - this.state.initialDragPos.x;
                const deltaZ = position[2] - this.state.initialDragPos.z;
                this.props.onXZDrag(deltaX, deltaZ);
                // Update initial position for continuous drag
                this.setState({ initialDragPos: { x: position[0], z: position[2] } });
            }
        } else if (dragState === 3) {
            // Drag ended
            this.setState({
                ringActive: false,
                initialDragPos: null,
            });
        }
    },

    // Forward rotation to parent
    _onRingRotate(rotateState, rotationFactor, source) {
        if (this.props.onRotate) {
            this.props.onRotate(rotateState, rotationFactor, source);
        }
    },

    // Forward pinch to parent
    _onRingPinch(pinchState, scaleFactor, source) {
        if (this.props.onPinch) {
            this.props.onPinch(pinchState, scaleFactor, source);
        }
    },

    render() {
        const gizmoScale = this.props.scale || 1.0;
        const yOffset = this.props.yOffset || 0;
        const ringSize = 0.3 * gizmoScale; // Ring diameter
        const isSelected = this.props.isSelected !== false;

        if (!isSelected) {
            return null; // Don't render if not selected
        }

        return (
            <ViroNode>
                {/* Ground ring - positioned at Y=0 relative to object's base position */}
                <ViroNode position={[0, -yOffset, 0]}>
                    {/* The ring image - handles X/Z drag, rotate, pinch */}
                    <ViroImage
                        source={GIZMO_RING}
                        position={[0, 0.01, 0]} // Slightly above ground to prevent z-fighting
                        rotation={[-90, 0, 0]} // Lay flat on ground
                        scale={[ringSize, ringSize, ringSize]}
                        opacity={this.state.ringActive ? 1.0 : 0.8}
                        onDrag={this._onRingDrag}
                        onRotate={this._onRingRotate}
                        onPinch={this._onRingPinch}
                        dragType="FixedToPlane"
                        dragPlane={{
                            planePoint: [0, 0, 0],
                            planeNormal: [0, 1, 0], // Constrain to XZ plane (horizontal movement)
                            maxDistance: 10,
                        }}
                    />
                </ViroNode>

                {/* Vertical stem connecting ring to object */}
                {yOffset > 0.05 && (
                    <ViroPolyline
                        points={[
                            [0, -yOffset + 0.02, 0], // Bottom (at ring)
                            [0, -0.02, 0],          // Top (at object base)
                        ]}
                        thickness={0.005}
                        materials={['gizmoStem']}
                    />
                )}
            </ViroNode>
        );
    },
});

module.exports = ObjectGizmo;

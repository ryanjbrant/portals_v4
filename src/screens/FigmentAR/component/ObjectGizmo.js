/**
 * ObjectGizmo.js
 * 
 * Gizmo control handles for precision positioning and rotation of AR objects.
 * - Y-axis handle: Drag to lift/lower object vertically
 * - X-axis handle: Drag to rotate object around Y-axis
 */
'use strict';

import React from 'react';
import {
    ViroNode,
    ViroSphere,
    ViroBox,
    ViroMaterials,
} from '@reactvision/react-viro';

// Create gizmo materials
ViroMaterials.createMaterials({
    gizmoWhite: {
        diffuseColor: '#FFFFFF',
        lightingModel: 'Constant',
    },
    gizmoYellow: {
        diffuseColor: '#FFFF00',
        lightingModel: 'Constant',
    },
});

var createReactClass = require('create-react-class');

/**
 * ObjectGizmo Component
 * 
 * Props:
 * - onYAxisDrag: (deltaY) => void - Called when Y handle is dragged
 * - onXAxisDrag: (deltaRotation) => void - Called when X handle is dragged (rotation)
 * - scale: number - Base scale for gizmo size (default 0.5)
 */
var ObjectGizmo = createReactClass({
    getInitialState() {
        return {
            yHandleActive: false,
            xHandleActive: false,
            initialYDragPos: null,
            initialXDragPos: null,
        };
    },

    // Y-axis handle drag - controls vertical position
    _onYHandleDrag(dragState, position, source) {
        if (dragState === 1) {
            // Drag started - capture initial position
            this.setState({
                yHandleActive: true,
                initialYDragPos: position[1],
            });
        } else if (dragState === 2) {
            // Dragging - calculate delta Y
            if (this.state.initialYDragPos !== null && this.props.onYAxisDrag) {
                const deltaY = position[1] - this.state.initialYDragPos;
                this.props.onYAxisDrag(deltaY);
                // Update initial position for continuous drag
                this.setState({ initialYDragPos: position[1] });
            }
        } else if (dragState === 3) {
            // Drag ended
            this.setState({
                yHandleActive: false,
                initialYDragPos: null,
            });
        }
    },

    // X-axis handle drag - controls Y rotation
    _onXHandleDrag(dragState, position, source) {
        if (dragState === 1) {
            // Drag started
            this.setState({
                xHandleActive: true,
                initialXDragPos: position[0],
            });
        } else if (dragState === 2) {
            // Dragging - map X movement to rotation
            if (this.state.initialXDragPos !== null && this.props.onXAxisDrag) {
                const deltaX = position[0] - this.state.initialXDragPos;
                // Convert X movement to rotation (multiply by sensitivity factor)
                const rotationDelta = deltaX * 50; // 50 degrees per meter of drag
                this.props.onXAxisDrag(rotationDelta);
                // Update initial position for continuous drag
                this.setState({ initialXDragPos: position[0] });
            }
        } else if (dragState === 3) {
            // Drag ended
            this.setState({
                xHandleActive: false,
                initialXDragPos: null,
            });
        }
    },

    render() {
        const gizmoScale = this.props.scale || 0.5;
        const handleRadius = 0.08 * gizmoScale;
        const barThickness = 0.02 * gizmoScale;
        const barLength = 0.4 * gizmoScale;

        return (
            <ViroNode>
                {/* Y-Axis (Vertical) - bar and handle */}
                <ViroNode position={[0, barLength / 2, 0]}>
                    {/* Vertical bar */}
                    <ViroBox
                        position={[0, 0, 0]}
                        scale={[barThickness, barLength, barThickness]}
                        materials={['gizmoWhite']}
                    />
                    {/* Y-axis handle (sphere at top) */}
                    <ViroSphere
                        position={[0, barLength / 2 + handleRadius, 0]}
                        radius={handleRadius}
                        materials={[this.state.yHandleActive ? 'gizmoYellow' : 'gizmoWhite']}
                        onDrag={this._onYHandleDrag}
                        dragType="FixedToPlane"
                        dragPlane={{
                            planePoint: [0, 0, 0],
                            planeNormal: [1, 0, 0], // Constrain to YZ plane (vertical movement)
                            maxDistance: 5,
                        }}
                    />
                </ViroNode>

                {/* X-Axis (Horizontal) - bar and handle for rotation */}
                <ViroNode position={[barLength / 2, 0, 0]}>
                    {/* Horizontal bar */}
                    <ViroBox
                        position={[0, 0, 0]}
                        scale={[barLength, barThickness, barThickness]}
                        materials={['gizmoWhite']}
                    />
                    {/* X-axis handle (sphere at end) */}
                    <ViroSphere
                        position={[barLength / 2 + handleRadius, 0, 0]}
                        radius={handleRadius}
                        materials={[this.state.xHandleActive ? 'gizmoYellow' : 'gizmoWhite']}
                        onDrag={this._onXHandleDrag}
                        dragType="FixedToPlane"
                        dragPlane={{
                            planePoint: [0, 0, 0],
                            planeNormal: [0, 1, 0], // Constrain to XZ plane (horizontal movement)
                            maxDistance: 5,
                        }}
                    />
                </ViroNode>
            </ViroNode>
        );
    },
});

module.exports = ObjectGizmo;

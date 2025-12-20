/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 */
import * as LoadingConstants from '../redux/LoadingStateConstants';

/**
 * Custom Lighting Setups - Replaces HDRI with configurable multi-light rigs
 * Each setup defines an array of lights with their properties
 * 
 * Light types: 'spot', 'ambient', 'directional'
 * Colors: Use hex values
 * Position: [x, y, z] - x=right, y=up, z=forward (toward camera)
 * Direction: [x, y, z] - normalized vector pointing toward target
 */

const LIGHTING_SETUPS = {
    // 1. Multi-Side Light Setup
    'studio-09': {
        name: 'Multi-Side Lights',
        ambientIntensity: 100,
        ambientColor: '#ffffff',
        lights: [
            // Front key light - main illumination from camera area
            { type: 'spot', position: [1, 4, 3], direction: [-0.2, -0.6, -0.8], color: '#fff8f0', intensity: 600, innerAngle: 20, outerAngle: 60, castsShadow: true, shadowOpacity: 0.3 },
            // Side light right
            { type: 'spot', position: [4, 3, 0], direction: [-0.9, -0.4, 0], color: '#fff8f0', intensity: 600, innerAngle: 15, outerAngle: 50 },
            // Side light left
            { type: 'spot', position: [-4, 3, 0], direction: [0.9, -0.4, 0], color: '#e6f0ff', intensity: 600, innerAngle: 15, outerAngle: 50 },
            // Rear rim light
            { type: 'spot', position: [0, 3, -3], direction: [0, -0.3, 1], color: '#e6f0ff', intensity: 800, innerAngle: 20, outerAngle: 60 },
        ]
    },

    // 2. Classic Three-Point Setup (what we just made)
    'studio-08': {
        name: 'Three-Point Classic',
        ambientIntensity: 50,
        ambientColor: '#fff5e6',
        lights: [
            // Key light - above right, warm pearl
            { type: 'spot', position: [2, 8, 1], direction: [-0.3, -0.8, -0.5], color: '#fff8f0', intensity: 1200, innerAngle: 10, outerAngle: 45, castsShadow: true, shadowOpacity: 0.4 },
            // Rim light - cool back light
            { type: 'spot', position: [0, 3, -3], direction: [0, -0.3, 1], color: '#e6f0ff', intensity: 2400, innerAngle: 15, outerAngle: 50 },
            // Fill light (directional)
            { type: 'directional', direction: [0, -1, -0.2], color: '#ffffff' },
        ]
    },

    // 3. High Contrast Drama - Two wide spotlights for even side lighting
    'studio-05': {
        name: 'High Contrast Drama',
        ambientIntensity: 30,
        ambientColor: '#ffffff',
        lights: [
            // Right side spotlight - very wide cone
            { type: 'spot', position: [8, 4, 0], direction: [-1, -0.2, 0], color: '#fff8f0', intensity: 1500, innerAngle: 40, outerAngle: 90 },
            // Left side spotlight - very wide cone
            { type: 'spot', position: [-8, 4, 0], direction: [1, -0.2, 0], color: '#e6f0ff', intensity: 1500, innerAngle: 40, outerAngle: 90 },
        ]
    },

    // 4. Product Studio Sidelight Simulator
    'studio-03': {
        name: 'Product Studio',
        ambientIntensity: 50,
        ambientColor: '#ffffff',
        lights: [
            // 3 lights 90 deg right
            { type: 'spot', position: [4, 0, 0], direction: [-1, 0, 0], color: '#ffffff', intensity: 600, innerAngle: 20, outerAngle: 60 },
            { type: 'spot', position: [4, 1.5, 0], direction: [-1, 0, 0], color: '#ffffff', intensity: 600, innerAngle: 20, outerAngle: 60 },
            { type: 'spot', position: [4, 3, 0], direction: [-1, 0, 0], color: '#ffffff', intensity: 600, innerAngle: 20, outerAngle: 60 },
            // 3 lights 90 deg left
            { type: 'spot', position: [-4, 0, 0], direction: [1, 0, 0], color: '#ffffff', intensity: 600, innerAngle: 20, outerAngle: 60 },
            { type: 'spot', position: [-4, 1.5, 0], direction: [1, 0, 0], color: '#ffffff', intensity: 600, innerAngle: 20, outerAngle: 60 },
            { type: 'spot', position: [-4, 3, 0], direction: [1, 0, 0], color: '#ffffff', intensity: 600, innerAngle: 20, outerAngle: 60 },
        ]
    },

    // 5. Studio Window Gobo Simulator
    'studio-02': {
        name: 'Window Gobo',
        ambientIntensity: 80,
        ambientColor: '#fff5e6',
        lights: [
            // 4 lights in a square top right (simulating window panels)
            { type: 'spot', position: [2, 5, 1], direction: [-0.3, -0.8, -0.3], color: '#fffaf0', intensity: 200, innerAngle: 8, outerAngle: 25 },
            { type: 'spot', position: [3, 5, 1], direction: [-0.4, -0.8, -0.3], color: '#fffaf0', intensity: 200, innerAngle: 8, outerAngle: 25 },
            { type: 'spot', position: [2, 6, 1], direction: [-0.3, -0.85, -0.3], color: '#fffaf0', intensity: 200, innerAngle: 8, outerAngle: 25 },
            { type: 'spot', position: [3, 6, 1], direction: [-0.4, -0.85, -0.3], color: '#fffaf0', intensity: 200, innerAngle: 8, outerAngle: 25 },
            // Far right behind character (rim)
            { type: 'spot', position: [3, 2, -3], direction: [-0.3, -0.2, 0.9], color: '#e6f0ff', intensity: 800, innerAngle: 15, outerAngle: 50 },
        ]
    },

    // 6. Softbox Simulator
    'cyclorama': {
        name: 'Softbox Ring',
        ambientIntensity: 60,
        ambientColor: '#ffffff',
        lights: [
            // North (front)
            { type: 'spot', position: [0, 1.5, 3], direction: [0, -0.2, -1], color: '#ffffff', intensity: 250, innerAngle: 25, outerAngle: 70, castsShadow: true, shadowOpacity: 0.2 },
            // East (right)
            { type: 'spot', position: [3, 1.5, 0], direction: [-1, -0.2, 0], color: '#ffffff', intensity: 250, innerAngle: 25, outerAngle: 70, castsShadow: true, shadowOpacity: 0.2 },
            // South (back)
            { type: 'spot', position: [0, 1.5, -3], direction: [0, -0.2, 1], color: '#ffffff', intensity: 250, innerAngle: 25, outerAngle: 70, castsShadow: true, shadowOpacity: 0.2 },
            // West (left)
            { type: 'spot', position: [-3, 1.5, 0], direction: [1, -0.2, 0], color: '#ffffff', intensity: 250, innerAngle: 25, outerAngle: 70, castsShadow: true, shadowOpacity: 0.2 },
            // Top light
            { type: 'spot', position: [0, 6, 0], direction: [0, -1, 0], color: '#ffffff', intensity: 300, innerAngle: 30, outerAngle: 80, castsShadow: true, shadowOpacity: 0.3 },
        ]
    },
};

// List items for the picker (keeping same structure for UI compatibility)
const LightingItems = [
    {
        "name": "studio-09",
        "displayName": "Multi-Side Lights",
        "icon_img": require("../../../../assets/hdri/SoftboxStudio.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "studio-08",
        "displayName": "Three-Point Classic",
        "icon_img": require("../../../../assets/hdri/StudioGlow.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "studio-05",
        "displayName": "High Contrast Drama",
        "icon_img": require("../../../../assets/hdri/TwoGlows.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "studio-03",
        "displayName": "Product Studio",
        "icon_img": require("../../../../assets/hdri/Stripes.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "studio-02",
        "displayName": "Window Gobo",
        "icon_img": require("../../../../assets/hdri/windowStudio.jpg"),
        "loading": LoadingConstants.NONE,
    },
    {
        "name": "cyclorama",
        "displayName": "Softbox Ring",
        "icon_img": require("../../../../assets/hdri/LightTentReflection.jpg"),
        "loading": LoadingConstants.NONE,
    }
];

module.exports = {
    getLightingArray: function () {
        return LightingItems;
    },
    // Legacy - returns null now since we use custom lighting
    getHDRISource: function (name) {
        return null;
    },
    // New - returns lighting setup configuration
    getLightingSetup: function (name) {
        return LIGHTING_SETUPS[name];
    }
};

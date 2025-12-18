/**
 * Audio Items Model
 * 
 * Defines audio types and factory functions for creating audio items
 * in the Figment AR editor.
 * 
 * Supports:
 * - ViroSound (mono/stereo)
 * - ViroSoundField (ambisonic 360°)
 * - ViroSpatialSound (3D positioned with distance attenuation)
 */
'use strict';

import { v4 as uuidv4 } from 'uuid';

// Audio type constants
export const AUDIO_TYPES = {
    SOUND: 'sound',           // ViroSound - standard mono/stereo
    SOUND_FIELD: 'soundfield', // ViroSoundField - ambisonic 360
    SPATIAL: 'spatial',        // ViroSpatialSound - 3D positioned
};

// Rolloff models for spatial audio
export const ROLLOFF_MODELS = {
    NONE: 'None',
    LINEAR: 'Linear',
    LOGARITHMIC: 'Logarithmic',
};

/**
 * Creates a new audio item with default values
 * @param {object} source - Audio source { uri: string }
 * @param {string} type - One of AUDIO_TYPES values
 * @param {object} options - Optional configuration overrides
 * @returns {object} Audio item object
 */
export function createAudioItem(source, type = AUDIO_TYPES.SPATIAL, options = {}) {
    return {
        uuid: uuidv4(),
        source: source, // { uri: string }
        type: type,

        // Transform properties (for spatial audio positioning)
        position: options.position || [0, 0, -2],
        rotation: options.rotation || [0, 0, 0],
        scale: options.scale || [1, 1, 1],

        // Playback properties
        volume: options.volume !== undefined ? options.volume : 1.0,
        loop: options.loop !== undefined ? options.loop : true,
        muted: options.muted !== undefined ? options.muted : false,
        paused: options.paused !== undefined ? options.paused : false,

        // Spatial audio properties
        minDistance: options.minDistance || 1,
        maxDistance: options.maxDistance || 10,
        rolloffModel: options.rolloffModel || ROLLOFF_MODELS.LOGARITHMIC,

        // State flags
        selected: false,
        loading: 'LOADED',
        isFromDraft: false,
    };
}

/**
 * Default preloaded sounds for quick access
 * Can be extended with bundled audio assets
 */
export const PRESET_SOUNDS = [
    // Add preset sounds here if needed
    // { name: 'Ambient Forest', source: require('../res/audio/forest.mp3'), type: AUDIO_TYPES.SPATIAL },
];

export default {
    AUDIO_TYPES,
    ROLLOFF_MODELS,
    createAudioItem,
    PRESET_SOUNDS,
};

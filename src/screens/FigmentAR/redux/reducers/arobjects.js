/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */
import * as ModelData from '../../model/ModelItems';
import * as PortalData from '../../model/PortalItems';
import * as EffectData from '../../model/EffectItems';
import * as LoadingConstants from '../LoadingStateConstants';
import * as EffectsConstants from '../EffectsConstants';
import * as PSConstants from '../../component/PSConstants';

/**
 * Reducers for handling state or AR objects (Objects, Portals, Effects) in the AR Scene
 */
// Basic UUID generator to replace missing uuid/v1
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Initial state of the app with empty models, portals and showing no emitters / post proccessing effect
const initialState = {
  modelItems: {},
  portalItems: {},
  mediaItems: {}, // Added for user-selected photos/videos
  audioItems: {}, // Added for audio (ViroSound, ViroSoundField, ViroSpatialSound)
  effectItems: EffectData.getInitEffectArray(),
  postProcessEffects: EffectsConstants.EFFECT_NONE,
}

// Creates a new model item with the given index from the data model in ModelItems.js
function newModelItem(indexToCreate) {
  return {
    uuid: uuidv4(),
    selected: false,
    loading: LoadingConstants.NONE,
    index: indexToCreate,
    // CRITICAL: Include defaults for serialization
    position: [0, 0, -1],
    rotation: [0, 0, 0],
    scale: [0.5, 0.5, 0.5], // Default scale for models
  };
}

// Creates a new media item (video/image)
function newMediaItem(source, type, width, height) {
  return {
    uuid: uuidv4(),
    selected: false,
    loading: LoadingConstants.LOADED, // Assumed loaded as it's local
    source: source,
    type: type,
    scale: [1, 1, 1],
    position: [0, 0, -1],
    rotation: [0, 0, 0], // Default rotation
    width: width || 1, // Default 1
    height: height || 1 // Default 1
  };
}

// action to change state of individual ListView items between NONE, LOADING, ERROR, LOADED (path: js/redux/LoadingStateConstants.js)
function changeLoadState(state = {}, action) {
  switch (action.type) {
    case 'CHANGE_MODEL_LOAD_STATE':
      return {
        ...state,
        loading: action.loadState,
      };
    default:
      return state;
  }
}

// change the background of a given portal (identified by uuid) in the scene.
function changePortalPhoto(state = {}, action) {
  switch (action.type) {
    case 'CHANGE_PORTAL_PHOTO':
      if (state[action.uuid] != null && state[action.uuid] != undefined) {
        // Return a NEW object to trigger Redux re-render (immutable update)
        return {
          ...state,
          [action.uuid]: {
            ...state[action.uuid],
            portal360Image: { ...action.photoSource }
          }
        };
      }
      return state;
    default:
      return state;
  }
}

// change effect selection in the Effects Listview (changes which effect has pink border around it)
function modifyEffectSelection(state = [], action) {
  switch (action.type) {
    case 'TOGGLE_EFFECT_SELECTED':
      var effectToggleArray = [];
      // for each effect in the listview, set selected = false for everything, except for the selected index (action.index)
      for (var i = 0; i < state.length; i++) {
        if (i != action.index) {
          state[i].selected = false;
        } else {
          if (!state[i].selected) {
            state[i].selected = true;
          } // else if this effect was already selected; do nothing
        }
        effectToggleArray.push(state[i]);
      }
      return effectToggleArray;
    case 'REMOVE_ALL':
      // reset selected = false for every effect
      var effectToggleArray = [];
      for (var i = 0; i < state.length; i++) {
        state[i].selected = false;
        effectToggleArray.push(state[i]);
      }
      return effectToggleArray;
  }
}

// Creates a new custom/remote model item
function newCustomModelItem(modelData) {
  // Derive ViroReact type from file extension
  const ext = modelData.extension?.toLowerCase() || 'glb';
  let viroType = 'GLB'; // default
  if (ext === 'vrx') viroType = 'VRX';
  else if (ext === 'obj') viroType = 'OBJ';
  else if (ext === 'gltf' || ext === 'glb') viroType = 'GLB';

  return {
    uuid: uuidv4(),
    selected: false,
    loading: LoadingConstants.NONE, // Let Viro handle loading state
    index: -1, // Indicates custom model
    // Store source directly
    source: { uri: modelData.uri },
    type: viroType,
    name: modelData.name,
    // CRITICAL: Include ALL transform fields for serialization
    scale: [1.0, 1.0, 1.0], // Default scale for custom models
    position: [0, 0, -1], // Will be updated by hit test
    rotation: [0, 0, 0], // Default rotation
    resources: [], // Remote GLB is self-contained
    materials: null, // Let GLB use its own materials/textures
    animation: { name: "02", delay: 0, loop: true, run: true },
  };
}

// Add model at the given index to the AR Scene
function addModelItem(state = {}, action) {
  var model = newModelItem(action.index);
  state[model.uuid] = model;
  return state;
}

// Add custom model to the AR Scene
function addCustomModelItem(state = {}, action) {
  var model = newCustomModelItem(action.modelData);
  state[model.uuid] = model;
  return state;
}

// Remove model with given UUID from the AR Scene
// Instead of deleting, mark as hidden to avoid native crash on unmount
function removeModelItem(state = {}, action) {
  if (state[action.uuid] != null && state[action.uuid] != undefined) {
    let newState = { ...state };
    newState[action.uuid] = { ...state[action.uuid], hidden: true };
    return newState;
  }
  return state;
}

// Add media item to the scene
function addMediaItem(state = {}, action) {
  var media = newMediaItem(action.source, action.mediaType, action.width, action.height);
  // Return a NEW object with the added item (Immutable update)
  return {
    ...state,
    [media.uuid]: media
  };
}

// Remove media item
function removeMediaItem(state = {}, action) {
  if (state[action.uuid] != null && state[action.uuid] != undefined) {
    let newState = { ...state };
    newState[action.uuid] = { ...state[action.uuid], hidden: true };
    return newState;
  }
  return state;
}

// Mark all items as hidden
function hideAllItems(state = {}) {
  let newState = {};
  Object.keys(state).forEach((key) => {
    if (state[key] != null && state[key] != undefined) {
      newState[key] = { ...state[key], hidden: true };
    }
  });
  return newState;
}

// Change state of individual ListView items between NONE, LOADING, ERROR, LOADED
function modifyLoadState(state = {}, action) {
  if (state[action.uuid] != null || state[action.uuid] != undefined) {
    var model = state[action.uuid];
    var newModel = { ...model };
    newModel.loading = action.loadState;
    state[action.uuid] = newModel;
  }
  return state;
}

function arobjects(state = initialState, action) {
  switch (action.type) {

    case 'ADD_MODEL':
      return {
        ...state,
        modelItems: { ...addModelItem(state.modelItems, action) },
      }
    case 'ADD_CUSTOM_MODEL':
      return {
        ...state,
        modelItems: { ...addCustomModelItem(state.modelItems, action) },
      }
    case 'REMOVE_MODEL':
      return {
        ...state,
        modelItems: { ...removeModelItem(state.modelItems, action) },
      }
    case 'ADD_MEDIA':
      console.log('[Reducer] ADD_MEDIA: Adding item');
      return {
        ...state,
        mediaItems: { ...addMediaItem(state.mediaItems, action) },
      }
    case 'REMOVE_MEDIA':
      return {
        ...state,
        mediaItems: { ...removeMediaItem(state.mediaItems, action) },
      }
    case 'ADD_AUDIO':
      console.log('[Reducer] ADD_AUDIO: Adding audio item');
      const newAudioItem = {
        uuid: action.uuid || uuidv4(),
        selected: false,
        loading: LoadingConstants.LOADED,
        source: action.source,
        type: action.audioType || 'spatial', // 'sound', 'soundfield', 'spatial'
        position: action.position || [0, 0, -2],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        volume: action.volume !== undefined ? action.volume : 1.0,
        loop: action.loop !== undefined ? action.loop : true,
        muted: false,
        paused: false,
        minDistance: action.minDistance || 1,
        maxDistance: action.maxDistance || 10,
        rolloffModel: action.rolloffModel || 'Logarithmic',
      };
      return {
        ...state,
        audioItems: {
          ...state.audioItems,
          [newAudioItem.uuid]: newAudioItem,
        },
      }
    case 'REMOVE_AUDIO':
      const audioToRemove = { ...state.audioItems };
      delete audioToRemove[action.uuid];
      return {
        ...state,
        audioItems: audioToRemove,
      }
    case 'ADD_PORTAL':
      return {
        ...state,
        portalItems: { ...addModelItem(state.portalItems, action) },
      }
    case 'REMOVE_PORTAL':
      return {
        ...state,
        portalItems: { ...removeModelItem(state.portalItems, action) },
      }
    case 'REMOVE_ALL':
      // Clear all items completely (not just hide) to prevent conflicts with new scenes
      var updatedEffects = modifyEffectSelection(state.effectItems.slice(0), action);
      return {
        ...state,
        portalItems: {}, // Clear completely
        modelItems: {}, // Clear completely
        effectItems: updatedEffects.slice(0),
        postProcessEffects: EffectsConstants.EFFECT_NONE,
        mediaItems: {}, // Clear completely
        audioItems: {}, // Clear audio items
      }
    case 'LOAD_SCENE':
      // Rebuild state from saved scene manifest
      // action.sceneData contains { objects: [...], postProcessEffects, hdriBackground }
      const loadedModels = {};
      const loadedPortals = {};
      const loadedMedia = {};
      const loadedAudio = {};

      // Find the NEAREST object (highest Z value since Z is negative in front of camera)
      // We'll anchor the nearest object at a comfortable viewing distance, preserving relative depths
      let nearestX = 0, nearestZ = -Infinity; // Start with far away
      let centerX = 0;
      let objectCount = 0;

      if (action.sceneData?.objects) {
        action.sceneData.objects.forEach(obj => {
          if (obj?.position && Array.isArray(obj.position)) {
            centerX += obj.position[0];
            objectCount++;
            // Track the nearest object (highest Z, closest to 0)
            if (obj.position[2] > nearestZ) {
              nearestZ = obj.position[2];
              nearestX = obj.position[0];
            }
          }
        });
      }

      if (objectCount > 0) {
        centerX /= objectCount;
      }

      // NO RECENTERING - Load objects at their exact saved positions
      // The user's scene arrangement is preserved exactly as saved
      const offsetX = 0;
      const offsetY = 0;
      const offsetZ = 0;

      console.log('[LOAD_SCENE] Loading objects at exact saved positions (no recentering)');

      if (action.sceneData?.objects) {
        action.sceneData.objects.forEach(obj => {
          // Skip objects without required fields
          if (!obj || !obj.id || !obj.type) {
            console.warn('[LOAD_SCENE] Skipping invalid object:', obj);
            return;
          }

          // Helper to parse transforms that might be strings or arrays
          const parseTransform = (val, defaultVal) => {
            if (!val) return defaultVal;
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return parsed;
              } catch (e) {
                console.warn('[LOAD_SCENE] Failed to parse transform string:', val);
              }
            }
            return defaultVal;
          };

          if (obj.type === 'viro_model') {
            const isCustom = obj.modelIndex < 0 || obj.uri;

            // Parse transforms - may be strings from JSON
            const position = parseTransform(obj.position, [0, 0, -1]);
            const rotation = parseTransform(obj.rotation, [0, 0, 0]);
            const scale = parseTransform(obj.scale, [1, 1, 1]);

            console.log('[LOAD_SCENE] Loading model item:', {
              id: obj.id,
              rawPosition: obj.position,
              rawPositionType: typeof obj.position,
              parsedPosition: position,
            });

            loadedModels[obj.id] = {
              uuid: obj.id,
              selected: false,
              loading: LoadingConstants.LOADED,
              isFromDraft: true, // Explicit flag for draft-loaded items
              index: isCustom ? -1 : obj.modelIndex,
              // Custom model properties
              source: isCustom ? { uri: obj.uri } : undefined,
              type: obj.modelType || 'GLB',
              name: obj.name,
              // Transform properties - apply offset to recenter
              position: [
                position[0] + offsetX,
                position[1] + offsetY,
                position[2] + offsetZ,
              ],
              rotation: rotation,
              scale: scale,
              // Animation
              animation: obj.animation || { name: "02", delay: 0, loop: true, run: true },
              materials: obj.materials,
              physics: obj.physics,
              resources: [],
            };
          } else if (obj.type === 'viro_portal') {
            loadedPortals[obj.id] = {
              uuid: obj.id,
              selected: false,
              loading: LoadingConstants.LOADED,
              isFromDraft: true, // Explicit flag for draft-loaded items
              index: obj.portalIndex,
              portal360Image: obj.portal360Image,
              position: obj.position ? [
                obj.position[0] + offsetX,
                obj.position[1] + offsetY,
                obj.position[2] + offsetZ,
              ] : [0, 0, -2],
              rotation: obj.rotation || [0, 0, 0],
              scale: obj.scale || [1, 1, 1],
            };
          } else if (obj.type === 'image' || obj.type === 'video') {
            console.log('[LOAD_SCENE] Loading media item:', {
              id: obj.id,
              position: obj.position,
              rotation: obj.rotation,
              scale: obj.scale,
            });
            loadedMedia[obj.id] = {
              uuid: obj.id,
              selected: false,
              loading: LoadingConstants.LOADED,
              isFromDraft: true, // Explicit flag for draft-loaded items
              source: { uri: obj.uri },
              type: (obj.type || 'image').toUpperCase(),
              position: obj.position ? [
                obj.position[0] + offsetX,
                obj.position[1] + offsetY,
                obj.position[2] + offsetZ,
              ] : [0, 0, -1],
              rotation: obj.rotation || [0, 0, 0],
              scale: obj.scale || [1, 1, 1],
              width: obj.width || 1,
              height: obj.height || 1,
              autoplay: obj.autoplay ?? true,
              loop: obj.loop ?? true,
            };
          } else if (obj.type === 'audio') {
            // Load audio item
            console.log('[LOAD_SCENE] Loading audio item:', {
              id: obj.id,
              audioType: obj.audioType,
              position: obj.position,
            });
            loadedAudio[obj.id] = {
              uuid: obj.id,
              selected: false,
              loading: LoadingConstants.LOADED,
              isFromDraft: true,
              source: { uri: obj.uri },
              type: obj.audioType || 'spatial',
              position: obj.position ? [
                obj.position[0] + offsetX,
                obj.position[1] + offsetY,
                obj.position[2] + offsetZ,
              ] : [0, 0, -2],
              rotation: obj.rotation || [0, 0, 0],
              scale: obj.scale || [1, 1, 1],
              volume: obj.volume !== undefined ? obj.volume : 1.0,
              loop: obj.loop !== undefined ? obj.loop : true,
              muted: false,
              paused: false,
              minDistance: obj.minDistance || 1,
              maxDistance: obj.maxDistance || 10,
              rolloffModel: obj.rolloffModel || 'Logarithmic',
            };
          }
        });
      }

      return {
        ...state,
        modelItems: loadedModels,
        portalItems: loadedPortals,
        mediaItems: loadedMedia,
        audioItems: loadedAudio,
        postProcessEffects: action.sceneData?.postProcessEffects || EffectsConstants.EFFECT_NONE,
      }
    case 'CHANGE_MODEL_LOAD_STATE':
      return {
        ...state,
        modelItems: { ...modifyLoadState(state.modelItems, action) },
      }
    case 'CHANGE_PORTAL_LOAD_STATE':
      return {
        ...state,
        portalItems: { ...modifyLoadState(state.portalItems, action) },
      }
    case 'CHANGE_PORTAL_PHOTO':
      return {
        ...state,
        portalItems: { ...changePortalPhoto(state.portalItems, action) },
      }
    case 'TOGGLE_EFFECT_SELECTED':
      var updatedEffects = modifyEffectSelection(state.effectItems.slice(0), action);
      return {
        ...state,
        effectItems: updatedEffects.slice(0),
        postProcessEffects: updatedEffects[action.index].postProcessEffects,
      }
    case 'UPDATE_MODEL_TRANSFORMS':
      // Sync component transforms back to Redux for serialization
      const modelToUpdate = state.modelItems[action.uuid];
      if (!modelToUpdate) return state;
      return {
        ...state,
        modelItems: {
          ...state.modelItems,
          [action.uuid]: {
            ...modelToUpdate,
            position: action.position || modelToUpdate.position,
            rotation: action.rotation || modelToUpdate.rotation,
            scale: action.scale || modelToUpdate.scale,
          }
        }
      }
    case 'UPDATE_MEDIA_TRANSFORMS':
      // Sync media component transforms back to Redux
      const mediaToUpdate = state.mediaItems[action.uuid];
      if (!mediaToUpdate) return state;
      return {
        ...state,
        mediaItems: {
          ...state.mediaItems,
          [action.uuid]: {
            ...mediaToUpdate,
            position: action.position || mediaToUpdate.position,
            rotation: action.rotation || mediaToUpdate.rotation,
            scale: action.scale || mediaToUpdate.scale,
          }
        }
      }
    case 'UPDATE_PORTAL_TRANSFORMS':
      // Sync portal component transforms back to Redux
      const portalToUpdate = state.portalItems[action.uuid];
      if (!portalToUpdate) return state;
      return {
        ...state,
        portalItems: {
          ...state.portalItems,
          [action.uuid]: {
            ...portalToUpdate,
            position: action.position || portalToUpdate.position,
            rotation: action.rotation || portalToUpdate.rotation,
            scale: action.scale || portalToUpdate.scale,
          }
        }
      }
    case 'UPDATE_AUDIO_TRANSFORMS':
      // Sync audio component transforms back to Redux
      const audioToUpdate = state.audioItems[action.uuid];
      if (!audioToUpdate) return state;
      return {
        ...state,
        audioItems: {
          ...state.audioItems,
          [action.uuid]: {
            ...audioToUpdate,
            position: action.position || audioToUpdate.position,
            rotation: action.rotation || audioToUpdate.rotation,
            scale: action.scale || audioToUpdate.scale,
          }
        }
      }
    default:
      return state;
  }
}

module.exports = arobjects;

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
  objectAnimations: {}, // Added for JS-driven animations (keyed by UUID)
  objectEmitters: {}, // Added for particle emitters (keyed by UUID)
  objectPhysics: {}, // Added for physics settings (keyed by UUID)
  // AR Paint state
  paintStrokes: [], // Completed paint strokes
  activePaintPoints: [], // Points in current stroke being drawn
  paintColor: '#FF3366',
  paintBrushType: 'tube', // 'texture' | 'tube' | 'particle'
  // Camera state for device painting
  cameraTransform: {
    position: [0, 0, 0],
    forward: [0, 0, -1],
    up: [0, 1, 0],
  },
}

// Creates a new model item with the given index from the data model in ModelItems.js
function newModelItem(indexToCreate) {
  // Get the model data to extract the name
  const modelArray = ModelData.getModelArray();
  const modelData = modelArray[indexToCreate] || {};
  const modelName = modelData.name || 'Object';

  return {
    uuid: uuidv4(),
    selected: false,
    loading: LoadingConstants.NONE,
    index: indexToCreate,
    name: modelName, // Use actual model name (Sphere, Cube, Emoji, etc.)
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
    // Use discovered animation name from GLB parser, or fallback to 'Main' (C4D default)
    animation: {
      name: modelData.discoveredAnimationName || "Main",
      delay: 0,
      loop: true,
      run: true
    },
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
              artifact: obj.artifact || null,
              resources: [],
              parentId: obj.parentId || null, // Parent-child hierarchy
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
        objectAnimations: action.sceneData?.objectAnimations || {}, // Restore animation states
        objectEmitters: action.sceneData?.objectEmitters || {}, // Restore emitter states
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
    case 'UPDATE_MODEL_ARTIFACT':
      console.log('[arobjects.js REDUCER] UPDATE_MODEL_ARTIFACT:', {
        uuid: action.uuid,
        artifact: action.artifact,
        modelExists: !!state.modelItems[action.uuid],
      });
      if (state.modelItems[action.uuid]) {
        const result = {
          ...state,
          modelItems: {
            ...state.modelItems,
            [action.uuid]: {
              ...state.modelItems[action.uuid],
              artifact: action.artifact,
            }
          }
        };
        console.log('[arobjects.js REDUCER] Updated modelItem artifact:', result.modelItems[action.uuid].artifact);
        return result;
      }
      console.warn('[arobjects.js REDUCER] Model not found for UUID:', action.uuid);
      return state;

    case 'UPDATE_OBJECT_ANIMATION':
      console.log('[arobjects.js REDUCER] UPDATE_OBJECT_ANIMATION:', {
        uuid: action.uuid,
        animationType: action.animationType,
        animationData: action.animationData,
      });
      return {
        ...state,
        objectAnimations: {
          ...state.objectAnimations,
          [action.uuid]: {
            ...(state.objectAnimations?.[action.uuid] || {}),
            [action.animationType]: action.animationData,
          },
        },
      };

    case 'UPDATE_PATH_ANIMATION':
      console.log('[arobjects.js REDUCER] UPDATE_PATH_ANIMATION:', {
        uuid: action.uuid,
        pathData: action.pathData,
      });
      return {
        ...state,
        objectAnimations: {
          ...state.objectAnimations,
          [action.uuid]: {
            ...(state.objectAnimations?.[action.uuid] || {}),
            path: action.pathData,
          },
        },
      };

    case 'UPDATE_VERTICAL_ANIMATION':
      console.log('[arobjects.js REDUCER] UPDATE_VERTICAL_ANIMATION:', {
        uuid: action.uuid,
        verticalData: action.verticalData,
      });
      return {
        ...state,
        objectAnimations: {
          ...state.objectAnimations,
          [action.uuid]: {
            ...(state.objectAnimations?.[action.uuid] || {}),
            vertical: action.verticalData,
          },
        },
      };

    case 'UPDATE_EMITTER':
      console.log('[arobjects.js REDUCER] UPDATE_EMITTER:', {
        uuid: action.uuid,
        emitterData: action.emitterData,
      });
      return {
        ...state,
        objectEmitters: {
          ...state.objectEmitters,
          [action.uuid]: action.emitterData,
        },
      };

    // ========== ATTRACTOR/FOLLOWER SYSTEM ==========
    case 'UPDATE_ATTRACTOR_SETTINGS':
      console.log('[arobjects.js REDUCER] UPDATE_ATTRACTOR_SETTINGS:', {
        uuid: action.uuid,
        attractorData: action.attractorData,
      });
      return {
        ...state,
        objectAnimations: {
          ...state.objectAnimations,
          [action.uuid]: {
            ...(state.objectAnimations?.[action.uuid] || {}),
            attractor: {
              ...(state.objectAnimations?.[action.uuid]?.attractor || {}),
              ...action.attractorData,
            },
          },
        },
      };

    case 'UPDATE_PHYSICS_SETTINGS':
      console.log('[arobjects.js REDUCER] UPDATE_PHYSICS_SETTINGS:', {
        uuid: action.uuid,
        physicsData: action.physicsData,
      });
      return {
        ...state,
        objectPhysics: {
          ...state.objectPhysics,
          [action.uuid]: {
            ...(state.objectPhysics?.[action.uuid] || {}),
            ...action.physicsData,
          },
        },
      };

    case 'SET_OBJECT_PARENT':
      console.log('[arobjects.js REDUCER] SET_OBJECT_PARENT:', {
        uuid: action.uuid,
        parentId: action.parentId,
      });
      // Update the modelItems entry with new parentId
      const childItem = state.modelItems[action.uuid];
      if (!childItem) {
        return state;
      }

      const newParentId = action.parentId;
      const oldParentId = childItem.parentId;
      let newPosition = childItem.position || [0, 0, 0];
      let newScale = childItem.scale || [1, 1, 1];

      if (newParentId && state.modelItems[newParentId]) {
        // PARENTING: Convert child's world position to relative position
        const parentItem = state.modelItems[newParentId];
        const parentPos = parentItem.position || [0, 0, 0];
        const childPos = childItem.position || [0, 0, 0];
        const parentScale = parentItem.scale || [1, 1, 1];
        const childScale = childItem.scale || [1, 1, 1];

        // Calculate world-space offset
        const worldOffset = [
          childPos[0] - parentPos[0],
          childPos[1] - parentPos[1],
          childPos[2] - parentPos[2],
        ];

        // ViroNode applies parent scale to child positions, so we need to
        // DIVIDE the offset by parent scale to get the correct relative position
        newPosition = [
          worldOffset[0] / parentScale[0],
          worldOffset[1] / parentScale[1],
          worldOffset[2] / parentScale[2],
        ];

        // Also compensate scale: divide child scale by parent scale
        newScale = [
          childScale[0] / parentScale[0],
          childScale[1] / parentScale[1],
          childScale[2] / parentScale[2],
        ];

        console.log('[arobjects.js REDUCER] Converting to relative:', {
          childWorld: childPos,
          parentWorld: parentPos,
          worldOffset: worldOffset,
          parentScale: parentScale,
          relativePos: newPosition,
          childScale: childScale,
          compensatedScale: newScale,
        });
      } else if (!newParentId && oldParentId && state.modelItems[oldParentId]) {
        // UNPARENTING: Convert child's relative position back to world position
        const oldParentItem = state.modelItems[oldParentId];
        const parentPos = oldParentItem.position || [0, 0, 0];
        const parentScale = oldParentItem.scale || [1, 1, 1];
        const relativePos = childItem.position || [0, 0, 0];
        const relativeScale = childItem.scale || [1, 1, 1];

        // ViroNode applies parent scale to child positions, so we need to
        // MULTIPLY relative position by parent scale, then add parent position
        newPosition = [
          (relativePos[0] * parentScale[0]) + parentPos[0],
          (relativePos[1] * parentScale[1]) + parentPos[1],
          (relativePos[2] * parentScale[2]) + parentPos[2],
        ];

        // Also restore scale: multiply child scale by parent scale
        newScale = [
          relativeScale[0] * parentScale[0],
          relativeScale[1] * parentScale[1],
          relativeScale[2] * parentScale[2],
        ];

        console.log('[arobjects.js REDUCER] Converting to world:', {
          relativePos: relativePos,
          parentWorld: parentPos,
          parentScale: parentScale,
          childWorld: newPosition,
          relativeScale: relativeScale,
          restoredScale: newScale,
        });
      }

      return {
        ...state,
        modelItems: {
          ...state.modelItems,
          [action.uuid]: {
            ...state.modelItems[action.uuid],
            parentId: action.parentId,
            position: newPosition,
            scale: newScale,
          },
        },
      };

    // ========== VOICE COMMAND REDUCERS ==========

    case 'BATCH_TRANSFORM_ALL':
      // Apply batch transforms to all objects
      const batchUpdated = { ...state.modelItems };
      const uuids = Object.keys(batchUpdated);
      if (uuids.length === 0) return state;

      // Calculate center position for cluster/spread operations
      let batchCenterX = 0, batchCenterZ = -2;
      if (action.transformType === 'spread') {
        uuids.forEach(uuid => {
          const item = batchUpdated[uuid];
          if (item.position) {
            batchCenterX += item.position[0];
            batchCenterZ += item.position[2];
          }
        });
        batchCenterX /= uuids.length;
        batchCenterZ /= uuids.length;
      }

      uuids.forEach((uuid, i) => {
        const item = batchUpdated[uuid];
        const pos = item.position || [0, 0, -2];

        switch (action.transformType) {
          case 'moveUp':
            const upDist = action.params?.distance || 1;
            batchUpdated[uuid] = { ...item, position: [pos[0], pos[1] + upDist, pos[2]] };
            break;

          case 'moveDown':
            const downDist = action.params?.distance || 1;
            batchUpdated[uuid] = { ...item, position: [pos[0], pos[1] - downDist, pos[2]] };
            break;

          case 'moveToFloor':
            batchUpdated[uuid] = { ...item, position: [pos[0], 0, pos[2]] };
            break;

          case 'liftInAir':
            const liftHeight = action.params?.height || 1.5;
            batchUpdated[uuid] = { ...item, position: [pos[0], liftHeight, pos[2]] };
            break;

          case 'cluster':
            // Move all to center point
            const clusterCenter = action.params?.center || [0, pos[1], -2];
            batchUpdated[uuid] = { ...item, position: clusterCenter };
            break;

          case 'spread':
            // Push away from center
            const spreadFactor = action.params?.factor || 2;
            const dx = pos[0] - batchCenterX;
            const dz = pos[2] - batchCenterZ;
            batchUpdated[uuid] = {
              ...item,
              position: [batchCenterX + dx * spreadFactor, pos[1], batchCenterZ + dz * spreadFactor]
            };
            break;

          case 'randomScale':
            const minS = action.params?.min || 0.1;
            const maxS = action.params?.max || 1.0;
            const randScale = minS + Math.random() * (maxS - minS);
            batchUpdated[uuid] = { ...item, scale: [randScale, randScale, randScale] };
            break;

          case 'randomPosition':
            const range = action.params?.range || 2;
            batchUpdated[uuid] = {
              ...item,
              position: [
                (Math.random() - 0.5) * range * 2,
                pos[1],
                -1.5 - Math.random() * range,
              ],
            };
            break;

          case 'randomRotation':
            batchUpdated[uuid] = {
              ...item,
              rotation: [Math.random() * 360, Math.random() * 360, Math.random() * 360]
            };
            break;

          case 'uniformScale':
            const uniScale = action.params?.scale || 0.5;
            batchUpdated[uuid] = { ...item, scale: [uniScale, uniScale, uniScale] };
            break;

          case 'stack':
            // Stack objects vertically
            const stackSpacing = action.params?.spacing || 0.4;
            const stackY = i * stackSpacing;
            batchUpdated[uuid] = { ...item, position: [0, stackY, -2] };
            break;

          case 'alignX':
            batchUpdated[uuid] = { ...item, position: [0, pos[1], pos[2]] };
            break;

          case 'alignY':
            const avgY = action.params?.y || 0;
            batchUpdated[uuid] = { ...item, position: [pos[0], avgY, pos[2]] };
            break;

          case 'alignZ':
            batchUpdated[uuid] = { ...item, position: [pos[0], pos[1], -2] };
            break;

          case 'reset':
            batchUpdated[uuid] = { ...item, position: [0, 0, -2], scale: [0.3, 0.3, 0.3], rotation: [0, 0, 0] };
            break;
        }
      });

      return { ...state, modelItems: batchUpdated };

    case 'ARRANGE_FORMATION':
      // Arrange objects in geometric formations
      const formationItems = { ...state.modelItems };
      const formationUuids = Object.keys(formationItems);
      const count = formationUuids.length;
      if (count === 0) return state;

      const radius = action.params.radius || 1.5;
      const centerY = action.params.centerY || 0;
      const centerZ = action.params.centerZ || -2;

      formationUuids.forEach((uuid, i) => {
        let newPos;
        switch (action.formationType) {
          case 'ring':
          case 'circle':
            const angle = (i / count) * Math.PI * 2;
            newPos = [
              Math.cos(angle) * radius,
              centerY,
              centerZ + Math.sin(angle) * radius,
            ];
            break;
          case 'grid':
            const cols = action.params.cols || Math.ceil(Math.sqrt(count));
            const spacing = action.params.spacing || 0.5;
            const row = Math.floor(i / cols);
            const col = i % cols;
            newPos = [
              (col - (cols - 1) / 2) * spacing,
              centerY,
              centerZ - row * spacing,
            ];
            break;
          case 'line':
            const lineSpacing = action.params.spacing || 0.5;
            newPos = [
              (i - (count - 1) / 2) * lineSpacing,
              centerY,
              centerZ,
            ];
            break;
          case 'scatter':
            const scatterRange = action.params.range || 3;
            newPos = [
              (Math.random() - 0.5) * scatterRange * 2,
              centerY + Math.random() * 0.5,
              centerZ - Math.random() * scatterRange,
            ];
            break;
          default:
            newPos = formationItems[uuid].position;
        }
        formationItems[uuid] = { ...formationItems[uuid], position: newPos };
      });

      return { ...state, modelItems: formationItems };

    case 'ADD_MODEL_AT_POSITION':
      // Add model at specific position (for voice commands)
      // Use the existing newModelItem function and override position/scale
      const positionedModel = newModelItem(action.index);
      positionedModel.position = action.position || [0, 0, -2];
      positionedModel.scale = action.scale || [0.3, 0.3, 0.3];
      positionedModel.rotation = action.rotation || [0, 0, 0];

      return {
        ...state,
        modelItems: {
          ...state.modelItems,
          [positionedModel.uuid]: positionedModel,
        },
      };

    case 'TRANSFORM_OBJECT':
      // Directly transform a specific object
      const targetItem = state.modelItems[action.uuid];
      if (!targetItem) return state;

      return {
        ...state,
        modelItems: {
          ...state.modelItems,
          [action.uuid]: {
            ...targetItem,
            position: action.transforms.position || targetItem.position,
            scale: action.transforms.scale || targetItem.scale,
            rotation: action.transforms.rotation || targetItem.rotation,
          },
        },
      };

    // ============ AR Paint Actions ============
    case 'ADD_PAINT_POINT':
      console.log('[Reducer] ADD_PAINT_POINT:', action.point, 'total:', state.activePaintPoints.length + 1);
      return {
        ...state,
        activePaintPoints: [...state.activePaintPoints, action.point],
      };

    case 'ADD_PAINT_POINTS_BATCH':
      // Batched paint points for reduced bridge traffic
      if (!action.points || action.points.length === 0) return state;
      console.log('[Reducer] ADD_PAINT_POINTS_BATCH:', action.points.length, 'points');
      return {
        ...state,
        activePaintPoints: [...state.activePaintPoints, ...action.points],
      };

    case 'END_PAINT_STROKE':
      console.log('[Reducer] END_PAINT_STROKE, active points:', state.activePaintPoints.length);
      if (state.activePaintPoints.length < 2) {
        // Not enough points for a stroke
        return { ...state, activePaintPoints: [] };
      }
      const newStroke = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        points: [...state.activePaintPoints],
        color: state.paintColor,
        brushType: state.paintBrushType,
        seed: Math.floor(Math.random() * 0xFFFFFFFF),
      };
      console.log('[Reducer] Created stroke:', newStroke.id, 'with', newStroke.points.length, 'points');
      return {
        ...state,
        paintStrokes: [...state.paintStrokes, newStroke],
        activePaintPoints: [],
      };

    case 'UNDO_PAINT_STROKE':
      return {
        ...state,
        paintStrokes: state.paintStrokes.slice(0, -1),
      };

    case 'CLEAR_PAINT':
      return {
        ...state,
        paintStrokes: [],
        activePaintPoints: [],
      };

    case 'SET_PAINT_COLOR':
      return {
        ...state,
        paintColor: action.color,
      };

    case 'SET_PAINT_BRUSH':
      return {
        ...state,
        paintBrushType: action.brushType,
      };

    case 'UPDATE_CAMERA_TRANSFORM':
      return {
        ...state,
        cameraTransform: {
          position: action.position,
          forward: action.forward,
          up: action.up,
        },
      };

    default:
      return state;
  }
}

module.exports = arobjects;

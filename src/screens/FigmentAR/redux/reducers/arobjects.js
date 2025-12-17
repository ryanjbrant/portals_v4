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
  effectItems: EffectData.getInitEffectArray(),
  postProcessEffects: EffectsConstants.EFFECT_NONE,
}

// Creates a new model item with the given index from the data model in ModelItems.js
function newModelItem(indexToCreate) {
  return { uuid: uuidv4(), selected: false, loading: LoadingConstants.NONE, index: indexToCreate };
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
    scale: [1.0, 1.0, 1.0], // Larger default scale for custom models
    position: [0, 0, -1], // Will be updated by hit test
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
      //clear efffects - mark items as hidden instead of deleting
      var updatedEffects = modifyEffectSelection(state.effectItems.slice(0), action);
      return {
        ...state,
        portalItems: hideAllItems(state.portalItems),
        modelItems: hideAllItems(state.modelItems),
        effectItems: updatedEffects.slice(0),
        postProcessEffects: EffectsConstants.EFFECT_NONE,
        mediaItems: hideAllItems(state.mediaItems),
      }
    case 'LOAD_SCENE':
      // Rebuild state from saved draft data
      // action.sceneData contains { objects: [...], effects, hdri, etc }
      const loadedModels = {};
      const loadedPortals = {};
      const loadedMedia = {};

      if (action.sceneData?.objects) {
        action.sceneData.objects.forEach(obj => {
          if (obj.type === 'viro_model') {
            loadedModels[obj.id] = {
              uuid: obj.id,
              selected: obj.selected || false,
              loading: LoadingConstants.LOADED,
              index: obj.modelIndex,
            };
          } else if (obj.type === 'viro_portal') {
            loadedPortals[obj.id] = {
              uuid: obj.id,
              selected: obj.selected || false,
              loading: LoadingConstants.LOADED,
              index: obj.portalIndex,
              portal360Image: obj.portal360Image,
            };
          } else if (obj.type === 'image' || obj.type === 'video') {
            loadedMedia[obj.id] = {
              uuid: obj.id,
              selected: false,
              loading: LoadingConstants.LOADED,
              source: { uri: obj.uri },
              type: obj.type.toUpperCase(),
              position: obj.position || [0, 0, -1],
              scale: obj.scale || [1, 1, 1],
              width: obj.width || 1,
              height: obj.height || 1,
            };
          }
        });
      }

      return {
        ...state,
        modelItems: loadedModels,
        portalItems: loadedPortals,
        mediaItems: loadedMedia,
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
    default:
      return state;
  }
}

module.exports = arobjects;

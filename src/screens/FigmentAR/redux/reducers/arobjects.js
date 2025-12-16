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
function newMediaItem(source, type) {
  return {
    uuid: uuidv4(),
    selected: false,
    loading: LoadingConstants.LOADED, // Assumed loaded as it's local
    source: source,
    type: type,
    scale: [1, 1, 1],
    position: [0, 0, -1]
  };
}

// ... (existing helpers)

// Add media item to the scene
function addMediaItem(state = {}, action) {
  var media = newMediaItem(action.source, action.mediaType);
  state[media.uuid] = media;
  return state;
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

// ... (existing helpers)

function hideAllItems(state = {}) {
  let newState = {};
  Object.keys(state).forEach((key) => {
    if (state[key] != null && state[key] != undefined) {
      newState[key] = { ...state[key], hidden: true };
    }
  });
  return newState;
}

// ... (existing modifyLoadState)

function arobjects(state = initialState, action) {
  switch (action.type) {

    case 'ADD_MODEL':
      return {
        ...state,
        modelItems: { ...addModelItem(state.modelItems, action) },
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
        mediaItems: hideAllItems(state.mediaItems), // Clean up media too
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

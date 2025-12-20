/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
import React, { Component } from 'react';
import { connect } from 'react-redux';

import * as LoadingConstants from './redux/LoadingStateConstants';
import * as UIConstants from './redux/UIConstants';
import ModelItemRender from './component/ModelItemRender';
import PortalItemRender from './component/PortalItemRender';
import EffectItemRender from './component/EffectItemRender';
import MediaItemRender from './component/MediaItemRender';
import AudioItemRender from './component/AudioItemRender';
import { ARTrackingInitialized, switchListMode } from './redux/actions';


import {
  ViroARScene,
  ViroTrackingStateConstants,
  ViroMaterials,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroSpotLight,
  ViroLightingEnvironment,
  ViroQuad
} from '@reactvision/react-viro';
import * as LightingData from './model/LightingItems';


export class figment extends Component {

  constructor(props) {
    super(props);

    this.state = {
      text: "not tapped",
      currentObj: 0,
      isLoading: false,
      scaleSurface: [1, 1, 1],
    }

    this._renderModels = this._renderModels.bind(this);
    this._renderPortals = this._renderPortals.bind(this);
    this._renderEffects = this._renderEffects.bind(this);
    this._onTrackingUpdated = this._onTrackingUpdated.bind(this);
    this._performARHitTest = this._performARHitTest.bind(this);
    this._onLoadCallback = this._onLoadCallback.bind(this);
    this._onModelsClickStateCallback = this._onModelsClickStateCallback.bind(this);
    this._onPortalsClickStateCallback = this._onPortalsClickStateCallback.bind(this);
    this._onSceneClick = this._onSceneClick.bind(this);
    this._renderLightingSetup = this._renderLightingSetup.bind(this);
  }

  /**
   * Renders the dynamic lighting setup based on selectedHdri prop
   * Each lighting setup defines ambient light and an array of spot/directional lights
   */
  _renderLightingSetup() {
    const setupName = this.props.selectedHdri;
    const setup = LightingData.getLightingSetup(setupName);

    // Default fallback lighting if no setup selected
    if (!setup) {
      console.log('[Figment] No lighting setup found for:', setupName, '- using default');
      return (
        <>
          <ViroAmbientLight color="#ffffff" intensity={100} />
          <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.2]} />
        </>
      );
    }

    console.log('[Figment] Loading lighting setup:', setup.name);

    const lights = [];

    // Add ambient light
    lights.push(
      <ViroAmbientLight
        key="ambient"
        color={setup.ambientColor || '#ffffff'}
        intensity={setup.ambientIntensity || 50}
      />
    );

    // Add each light from the setup
    setup.lights.forEach((light, index) => {
      if (light.type === 'spot') {
        const spotProps = {
          key: `spot-${index}`,
          position: light.position,
          direction: light.direction,
          color: light.color || '#ffffff',
          intensity: light.intensity || 500,
          innerAngle: light.innerAngle || 15,
          outerAngle: light.outerAngle || 45,
          attenuationStartDistance: light.attenuationStart || 3,
          attenuationEndDistance: light.attenuationEnd || 15,
          castsShadow: light.castsShadow || false,
        };

        // Add shadow props only when shadows are enabled
        if (light.castsShadow) {
          spotProps.shadowMapSize = 512;
          spotProps.shadowNearZ = 2;
          spotProps.shadowFarZ = 20;
          spotProps.shadowOpacity = light.shadowOpacity || 0.4;
        }

        lights.push(<ViroSpotLight {...spotProps} />);
      } else if (light.type === 'directional') {
        lights.push(
          <ViroDirectionalLight
            key={`dir-${index}`}
            direction={light.direction}
            color={light.color || '#ffffff'}
          />
        );
      } else if (light.type === 'ambient') {
        lights.push(
          <ViroAmbientLight
            key={`amb-${index}`}
            color={light.color || '#ffffff'}
            intensity={light.intensity || 100}
          />
        );
      }
    });

    return <>{lights}</>;
  }

  // ... (existing helper methods)

  _onSceneClick() {
    console.log('[Figment] Background clicked - calling onBackgroundTap from props');
    // Clear the list mode via app callback
    if (this.props.arSceneNavigator && this.props.arSceneNavigator.viroAppProps && this.props.arSceneNavigator.viroAppProps.onBackgroundTap) {
      this.props.arSceneNavigator.viroAppProps.onBackgroundTap();
    }
  }

  componentDidMount() {
    console.log('[Figment] componentDidMount - Initializing materials');

    // Check and Enable Scene Semantics
    if (this.props.arSceneNavigator && this.props.arSceneNavigator.isSemanticModeSupported) {
      this.props.arSceneNavigator.isSemanticModeSupported().then((result) => {
        console.log('[Figment] Scene Semantics Supported:', result.supported);
        if (result.supported) {
          this.props.arSceneNavigator.setSemanticModeEnabled(true);
          console.log('[Figment] Semantic Mode Enabled');
        }
      }).catch(err => {
        console.log('[Figment] Scene Semantics Check Error:', err);
      });
    }
  }

  render() {
    console.log('[Figment] render start');
    // the starting bitmask is 2 because the default is 1 (2^0 = 1)
    let startingBitMask = 2;
    // fetch models
    let models = this._renderModels(this.props.modelItems, startingBitMask);
    // increment startingBitMask by the number of models
    startingBitMask += Object.keys(this.props.modelItems).length;
    // fetch portals (portals don't have shadows, so not incrementing bitmask)
    let portals = this._renderPortals(this.props.portalItems, startingBitMask);
    // fetch effects
    let effects = this._renderEffects(this.props.effectItems);
    // fetch audio items
    let audioItems = this._renderAudioItems(this.props.audioItems);
    console.log('[Figment] render end - Models count:', models.length, 'Audio count:', audioItems.length);

    return (
      <ViroARScene ref={component => { this.arSceneRef = component }} physicsWorld={{ gravity: [0, -9.81, 0] }} postProcessEffects={[this.props.postProcessEffects]}
        onTrackingUpdated={this._onTrackingUpdated}>
        {/* Dynamic Lighting Setup based on selectedHdri */}
        {this._renderLightingSetup()}

        {/* Dedicated Shadow Light - Always present to ensure shadows work */}
        <ViroSpotLight
          innerAngle={15}
          outerAngle={60}
          direction={[-0.2, -0.9, -0.3]}
          position={[1, 8, 2]}
          color="#ffffff"
          intensity={100}
          attenuationStartDistance={5}
          attenuationEndDistance={20}
          castsShadow={true}
          shadowMapSize={512}
          shadowNearZ={2}
          shadowFarZ={20}
          shadowOpacity={0.35}
        />

        {/* Global Shadow Receiver Plane (Invisible, catches shadows) */}
        <ViroQuad
          position={[0, -0.75, 0]}
          rotation={[-90, 0, 0]}
          width={100}
          height={100}
          arShadowReceiver={true}
        />

        {models}
        {portals}
        {effects}
        {audioItems}
      </ViroARScene>
    );
  }

  // Render models added to the scene. 
  // modelItems - list of models added by user; comes from redux, see js/redux/reducers/arobjects.js
  // startingBitMask - used for adding shadows for each of the, for each new object added to the scene,
  //           pass a bitMask as {Math.pow(2,objBitMask)}. This is done since each object has it's own 
  //           spotlight and a corresponding shadow plane. So each new set of these components are assigned a 
  //           consistent bitMask that's used in SpotLight's "influenceBitMask",
  //           Viro3DObject's "shadowCastingBitMask" and "lightReceivingBitMask" and Shadow plane (ViroQuad)'s "lightReceivingBitMask"
  _renderModels(modelItems, startingBitMask) {
    var renderedObjects = [];
    if (modelItems) {
      var root = this;
      let objBitMask = startingBitMask;
      Object.keys(modelItems).forEach(function (currentKey) {
        // Keep rendering items to prevent unmount crash - hidden items will set visible=false
        if (modelItems[currentKey] != null && modelItems[currentKey] != undefined) {
          // Get animations for this model from Redux props (NOT viroAppProps - those don't trigger re-render)
          const uuid = modelItems[currentKey].uuid;
          const objectAnimations = root.props.objectAnimations || {};
          const modelAnimations = objectAnimations[uuid] || {};

          // DEBUG: Log the objectAnimations from Redux props (only if non-empty)
          if (Object.keys(modelAnimations).length > 0) {
            console.log('[Figment] _renderModels - Redux objectAnimations for UUID:', uuid,
              'modelAnimations:', JSON.stringify(modelAnimations));
          }

          renderedObjects.push(
            <ModelItemRender key={modelItems[currentKey].uuid}
              modelIDProps={modelItems[currentKey]}
              hitTestMethod={root._performARHitTest}
              onLoadCallback={root._onLoadCallback}
              onClickStateCallback={root._onModelsClickStateCallback}
              onTransformUpdate={root.props.arSceneNavigator?.viroAppProps?.onTransformUpdate}
              bitMask={Math.pow(2, objBitMask)}
              isHidden={modelItems[currentKey].hidden === true}
              objectAnimations={modelAnimations} />
          );
        }
        objBitMask++;
      });
    }

    // Render Media Items
    let mediaKeys = Object.keys(this.props.mediaItems);
    // console.log('[Figment] _renderModels: Media keys count:', mediaKeys.length);
    for (let i = 0; i < mediaKeys.length; i++) {
      let key = mediaKeys[i];
      let mediaItem = this.props.mediaItems[key];
      // We can reuse the same bitmask logic or simplified one
      if (!mediaItem.hidden) {
        console.log('[Figment] Rendering Media Item:', mediaItem.uuid);
        renderedObjects.push((
          <MediaItemRender
            key={mediaItem.uuid}
            mediaItem={mediaItem}
            onTransformUpdate={root.props.arSceneNavigator?.viroAppProps?.onMediaTransformUpdate}
          // Add callbacks if needed, e.g. for selection
          />
        ));
      }
    }

    return renderedObjects;
  }

  // Render Portals added to the scene. 
  // portalItems - list of portals added by user; comes from redux, see js/redux/reducers/arobjects.js
  // startingBitMask - used for adding shadows for each of the 
  _renderPortals(portalItems, startingBitMask) {
    var renderedObjects = [];
    if (portalItems) {
      var root = this;
      let portalBitMask = startingBitMask;
      Object.keys(portalItems).forEach(function (currentKey) {
        // Keep rendering items to prevent unmount crash - hidden items will set visible=false
        if (portalItems[currentKey] != null && portalItems[currentKey] != undefined) {
          renderedObjects.push(
            <PortalItemRender
              key={portalItems[currentKey].uuid}
              portalIDProps={portalItems[currentKey]}
              hitTestMethod={root._performARHitTest}
              onLoadCallback={root._onLoadCallback}
              onClickStateCallback={root._onPortalsClickStateCallback}
              onTransformUpdate={root.props.arSceneNavigator?.viroAppProps?.onPortalTransformUpdate}
              onVideoBuffering={root.props.arSceneNavigator?.viroAppProps?.onVideoBuffering}
              bitMask={Math.pow(2, portalBitMask)}
              isHidden={portalItems[currentKey].hidden === true} />
          );
        }
        portalBitMask++;
      });
    }
    return renderedObjects;
  }

  // Render Effects added to the scene. Handled differently compared to Objects and Portals,
  // since a user can enable only 1 effect to the scene at a time
  // effectItems - list of effects; from the data model, see js/model/EffectItems.js
  _renderEffects(effectItems) {
    if (effectItems) {
      for (var i = 0; i < effectItems.length; i++) {
        if (effectItems[i].selected) {
          return (<EffectItemRender index={i} effectItem={effectItems[i]} />);
        }
      }
    }
  }

  // Render audio items added to the scene.
  // audioItems - list of audio added by user; comes from redux, see js/redux/reducers/arobjects.js
  _renderAudioItems(audioItems) {
    var renderedAudio = [];
    if (audioItems) {
      var root = this;
      Object.keys(audioItems).forEach(function (currentKey) {
        let audioItem = audioItems[currentKey];
        if (audioItem && !audioItem.hidden) {
          console.log('[Figment] Rendering Audio Item:', audioItem.uuid, 'Type:', audioItem.type);
          renderedAudio.push((
            <AudioItemRender
              key={audioItem.uuid}
              audioItem={audioItem}
              onTransformUpdate={root.props.arSceneNavigator?.viroAppProps?.onAudioTransformUpdate}
              onClickStateCallback={root._onModelClickStateCallback}
            />
          ));
        }
      });
    }
    return renderedAudio;
  }

  // Callback fired when the app receives AR Tracking state changes from ViroARScene.
  // If the tracking state is not NORMAL -> show the user AR Initialization animation 
  // to guide them to move the device around to get better AR tracking.
  _onTrackingUpdated(state, reason) {
    var trackingNormal = false;
    if (state == ViroTrackingStateConstants.TRACKING_NORMAL) {
      trackingNormal = true;
    }
    this.props.dispatchARTrackingInitialized(trackingNormal);
  }

  // Performed to find the correct position where to place a new object being added to the scene
  // Get's camera's current orientation, and performs an AR Hit Test with Ray along the camera's orientation
  // the object is then placed at the intersection of the Ray and identified AR point returned by the system
  // along that ray.
  _performARHitTest(callback) {
    this.arSceneRef.getCameraOrientationAsync().then((orientation) => {
      this.arSceneRef.performARHitTestWithRay(orientation.forward).then((results) => {
        callback(orientation.position, orientation.forward, results);
      })
    });
  }

  _onLoadCallback(uuid, loadState) {
    this.props.arSceneNavigator.viroAppProps.loadingObjectCallback(uuid, loadState);
  }
  _onModelsClickStateCallback(uuid, clickState, itemType) {
    this.props.arSceneNavigator.viroAppProps.clickStateCallback(uuid, clickState, itemType);
  }
  _onPortalsClickStateCallback(index, clickState, itemType) {
    this.props.arSceneNavigator.viroAppProps.clickStateCallback(index, clickState, itemType);
  }
}

// -- REDUX STORE
function initMaterials() {
  console.log('[Figment] initMaterials called');
  ViroMaterials.createMaterials({
    shadowCatcher: {
      writesToDepthBuffer: false,
      readsFromDepthBuffer: false,
      diffuseColor: "#ff9999"

    },
    ground: {
      lightingModel: "Lambert",
      cullMode: "None",
      shininess: 2.0,
      diffuseColor: "#ff999900"
    },
    theatre: {
      diffuseTexture: require('./res/360_dark_theatre.jpg'),
    },
    // pbr is now in ModelItemRender.js
  });
}
initMaterials();

// -- REDUX STORE
function selectProps(store) {
  return {
    modelItems: store.arobjects.modelItems,
    portalItems: store.arobjects.portalItems,
    mediaItems: store.arobjects.mediaItems, // Added
    audioItems: store.arobjects.audioItems, // Added for spatial audio
    effectItems: store.arobjects.effectItems,
    postProcessEffects: store.arobjects.postProcessEffects,
    objectAnimations: store.arobjects.objectAnimations, // Added for JS-driven animations
    selectedHdri: store.ui.selectedHdri,
  };
}

// -- dispatch REDUX ACTIONS map
const mapDispatchToProps = (dispatch) => {
  return {
    dispatchARTrackingInitialized: (trackingNormal) => dispatch(ARTrackingInitialized(trackingNormal)),
    dispatchSwitchListMode: (listMode, listTitle) => dispatch(switchListMode(listMode, listTitle)),
  }
}
module.exports = connect(selectProps, mapDispatchToProps)(figment);

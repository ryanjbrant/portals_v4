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
import { ARTrackingInitialized, switchListMode } from './redux/actions';


import {
  ViroARScene,
  ViroTrackingStateConstants,
  ViroMaterials,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroSpotLight,
  ViroLightingEnvironment
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
    console.log('[Figment] render end - Models count:', models.length);

    return (
      <ViroARScene ref={component => { this.arSceneRef = component }} physicsWorld={{ gravity: [0, -9.81, 0] }} postProcessEffects={[this.props.postProcessEffects]}
        onTrackingUpdated={this._onTrackingUpdated}>
        {this.props.selectedHdri && LightingData.getHDRISource(this.props.selectedHdri) && (
          <ViroLightingEnvironment
            source={LightingData.getHDRISource(this.props.selectedHdri)}
            onLoadStart={() => console.log('[Figment] HDRI Loading:', this.props.selectedHdri)}
            onLoadEnd={() => console.log('[Figment] HDRI Loaded:', this.props.selectedHdri)}
            onError={(event) => console.log('[Figment] HDRI Error:', event.nativeEvent, this.props.selectedHdri)}
          />
        )}

        {/* Soft ambient fill light - Matched to ARComposer */}
        <ViroAmbientLight color="#ffffff" intensity={150} />
        <ViroAmbientLight color="#ffffff" intensity={200} />

        {/* DirectionalLight (Restored per user request to work in tandem) */}
        <ViroDirectionalLight color="#ffffff" direction={[0, -1, -.2]} />

        {/* Spotlight with Shadows - Matched to ARComposer (Top Down) */}
        <ViroSpotLight
          innerAngle={5}
          outerAngle={25}
          direction={[0, -1, -.2]}
          position={[0, 5, 1]}
          color="#ffffff"
          castsShadow={true}
          shadowMapSize={2048}
          shadowNearZ={1}
          shadowFarZ={10}
          shadowOpacity={0.5}
        />

        {models}
        {portals}
        {effects}
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
          renderedObjects.push(
            <ModelItemRender key={modelItems[currentKey].uuid}
              modelIDProps={modelItems[currentKey]}
              hitTestMethod={root._performARHitTest}
              onLoadCallback={root._onLoadCallback}
              onClickStateCallback={root._onModelsClickStateCallback}
              bitMask={Math.pow(2, objBitMask)}
              isHidden={modelItems[currentKey].hidden === true} />
          );
        }
        objBitMask++;
      });

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
    effectItems: store.arobjects.effectItems,
    postProcessEffects: store.arobjects.postProcessEffects,
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

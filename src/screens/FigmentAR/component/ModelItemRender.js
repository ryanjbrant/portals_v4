/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 */
'use strict';

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as LoadConstants from '../redux/LoadingStateConstants';
import * as UIConstants from '../redux/UIConstants';
import * as ModelData from '../model/ModelItems';
import TimerMixin from 'react-timer-mixin';
import ParticleEmitter from '../model/emitters/ParticleEmitter';
import renderIf from '../helpers/renderIf';
import {
  ViroMaterials,
  ViroNode,
  Viro3DObject,
  ViroSpotLight,
  ViroAmbientLight,
  ViroQuad,
} from '@reactvision/react-viro';

var createReactClass = require('create-react-class');


/**
 * Class that encapsulates everything needed to be added to the scene when a user adds a Model (3D Object)
 * from the listview. This configures position, rotation, etc. for the objects, as well as click / pinch gesture
 * behaviors. Additionally this also configures a SpotLight and a corresponding ViroQuad for shadows below the object
 */
var ModelItemRender = createReactClass({
  mixins: [TimerMixin],
  propTypes: {
    // All props retreived from the data model for Models (See js/model/ModelItems.js)
    modelIDProps: PropTypes.any,
    // Callback function that gets triggered once the model is loaded
    onLoadCallback: PropTypes.func,
    // Callback function thats fired when a user clicks the model
    onClickStateCallback: PropTypes.func,
    // A callback method thats provided here, gets triggered when the model loads that resolves to the correct
    // position and orientation for the model to be placed at initially
    hitTestMethod: PropTypes.func,
  },

  componentDidMount() {
    console.log('[ModelItemRender] componentDidMount - UUID:', this.props.modelIDProps.uuid);
    this._modelData = ModelData.getModelArray();
    this._isMounted = true;

    // Force a re-render after a short delay to work around ViroReact batching issue
    // where the first render cycle doesn't properly attach nodes to the scene graph
    this.setTimeout(() => {
      if (this._isMounted) {
        console.log('[ModelItemRender] Forcing re-render for UUID:', this.props.modelIDProps.uuid);
        this.forceUpdate();
      }
    }, 100);
  },

  componentWillUnmount() {
    console.log('[ModelItemRender] componentWillUnmount - UUID:', this.props.modelIDProps.uuid);
    this._isMounted = false;
  },

  getInitialState() {
    return {
      scale: ModelData.getModelArray()[this.props.modelIDProps.index].scale,
      rotation: [0, 0, 0],
      nodeIsVisible: true,
      position: [0, 10, 1], // make it appear initially high in the sky
      shouldBillboard: true,
      runAnimation: true,
      showParticles: true,
      itemClickedDown: false,
    }
  },

  render: function () {
    console.log('[ModelItemRender] render - UUID:', this.props.modelIDProps.uuid);

    var modelItem = ModelData.getModelArray()[this.props.modelIDProps.index];
    let transformBehaviors = {};
    if (this.state.shouldBillboard) {
      transformBehaviors.transformBehaviors = this.state.shouldBillboard ? "billboardY" : [];
    }

    // If hidden prop is true, force invisible (but keep same element structure to avoid unmount crash)
    const isVisible = this.props.isHidden ? false : this.state.nodeIsVisible;

    return (

      <ViroNode
        {...transformBehaviors}
        key={this.props.modelIDProps.uuid}
        ref={this._setARNodeRef}
        visible={isVisible}
        position={this.state.position}
        scale={this.state.scale}
        rotation={this.state.rotation}
        onPinch={this._onPinch}
        onRotate={this._onRotate}
        onDrag={() => { }}
        dragType="FixedToWorld">

        {/* This SpotLight is placed directly above the 3D Object, directed straight down,
                is responsible for creating "shadows" underneath the object in addition to providing lighting (castsShadow = true, influenceBitMask = this.props.bitMask). 
                The bitMask comes from figment.js where it is calculated each time a new object is added to the scene
                The position of the spotlight is either default or is configured in the data model (ModelItems.js).
                Rest of the props (innerAngle, outerAngle, attenautionDistances, nearZ, farZ) are configured so that
                they create "as tight as possible" spotlight frustrum around the object for optimizing performance
                (see https://docs.viromedia.com/docs/virospotlight1). */}
        {/* 
        <ViroSpotLight
          ref={component => { this.spotLight = component }}
          intensity={modelItem.lighting_mode == "IBL" ? 100 : 1000}
          innerAngle={5}
          outerAngle={20}
          attenuationStartDistance={0.1}
          attenuationEndDistance={22}
          direction={[0, -1, 0]}
          position={[modelItem.spotlight_position_x == undefined ? 0 : modelItem.spotlight_position_x, modelItem.spotlight_position_y == undefined ? 6 : modelItem.spotlight_position_y, modelItem.spotlight_position_z == undefined ? 0 : modelItem.spotlight_position_z]}
          color="#ffffff"
          castsShadow={true}
          influenceBitMask={this.props.bitMask}
          shadowNearZ={.1}
          shadowFarZ={modelItem.shadowfarz == undefined ? 6 : modelItem.shadowfarz * this.state.scale[0]}
          shadowOpacity={.9} />
        */}

        <ViroNode position={modelItem.position}>
          <Viro3DObject
            source={modelItem.obj}
            type={modelItem.type}
            resources={modelItem.resources}
            scale={this.state.scale}
            onClickState={this._onClickState(this.props.modelIDProps.uuid)}
            onError={this._onError(this.props.modelIDProps.uuid)}
            onLoadStart={this._onObjectLoadStart(this.props.modelIDProps.uuid)}
            onLoadEnd={this._onObjectLoadEnd(this.props.modelIDProps.uuid)} />
        </ViroNode>
      </ViroNode>
    );
  },

  _setARNodeRef(component) {
    this.arNodeRef = component;
  },

  /**
   * This method handles various state changes that happen when a user "Clicks" a model in the scene. For every "click" on a model, 
     a user can have different intentions:
     1. a quick tap to start/stop animation
     2. a quick tap to bring up the contextmenu
     3. a long tap where the intention is actually "drag" the model to reposition it
     Each "click" is comprised of two events - ClickDown : trigged when the user's finger touches the screen and a ClickUp: when the finger leaves the screen
   */
  _onClickState(uuid) {
    return (clickState, position, source) => {
      if (clickState == 1) {
        // clickState == 1 -> "ClickDown", we set the state itemClickedDown = true here,
        // which gets "reset" in 200 miliseconds. If a "ClickUp" happens in these 200 ms then
        // the user most likely just wanted to click the model (handled in the clickState == 2). 
        //After 200 ms, most likely the user intended to "drag" the object.
        if (this._isMounted) {
          this.setState({
            itemClickedDown: true,
          });
        }
        TimerMixin.setTimeout(
          () => {
            if (this._isMounted) {
              this.setState({
                itemClickedDown: false,
              });
            }
          },
          200
        );
      }

      if (clickState == 2) { // clickstate == 2 -> "ClickUp"
        // As explained above, within 200 ms, the user's intention is to "tap" the model -> toggle the animation start/stop
        if (this.state.itemClickedDown) {
          { this._onItemClicked() }
        }
        // Irrespective of 200 ms, we call the callback provided in props -> this brings up the context menu on top right
        this.props.onClickStateCallback(uuid, clickState, UIConstants.LIST_MODE_MODEL);
      }
    }
  },
  _onItemClicked() {
    if (!this._isMounted) return;
    let currentAnimationState = this.state.runAnimation;
    let currentParticlesState = this.state.showParticles;
    this.setState({
      runAnimation: !currentAnimationState,
      showParticles: !currentParticlesState,
      itemClickedDown: false,
    });
  },
  /*
   Rotation should be relative to its current rotation *not* set to the absolute
   value of the given rotationFactor.
   */
  _onRotate(rotateState, rotationFactor, source) {
    if (!this._isMounted) return;

    if (rotateState == 3) {
      this.setState({
        rotation: [this.state.rotation[0], this.state.rotation[1] + rotationFactor, this.state.rotation[2]]
      });
      this.props.onClickStateCallback(this.props.modelIDProps.uuid, rotateState, UIConstants.LIST_MODE_MODEL);
      return;
    }

    if (this.arNodeRef) {
      this.arNodeRef.setNativeProps({ rotation: [this.state.rotation[0], this.state.rotation[1] + rotationFactor, this.state.rotation[2]] });
    }
  },

  /*
   Pinch scaling should be relative to its last value *not* the absolute value of the
   scale factor. So while the pinching is ongoing set scale through setNativeProps
   and multiply the state by that factor. At the end of a pinch event, set the state
   to the final value and store it in state.
   */
  _onPinch(pinchState, scaleFactor, source) {
    if (!this._isMounted) return;

    // State 1: Pinch Started - Capture initial scale
    if (pinchState === 1) {
      this._initialPinchScale = this.state.scale;
      return;
    }

    // State 2: Pinch Moving - Apply via setNativeProps (Performance)
    if (pinchState === 2) {
      // Safety: If we missed state 1 (rare but possible), fallback to current state
      const baseScale = this._initialPinchScale || this.state.scale;

      const newScale = baseScale.map((x) => { return x * scaleFactor });

      // Cache for the end event
      this._lastPinchScale = newScale;

      if (this.arNodeRef) {
        this.arNodeRef.setNativeProps({ scale: newScale });
      }
      return; // check: ARComposer logic does not update state here
    }

    // State 3: Pinch Ended - Commit to State
    if (pinchState === 3) {
      // Use the last calculated scale from the gesture (State 2) to ensure continuity.
      // If we use 'scaleFactor' here, it *should* be the final cumulative, but caching is safer against resets.
      const finalScale = this._lastPinchScale || this.state.scale; // Fallback if no move occurred

      this.setState({
        scale: finalScale
      });

      // Notify parent
      this.props.onClickStateCallback(this.props.modelIDProps.uuid, pinchState, UIConstants.LIST_MODE_MODEL);

      // Cleanup
      this._initialPinchScale = null;
      this._lastPinchScale = null;
      return;
    }
  },

  _onError(uuid) {
    return () => {
      this.props.loadCallback(uuid, LoadConstants.ERROR);
      //this.props.arSceneNavigator.viroAppProps.loadingObjectCallback(index, LoadingConstants.LOAD_ERROR);
    };

  },

  _onObjectLoadStart(uuid) {
    return () => {
      this.props.onLoadCallback(uuid, LoadConstants.LOADING);
    };
  },

  _onObjectLoadEnd(uuid) {
    return () => {
      this.props.onLoadCallback(uuid, LoadConstants.LOADED);
      this.props.hitTestMethod(this._onARHitTestResults);
    };
  },

  /**
   * This method is executed once a model finishes loading. The arguments position, forward and results are used to
   * find the correct position of the model. position, forward and results are calculated when user adds a model to 
   * the scene by performing an AR Hit Test (see https://docs.viromedia.com/docs/viroarscene). arguments:
   * position - intersection of a Ray going out from the camera in the forward direction and the AR point returned by underlying AR platform
   * forward - forward vector of the ray
   * results - All feature points returned
   */
  _onARHitTestResults(position, forward, results) {
    // default position is just 3 forward of the user
    let newPosition = [forward[0] * 1.5, forward[1] * 1.5, forward[2] * 1.5];

    // try to find a more informed position via the hit test results
    if (results.length > 0) {
      let hitResultPosition = undefined;
      // Go through all the hit test results, and find the first AR Point that's close to the position returned by the AR Hit Test
      // We'll place our object at that first point
      for (var i = 0; i < results.length; i++) {
        let result = results[i];
        if (result.type == "ExistingPlaneUsingExtent" || result.type == "FeaturePoint" && !hitResultPosition) {
          // Calculate distance of the "position" from this hit test result
          // math = Sqr root {(x1 - x2) ^ 2 + (y1 - y2) ^ 2 + (z1 - z2) ^ 2} ->regular "distance" calculation
          var distance = Math.sqrt(((result.transform.position[0] - position[0]) * (result.transform.position[0] - position[0])) + ((result.transform.position[1] - position[1]) * (result.transform.position[1] - position[1])) + ((result.transform.position[2] - position[2]) * (result.transform.position[2] - position[2])));
          if (distance > .2 && distance < 10) {
            hitResultPosition = result.transform.position;
            break;
          }
        }
      }

      // If we found a hitResultPosition above after doing the distance math, set the position to this new place
      if (hitResultPosition) {
        newPosition = hitResultPosition;
      }
    }

    this._setInitialPlacement(newPosition);
  },

  // we need to set the position before making the node visible because of a race condition
  // in the case of models, this could cause the model to appear where the user is before
  // moving to it's location causing the user to accidentally be "inside" the model.
  // This sets an initial timeout of 500 ms to avoid any race condition in setting 
  // position and rotation while the object is being loaded.
  _setInitialPlacement(position) {
    if (!this._isMounted) return;
    this.setState({
      position: position,
    });
    this.setTimeout(() => { this._updateInitialRotation() }, 500);
  },

  // This function gets the rotation transform of the parent ViroNode that was placed in the scene by the user
  // and applies that rotation to the model inside the ViroNode (by setting state). This is done to ensure that
  // the portal faces the user at it's initial placement.
  _updateInitialRotation() {
    if (!this._isMounted) return;
    // If we don't have the ref yet, just make it visible without rotation adjustment
    if (!this.arNodeRef) {
      console.log('[ModelItemRender] _updateInitialRotation - No ref, making visible anyway');
      this.setState({
        shouldBillboard: false,
        nodeIsVisible: true,
      });
      return;
    }
    this.arNodeRef.getTransformAsync().then((retDict) => {
      if (!this._isMounted) return;
      let rotation = retDict.rotation;
      let absX = Math.abs(rotation[0]);
      let absZ = Math.abs(rotation[2]);

      let yRotation = (rotation[1]);

      // if the X and Z aren't 0, then adjust the y rotation.
      if (absX > 1 && absZ > 1) {
        yRotation = 180 - (yRotation);
      }
      this.setState({
        rotation: [0, yRotation, 0],
        shouldBillboard: false,
        nodeIsVisible: true,
      });
    }).catch((error) => {
      console.warn('[ModelItemRender] _updateInitialRotation error:', error);
    });
  },
});



ViroMaterials.createMaterials({
  pbr: {
    lightingModel: "PBR",
  },
});

module.exports = ModelItemRender;

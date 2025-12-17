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
import ObjectGizmo from './ObjectGizmo';
import {
  ViroMaterials,
  ViroNode,
  Viro3DObject,
  ViroSpotLight,
  ViroAmbientLight,
  ViroQuad,
  ViroAnimations,
} from '@reactvision/react-viro';
import * as FileSystem from 'expo-file-system/legacy';

var createReactClass = require('create-react-class');

// Bright modern color palette (HSL values for vibrant colors)
const BRIGHT_COLORS = [
  '#FF3366', // Hot Pink
  '#FF6B35', // Orange Red
  '#F7931A', // Bitcoin Orange
  '#FFD700', // Gold
  '#00FF88', // Mint Green
  '#00D4FF', // Cyan
  '#7B68EE', // Medium Slate Blue
  '#FF69B4', // Hot Pink
  '#00CED1', // Dark Turquoise
  '#FF4500', // Orange Red
  '#9370DB', // Medium Purple
  '#20B2AA', // Light Sea Green
  '#FF1493', // Deep Pink
  '#00FA9A', // Medium Spring Green
  '#8A2BE2', // Blue Violet
  '#DC143C', // Crimson
  '#00BFFF', // Deep Sky Blue
  '#FF8C00', // Dark Orange
];

// Generate a random bright color
function getRandomBrightColor() {
  return BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
}

// Get complementary color (180 degrees on color wheel)
function getComplementaryColor(hexColor) {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Get complementary
  const compR = 255 - r;
  const compG = 255 - g;
  const compB = 255 - b;

  return '#' + [compR, compG, compB].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Track created dynamic materials
const createdMaterials = new Set();


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

  getInitialState() {
    // Get base scale from model data and multiply by 2.5 for 0.5 default size
    const isCustom = this.props.modelIDProps.index === -1;
    const modelItem = isCustom ? this.props.modelIDProps : ModelData.getModelArray()[this.props.modelIDProps.index];

    // Default scale for custom is usually smaller or defined in reducer
    const baseScale = modelItem.scale || [0.2, 0.2, 0.2];
    const scaledUp = baseScale.map(s => s * 2.5);
    // Generate a random bright color for this primitive
    const randomColor = getRandomBrightColor();
    const materialName = `dynamicColor_${this.props.modelIDProps.uuid}`;

    // Create dynamic material BEFORE first render
    // const modelItem = ... (already defined above)
    if (modelItem.type === 'GLB' && !createdMaterials.has(materialName)) {
      ViroMaterials.createMaterials({
        [materialName]: {
          lightingModel: 'PBR',
          diffuseColor: randomColor,
          metalness: 0.3,
          roughness: 0.4,
        },
      });
      createdMaterials.add(materialName);
      console.log('[ModelItemRender] Created material:', materialName, 'with color:', randomColor);
    }

    return {
      scale: scaledUp,
      rotation: [0, 0, 0],
      nodeIsVisible: true,
      // If loaded from draft (loading === 'LOADED'), start visible in front of user
      // Otherwise start high in sky to wait for hitTest placement
      position: this.props.modelIDProps.loading === 'LOADED' ? [0, 0, -1.5] : [0, 10, 1],
      shouldBillboard: this.props.modelIDProps.loading !== 'LOADED', // Don't billboard if loading from draft
      runAnimation: true,
      showParticles: true,
      itemClickedDown: false,
      showGizmo: false, // Gizmo visibility
      materialColor: randomColor,
      materialName: materialName,
      // For custom models - track local file path after download
      localModelPath: null,
      isDownloading: false,
      downloadError: null,
    }
  },

  componentDidMount() {
    console.log('[ModelItemRender] componentDidMount - UUID:', this.props.modelIDProps.uuid);
    this._modelData = ModelData.getModelArray();
    this._isMounted = true;

    // Check if this is a custom model with a remote URL
    const isCustom = this.props.modelIDProps.index === -1;
    if (isCustom && this.props.modelIDProps.source?.uri) {
      const remoteUri = this.props.modelIDProps.source.uri;
      console.log('[ModelItemRender] Custom model detected, downloading from:', remoteUri);
      this._downloadRemoteModel(remoteUri);
    }

    // Force a re-render after a short delay to work around ViroReact batching issue
    // where the first render cycle doesn't properly attach nodes to the scene graph
    this.setTimeout(() => {
      if (this._isMounted) {
        console.log('[ModelItemRender] Forcing re-render for UUID:', this.props.modelIDProps.uuid);
        this.forceUpdate();
      }
    }, 100);
  },

  async _downloadRemoteModel(remoteUri) {
    try {
      this.setState({ isDownloading: true });

      // Generate local filename from UUID
      const uuid = this.props.modelIDProps.uuid;
      const ext = this.props.modelIDProps.source?.uri?.split('.').pop() || 'glb';
      const localFileName = `${uuid}.${ext}`;
      const localPath = `${FileSystem.cacheDirectory}models/${localFileName}`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}models`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}models`, { intermediates: true });
      }

      // Check if already cached
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        console.log('[ModelItemRender] Model already cached at:', localPath);
        if (this._isMounted) {
          this.setState({ localModelPath: localPath, isDownloading: false });
        }
        return;
      }

      console.log('[ModelItemRender] Downloading model to:', localPath);
      const downloadResult = await FileSystem.downloadAsync(remoteUri, localPath);

      if (downloadResult.status === 200) {
        console.log('[ModelItemRender] Download complete, local path:', downloadResult.uri);
        if (this._isMounted) {
          this.setState({ localModelPath: downloadResult.uri, isDownloading: false });
        }
      } else {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
    } catch (error) {
      console.error('[ModelItemRender] Download error:', error);
      if (this._isMounted) {
        this.setState({ downloadError: error.message, isDownloading: false });
      }
    }
  },

  componentDidUpdate(prevProps) {
    // Re-render when objectAnimations change
    if (JSON.stringify(prevProps.objectAnimations) !== JSON.stringify(this.props.objectAnimations)) {
      console.log('[ModelItemRender] objectAnimations changed for UUID:', this.props.modelIDProps.uuid);
    }
  },

  componentWillUnmount() {
    console.log('[ModelItemRender] componentWillUnmount - UUID:', this.props.modelIDProps.uuid);
    this._isMounted = false;
  },

  render: function () {
    console.log('[ModelItemRender] render - UUID:', this.props.modelIDProps.uuid);

    const isCustom = this.props.modelIDProps.index === -1;
    var modelItem = isCustom ? this.props.modelIDProps : ModelData.getModelArray()[this.props.modelIDProps.index];

    // Debug logging for custom models
    if (isCustom) {
      console.log('[ModelItemRender] Custom model detected');
      console.log('[ModelItemRender] source:', modelItem.source);
      console.log('[ModelItemRender] type:', modelItem.type);
      console.log('[ModelItemRender] scale:', this.state.scale);
      console.log('[ModelItemRender] position:', this.state.position);
      console.log('[ModelItemRender] obj:', modelItem.obj);
    }
    let transformBehaviors = {};
    if (this.state.shouldBillboard) {
      transformBehaviors.transformBehaviors = this.state.shouldBillboard ? "billboardY" : [];
    }

    // If hidden prop is true, force invisible (but keep same element structure to avoid unmount crash)
    const isVisible = this.props.isHidden ? false : this.state.nodeIsVisible;

    // Determine active animation from objectAnimations prop
    const objectAnims = this.props.objectAnimations || {};
    let activeAnimation = null;
    let animationName = null;

    // Priority order: bounce, pulse, rotate, scale, wiggle, random
    const animOrder = ['bounce', 'pulse', 'rotate', 'scale', 'wiggle', 'random'];
    for (const animType of animOrder) {
      if (objectAnims[animType]?.active) {
        // For rotate, check which axis
        if (animType === 'rotate') {
          const axis = objectAnims[animType].axis || { x: false, y: true, z: false };
          if (axis.x) animationName = 'rotateX';
          else if (axis.z) animationName = 'rotateZ';
          else animationName = 'rotateY';
        } else {
          animationName = animType;
        }
        activeAnimation = { name: animationName, run: true, loop: true };
        console.log('[ModelItemRender] Animation applied:', animationName, 'for UUID:', this.props.modelIDProps.uuid);
        break;
      }
    }

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

        <ViroNode position={modelItem.position || [0, 0, 0]} animation={activeAnimation}>
          {/* Render model: bundled OR custom */}
          {(() => {
            // For custom models, use the remote URL directly (ViroReact supports remote GLB)
            let modelSource;
            if (isCustom) {
              // Use remote source directly
              modelSource = modelItem.source;
              console.log('[ModelItemRender] Viro3DObject source (remote):', JSON.stringify(modelSource));
            } else {
              modelSource = modelItem.obj;
              console.log('[ModelItemRender] Viro3DObject source (bundled)');
            }
            console.log('[ModelItemRender] Viro3DObject type:', modelItem.type);
            return (
              <Viro3DObject
                source={modelSource}
                type={modelItem.type}
                resources={modelItem.resources || []}
                materials={isCustom ? undefined : (modelItem.type === 'GLB' ? [this.state.materialName] : modelItem.materials)}
                scale={this.state.scale}
                onClickState={this._onClickState(this.props.modelIDProps.uuid)}
                onError={this._onError(this.props.modelIDProps.uuid)}
                onLoadStart={this._onObjectLoadStart(this.props.modelIDProps.uuid)}
                onLoadEnd={this._onObjectLoadEnd(this.props.modelIDProps.uuid)} />
            );
          })()}

          {/* Gizmo controls - shown when object is tapped */}
          {this.state.showGizmo && (
            <ObjectGizmo
              scale={this.state.scale[0] * 2}
              onYAxisDrag={(deltaY) => this._onGizmoYDrag(deltaY)}
              onXAxisDrag={(deltaRot) => this._onGizmoXDrag(deltaRot)}
            />
          )}
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
    // Toggle gizmo visibility on tap
    this.setState({
      showGizmo: !this.state.showGizmo,
      itemClickedDown: false,
    });
  },

  // Gizmo Y-axis drag handler - lift object vertically
  _onGizmoYDrag(deltaY) {
    if (!this._isMounted) return;
    this.setState(prevState => ({
      position: [
        prevState.position[0],
        prevState.position[1] + deltaY,
        prevState.position[2],
      ],
    }));
  },

  // Gizmo X-axis drag handler - rotate object around Y
  _onGizmoXDrag(deltaRotation) {
    if (!this._isMounted) return;
    this.setState(prevState => ({
      rotation: [
        prevState.rotation[0],
        prevState.rotation[1] + deltaRotation,
        prevState.rotation[2],
      ],
    }));
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

    // State 2: Pinch Moving - Update State Continuously
    if (pinchState === 2) {
      // Ensure we have a base scale (handle missed state 1)
      if (!this._initialPinchScale) {
        this._initialPinchScale = this.state.scale;
      }

      const newScale = this._initialPinchScale.map((x) => { return x * scaleFactor });

      // Update state immediately (matches ARComposer "perfect" behavior)
      this.setState({ scale: newScale });
      return;
    }

    // State 3: Pinch Ended - Cleanup
    if (pinchState === 3) {
      // No scale update here - state is already up to date from the last State 2 event.
      // This prevents the "snap" caused by re-applying logic on release.

      this._initialPinchScale = null;
      this.props.onClickStateCallback(this.props.modelIDProps.uuid, pinchState, UIConstants.LIST_MODE_MODEL);
      return;
    }
  },

  _onError(uuid) {
    return () => {
      console.log('[ModelItemRender] Error loading model:', uuid);
      this.props.onLoadCallback(uuid, LoadConstants.ERROR);
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
      console.log('[ModelItemRender] Model loaded:', uuid);
      this.props.onLoadCallback(uuid, LoadConstants.LOADED);
      this.props.hitTestMethod(this._onARHitTestResults);

      // Auto-scale custom models to fit ~60% of viewport
      if (this.props.modelIDProps.index === -1) {
        this._autoScaleModel();
      }
    };
  },

  _autoScaleModel(attempt = 0) {
    // If ref is missing, retry up to 5 times (1 second total)
    if (!this.arNodeRef) {
      if (attempt < 5) {
        console.log(`[ModelItemRender] No ref for auto-scale, retrying... (${attempt + 1}/5)`);
        this.setTimeout(() => {
          this._autoScaleModel(attempt + 1);
        }, 200);
      } else {
        console.warn('[ModelItemRender] Failed to auto-scale: ref never became available.');
      }
      return;
    }

    // Slight delay to ensure geometry is ready for bounding box check
    this.setTimeout(() => {
      // ViroNode doesn't always support getBoundingBoxAsync directly in all versions,
      // but if it does, this is the way. If not, we might need a fallback.
      // Assuming ViroNode or the inner Viro3DObject (which we don't have a direct ref to easily) supports it.
      // Actually, we set this.arNodeRef to the ViroNode.
      if (this.arNodeRef.getBoundingBoxAsync) {
        this.arNodeRef.getBoundingBoxAsync().then((boundingBox) => {
          const { min, max } = boundingBox;
          const width = max[0] - min[0];
          const height = max[1] - min[1];
          const depth = max[2] - min[2];

          const maxDim = Math.max(width, height, depth);

          // Target size: ~0.6 meters (rough approximation of 60% viewport at 1m distance)
          const targetSize = 0.6;

          if (maxDim > 0) {
            const scaleFactor = targetSize / maxDim;
            console.log(`[ModelItemRender] Auto-scaling model. MaxDim: ${maxDim}, ScaleFactor: ${scaleFactor}`);

            this.setState({
              scale: [scaleFactor, scaleFactor, scaleFactor]
            });
          }
        }).catch(err => {
          console.warn('[ModelItemRender] Failed to get bounding box for auto-scale:', err);
        });
      }
    }, 200);
  },

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

  _setInitialPlacement(position) {
    if (!this._isMounted) return;
    this.setState({
      position: position,
    });
    this.setTimeout(() => { this._updateInitialRotation() }, 500);
  },

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

// Register animations for Figment AR objects
ViroAnimations.registerAnimations({
  // Bounce animation - sequential: up then down
  bounceUp: { properties: { positionY: "+=0.15" }, easing: "EaseInEaseOut", duration: 300 },
  bounceDown: { properties: { positionY: "-=0.15" }, easing: "EaseInEaseOut", duration: 300 },
  bounce: [["bounceUp", "bounceDown"]],

  // Pulse animation (scale) - sequential: grow then shrink
  pulseUp: { properties: { scaleX: 1.15, scaleY: 1.15, scaleZ: 1.15 }, easing: "EaseInEaseOut", duration: 400 },
  pulseDown: { properties: { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 }, easing: "EaseInEaseOut", duration: 400 },
  pulse: [["pulseUp", "pulseDown"]],

  // Rotate animations - loopable single rotation
  rotateY: { properties: { rotateY: "+=45" }, duration: 500 },
  rotateX: { properties: { rotateX: "+=45" }, duration: 500 },
  rotateZ: { properties: { rotateZ: "+=45" }, duration: 500 },

  // Scale animation (oscillating) - sequential: grow then shrink
  scaleUp: { properties: { scaleX: 1.3, scaleY: 1.3, scaleZ: 1.3 }, easing: "EaseInEaseOut", duration: 500 },
  scaleDown: { properties: { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 }, easing: "EaseInEaseOut", duration: 500 },
  scale: [["scaleUp", "scaleDown"]],

  // Wiggle animation - sequential: left, right, center
  wiggleLeft: { properties: { rotateZ: "+=5" }, easing: "EaseInEaseOut", duration: 100 },
  wiggleRight: { properties: { rotateZ: "-=10" }, easing: "EaseInEaseOut", duration: 100 },
  wiggleCenter: { properties: { rotateZ: "+=5" }, easing: "EaseInEaseOut", duration: 100 },
  wiggle: [["wiggleLeft", "wiggleRight", "wiggleCenter"]],

  // Random/float animation - sequential: up then down
  floatUp: { properties: { positionY: "+=0.05" }, easing: "EaseInEaseOut", duration: 1000 },
  floatDown: { properties: { positionY: "-=0.05" }, easing: "EaseInEaseOut", duration: 1000 },
  random: [["floatUp", "floatDown"]],
});

module.exports = ModelItemRender;

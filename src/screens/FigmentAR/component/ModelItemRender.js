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
import { StyleSheet } from 'react-native';
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
  ViroAnimations,
  ViroText,
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
    // Callback to sync transforms back to Redux
    onTransformUpdate: PropTypes.func,
  },

  getInitialState() {
    // Get base scale from model data and multiply by 2.5 for 0.5 default size
    const isCustom = this.props.modelIDProps.index === -1;
    const modelItem = isCustom ? this.props.modelIDProps : ModelData.getModelArray()[this.props.modelIDProps.index];
    // Use explicit isFromDraft flag (set by LOAD_SCENE reducer)
    const isLoadedFromDraft = this.props.modelIDProps.isFromDraft === true;

    console.log('[ModelItemRender] getInitialState DETAILED:', {
      uuid: this.props.modelIDProps.uuid,
      isLoadedFromDraft,
      propsPosition: JSON.stringify(this.props.modelIDProps.position),
      propsRotation: JSON.stringify(this.props.modelIDProps.rotation),
      propsScale: JSON.stringify(this.props.modelIDProps.scale),
    });

    // Use saved values if loading from draft, otherwise use defaults
    let initialScale;
    let initialPosition;
    let initialRotation;

    if (isLoadedFromDraft && this.props.modelIDProps.scale) {
      // Use the saved scale from draft
      initialScale = this.props.modelIDProps.scale;
    } else {
      // Default scale for new models
      const baseScale = modelItem.scale || [0.2, 0.2, 0.2];
      initialScale = baseScale.map(s => s * 2.5);
    }

    if (isLoadedFromDraft && this.props.modelIDProps.position) {
      // Use the saved position from draft
      initialPosition = this.props.modelIDProps.position;
    } else {
      // Start high in sky to wait for hitTest placement
      initialPosition = [0, 10, 1];
    }

    if (isLoadedFromDraft && this.props.modelIDProps.rotation) {
      // Use the saved rotation from draft
      initialRotation = this.props.modelIDProps.rotation;
    } else {
      initialRotation = [0, 0, 0];
    }

    console.log('[ModelItemRender] Using transforms:', {
      position: JSON.stringify(initialPosition),
      rotation: JSON.stringify(initialRotation),
      scale: JSON.stringify(initialScale),
    });

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
      scale: initialScale,
      rotation: initialRotation,
      nodeIsVisible: true,
      position: initialPosition,
      shouldBillboard: !isLoadedFromDraft, // Don't billboard if loading from draft
      runAnimation: true,
      showParticles: true,
      itemClickedDown: false,
      materialColor: randomColor,
      materialName: materialName,
      // For custom models - track local file path after download
      localModelPath: null,
      isDownloading: false,
      downloadError: null,
      // Y-lift mode: long-press enables Y-only dragging
      yLiftMode: false,
      lockedY: null, // When set, Y position is constrained to this value
    }
  },

  componentDidMount() {
    console.log('[ModelItemRender] componentDidMount - UUID:', this.props.modelIDProps.uuid);
    this._modelData = ModelData.getModelArray();
    this._isMounted = true;
    this._hasInitialSynced = false; // Prevent duplicate initial transform syncs

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
    // Re-render when objectAnimations change and start/stop animation loop
    if (JSON.stringify(prevProps.objectAnimations) !== JSON.stringify(this.props.objectAnimations)) {
      console.log('[ModelItemRender] objectAnimations changed for UUID:', this.props.modelIDProps.uuid, 'new anims:', JSON.stringify(this.props.objectAnimations));
      // Start or stop JS-driven animation based on new state
      this._updateAnimationState();
    }


    // CRITICAL: Handle case where LOAD_SCENE updates Redux AFTER component mounts
    // When isFromDraft changes from false/undefined to true, update state with saved transforms
    const wasFromDraft = prevProps.modelIDProps.isFromDraft === true;
    const isNowFromDraft = this.props.modelIDProps.isFromDraft === true;

    if (!wasFromDraft && isNowFromDraft) {
      const newPosition = this.props.modelIDProps.position || this.state.position;
      const newRotation = this.props.modelIDProps.rotation || this.state.rotation;
      const newScale = this.props.modelIDProps.scale || this.state.scale;

      console.log('[ModelItemRender] isFromDraft changed to true, updating transforms:', {
        uuid: this.props.modelIDProps.uuid,
        position: JSON.stringify(newPosition),
        rotation: JSON.stringify(newRotation),
        scale: JSON.stringify(newScale),
      });

      // Update React state with saved transforms from the draft
      this.setState({
        position: newPosition,
        rotation: newRotation,
        scale: newScale,
        shouldBillboard: false, // Disable billboard for draft-loaded models
        nodeIsVisible: true,
      });

      // CRITICAL: ViroReact caches transforms and ignores React state changes
      // Must use setNativeProps to force the native component to update
      if (this.arNodeRef) {
        this.arNodeRef.setNativeProps({
          position: newPosition,
          rotation: newRotation,
          scale: newScale,
        });
      }
    }
  },

  componentWillUnmount() {
    console.log('[ModelItemRender] componentWillUnmount - UUID:', this.props.modelIDProps.uuid);
    this._isMounted = false;
    // Clean up animation loop
    this._stopAnimationLoop();
  },

  // ===== JS-DRIVEN ANIMATION SYSTEM =====
  // ViroReact's animation prop on Viro3DObject causes native crashes (see README Section 4)
  // This system manually animates transforms using setNativeProps

  _startAnimationLoop() {
    if (this._animationInterval) return; // Already running

    const activeAnim = this._getActiveAnimationType();
    if (!activeAnim) return;

    console.log('[ModelItemRender] Starting JS animation loop:', activeAnim, 'for UUID:', this.props.modelIDProps.uuid);

    this._animationStartTime = Date.now();
    this._animationPhase = 0; // 0 = first half, 1 = second half

    // Run animation at 30fps (33ms interval)
    this._animationInterval = this.setInterval(() => {
      if (!this._isMounted || !this.arNodeRef) {
        this._stopAnimationLoop();
        return;
      }
      this._tickAnimation();
    }, 33);
  },

  _stopAnimationLoop() {
    if (this._animationInterval) {
      console.log('[ModelItemRender] Stopping JS animation loop for UUID:', this.props.modelIDProps.uuid);
      this.clearInterval(this._animationInterval);
      this._animationInterval = null;
    }
  },

  _getActiveAnimationType() {
    const objectAnims = this.props.objectAnimations || {};
    const animOrder = ['bounce', 'pulse', 'rotate', 'scale', 'wiggle', 'random'];
    for (const animType of animOrder) {
      if (objectAnims[animType]?.active) {
        return animType;
      }
    }
    return null;
  },

  _tickAnimation() {
    if (!this.arNodeRef) return;

    const objectAnims = this.props.objectAnimations || {};
    const elapsed = Date.now() - this._animationStartTime;

    // Calculate combined transform offsets from ALL active animations
    let positionOffset = [0, 0, 0];
    let rotationOffset = [0, 0, 0];
    let scaleMultiplier = [1, 1, 1];

    // Process each animation type
    const animOrder = ['bounce', 'pulse', 'rotate', 'scale', 'wiggle', 'random'];

    for (const animType of animOrder) {
      const animData = objectAnims[animType];
      if (!animData?.active) continue;

      const intensity = animData.intensity || 1.0;
      const cycleDuration = this._getAnimationCycleDuration(animType);
      const cycleProgress = (elapsed % cycleDuration) / cycleDuration;

      switch (animType) {
        case 'bounce':
          // Bounce up and down - sine wave on Y position
          const bounceHeight = 0.15 * intensity;
          positionOffset[1] += Math.sin(cycleProgress * Math.PI * 2) * bounceHeight;
          break;

        case 'pulse':
          // Pulse scale up and down (multiplicative, so we accumulate)
          const pulseAmount = 0.15 * intensity;
          const pulseFactor = 1 + Math.sin(cycleProgress * Math.PI * 2) * pulseAmount;
          scaleMultiplier[0] *= pulseFactor;
          scaleMultiplier[1] *= pulseFactor;
          scaleMultiplier[2] *= pulseFactor;
          break;

        case 'rotate':
          // Continuous rotation on selected axes (additive)
          const rotateSpeed = intensity; // 1.0 = 1 full rotation per cycle
          const rotateAngle = cycleProgress * 360 * rotateSpeed;
          const axis = animData.axis || { x: false, y: true, z: false }; // Default to Y-axis
          if (axis.x) rotationOffset[0] += rotateAngle;
          if (axis.y) rotationOffset[1] += rotateAngle;
          if (axis.z) rotationOffset[2] += rotateAngle;
          break;

        case 'scale':
          // Scale up and down (larger amplitude)
          const scaleAmount = 0.3 * intensity;
          const scaleFactor = 1 + Math.sin(cycleProgress * Math.PI * 2) * scaleAmount;
          scaleMultiplier[0] *= scaleFactor;
          scaleMultiplier[1] *= scaleFactor;
          scaleMultiplier[2] *= scaleFactor;
          break;

        case 'wiggle':
          // Wiggle rotation on Z axis
          const wiggleAngle = 5 * intensity;
          rotationOffset[2] += Math.sin(cycleProgress * Math.PI * 4) * wiggleAngle;
          break;

        case 'random':
        case 'float':
          // Ocean wave-like looping motion using Lissajous curves
          // Creates organic floating movement that always returns to origin
          // Uses different frequencies for each axis to create complex but looping path
          const distance = animData.distance || 1.0; // Distance multiplier for travel range
          const baseAmplitude = 0.1 * intensity * distance; // Intensity controls feel, distance controls range

          // Lissajous curve parameters - different frequencies create organic looping
          // X: slow drift left-right (frequency ratio 2)
          // Y: gentle bob up-down (frequency ratio 3)  
          // Z: medium drift forward-back (frequency ratio 2, phase shifted)

          const xFreq = 2; // Completes 2 cycles per loop
          const yFreq = 3; // Completes 3 cycles per loop (creates figure-8 style)
          const zFreq = 2; // Same as X but phase shifted

          // Phase offsets create the "pushed around" feeling
          const xPhase = 0;
          const yPhase = Math.PI / 4; // 45 degree offset
          const zPhase = Math.PI / 2; // 90 degree offset from X

          // Calculate position offsets following the Lissajous curve
          positionOffset[0] += Math.sin(cycleProgress * Math.PI * 2 * xFreq + xPhase) * baseAmplitude;
          positionOffset[1] += Math.sin(cycleProgress * Math.PI * 2 * yFreq + yPhase) * baseAmplitude * 0.6; // Y is more subtle
          positionOffset[2] += Math.sin(cycleProgress * Math.PI * 2 * zFreq + zPhase) * baseAmplitude;
          break;
      }
    }

    // Apply combined transforms via setNativeProps
    const basePosition = this.state.position;
    const baseRotation = this.state.rotation;
    const baseScale = this.state.scale;

    const newPosition = [
      basePosition[0] + positionOffset[0],
      basePosition[1] + positionOffset[1],
      basePosition[2] + positionOffset[2],
    ];
    const newRotation = [
      baseRotation[0] + rotationOffset[0],
      baseRotation[1] + rotationOffset[1],
      baseRotation[2] + rotationOffset[2],
    ];
    const newScale = [
      baseScale[0] * scaleMultiplier[0],
      baseScale[1] * scaleMultiplier[1],
      baseScale[2] * scaleMultiplier[2],
    ];

    this.arNodeRef.setNativeProps({
      position: newPosition,
      rotation: newRotation,
      scale: newScale,
    });
  },

  _getAnimationCycleDuration(animType) {
    // Duration in milliseconds for one complete cycle
    switch (animType) {
      case 'bounce': return 600;
      case 'pulse': return 800;
      case 'rotate': return 2000;
      case 'scale': return 1000;
      case 'wiggle': return 300;
      case 'random':
      case 'float': return 4000; // 4 seconds for smooth Lissajous wave motion
      default: return 1000;
    }
  },

  _updateAnimationState() {
    const activeAnim = this._getActiveAnimationType();
    if (activeAnim && !this._animationInterval) {
      this._startAnimationLoop();
    } else if (!activeAnim && this._animationInterval) {
      this._stopAnimationLoop();
      // Reset to base transforms when animation stops
      if (this.arNodeRef && this._isMounted) {
        this.arNodeRef.setNativeProps({
          position: this.state.position,
          rotation: this.state.rotation,
          scale: this.state.scale,
        });
      }
    }
  },


  render: function () {
    const isCustom = this.props.modelIDProps.index === -1;
    var modelItem = isCustom ? this.props.modelIDProps : ModelData.getModelArray()[this.props.modelIDProps.index];

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

    // DEBUG: Log the raw objectAnimations prop
    console.log('[ModelItemRender] render() objectAnimations:', {
      uuid: this.props.modelIDProps.uuid,
      objectAnimations: JSON.stringify(this.props.objectAnimations),
      hasAnims: Object.keys(objectAnims).length > 0,
    });

    // Priority order: bounce, pulse, rotate, scale, wiggle, random
    const animOrder = ['bounce', 'pulse', 'rotate', 'scale', 'wiggle', 'random'];
    for (const animType of animOrder) {
      const animData = objectAnims[animType];
      if (animData) {
        console.log('[ModelItemRender] Found anim type:', animType, 'data:', animData, 'active:', animData?.active);
      }
      if (animData?.active) {
        // For rotate, check which axis
        if (animType === 'rotate') {
          const axis = animData.axis || { x: false, y: true, z: false };
          if (axis.x) animationName = 'rotateX';
          else if (axis.z) animationName = 'rotateZ';
          else animationName = 'rotateY';
        } else {
          animationName = animType;
        }
        activeAnimation = { name: animationName, run: true, loop: true };
        console.log('[ModelItemRender] *** Animation APPLIED ***:', animationName, 'for UUID:', this.props.modelIDProps.uuid);
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
        onDrag={this._onDrag}
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

        {/* Inner ViroNode for model-specific offset (ground alignment, pivot, etc.).
            This offset is defined in ModelItems.js and must be applied for all models,
            including draft-loaded ones, since the saved outer position doesn't include it. */}
        <ViroNode
          position={modelItem.position || [0, 0, 0]}>
          {/* Render model: bundled OR custom */}
          {(() => {
            // For custom models, use the remote URL directly (ViroReact supports remote GLB)
            let modelSource;
            if (isCustom) {
              // Use remote source directly
              modelSource = modelItem.source;
            } else {
              modelSource = modelItem.obj;
            }
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



          {/* Artifact Logic - Title Label */}
          {modelItem.artifact && modelItem.artifact.isArtifact && (
            <ViroText
              text={modelItem.artifact.title || "Artifact"}
              scale={[0.2, 0.2, 0.2]}
              position={[0, 0.6, 0]}
              transformBehaviors={["billboard"]}
            />
          )}

          {/* Artifact Logic - Floating Diamond Icon */}
          {modelItem.artifact && modelItem.artifact.isArtifact && (
            <ViroText
              text="💎"
              scale={[0.3, 0.3, 0.3]}
              position={[0, 0.9, 0]}
              style={styles.artifactIconStyle}
              transformBehaviors={["billboard"]}
              animation={{ name: "rotate", run: true, loop: true }}
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
      console.log('[ModelItemRender] _onClickState:', {
        uuid,
        clickState,
        position,
        itemClickedDown: this.state.itemClickedDown,
      });
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

        // Long-press timer for Y-lift mode (1000ms hold)
        this._longPressTimer = TimerMixin.setTimeout(
          () => {
            if (this._isMounted) {
              console.log('[ModelItemRender] Long-press detected - enabling Y-lift mode');
              this.setState({
                yLiftMode: true,
              });
            }
          },
          1000
        );
      }

      if (clickState == 2) { // clickstate == 2 -> "ClickUp"
        console.log('[ModelItemRender] ClickUp detected, itemClickedDown:', this.state.itemClickedDown);

        // Clear long-press timer
        if (this._longPressTimer) {
          TimerMixin.clearTimeout(this._longPressTimer);
          this._longPressTimer = null;
        }

        // If in Y-lift mode, lock the Y position and exit lift mode
        if (this.state.yLiftMode) {
          console.log('[ModelItemRender] Exiting Y-lift mode, locking Y at:', this.state.position[1]);
          this.setState({
            yLiftMode: false,
            lockedY: this.state.position[1], // Lock Y at current position
          });
        }

        // As explained above, within 200 ms, the user's intention is to "tap" the model -> toggle the animation start/stop
        if (this.state.itemClickedDown) {
          { this._onItemClicked() }
        }
        // Irrespective of 200 ms, we call the callback provided in props -> this brings up the context menu on top right
        console.log('[ModelItemRender] Calling onClickStateCallback with uuid:', uuid);
        this.props.onClickStateCallback(uuid, clickState, UIConstants.LIST_MODE_MODEL);
      }
    }
  },
  _onItemClicked() {
    if (!this._isMounted) return;
    this.setState({
      itemClickedDown: false,
    });
  },


  /*
   Drag handler - ViroReact provides dragToPos and source.
   ViroReact API: onDrag(dragToPos, source)
   - dragToPos: [x, y, z] array of the current drag position
   - source: drag event source (ViroNode always sends 1, not distinct start/drag/end states)
   
   Since ViroNode doesn't send distinct drag states, we sync position on every drag event.
   */
  _onDrag(dragToPos, source) {
    if (!this._isMounted) return;
    if (!dragToPos || !Array.isArray(dragToPos)) return;

    let newPosition;

    if (this.state.yLiftMode) {
      // Y-lift mode: Only Y changes, X and Z stay fixed
      newPosition = [
        this.state.position[0], // Keep current X
        dragToPos[1],           // Use dragged Y
        this.state.position[2]  // Keep current Z
      ];
    } else if (this.state.lockedY !== null) {
      // Locked Y mode: X and Z can change, Y stays at locked value
      newPosition = [
        dragToPos[0],           // Use dragged X
        this.state.lockedY,     // Keep locked Y
        dragToPos[2]            // Use dragged Z
      ];
    } else {
      // Normal drag: all axes free
      newPosition = dragToPos;
    }

    // Update state with new drag position
    this.setState({
      position: newPosition
    });

    // Throttle Redux updates to avoid overwhelming the store
    // Sync every 100ms at most
    const now = Date.now();
    if (!this._lastDragSync || now - this._lastDragSync > 100) {
      this._lastDragSync = now;

      // Sync to Redux for serialization
      if (this.props.onTransformUpdate) {
        this.props.onTransformUpdate(this.props.modelIDProps.uuid, {
          scale: this.state.scale,
          position: newPosition,
          rotation: this.state.rotation,
        });
      }
    }
  },

  /*
   Rotation should be relative to its current rotation *not* set to the absolute
   value of the given rotationFactor.
   Note: rotationFactor from ViroReact is the cumulative rotation since gesture start.
   Note: ViroNode may not send distinct rotateState values (1/2/3), so we sync on every event.
   */
  _onRotate(rotateState, rotationFactor, source) {
    if (!this._isMounted) return;

    // State 1 or first event: Capture initial rotation
    if (rotateState === 1 || this._initialRotationY === null || this._initialRotationY === undefined) {
      this._initialRotationY = this.state.rotation[1];
    }

    // Calculate current rotation
    const currentRotationY = (this._initialRotationY || 0) + rotationFactor;
    const newRotation = [this.state.rotation[0], currentRotationY, this.state.rotation[2]];

    // Update visually
    if (this.arNodeRef) {
      this.arNodeRef.setNativeProps({ rotation: newRotation });
    }

    // Throttle Redux updates (like we do for drag)
    const now = Date.now();
    if (!this._lastRotateSync || now - this._lastRotateSync > 100) {
      this._lastRotateSync = now;

      // Update state
      this.setState({ rotation: newRotation });

      // Sync to Redux for serialization
      if (this.props.onTransformUpdate) {
        this.props.onTransformUpdate(this.props.modelIDProps.uuid, {
          scale: this.state.scale,
          position: this.state.position,
          rotation: newRotation,
        });
      }
    }

    // State 3: Rotation Ended - final sync
    if (rotateState === 3) {
      this.setState({ rotation: newRotation });

      if (this.props.onTransformUpdate) {
        this.props.onTransformUpdate(this.props.modelIDProps.uuid, {
          scale: this.state.scale,
          position: this.state.position,
          rotation: newRotation,
        });
      }

      this._initialRotationY = null; // Reset for next gesture
      this.props.onClickStateCallback(this.props.modelIDProps.uuid, rotateState, UIConstants.LIST_MODE_MODEL);
    }
  },

  /*
   Pinch scaling should be relative to its last value *not* the absolute value of the
   scale factor. So while the pinching is ongoing set scale through setNativeProps
   and multiply the state by that factor. At the end of a pinch event, set the state
   to the final value and store it in state.
   Note: ViroNode may not send distinct pinchState values, so we sync continuously.
   */
  _onPinch(pinchState, scaleFactor, source) {
    if (!this._isMounted) return;

    // State 1 or first event: Capture initial scale
    if (pinchState === 1 || !this._initialPinchScale) {
      this._initialPinchScale = this.state.scale;
    }

    // Calculate new scale
    const newScale = this._initialPinchScale.map((x) => x * scaleFactor);

    // Update state
    this.setState({ scale: newScale });

    // Throttle Redux updates
    const now = Date.now();
    if (!this._lastPinchSync || now - this._lastPinchSync > 100) {
      this._lastPinchSync = now;

      // Sync to Redux for serialization
      if (this.props.onTransformUpdate) {
        this.props.onTransformUpdate(this.props.modelIDProps.uuid, {
          scale: newScale,
          position: this.state.position,
          rotation: this.state.rotation,
        });
      }
    }

    // State 3: Pinch Ended - final sync and cleanup
    if (pinchState === 3) {
      if (this.props.onTransformUpdate) {
        this.props.onTransformUpdate(this.props.modelIDProps.uuid, {
          scale: newScale,
          position: this.state.position,
          rotation: this.state.rotation,
        });
      }

      this._initialPinchScale = null;
      this.props.onClickStateCallback(this.props.modelIDProps.uuid, pinchState, UIConstants.LIST_MODE_MODEL);
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

      // Check if model is loaded from draft - if so, skip placement and auto-scale
      // Use explicit isFromDraft flag (set by LOAD_SCENE reducer)
      const isLoadedFromDraft = this.props.modelIDProps.isFromDraft === true;

      if (isLoadedFromDraft) {
        // Draft-loaded models already have their position/scale set from getInitialState
        // Just make them visible without running hit test placement
        console.log('[ModelItemRender] Draft-loaded model, skipping hit test placement');
        this.setState({
          shouldBillboard: false,
          nodeIsVisible: true,
        });
        return;
      }

      // Only do hit test placement for NEW models
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
      // Sync current transforms to Redux (only for NEW models, not draft-loaded)
      if (!this._hasInitialSynced && this.props.modelIDProps.isFromDraft !== true) {
        this._hasInitialSynced = true;
        this._syncTransformToRedux();
      }
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
      const newRotation = [0, yRotation, 0];
      this.setState({
        rotation: newRotation,
        shouldBillboard: false,
        nodeIsVisible: true,
      });
      // Sync final transforms to Redux after placement (only for NEW models)
      if (!this._hasInitialSynced && this.props.modelIDProps.isFromDraft !== true) {
        this._hasInitialSynced = true;
        this._syncTransformToRedux(newRotation);
      }
    }).catch((error) => {
      console.warn('[ModelItemRender] _updateInitialRotation error:', error);
    });
  },

  _syncTransformToRedux(rotation) {
    // Get the ACTUAL world transform from ViroReact's native layer
    // React state position may be stale if drag updated the native position
    if (this.arNodeRef && this.arNodeRef.getTransformAsync) {
      this.arNodeRef.getTransformAsync().then((transform) => {
        console.log('[ModelItemRender] Syncing true world transform:', {
          uuid: this.props.modelIDProps.uuid,
          position: transform.position,
          rotation: transform.rotation,
          scale: this.state.scale,
        });

        if (this.props.onTransformUpdate) {
          this.props.onTransformUpdate(this.props.modelIDProps.uuid, {
            scale: this.state.scale,
            position: transform.position, // True world position from ViroReact
            rotation: rotation || transform.rotation,
          });
        }

        // Also update local state to match
        this.setState({
          position: transform.position,
          rotation: rotation || transform.rotation,
        });
      }).catch((error) => {
        console.warn('[ModelItemRender] getTransformAsync failed, using state:', error);
        // Fallback to state
        if (this.props.onTransformUpdate) {
          this.props.onTransformUpdate(this.props.modelIDProps.uuid, {
            scale: this.state.scale,
            position: this.state.position,
            rotation: rotation || this.state.rotation,
          });
        }
      });
    } else {
      // No ref available, use state
      if (this.props.onTransformUpdate) {
        this.props.onTransformUpdate(this.props.modelIDProps.uuid, {
          scale: this.state.scale,
          position: this.state.position,
          rotation: rotation || this.state.rotation,
        });
      }
    }
  },
});



ViroMaterials.createMaterials({
  pbr: {
    lightingModel: "PBR",
  },
});

// Register animations for Figment AR objects (following Viro documentation)
ViroAnimations.registerAnimations({
  // Bounce animation - sequential: up then down (using additive syntax)
  bounceUp: { properties: { positionY: "+=0.15" }, easing: "EaseInEaseOut", duration: 300 },
  bounceDown: { properties: { positionY: "-=0.15" }, easing: "EaseInEaseOut", duration: 300 },
  bounce: [["bounceUp", "bounceDown"]],

  // Pulse animation (scale) - using additive/multiplicative syntax for scale
  pulseGrow: { properties: { scaleX: "*=1.15", scaleY: "*=1.15", scaleZ: "*=1.15" }, easing: "EaseInEaseOut", duration: 400 },
  pulseShrink: { properties: { scaleX: "/=1.15", scaleY: "/=1.15", scaleZ: "/=1.15" }, easing: "EaseInEaseOut", duration: 400 },
  pulse: [["pulseGrow", "pulseShrink"]],

  // Rotate animations - loopable single rotation (additive)
  rotateY: { properties: { rotateY: "+=45" }, duration: 500 },
  rotateX: { properties: { rotateX: "+=45" }, duration: 500 },
  rotateZ: { properties: { rotateZ: "+=45" }, duration: 500 },

  // Scale animation (oscillating) - using multiplicative for relative scaling
  scaleGrow: { properties: { scaleX: "*=1.3", scaleY: "*=1.3", scaleZ: "*=1.3" }, easing: "EaseInEaseOut", duration: 500 },
  scaleShrink: { properties: { scaleX: "/=1.3", scaleY: "/=1.3", scaleZ: "/=1.3" }, easing: "EaseInEaseOut", duration: 500 },
  scale: [["scaleGrow", "scaleShrink"]],

  // Wiggle animation - sequential: left, right, center (additive rotation)
  wiggleLeft: { properties: { rotateZ: "+=5" }, easing: "EaseInEaseOut", duration: 100 },
  wiggleRight: { properties: { rotateZ: "-=10" }, easing: "EaseInEaseOut", duration: 100 },
  wiggleCenter: { properties: { rotateZ: "+=5" }, easing: "EaseInEaseOut", duration: 100 },
  wiggle: [["wiggleLeft", "wiggleRight", "wiggleCenter"]],

  // Float/random animation - gentle up and down motion
  floatUp: { properties: { positionY: "+=0.05" }, easing: "EaseInEaseOut", duration: 1000 },
  floatDown: { properties: { positionY: "-=0.05" }, easing: "EaseInEaseOut", duration: 1000 },
  random: [["floatUp", "floatDown"]],
});

var styles = StyleSheet.create({
  artifactTextStyle: {
    fontFamily: 'Arial',
    fontSize: 30,
    color: '#ffffff',
    textAlignVertical: 'center',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  artifactIconStyle: {
    fontSize: 40,
    textAlignVertical: 'center',
    textAlign: 'center',
  }
});

module.exports = ModelItemRender;

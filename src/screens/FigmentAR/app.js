/**
 * Copyright (c) 2017-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { connect } from 'react-redux';
import { addPortalWithIndex, removePortalWithUUID, addModelWithIndex, removeAll, removeModelWithUUID, toggleEffectSelection, changePortalLoadState, changePortalPhoto, changeModelLoadState, changeItemClickState, switchListMode, removeARObject, displayUIScreen } from './redux/actions';
import TimerMixin from 'react-timer-mixin';

import * as LoadingConstants from './redux/LoadingStateConstants';
import * as UIConstants from './redux/UIConstants';
import renderIf from './helpers/renderIf';
import ButtonComponent from './component/ButtonComponent';
import RecordButton from './component/RecordButton';
import ContextMenuButton from './component/ContextMenuButton';
import SuccessAnimation from './component/SuccessAnimation';
import ShareScreenButton from './component/ShareScreenButtonComponent';
import FigmentListView from './component/FigmentListView';
import PhotosSelector from './component/PhotosSelector';
import ARInitializationUI from './component/ARInitializationUI.js';
import * as ModelData from './model/ModelItems';
import * as PortalData from './model/PortalItems';

const kObjSelectMode = 1;
const kPortalSelectMode = 2;
const kEffectSelectMode = 3;

const kPreviewTypePhoto = 1;
const kPreviewTypeVideo = 2;


import {
  AppRegistry,
  Text,
  View,
  StyleSheet,
  PixelRatio,
  Image,
  TouchableHighlight,
  TouchableOpacity,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Button,
  StatusBar,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

import {
  ViroARSceneNavigator,
  ViroRecordingErrorConstants,
} from '@reactvision/react-viro';

import Share from 'react-native-share';
import Video from 'react-native-video';
import { Svg, Circle, Line } from 'react-native-svg';
import { startInAppRecording, stopInAppRecording, cancelInAppRecording } from 'react-native-nitro-screen-recorder';

// Recording constants
const MAX_DURATION = 15000; // 15 seconds max

// AR Scene that's rendered on the MAIN Screen. App state changes propagate to figment.js via redux 
var InitialScene = require('./figment');
/**
 * Entry point of the app. This class also connects and orchestrates the interaction between 2D UI component and 3D Viro components using redux
 */
export class App extends Component {

  constructor(props) {
    super(props);

    this._renderShareScreen = this._renderShareScreen.bind(this);
    this._renderRecord = this._renderRecord.bind(this);
    this.handleRecordPressIn = this.handleRecordPressIn.bind(this);
    this.handleRecordPressOut = this.handleRecordPressOut.bind(this);
    this.handleRecordConfirm = this.handleRecordConfirm.bind(this);
    this.handleRecordCancel = this.handleRecordCancel.bind(this);
    this._setARNavigatorRef = this._setARNavigatorRef.bind(this);
    this._onListItemLoaded = this._onListItemLoaded.bind(this);
    this._onListPressed = this._onListPressed.bind(this);
    this._getListItems = this._getListItems.bind(this);
    this._saveToCameraRoll = this._saveToCameraRoll.bind(this);
    this._renderPhotosSelector = this._renderPhotosSelector.bind(this);
    this._takeScreenshot = this._takeScreenshot.bind(this);
    this._onPhotoSelected = this._onPhotoSelected.bind(this);
    this._onItemClickedInScene = this._onItemClickedInScene.bind(this);
    this._onContextMenuRemoveButtonPressed = this._onContextMenuRemoveButtonPressed.bind(this);
    this._startStopWatch = this._startStopWatch.bind(this);
    this._getLoadingforModelIndex = this._getLoadingforModelIndex.bind(this);
    this._constructListArrayModel = this._constructListArrayModel.bind(this);
    this._onContextClearAll = this._onContextClearAll.bind(this);
    this.requestAudioPermission = this.requestAudioPermission.bind(this);
    this.requestWriteAccessPermission = this.requestWriteAccessPermission.bind(this);
    this.requestReadAccessPermission = this.requestReadAccessPermission.bind(this);

    this.state = {
      currentModeSelected: kObjSelectMode,
      videoUrl: null,
      haveSavedMedia: false,
      playPreview: false,
      viroAppProps: { loadingObjectCallback: this._onListItemLoaded, clickStateCallback: this._onItemClickedInScene },
      showPhotosSelector: false,
      previewType: kPreviewTypeVideo,
      lastSelectedPortalUUID: -1,
      timer: null,
      hours: '00',
      minutes: '00',
      seconds: '00',
      miliseconds: '00',
      recordStartTimeInMillis: 0,
      cameraPermission: false,
      audioPermission: false,
      writeAccessPermission: false,
      readAccessPermission: false,
      screenshot_count: 0,
      // Hold-to-record state
      recordingProgress: 0, // Current recording progress in ms
      isActivelyRecording: false, // True while finger is held down
      pauseMarkers: [], // Array of pause marker positions (milliseconds)
      showConfirmButtons: false, // Show confirm/delete after recording
    };
  }

  // This render() function renders the AR Scene in <ViroARSceneNavigator> with the <ViroARScene> defined in figment.js
  // Rest of the components in <View> ... </View> render 2D UI components (React-Native)
  render() {
    // Check if recording is in progress (either actively recording or paused but still capturing)
    const isRecordingInProgress = this.state.isActivelyRecording ||
      (this.state.recordingProgress > 0 && !this.state.showConfirmButtons);

    return (
      <View style={localStyles.flex}>
        <StatusBar hidden={true} />
        <ViroARSceneNavigator style={localStyles.arView}
          apiKey="YOUR-API-KEY-HERE"
          initialScene={{ scene: InitialScene }}
          ref={this._setARNavigatorRef}
          viroAppProps={this.state.viroAppProps} />

        {/* Close button - top left */}
        {!isRecordingInProgress && this.props.currentScreen === UIConstants.SHOW_MAIN_SCREEN && (
          <TouchableOpacity
            onPress={() => this.props.navigation?.goBack?.()}
            style={{ position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ color: 'white', fontSize: 20 }}>✕</Text>
          </TouchableOpacity>
        )}

        {/* AR Initialization animation - hide during recording */}
        {!isRecordingInProgress && (
          <ARInitializationUI style={{ position: 'absolute', top: 20, left: 0, right: 0, width: '100%', height: 140, flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }} />
        )}

        {/* 2D UI buttons on top right of the app - hide during recording */}
        {!isRecordingInProgress && this._renderContextMenu()}

        {/* 2D UI for sharing rendered after user finishes taking a video / screenshot */}
        {this._renderShareScreen()}

        {/* 2D UI rendered to enable the user changing background for Portals - hide during recording */}
        {!isRecordingInProgress && this._renderPhotosSelector()}

        {/* Timeline (Top) */}
        {this._renderRecord()}

        {/* Bottom Controls (Picker + Toolbar + Record Button) - Flexbox Container */}
        {this._renderBottomControls()}
      </View>
    );
  }

  async requestAudioPermission() {
    if (Platform.OS !== 'android') return;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          'title': 'Figment AR Audio Permission',
          'message': 'Figment AR App needs to access your audio ' +
            'so you can record videos with audio of ' +
            'your augmented scenes.'
        }
      )
      if (granted == PermissionsAndroid.RESULTS.GRANTED) {
        this.setState({
          audioPermission: true,
        });
      } else {
        this.setState({
          cameraPermission: false,
        });
      }
    } catch (err) {
      console.warn("[PermissionsAndroid]" + err)
    }
  }

  async requestWriteAccessPermission() {
    if (Platform.OS !== 'android') return;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          'title': 'Figment AR Audio Permission',
          'message': 'Figment AR App needs to access your photos / videos ' +
            'so you can record cool videos and photos of' +
            'your augmented scenes.'
        }
      )
      if (granted == PermissionsAndroid.RESULTS.GRANTED) {
        this.setState({
          writeAccessPermission: true,
        });
      } else {
        this.setState({
          writeAccessPermission: false,
        });
      }
    } catch (err) {
      console.warn("[PermissionsAndroid]" + err)
    }
  }

  async requestReadAccessPermission() {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          'title': 'Figment AR Audio Permission',
          'message': 'Figment AR App needs to access your audio ' +
            'so you can view your own images in portals.'
        }
      )
      if (granted == PermissionsAndroid.RESULTS.GRANTED) {
        this.setState({
          readAccessPermission: true,
        });
      } else {
        this.setState({
          readAccessPermission: false,
        });
      }
    } catch (err) {
      console.warn("[PermissionsAndroid]" + err)
    }
  }

  // Context Menu is the collection of three buttons that appear on the top right with "Remove object (or Portal)", "Clear All" and "Photo Selector (Only for Portals)"
  _renderContextMenu() {
    var selectedItemIndex = this.props.currentItemSelectionIndex;
    var clickState = this.props.currentItemClickState;
    var totalHeight = 120;
    if (this.props.currentSelectedItemType != UIConstants.LIST_MODE_PORTAL) {
      totalHeight = 80;
    }
    if (selectedItemIndex != -1 && clickState == 2) {
      // If a valid object (or portal) was clicked, reset the items "click state" after 3.5 seconds 
      // So that the item can "clicked" again.
      TimerMixin.setTimeout(
        () => {
          this.props.dispatchChangeItemClickState(-1, '', '');
        },
        3500
      );
    }
    return (
      <View style={{ flex: 1, position: 'absolute', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', top: '25%', right: 10, width: 80, height: 220 }}>
        <View style={{ flex: .45, flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', right: 0, top: 20, width: 80 }}>
          {renderIf(this.props.currentItemSelectionIndex != -1 && (this.state.showPhotosSelector == false),
            <ContextMenuButton onPress={this._onContextMenuRemoveButtonPressed}
              stateImageArray={[require("./res/btn_trash.png")]}
              style={localStyles.previewScreenButtons} />
          )}

          {renderIf(this.props.currentItemSelectionIndex != -1 && (this.state.showPhotosSelector == false),
            <ContextMenuButton onPress={this._onContextClearAll}
              stateImageArray={[require("./res/btn_clear_all.png")]}
              style={localStyles.previewScreenButtons} />
          )}

        </View>
        <View style={{ flex: .2, flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end', width: 80 }}>
          {renderIf(this.props.currentItemSelectionIndex != -1 && (this.props.currentSelectedItemType == UIConstants.LIST_MODE_PORTAL) && (this.state.showPhotosSelector == false),
            <ContextMenuButton onPress={() => { this.setState({ showPhotosSelector: true, lastSelectedPortalUUID: this.props.currentItemSelectionIndex }) }}
              stateImageArray={[require("./res/btn_add_pic_v2.png")]}
              style={localStyles.previewScreenButtonsAddPic} />
          )}
        </View>
      </View>

    );
  }

  // Remove button from Context Menu pressed
  _onContextMenuRemoveButtonPressed() {
    var uuid = this.props.currentItemSelectionIndex;
    var itemType = this.props.currentSelectedItemType;

    if (uuid == -1 || this.props.currentItemClickState == '') {
      return;
    }

    // First, reset click state immediately so the context menu disappears
    this.props.dispatchChangeItemClickState(-1, '', '');

    // For portals, also reset load state
    if (itemType == UIConstants.LIST_MODE_PORTAL) {
      if (this.props.portalItems[uuid] && this.props.portalItems[uuid].selected == true) {
        this.props.dispatchChangePortalLoadState(uuid, LoadingConstants.NONE);
      }
      this.setState({
        lastSelectedPortalUUID: -1,
      });
    }

    // Delay the actual removal to give ViroReact time to clean up native resources
    TimerMixin.setTimeout(() => {
      if (itemType == UIConstants.LIST_MODE_MODEL) {
        this.props.dispatchRemoveModelWithUUID(uuid);
      } else if (itemType == UIConstants.LIST_MODE_PORTAL) {
        this.props.dispatchRemovePortalWithUUID(uuid);
      }
    }, 200);
  }

  // Clear All button was pressed
  _onContextClearAll() {
    // First reset click state
    this.props.dispatchChangeItemClickState(-1, '', '');

    Alert.alert(
      "Remove All Objects",
      "Are you sure you want to clear the entire scene?",
      [
        { text: 'Cancel', onPress: () => { } },
        {
          text: 'OK', onPress: () => {
            // Delay the removal
            TimerMixin.setTimeout(() => {
              this.props.dispatchRemoveAll();
            }, 200);
          }
        },
      ],
    );
  }

  // Photo Selector from ContextMenu was pressed
  _renderPhotosSelector() {

    if (this.state.showPhotosSelector == true) {
      // check for read permissions
      if (!this.state.readAccessPermission) {
        this.requestReadAccessPermission();
      }
      var photoSelectorViews = [];
      photoSelectorViews.push(<StatusBar key="statusBarKey" hidden={true} />);
      photoSelectorViews.push(<View key="topPhotoBar" style={localStyles.topPhotoBar}>
        <View style={{ flex: 1, backgroundColor: "#00000000", justifyContent: 'center', alignItems: 'center' }} />
        <Text style={localStyles.photosText}>My Photos</Text>
        <Text onPress={() => { this.setState({ showPhotosSelector: false }) }}
          style={localStyles.doneText}>Done</Text>
      </View>);
      photoSelectorViews.push(<PhotosSelector key="photosSelector" style={localStyles.photosSelectorStyle} rows={2.3} columns={4}
        onPhotoSelected={this._onPhotoSelected} />);
      return photoSelectorViews;
    }
    return null;
  }

  // Photo selected from Photo Selector
  _onPhotoSelected(index, source) {
    this.props.dispatchChangePortalPhoto(this.state.lastSelectedPortalUUID, source);
  }

  // Helper function called while initializing <ViroARSceneNavigator>
  _setARNavigatorRef(ARNavigator) {
    this._arNavigator = ARNavigator;
  }

  // Render UI for Share Screen, shown after taking a video / image screenshot
  _renderShareScreen() {
    if (this.props.currentScreen == UIConstants.SHOW_SHARE_SCREEN) {
      return (
        <View style={localStyles.shareScreenContainerTransparent} >

          {/* If previewType == photo, show the image on share screen*/}
          {renderIf(this.state.previewType == kPreviewTypePhoto,
            <Image source={{ uri: this.state.videoUrl }} style={localStyles.backgroundImage} resizeMethod={'resize'} />)}

          {/* If previewType == video, play the video on share screen*/}
          {/* With react-native-video, if you turn repeat to true and then onEnd pause
            the video, you'll end up with black screen. So we set repeat to false
            and instead seek to 0 when we want to play the video again (seeking will auto start
            the video player too*/}
          {renderIf(this.state.previewType == kPreviewTypeVideo,
            <Video ref={(ref) => { this.player = ref }}
              source={{ uri: this.state.videoUrl }} paused={!this.state.playPreview}
              repeat={false} style={localStyles.backgroundVideo}
              onEnd={() => { this.setState({ playPreview: false }) }} />
          )}

          {/* Overlay Play button on top of video, after playing it once. Clicking this button would seek video to 0 and play it again */}
          {renderIf(!this.state.playPreview && (this.state.previewType == kPreviewTypeVideo),
            <View style={{
              position: 'absolute', flex: 1, flexDirection: 'column',
              width: 90, top: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center'
            }}>
              <TouchableOpacity onPress={() => { this.player.seek(0); this.setState({ playPreview: true }) }} style={localStyles.previewPlayButtonContainer} underlayColor="#00000000">
                <Image source={require("./res/btn_play.png")} style={localStyles.previewPlayButton} />
              </TouchableOpacity>
            </View>
          )}

          {/* Close button -> Takes user back to main screen */}
          <View style={{ position: 'absolute', left: 20, top: 20, width: 30, height: 30 }}>
            <ShareScreenButton onPress={() => { this.props.dispatchDisplayUIScreen(UIConstants.SHOW_MAIN_SCREEN) }}
              buttonState={'off'}
              stateImageArray={[require("./res/btn_close.png"), require("./res/btn_close.png")]}
              style={localStyles.previewScreenButtonClose} />
          </View>

          {/* Button to save media to camera roll */}
          <View style={{ position: 'absolute', left: 20, bottom: 20, width: 40, height: 40 }}>
            <ShareScreenButton onPress={() => { this._saveToCameraRoll() }}
              buttonState={this.state.haveSavedMedia ? 'on' : 'off'}
              stateImageArray={[require("./res/btn_saved.png"), require("./res/btn_save.png")]}
              style={localStyles.previewScreenButtonShare} />
          </View>

          {/* Save to media operation success indicator */}
          {renderIf(this.state.haveSavedMedia,
            <SuccessAnimation onPress={() => { }}
              stateImageArray={[require("./res/icon_success.png")]}
              style={localStyles.previewSavedSuccess} />
          )}

          {/* Share button -> Opens Share Action Sheet to enable user to share media to their social media destination of choice */}
          <View style={{ position: 'absolute', left: 85, bottom: 20, width: 40, height: 40 }}>
            <ShareScreenButton onPress={() => { this._openShareActionSheet() }}
              buttonState={'off'}
              stateImageArray={[require("./res/btn_share.png"), require("./res/btn_share.png")]}
              style={localStyles.previewScreenButtonShare} />
          </View>
        </View>
      )
    }
  }

  // This menu shows up over the AR view at bottom left side of the screen, centered vertically and consists of 3 buttons
  // to toggle listview contents between Portals, Effects and Objects.


  // Render Top Timeline for Recording
  _renderRecord() {
    // Only render if recording or confirming
    if (!this.state.isActivelyRecording && !this.state.showConfirmButtons) return null;

    const progressSeconds = Math.floor(this.state.recordingProgress / 1000);
    const progressText = `00:${progressSeconds.toString().padStart(2, '0')}`;

    return (
      <View key="record_timeline" style={{ position: 'absolute', backgroundColor: '#00000066', left: 0, right: 0, top: 0, height: 34, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={localStyles.recordingTimeText}>{progressText}</Text>
      </View>
    );
  }

  // Combined Bottom Controls (Picker, Toolbar, Record Button)
  _renderBottomControls() {
    const isPortals = this.props.listMode === UIConstants.LIST_MODE_PORTAL;
    const isEffects = this.props.listMode === UIConstants.LIST_MODE_EFFECT;
    const isModels = this.props.listMode === UIConstants.LIST_MODE_MODEL;

    // Check if we should show the non-recording UI (Picker + Toolbar)
    const showSelectionUI = !this.state.isActivelyRecording && !this.state.showConfirmButtons && !this.state.showPhotosSelector && this.props.currentScreen === UIConstants.SHOW_MAIN_SCREEN;

    const shouldShowPicker = showSelectionUI && (isPortals || isEffects || isModels);

    // SVG Progress logic
    const circumference = 2 * Math.PI * 45;
    const progress = this.state.recordingProgress / MAX_DURATION;
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 40, flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: 'box-none' }}>

        {/* 1. Picker Container */}
        {shouldShowPicker && (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingVertical: 12, marginBottom: 25, maxWidth: '90%', overflow: 'hidden' }}>
            <FigmentListView items={this._getListItems()} onPress={this._onListPressed} />
          </View>
        )}

        {/* 2. Toolbar */}
        {showSelectionUI && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 25 }}>
            {/* Portals */}
            <TouchableOpacity
              onPress={() => { this.props.dispatchSwitchListMode(UIConstants.LIST_MODE_PORTAL, UIConstants.LIST_TITLE_PORTALS) }}
              style={{ alignItems: 'center', marginHorizontal: 15, opacity: isPortals ? 1 : 0.6 }}
            >
              <Image
                source={isPortals ? require("./res/btn_mode_portals_on.png") : require("./res/btn_mode_portals.png")}
                style={{ width: 40, height: 40 }}
              />
              <Text style={{ color: 'white', fontSize: 10, marginTop: 4 }}>Portals</Text>
            </TouchableOpacity>

            {/* Effects */}
            <TouchableOpacity
              onPress={() => { this.props.dispatchSwitchListMode(UIConstants.LIST_MODE_EFFECT, UIConstants.LIST_TITLE_EFFECTS) }}
              style={{ alignItems: 'center', marginHorizontal: 15, opacity: isEffects ? 1 : 0.6 }}
            >
              <Image
                source={isEffects ? require("./res/btn_mode_effects_on.png") : require("./res/btn_mode_effects.png")}
                style={{ width: 40, height: 40 }}
              />
              <Text style={{ color: 'white', fontSize: 10, marginTop: 4 }}>Effects</Text>
            </TouchableOpacity>

            {/* Objects */}
            <TouchableOpacity
              onPress={() => { this.props.dispatchSwitchListMode(UIConstants.LIST_MODE_MODEL, UIConstants.LIST_TITLE_MODELS) }}
              style={{ alignItems: 'center', marginHorizontal: 15, opacity: isModels ? 1 : 0.6 }}
            >
              <Image
                source={isModels ? require("./res/btn_mode_objects_on.png") : require("./res/btn_mode_objects.png")}
                style={{ width: 40, height: 40 }}
              />
              <Text style={{ color: 'white', fontSize: 10, marginTop: 4 }}>Objects</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Record/Controls Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 100 }}>
          {/* Cancel Button - visible when we have some recording */}
          {this.state.showConfirmButtons ? (
            <TouchableOpacity
              key="cancel_button"
              onPress={this.handleRecordCancel}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 20 }}
            >
              <Text style={{ color: 'white', fontSize: 24 }}>✕</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44, marginRight: 20 }} />
          )}

          {/* Main Record Button - Always visible to allow resume */}
          <TouchableOpacity
            key="record_button"
            onPressIn={this.handleRecordPressIn}
            onPressOut={this.handleRecordPressOut}
            activeOpacity={1}
            disabled={this.state.recordingProgress >= MAX_DURATION}
          >
            <Svg height="100" width="100" viewBox="0 0 100 100">
              {/* Background circle */}
              <Circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.3)" strokeWidth="6" fill="none" />
              {/* Progress ring */}
              {this.state.recordingProgress > 0 && (
                <Circle cx="50" cy="50" r="45" stroke="#FF3050" strokeWidth="6" fill="none"
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round" rotation="-90" origin="50, 50" />
              )}
              {/* Cut markers */}
              {this.state.pauseMarkers.map((markerDuration, i) => {
                const markerProgress = markerDuration / MAX_DURATION;
                const angle = markerProgress * 360 - 90;
                const rad = (angle * Math.PI) / 180;
                const x1 = 50 + 38 * Math.cos(rad);
                const y1 = 50 + 38 * Math.sin(rad);
                const x2 = 50 + 52 * Math.cos(rad);
                const y2 = 50 + 52 * Math.sin(rad);
                return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="black" strokeWidth="2" />;
              })}
              {/* Inner Circle Red Fill when recording */}
              <Circle cx="50" cy="50" r={this.state.isActivelyRecording ? "35" : "40"} fill="#FF3050" />
            </Svg>
          </TouchableOpacity>

          {/* Confirm Button - visible when we have some recording */}
          {this.state.showConfirmButtons ? (
            <TouchableOpacity
              key="confirm_button"
              onPress={this.handleRecordConfirm}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF3050', justifyContent: 'center', alignItems: 'center', marginLeft: 20 }}
            >
              <Text style={{ color: 'white', fontSize: 24 }}>✓</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44, marginLeft: 20 }} />
          )}
        </View>

      </View>
    );
  }

  _takeScreenshot() {
    // check for write permissions, if not then request
    if (!this.state.writeAccessPermission) {
      this.requestWriteAccessPermission();
    }

    this._arNavigator.sceneNavigator.takeScreenshot("figment_still_" + this.state.screenshot_count, false).then((retDict) => {
      if (!retDict.success) {
        if (retDict.errorCode == ViroRecordingErrorConstants.RECORD_ERROR_NO_PERMISSION) {
          this._displayVideoRecordAlert("Screenshot Error", "Please allow camera permissions!" + errorCode);
        }
      }
      let currentCount = this.state.screenshot_count + 1;
      this.setState({
        videoUrl: "file://" + retDict.url,
        haveSavedMedia: false,
        playPreview: false,
        previewType: kPreviewTypePhoto,
        screenshot_count: currentCount,
      });
      this.props.dispatchDisplayUIScreen(UIConstants.SHOW_SHARE_SCREEN);
    });
  }

  // Handle Record Press In - Start recording when user presses down
  async handleRecordPressIn() {
    if (this.state.recordingProgress >= MAX_DURATION) return;

    // Check permissions
    if (!this.state.audioPermission) {
      this.requestAudioPermission();
    }

    try {
      // Start screen recording using nitro-screen-recorder ONLY IF STARTING NEW
      if (this.state.recordingProgress === 0) {
        await startInAppRecording({
          options: {
            enableMic: true,
            enableCamera: false,
          },
          onRecordingFinished: (file) => {
            if (file && file.path) {
              this.setState({ videoUrl: 'file://' + file.path });
            }
          },
        });
      }
    } catch (error) {
      this._displayVideoRecordAlert("Recording Error", "Could not start recording: " + error.message);
      return;
    }

    // Set recording state
    this.setState({
      isActivelyRecording: true,
      showConfirmButtons: false,
      recordStartTimeInMillis: Date.now(),
    });

    // Start progress timer
    this._recordingTimer = TimerMixin.setInterval(() => {
      const elapsed = Date.now() - this.state.recordStartTimeInMillis;
      const newProgress = this.state.recordingProgress + elapsed;

      if (newProgress >= MAX_DURATION) {
        this.setState({ recordingProgress: MAX_DURATION });
        this.handleRecordPressOut();
      } else {
        this.setState({
          recordingProgress: newProgress,
          recordStartTimeInMillis: Date.now(),
        });
      }
    }, 50);

    this.props.dispatchDisplayUIScreen(UIConstants.SHOW_RECORDING_SCREEN);
  }

  // Stopwatch at the top while recording
  _startStopWatch() {

    let timer = TimerMixin.setInterval(() => {

      var seconds = (Number(this.state.seconds) + 1).toString(),
        minutes = this.state.minutes,
        hours = this.state.hours;

      if (Number(this.state.seconds) == 59) {
        minutes = (Number(this.state.minutes) + 1).toString();
        seconds = '00';
      }

      if (Number(this.state.minutes) == 59) {
        hours = (Number(this.state.hours) + 1).toString();
        minutes = '00';
        seconds = '00';
      }

      this.setState({
        hours: hours.length == 1 ? '0' + hours : hours,
        minutes: minutes.length == 1 ? '0' + minutes : minutes,
        seconds: seconds.length == 1 ? '0' + seconds : seconds,
      });
    }, 1000);
    this.setState({
      timer: timer,
      recordStartTimeInMillis: (new Date).getTime(),
    });
  }

  // Handle Record Press Out - Pause recording visually when user lifts finger
  // NOTE: Recording continues in background - only stopped on confirm
  handleRecordPressOut() {
    if (!this.state.isActivelyRecording) return;

    // Stop progress timer (but recording continues in background)
    if (this._recordingTimer) {
      TimerMixin.clearInterval(this._recordingTimer);
      this._recordingTimer = null;
    }

    // Add pause marker at current progress
    const newMarkers = [...this.state.pauseMarkers, this.state.recordingProgress];

    // DON'T stop recording here - just pause the UI
    this.setState({
      isActivelyRecording: false,
      pauseMarkers: newMarkers,
      showConfirmButtons: true,
    });

    this.props.dispatchDisplayUIScreen(UIConstants.SHOW_MAIN_SCREEN);
  }

  // Handle confirm button - stop recording and navigate to share screen
  async handleRecordConfirm() {
    try {
      const file = await stopInAppRecording();

      if (file && file.path) {
        const videoUrl = 'file://' + file.path;
        this.setState({
          videoUrl: videoUrl,
          showConfirmButtons: false,
          haveSavedMedia: false,
          playPreview: true,
          previewType: kPreviewTypeVideo,
          recordingProgress: 0,
          pauseMarkers: [],
        }, () => {
          this.props.dispatchDisplayUIScreen(UIConstants.SHOW_SHARE_SCREEN);
        });
      } else if (this.state.videoUrl) {
        this.setState({
          showConfirmButtons: false,
          haveSavedMedia: false,
          playPreview: true,
          previewType: kPreviewTypeVideo,
          recordingProgress: 0,
          pauseMarkers: [],
        }, () => {
          this.props.dispatchDisplayUIScreen(UIConstants.SHOW_SHARE_SCREEN);
        });
      } else {
        Alert.alert('Recording Error', 'No video was recorded.');
        this.handleRecordCancel();
      }
    } catch (error) {
      Alert.alert('Recording Error', 'Failed to save recording.');
      this.handleRecordCancel();
    }
  }

  // Handle cancel button - cancel recording and reset state
  async handleRecordCancel() {
    try {
      await cancelInAppRecording();
    } catch (error) {
      // May fail if no recording in progress
    }

    this.setState({
      recordingProgress: 0,
      pauseMarkers: [],
      showConfirmButtons: false,
      videoUrl: null,
      isActivelyRecording: false,
    });
  }

  _saveToCameraRoll() {
    if (this.state.videoUrl != undefined && !this.state.haveSavedMedia) {
      this.setState({
        haveSavedMedia: true
      })
    }
    CameraRoll.saveToCameraRoll(this.state.videoUrl);
  }

  _displayVideoRecordAlert(title, message) {
    Alert.alert(
      title,
      message,
      [
        { text: 'OK', onPress: () => this.props.dispatchDisplayUIScreen(UIConstants.SHOW_MAIN_SCREEN) },
      ],
      { cancelable: false }
    )
  }

  // Dispatch correct event to redux for adding AR Objects, Portals and Effects in the scene 
  _onListPressed(index) {
    if (this.props.listMode == UIConstants.LIST_MODE_MODEL) {
      this.props.dispatchAddModel(index);
    }

    if (this.props.listMode == UIConstants.LIST_MODE_PORTAL) {
      this.props.dispatchAddPortal(index);
    }

    if (this.props.listMode == UIConstants.LIST_MODE_EFFECT) {
      this.props.dispatchToggleEffectSelection(index);
    }
  }

  // Dispath correct event to redux for handling load states of Objects and Portals
  _onListItemLoaded(index, loadState) {
    if (this.props.listMode == UIConstants.LIST_MODE_MODEL) {
      this.props.dispatchChangeModelLoadState(index, loadState);
    }

    if (this.props.listMode == UIConstants.LIST_MODE_PORTAL) {
      this.props.dispatchChangePortalLoadState(index, loadState);
    }
  }

  // When an AR object (Object or Portal) in the scene is clicked; 
  // dispatch this event to redux -> which results in context menu appearing on top left
  _onItemClickedInScene(index, clickState, itemType) {
    this.props.dispatchChangeItemClickState(index, clickState, itemType);
  }

  // Load data source for listview based on listview modes
  _getListItems() {
    if (this.props.listMode == UIConstants.LIST_MODE_MODEL) {
      return this._constructListArrayModel(ModelData.getModelArray(), this.props.modelItems);
    } else if (this.props.listMode == UIConstants.LIST_MODE_PORTAL) {
      return this._constructListArrayModel(PortalData.getPortalArray(), this.props.portalItems);
    } else if (this.props.listMode == UIConstants.LIST_MODE_EFFECT) {
      return this.props.effectItems;
    }
  }

  // Helper to construct listview items
  _constructListArrayModel(sourceArray, items) {
    var listArrayModel = [];
    for (var i = 0; i < sourceArray.length; i++) {
      listArrayModel.push({ icon_img: sourceArray[i].icon_img, loading: this._getLoadingforModelIndex(i, items) })
    }
    return listArrayModel;
  }

  // Helper to determine which listview item to show the Loading spinner if an AR object or portal is being added to the scene
  _getLoadingforModelIndex(index, items) {
    if (items == null || items == undefined) {
      return LoadingConstants.NONE;
    }
    var loadingConstant = LoadingConstants.NONE;

    Object.keys(items).forEach(function (currentKey) {
      if (items[currentKey] != null && items[currentKey] != undefined) {
        if (items[currentKey].loading != LoadingConstants.NONE && items[currentKey].index == index) {
          loadingConstant = items[currentKey].loading;
        }
      }
    });

    return loadingConstant;
  }

  async _openShareActionSheet() {
    let contentType = this.state.previewType == kPreviewTypeVideo ? 'video/mp4' : 'image/png';
    await Share.open({
      subject: "#FigmentAR",
      message: "#FigmentAR",
      url: this.state.videoUrl,
      type: contentType,
    });
  }
}


App.propTypes = {
  objIndex: PropTypes.number.isRequired,
}

App.defaultProps = {
  objIndex: -1,
}

var localStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  arView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topPhotoBar: {
    backgroundColor: '#000000aa',
    height: 50,
    width: '100%',
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneText: {
    textAlign: 'right',
    color: '#d6d6d6',
    fontWeight: 'bold',
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
    marginRight: 10,
    backgroundColor: '#00000000',
    flex: 1,
  },
  photosText: {
    textAlign: 'center',
    color: '#d6d6d6',
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
    backgroundColor: '#00000000',
    flex: 1,
  },
  previewScreenButtons: {
    height: 30,
    width: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewScreenButtonsAddPic: {
    height: 32,
    width: 37,
  },
  previewScreenButtonClose: {
    position: 'absolute',
    height: 23,
    width: 23,
  },
  previewScreenButtonShare: {
    position: 'absolute',
    height: 35,
    width: 35,
  },
  screenIcon: {
    position: 'absolute',
    height: 58,
    width: 58,
  },
  recordIcon: {
    position: 'absolute',
    height: 58,
    width: 58,
    top: 10,
    left: 10,
  },
  cameraIcon: {
    position: 'absolute',
    height: 30,
    width: 30,
    top: 25,
    left: 25,
  },
  recordingTimeText: {
    textAlign: 'center',
    color: '#d6d6d6',
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
  },
  previewPlayButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 90,
  },
  previewPlayButton: {
    position: 'absolute',
    height: 90,
    width: 90,
    left: 0,
    alignSelf: 'center',
  },
  previewSavedSuccess: {
    position: 'absolute',
    height: 115,
    width: 100,
    alignSelf: 'center',
  },
  shareScreenContainerTransparent: {
    position: 'absolute',
    flex: 1,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    resizeMode: 'stretch',
  },
  photosSelectorStyle: {
    position: 'absolute',
    width: '100%',
    height: '40%',
    bottom: 0
  }
});

// -- REDUX STORE
function selectProps(store) {
  return {
    modelItems: store.arobjects.modelItems,
    portalItems: store.arobjects.portalItems,
    effectItems: store.arobjects.effectItems,
    currentScreen: store.ui.currentScreen,
    listMode: store.ui.listMode,
    listTitle: store.ui.listTitle,
    currentItemSelectionIndex: store.ui.currentItemSelectionIndex,
    currentItemClickState: store.ui.currentItemClickState,
    currentSelectedItemType: store.ui.currentSelectedItemType,
  };
}

// -- dispatch REDUX ACTIONS map
const mapDispatchToProps = (dispatch) => {
  return {
    dispatchAddPortal: (index) => dispatch(addPortalWithIndex(index)),
    dispatchRemovePortalWithUUID: (uuid) => dispatch(removePortalWithUUID(uuid)),
    dispatchAddModel: (index) => dispatch(addModelWithIndex(index)),
    dispatchRemoveModelWithUUID: (uuid) => dispatch(removeModelWithUUID(uuid)),
    dispatchRemoveAll: () => dispatch(removeAll()),
    dispatchToggleEffectSelection: (index) => dispatch(toggleEffectSelection(index)),
    dispatchChangeModelLoadState: (index, loadState) => dispatch(changeModelLoadState(index, loadState)),
    dispatchChangePortalLoadState: (index, loadState) => dispatch(changePortalLoadState(index, loadState)),
    dispatchDisplayUIScreen: (uiScreenState) => dispatch(displayUIScreen(uiScreenState)),
    dispatchSwitchListMode: (listMode, listTitle) => dispatch(switchListMode(listMode, listTitle)),
    dispatchChangePortalPhoto: (index, source) => dispatch(changePortalPhoto(index, source)),
    dispatchChangeItemClickState: (index, clickState, itemType) => dispatch(changeItemClickState(index, clickState, itemType)),
  }
}

export default connect(selectProps, mapDispatchToProps)(App)

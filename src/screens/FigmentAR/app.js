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
import * as LightingData from './model/LightingItems';
import { addPortalWithIndex, removePortalWithUUID, addModelWithIndex, removeAll, removeModelWithUUID, toggleEffectSelection, changePortalLoadState, changePortalPhoto, changeModelLoadState, changeItemClickState, switchListMode, removeARObject, displayUIScreen, changeHdriTheme, ARTrackingInitialized, addMedia } from './redux/actions';

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
  ScrollView,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

import {
  ViroARSceneNavigator,
  ViroRecordingErrorConstants,
} from '@reactvision/react-viro';

import Share from 'react-native-share';
import Video from 'react-native-video';
import { Svg, Circle, Line } from 'react-native-svg';
import { NativeModules, findNodeHandle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

// Import Expo ArViewRecorder module
import ArViewRecorder from '../../../modules/ar-view-recorder';

const { VideoMerger } = NativeModules;

// Debug: Log ArViewRecorder module
console.log('[App] ArViewRecorder:', ArViewRecorder);

// Recording constants
const MAX_DURATION = 30000; // 30 seconds max recording time

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
      recordingProgress: 0, // Current recording progress in ms
      isActivelyRecording: false, // True while finger is held down
      pauseMarkers: [], // Array of pause marker positions (milliseconds)
      showConfirmButtons: false, // Show confirm/delete after recording
      recordingSegments: [], // Array of video segment paths for stitching
      isStitching: false, // Loading state while stitching videos
      // Scrubber UI state
      frameThumbnails: [], // Array of base64 thumbnail images
      scrubberPosition: 0, // Current scrub position (0-1)
      coverFrameIndex: 0, // Selected cover frame index
      isExtractingFrames: false, // Loading state for frame extraction
      videoDuration: 0, // Video duration in seconds
    };

    this._onBackgroundTap = this._onBackgroundTap.bind(this);
    // Update viroAppProps to include onBackgroundTap
    this.state.viroAppProps = {
      loadingObjectCallback: this._onListItemLoaded,
      clickStateCallback: this._onItemClickedInScene,
      onBackgroundTap: this._onBackgroundTap
    };
  }

  _onBackgroundTap() {
    console.log('[App] _onBackgroundTap called. Current listMode:', this.props.listMode);
    // Dispatch action to hide the menu (set mode to NONE)
    if (this.props.listMode !== UIConstants.LIST_MODE_NONE) {
      console.log('[App] Dispatching LIST_MODE_NONE');
      this.props.dispatchSwitchListMode(UIConstants.LIST_MODE_NONE, '');
    }
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
        {/* CRITICAL: Use memoized viroAppProps from state to prevent AR scene reload */}
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

        {/* Timeline (Top) - hide on share screen */}
        {this.props.currentScreen !== UIConstants.SHOW_SHARE_SCREEN && this._renderRecord()}

        {/* Bottom Controls (Picker + Toolbar + Record Button) - hide on share screen */}
        {this.props.currentScreen !== UIConstants.SHOW_SHARE_SCREEN && this._renderBottomControls()}
      </View>
    );
  }

  async requestAudioPermission() {
    try {
      if (Platform.OS === 'ios') {
        // iOS: Use expo-av for microphone permission
        const { status } = await Audio.requestPermissionsAsync();
        console.log('[App] iOS audio permission status:', status);
        this.setState({
          audioPermission: status === 'granted',
        });
        return status === 'granted';
      } else {
        // Android: Use PermissionsAndroid
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            'title': 'Figment AR Audio Permission',
            'message': 'Figment AR App needs to access your audio ' +
              'so you can record videos with audio of ' +
              'your augmented scenes.'
          }
        );
        const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        this.setState({
          audioPermission: hasPermission,
        });
        return hasPermission;
      }
    } catch (err) {
      console.warn("[requestAudioPermission] Error:", err);
      return false;
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
              onLoad={(data) => { this.setState({ videoDuration: data.duration }); }}
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
          <View style={{ position: 'absolute', left: 20, top: 60, width: 44, height: 44 }}>
            <TouchableOpacity
              onPress={() => { this.props.dispatchDisplayUIScreen(UIConstants.SHOW_MAIN_SCREEN) }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(0,0,0,0.4)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Premium Bottom Bar with Scrubber */}
          {this._renderVideoScrubber()}
        </View>
      )
    }
  }

  // Premium Apple-style video scrubber component
  _renderVideoScrubber() {
    const { frameThumbnails, isExtractingFrames, scrubberPosition, coverFrameIndex, previewType } = this.state;

    // Only show for video previews
    if (previewType !== kPreviewTypeVideo) {
      return this._renderPhotoBottomBar();
    }

    return (
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 40, // Safe area
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}>
        {/* Frame Thumbnails Strip - Connected, Full Width, Scrubable */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            height: 70,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => this._handleScrubStart(e)}
          onResponderMove={(e) => this._handleScrubMove(e)}
          onResponderRelease={(e) => this._handleScrubEnd(e)}
        >
          {isExtractingFrames ? (
            // Loading skeleton
            <View style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Preparing timeline...</Text>
            </View>
          ) : frameThumbnails.length === 0 ? (
            // Empty state
            <View style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>No preview frames available</Text>
            </View>
          ) : (
            // Actual thumbnails - connected, no gaps
            <View style={{ flex: 1, flexDirection: 'row' }}>
              {frameThumbnails.map((uri, index) => {
                const isSelected = index === coverFrameIndex;
                return (
                  <View
                    key={index}
                    style={{
                      flex: 1,
                      height: 70,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: '#007AFF',
                    }}
                  >
                    <Image
                      source={{ uri }}
                      style={{
                        flex: 1,
                        width: '100%',
                        height: '100%',
                      }}
                      resizeMode="cover"
                    />
                  </View>
                );
              })}
              {/* Scrub indicator */}
              <View style={{
                position: 'absolute',
                left: `${scrubberPosition * 100}%`,
                top: 0,
                bottom: 0,
                width: 3,
                backgroundColor: 'white',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 4,
              }} />
            </View>
          )}
        </View>

        {/* Action Buttons Row */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginHorizontal: 16,
          marginTop: 16,
          marginBottom: 8,
        }}>
          {/* Left: Save & Share */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => this._saveToCameraRoll()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: this.state.haveSavedMedia ? 'rgba(52,199,89,0.3)' : 'rgba(255,255,255,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                marginRight: 10,
              }}
            >
              <Ionicons
                name={this.state.haveSavedMedia ? 'checkmark-circle' : 'download-outline'}
                size={20}
                color={this.state.haveSavedMedia ? '#34C759' : 'white'}
              />
              <Text style={{
                color: this.state.haveSavedMedia ? '#34C759' : 'white',
                fontSize: 15,
                fontWeight: '600',
                marginLeft: 6,
              }}>
                {this.state.haveSavedMedia ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => this._openShareActionSheet()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
              }}
            >
              <Ionicons name="share-outline" size={20} color="white" />
              <Text style={{
                color: 'white',
                fontSize: 15,
                fontWeight: '600',
                marginLeft: 6,
              }}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Right: Set Cover */}
          <TouchableOpacity
            onPress={() => this._setCoverFrame()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#007AFF',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Ionicons name="layers-outline" size={20} color="white" />
            <Text style={{
              color: 'white',
              fontSize: 15,
              fontWeight: '600',
              marginLeft: 6,
            }}>Set Cover</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Bottom bar for photo previews (simpler)
  _renderPhotoBottomBar() {
    return (
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 40,
        paddingHorizontal: 16,
        paddingTop: 16,
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        flexDirection: 'row',
        justifyContent: 'center',
      }}>
        <TouchableOpacity
          onPress={() => this._saveToCameraRoll()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: this.state.haveSavedMedia ? 'rgba(52,199,89,0.3)' : 'rgba(255,255,255,0.15)',
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 14,
            marginRight: 12,
          }}
        >
          <Ionicons
            name={this.state.haveSavedMedia ? 'checkmark-circle' : 'download-outline'}
            size={22}
            color={this.state.haveSavedMedia ? '#34C759' : 'white'}
          />
          <Text style={{
            color: this.state.haveSavedMedia ? '#34C759' : 'white',
            fontSize: 16,
            fontWeight: '600',
            marginLeft: 8,
          }}>
            {this.state.haveSavedMedia ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => this._openShareActionSheet()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#007AFF',
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 14,
          }}
        >
          <Ionicons name="share-outline" size={22} color="white" />
          <Text style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '600',
            marginLeft: 8,
          }}>Share</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Set the selected frame as cover
  _setCoverFrame() {
    const { coverFrameIndex, frameThumbnails } = this.state;
    if (frameThumbnails.length > coverFrameIndex) {
      console.log('[App] Cover frame set to index:', coverFrameIndex);
      // TODO: Implement actual cover frame saving logic
      Alert.alert('Cover Set', `Frame ${coverFrameIndex + 1} will be used as the video cover.`);
    }
  }

  // Extract frames from video for scrubber timeline
  async _extractFramesForScrubber(videoUrl) {
    try {
      console.log('[App] Starting frame extraction for:', videoUrl);

      // Small delay to ensure video file is ready
      await new Promise(resolve => setTimeout(resolve, 500));

      const frameResult = await ArViewRecorder.extractFrames(videoUrl, 12);
      console.log('[App] Frame extraction complete:', JSON.stringify(frameResult));

      if (frameResult && frameResult.frames && frameResult.frames.length > 0) {
        console.log('[App] Setting', frameResult.frames.length, 'thumbnails');
        this.setState({
          frameThumbnails: frameResult.frames,
          isExtractingFrames: false,
        });
      } else {
        console.warn('[App] No frames returned from extraction');
        this.setState({ isExtractingFrames: false });
      }
    } catch (error) {
      console.error('[App] Frame extraction error:', error);
      this.setState({ isExtractingFrames: false });
    }
  }

  // Handle scrub start - pause video and cache initial state
  _handleScrubStart(e) {
    // Cache the timeline layout and starting position
    e.target.measure((x, y, width, height, pageXOffset, pageYOffset) => {
      this._timelineLayout = { width, pageXOffset };
    });
    // Store initial touch position and current scrubber position
    this._scrubStartX = e.nativeEvent.pageX;
    this._scrubStartPosition = this.state.scrubberPosition;
    // Pause video when starting to scrub
    this.setState({ playPreview: false });
  }

  // Handle scrub move - update position based on drag delta (relative movement)
  _handleScrubMove(e) {
    if (!this._timelineLayout || !this._timelineLayout.width) return;

    const { width } = this._timelineLayout;
    // Calculate how much finger has moved since start
    const dragDelta = e.nativeEvent.pageX - this._scrubStartX;
    // Convert to position delta (0-1 range)
    const positionDelta = dragDelta / width;
    // Apply to starting position
    const newPosition = Math.max(0, Math.min(1, this._scrubStartPosition + positionDelta));

    // Update scrubber position and cover frame
    const frameCount = this.state.frameThumbnails.length;
    const frameIndex = Math.floor(newPosition * frameCount);
    const clampedIndex = Math.min(Math.max(0, frameIndex), frameCount - 1);

    // Seek video to this position
    if (this.player && this.state.videoDuration > 0) {
      this.player.seek(newPosition * this.state.videoDuration);
    }

    this.setState({
      scrubberPosition: newPosition,
      coverFrameIndex: clampedIndex,
    });
  }

  // Handle scrub end
  _handleScrubEnd(e) {
    // Video stays paused so user can see frame for poster selection
    this._scrubStartX = null;
    this._scrubStartPosition = null;
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

  _onMediaButtonPress = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Photo', 'Video'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          this._launchPicker(['images']);
        } else if (buttonIndex === 2) {
          this._launchPicker(['videos']);
        }
      }
    );
  };

  _launchPicker = async (mediaTypes) => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypes,
        allowsEditing: false, // Disabled to ensure Videos are selectable
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const type = asset.type === 'video' ? 'VIDEO' : 'IMAGE';
        const source = { uri: asset.uri };

        console.log('[App] _launchPicker: Asset selected:', { type, width: asset.width, height: asset.height });

        // If Image, we can calculate or use getSize
        if (type === 'IMAGE') {
          let width = 1;
          let height = 1;
          if (asset.width && asset.height) {
            height = asset.height / asset.width;
            this._finishAddMedia(source, type, width, height);
          } else {
            // Fallback for Image
            Image.getSize(asset.uri, (w, h) => {
              if (w && h) height = h / w;
              this._finishAddMedia(source, type, width, height);
            }, () => {
              this._finishAddMedia(source, type, width, height);
            });
          }
        } else {
          // VIDEO: If metadata missing, USE PROBE
          if (asset.width && asset.height) {
            let height = asset.height / asset.width;
            this._finishAddMedia(source, type, 1, height);
          } else {
            console.log('[App] Video metadata missing, triggering probe...');
            this.setState({ videoProbeUri: asset.uri });
          }
        }
      }
    } catch (e) {
      console.error('[App] Error:', e);
    }
  };

  _onVideoProbeLoad = (data) => {
    console.log('[App] Video Probe Loaded:', data.naturalSize);
    const { width, height } = data.naturalSize;
    const ratio = (width && height) ? (height / width) : 1.777; // Default to 16:9 vertical if weird

    this._finishAddMedia({ uri: this.state.videoProbeUri }, 'VIDEO', 1, ratio);
    this.setState({ videoProbeUri: null }); // Clear probe
  };

  _onVideoProbeError = (data) => {
    console.warn('[App] Video Probe Failed:', data);
    // Fallback
    this._finishAddMedia({ uri: this.state.videoProbeUri }, 'VIDEO', 1, 1.777);
    this.setState({ videoProbeUri: null });
  };

  _finishAddMedia = (source, type, width, height) => {
    // Dispatch action to add media to the scene
    // Adding a delay to ensure ImagePicker dismisses cleanly before heavy AR render
    setTimeout(() => {
      console.log('[App] _finishAddMedia dispatching:', { width, height });
      this.props.dispatchAddMedia(source, type, width, height); // Pass dimensions
      this.props.dispatchSwitchListMode(UIConstants.LIST_MODE_NONE, '');
    }, 500);
  };


  // Combined Bottom Controls (Picker, Toolbar, Record Button)
  _renderBottomControls() {
    const isPortals = this.props.listMode === UIConstants.LIST_MODE_PORTAL;
    const isEffects = this.props.listMode === UIConstants.LIST_MODE_EFFECT;
    const isModels = this.props.listMode === UIConstants.LIST_MODE_MODEL;
    const isLighting = this.props.listMode === UIConstants.LIST_MODE_LIGHT;

    // Check if we should show the non-recording UI (Picker + Toolbar)
    const showSelectionUI = !this.state.isActivelyRecording && !this.state.showConfirmButtons && !this.state.showPhotosSelector && this.props.currentScreen === UIConstants.SHOW_MAIN_SCREEN;

    const shouldShowPicker = showSelectionUI && (isPortals || isEffects || isModels || isLighting);

    // SVG Progress logic
    const circumference = 2 * Math.PI * 45;
    const progress = this.state.recordingProgress / MAX_DURATION;
    const strokeDashoffset = circumference * (1 - progress);

    const toggleMode = (mode, title) => {
      // If tapping the already active mode, toggle it OFF (hide menu)
      if (this.props.listMode === mode) {
        this.props.dispatchSwitchListMode(UIConstants.LIST_MODE_NONE, '');
      } else {
        // Otherwise switch to the new mode
        this.props.dispatchSwitchListMode(mode, title);
      }
    };

    return (
      <View style={{ position: 'absolute', bottom: 130, left: 0, right: 0, alignItems: 'center' }}>

        {/* 1. Picker Container - Only show if mode is NOT NONE */}
        {shouldShowPicker && this.props.listMode !== UIConstants.LIST_MODE_NONE && (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingVertical: 12, marginBottom: 25, maxWidth: '90%', overflow: 'hidden' }}>
            <FigmentListView items={this._getListItems()} onPress={this._onListPressed} />
          </View>
        )}

        {/* 2. Toolbar */}
        {/* Only show toolbar if NOT recording (verified: this method is only called if !isRecordingInProgress or handled in render) */}
        {!this.state.isActivelyRecording && this.state.recordingProgress === 0 && (
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginBottom: 20,
            backgroundColor: 'transparent',
            paddingVertical: 10,
            borderRadius: 20
          }}>
            {/* Objects Button */}
            <TouchableOpacity
              onPress={() => toggleMode(UIConstants.LIST_MODE_MODEL, UIConstants.LIST_TITLE_MODELS)}
              style={{ alignItems: 'center', marginHorizontal: 12, opacity: this.props.listMode === UIConstants.LIST_MODE_MODEL ? 1 : 0.6 }}
            >
              <Ionicons name="cube-outline" size={32} color="white" style={{ marginBottom: 4 }} />
              <Text style={{ color: 'white', fontSize: 10, marginTop: 4 }}>Objects</Text>
            </TouchableOpacity>

            {/* Portals Button */}
            <TouchableOpacity
              onPress={() => toggleMode(UIConstants.LIST_MODE_PORTAL, UIConstants.LIST_TITLE_PORTALS)}
              style={{ alignItems: 'center', marginHorizontal: 12, opacity: this.props.listMode === UIConstants.LIST_MODE_PORTAL ? 1 : 0.6 }}
            >
              <Ionicons name="aperture-outline" size={32} color="white" style={{ marginBottom: 4 }} />
              <Text style={{ color: 'white', fontSize: 10, marginTop: 4 }}>Portals</Text>
            </TouchableOpacity>

            {/* Media Button */}
            <TouchableOpacity
              onPress={this._onMediaButtonPress}
              style={{ alignItems: 'center', marginHorizontal: 12, opacity: 0.6 }}
            >
              <Ionicons name="images-outline" size={32} color="white" style={{ marginBottom: 4 }} />
              <Text style={{ color: 'white', fontSize: 10, marginTop: 4 }}>Media</Text>
            </TouchableOpacity>

            {/* Effects Button */}
            <TouchableOpacity
              onPress={() => toggleMode(UIConstants.LIST_MODE_EFFECT, UIConstants.LIST_TITLE_EFFECTS)}
              style={{ alignItems: 'center', marginHorizontal: 12, opacity: this.props.listMode === UIConstants.LIST_MODE_EFFECT ? 1 : 0.6 }}
            >
              <Ionicons name="sparkles-outline" size={32} color="white" style={{ marginBottom: 4 }} />
              <Text style={{ color: 'white', fontSize: 10, marginTop: 4 }}>Effects</Text>
            </TouchableOpacity>

            {/* Lighting Button */}
            <TouchableOpacity
              onPress={() => toggleMode(UIConstants.LIST_MODE_LIGHT, UIConstants.LIST_TITLE_LIGHT)}
              style={{ alignItems: 'center', marginHorizontal: 12, opacity: this.props.listMode === UIConstants.LIST_MODE_LIGHT ? 1 : 0.6 }}
            >
              <Ionicons name="sunny-outline" size={32} color="white" style={{ marginBottom: 4 }} />
              <Text style={{ color: 'white', fontSize: 10, marginTop: 4 }}>Lighting</Text>
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

  // Handle Record Press In - Start or resume recording AR scene when user presses down
  async handleRecordPressIn() {
    // If we're already actively recording (not paused), ignore
    if (this.state.isActivelyRecording) {
      console.log('[App] Already actively recording, ignoring press');
      return;
    }
    if (this.state.recordingProgress >= MAX_DURATION) return;

    // Check and request audio permissions (MUST await before recording)
    if (!this.state.audioPermission) {
      console.log('[App] Requesting audio permission...');
      const granted = await this.requestAudioPermission();
      if (!granted) {
        console.warn('[App] Audio permission denied, cannot record');
        Alert.alert('Permission Required', 'Microphone permission is required to record video.');
        return;
      }
    }

    try {
      // Check if we have an active session that's paused
      if (this._hasActiveSession) {
        // Resume the paused session
        console.log('[App] Resuming paused recording...');
        const result = await ArViewRecorder.resumeRecording();
        console.log('[App] ArViewRecorder.resumeRecording result:', JSON.stringify(result));
      } else {
        // Start a new recording session
        const recordingId = Date.now();
        const recordingFile = `ar_recording_${recordingId}`;
        this._currentRecordingFile = recordingFile;

        console.log('[App] Starting new ArViewRecorder session:', recordingFile);

        if (ArViewRecorder && ArViewRecorder.startRecording) {
          const viewTag = findNodeHandle(this._arNavigator);
          console.log('[App] ViroARSceneNavigator view tag:', viewTag);

          if (viewTag) {
            const result = await ArViewRecorder.startRecording(viewTag, recordingFile);
            console.log('[App] ArViewRecorder.startRecording result:', JSON.stringify(result));
            this._hasActiveSession = true;
          } else {
            console.warn('[App] Could not get view tag for ViroARSceneNavigator');
            throw new Error('Could not get view tag');
          }
        } else {
          console.warn('[App] ArViewRecorder not available');
          throw new Error('ArViewRecorder not available');
        }
      }

      // Track recording start time for this segment
      this._recordingStartTime = Date.now();
      this._isRecording = true;

      // Update visual state
      this.setState({
        isActivelyRecording: true,
        showConfirmButtons: false,
        recordStartTimeInMillis: this._recordingStartTime,
      });

      // Store progress at segment start to add to it
      this._segmentStartProgress = this.state.recordingProgress;

      // Start progress timer with reduced update frequency (200ms) to minimize re-renders during recording
      this._recordingTimer = TimerMixin.setInterval(() => {
        const elapsedThisSegment = Date.now() - this._recordingStartTime;
        const totalProgress = this._segmentStartProgress + elapsedThisSegment;

        if (totalProgress >= MAX_DURATION) {
          this.setState({ recordingProgress: MAX_DURATION });
          this.handleRecordPressOut();
        } else {
          this.setState({ recordingProgress: totalProgress });
        }
      }, 200);

      this.props.dispatchDisplayUIScreen(UIConstants.SHOW_RECORDING_SCREEN);

    } catch (error) {
      console.error('[App] Recording start/resume error:', error);
      this._isRecording = false;
      this._displayVideoRecordAlert("Recording Error", "Could not start/resume recording: " + error.message);
    }
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

  // Handle Record Press Out - Pause recording when user lifts finger
  async handleRecordPressOut() {
    if (!this.state.isActivelyRecording) return;

    // Stop progress timer
    if (this._recordingTimer) {
      TimerMixin.clearInterval(this._recordingTimer);
      this._recordingTimer = null;
    }

    // Minimum recording segment time (to avoid accidental taps)
    const MIN_SEGMENT_DURATION = 300; // ms
    const segmentDuration = Date.now() - this.state.recordStartTimeInMillis;

    if (segmentDuration < MIN_SEGMENT_DURATION) {
      const waitTime = MIN_SEGMENT_DURATION - segmentDuration;
      console.log(`[App] Waiting ${waitTime}ms for minimum recording duration...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Pause the recording (keeps session open)
    this._isRecording = false;
    try {
      console.log('[App] Pausing video recording...');

      if (ArViewRecorder && ArViewRecorder.pauseRecording) {
        const result = await ArViewRecorder.pauseRecording();
        console.log('[App] ArViewRecorder.pauseRecording result:', JSON.stringify(result));
      }

      // Add a pause marker at current progress
      this.setState((prevState) => ({
        isActivelyRecording: false,
        pauseMarkers: [...prevState.pauseMarkers, prevState.recordingProgress],
        showConfirmButtons: true,
      }));

    } catch (error) {
      console.error('[App] Pause recording error:', error);
      this.setState({
        isActivelyRecording: false,
        showConfirmButtons: true,
      });
    }
  }

  // Handle confirm button - finalize recording and navigate to share screen
  async handleRecordConfirm() {
    // Check if there's an active recording session to stop
    if (!this._hasActiveSession) {
      Alert.alert('Recording Error', 'No recording session to finalize.');
      this.handleRecordCancel();
      return;
    }

    this.setState({ isStitching: true }); // Show loading indicator

    try {
      console.log('[App] Finalizing recording...');

      // Stop the recording session to get the final video file
      const result = await ArViewRecorder.stopRecording();
      console.log('[App] ArViewRecorder.stopRecording result:', JSON.stringify(result));

      this._hasActiveSession = false;

      // Get the video path
      const videoPath = result.url || result.path;
      if (!videoPath) {
        throw new Error('No video path returned');
      }

      const finalUrl = videoPath.startsWith('file://') ? videoPath : 'file://' + videoPath;
      console.log('[App] Final video:', finalUrl);

      this.setState({
        videoUrl: finalUrl,
        showConfirmButtons: false,
        haveSavedMedia: false,
        playPreview: true,
        previewType: kPreviewTypeVideo,
        recordingProgress: 0,
        pauseMarkers: [],
        isStitching: false,
        isExtractingFrames: true, // Start loading state
        frameThumbnails: [], // Clear previous thumbnails
        coverFrameIndex: 0,
      }, () => {
        this.props.dispatchDisplayUIScreen(UIConstants.SHOW_SHARE_SCREEN);
      });

      // Extract frames for scrubber (moved outside setState callback)
      this._extractFramesForScrubber(finalUrl);
    } catch (error) {
      console.error('[App] Finalize recording error:', error);
      this.setState({ isStitching: false });
      this._hasActiveSession = false;
      Alert.alert('Recording Error', 'Failed to finalize recording: ' + error.message);
    }
  }

  // Handle cancel button - reset state and discard recording
  async handleRecordCancel() {
    // Clear any pending timer
    if (this._recordingTimer) {
      TimerMixin.clearInterval(this._recordingTimer);
      this._recordingTimer = null;
    }

    // Stop and discard any active recording session
    if (this._hasActiveSession) {
      try {
        await ArViewRecorder.stopRecording();
        console.log('[App] Recording session discarded');
      } catch (e) {
        console.log('[App] Error stopping recording on cancel:', e);
      }
      this._hasActiveSession = false;
    }

    this._isRecording = false;

    this.setState({
      recordingProgress: 0,
      pauseMarkers: [],
      showConfirmButtons: false,
      videoUrl: null,
      isActivelyRecording: false,
      isStitching: false,
    });

    this.props.dispatchDisplayUIScreen(UIConstants.SHOW_MAIN_SCREEN);
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
    } else if (this.props.listMode == UIConstants.LIST_MODE_PORTAL) {
      this.props.dispatchAddPortal(index);
    } else if (this.props.listMode == UIConstants.LIST_MODE_EFFECT) {
      this.props.dispatchToggleEffectSelection(index);
    } else if (this.props.listMode == UIConstants.LIST_MODE_LIGHT) {
      var lightingArray = LightingData.getLightingArray();
      this.props.dispatchChangeHdriTheme(lightingArray[index].name);
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
    // Hide menu when interacting with an object
    if (this.props.listMode !== UIConstants.LIST_MODE_NONE) {
      this.props.dispatchSwitchListMode(UIConstants.LIST_MODE_NONE, '');
    }
  }

  // Load data source for listview based on listview modes
  _getListItems() {
    if (this.props.listMode == UIConstants.LIST_MODE_MODEL) {
      return this._constructListArrayModel(ModelData.getModelArray(), this.props.modelItems);
    } else if (this.props.listMode == UIConstants.LIST_MODE_PORTAL) {
      return this._constructListArrayModel(PortalData.getPortalArray(), this.props.portalItems);
    } else if (this.props.listMode == UIConstants.LIST_MODE_EFFECT) {
      return this.props.effectItems;
    } else if (this.props.listMode == UIConstants.LIST_MODE_LIGHT) {
      return this._constructListArrayModel(LightingData.getLightingArray(), []);
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
    dispatchChangeHdriTheme: (hdri) => dispatch(changeHdriTheme(hdri)),
    dispatchAddMedia: (source, type, width, height) => dispatch(addMedia(source, type, width, height)),
  }
}

export default connect(selectProps, mapDispatchToProps)(App)

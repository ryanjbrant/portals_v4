/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 */
'use strict';

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as UIConstants from '../redux/UIConstants';
import {
    ViroNode,
    ViroImage,
    ViroVideo,
} from '@reactvision/react-viro';

var createReactClass = require('create-react-class');

var MediaItemRender = createReactClass({
    propTypes: {
        mediaIDProps: PropTypes.any,
        mediaItem: PropTypes.any,
        onClickStateCallback: PropTypes.func,
        onTransformUpdate: PropTypes.func, // Callback to sync transforms back to Redux
    },

    getInitialState() {
        // Use saved values from mediaItem if loading from draft
        const mediaItem = this.props.mediaItem || {};
        const isLoadedFromDraft = mediaItem.loading === 'LOADED';

        return {
            scale: isLoadedFromDraft && mediaItem.scale ? mediaItem.scale : [1, 1, 1],
            rotation: isLoadedFromDraft && mediaItem.rotation ? mediaItem.rotation : [0, 0, 0],
            position: isLoadedFromDraft && mediaItem.position ? mediaItem.position : [0, 0, -1],
            nodeIsVisible: true,
        }
    },

    componentDidMount() {
        console.log('[MediaItemRender] componentDidMount:', this.props.mediaItem.uuid);
        this._isMounted = true;

        // CRITICAL: Force re-render after 100ms to fix Viro batching visibility issue
        setTimeout(() => {
            if (this._isMounted) {
                this.forceUpdate();
            }
        }, 100);
    },

    componentWillUnmount() {
        this._isMounted = false;
    },

    _syncToRedux() {
        // Sync transforms back to Redux for serialization
        if (this.props.onTransformUpdate && this.props.mediaItem) {
            this.props.onTransformUpdate(this.props.mediaItem.uuid, {
                scale: this.state.scale,
                position: this.state.position,
                rotation: this.state.rotation,
            });
        }
    },

    _onPinch(pinchState, scaleFactor, source) {
        if (pinchState === 2) {
            if (!this._initialPinchScale) this._initialPinchScale = this.state.scale;
            const newScale = this._initialPinchScale.map((x) => x * scaleFactor);
            this.setState({ scale: newScale });
        }
        if (pinchState === 3) {
            this._initialPinchScale = null;
            this._syncToRedux(); // Sync on gesture end
        }
    },

    _onRotate(rotateState, rotationFactor, source) {
        if (rotateState === 2) {
            this.setState(prevState => ({
                rotation: [prevState.rotation[0], prevState.rotation[1] - rotationFactor, prevState.rotation[2]]
            }));
        }
        if (rotateState === 3) {
            this._syncToRedux(); // Sync on gesture end
        }
    },

    _onDrag(dragState, position, source) {
        if (dragState === 2) { // Moving
            this.setState({ position: position });
        }
        if (dragState === 3) { // Drag ended
            this._syncToRedux(); // Sync on gesture end
        }
    },

    _onLoadStart() {
        console.log('[MediaItemRender] _onLoadStart');
    },

    _onLoadEnd() {
        console.log('[MediaItemRender] _onLoadEnd');
    },

    _onError(event) {
        console.log('[MediaItemRender] _onError:', event.nativeEvent ? event.nativeEvent.error : event);
    },

    render: function () {
        const mediaItem = this.props.mediaItem;
        if (!mediaItem) return null;

        console.log('[MediaItemRender] Rendering item with source:', mediaItem.source);

        return (
            <ViroNode
                key={mediaItem.uuid}
                position={this.state.position}
                rotation={this.state.rotation}
                scale={this.state.scale}
                onDrag={this._onDrag}
                onPinch={this._onPinch}
                onRotate={this._onRotate}
                dragType="FixedToWorld">

                {mediaItem.type === 'VIDEO' ? (
                    <ViroVideo
                        source={mediaItem.source}
                        loop={true}
                        placeholderSource={require("../../../../assets/icon.png")}
                        width={mediaItem.width || 1}
                        height={mediaItem.height || 1}
                        onClick={this.props.onClick}
                        onLoadStart={this._onLoadStart}
                        onLoadEnd={this._onLoadEnd}
                        onError={this._onError}
                    />
                ) : (
                    <ViroImage
                        source={mediaItem.source}
                        width={mediaItem.width || 1}
                        height={mediaItem.height || 1}
                        onClick={this.props.onClick}
                        onLoadStart={this._onLoadStart}
                        onLoadEnd={this._onLoadEnd}
                        onError={this._onError}
                    />
                )}
            </ViroNode>
        );
    },
});

module.exports = MediaItemRender;

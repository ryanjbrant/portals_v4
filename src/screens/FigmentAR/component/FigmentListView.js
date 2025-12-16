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

import *  as UIConstants from '../redux/UIConstants';
import * as LoadingConstants from '../redux/LoadingStateConstants';
import { connect } from 'react-redux'
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, TouchableHighlight, ActivityIndicator, View, FlatList, Image } from 'react-native';
import renderIf from '../helpers/renderIf';
import ListViewItem from './ListViewItem';

/**
 * ListView wrapper that encapsulates behavior for the Listview seen at the bottom of the screen
 * in the app. 
 */
class FigmentListView extends Component {
  constructor(props) {
    super(props);

    // YellowBox.ignoreWarnings not needed as much if we fix deprecations, but keeping for safety if other libs warn


    this._renderItem = this._renderItem.bind(this);
    this._isSelected = this._isSelected.bind(this);
    this._onAnimationDone = this._onAnimationDone.bind(this);
    this._onListItemPressed = this._onListItemPressed.bind(this);

    this.state = {
      selectedItem: -1,
      animationDone: false
    }
  }

  // FlatList updates automatically with props, no need for componentWillReceiveProps complexity for data source
  // But we might need to update state if logic depends on it. 
  // The original code updated 'dataRows' and 'dataSource' in CWRP.
  // We can just use this.props.items in render.

  render() {
    if (!this.props.items) {
      return (<View />);
    }
    return (
      <FlatList
        horizontal={true}
        contentContainerStyle={styles.listViewContainer}
        data={this.props.items}
        renderItem={this._renderItem}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => index.toString()}
        removeClippedSubviews={false}
      />);
  }

  _renderItem({ item, index }) {
    // item is the data object, index is index
    return (
      <View style={{ marginLeft: 10 }}>
        <ListViewItem onPress={this._onListItemPressed(index)}
          key={item.icon_img + this.props.currentSelectedEffect}
          stateImageArray={[item.icon_img]}
          style={styles.photo}
          animationDoneCallBack={this._onAnimationDone} />
        {renderIf(item.loading == LoadingConstants.LOADING,
          <ActivityIndicator style={{ position: 'absolute', marginLeft: 12, marginTop: 19, }} animating={true} size='large' />
        )}

        {renderIf(this._isSelected(item, index),
          <Image source={require("../res/icon_effects_selected_pink.png")} style={styles.photoSelection} />
        )}
      </View>
    );
  }

  // Check if given rowId in the listView is selected, used to render the pink border around chosen effect
  _isSelected(data, rowId) {
    return (this.props.listMode == UIConstants.LIST_MODE_EFFECT
      && this.state.animationDone
      && this.state.selectedItem == rowId);
  }

  // Called when animation on the listViewItem is done
  _onAnimationDone() {
    this.setState({
      animationDone: true,
    })
  }

  _onListItemPressed(rowId) {
    // rowId is index
    let selectedItem = this.props.listMode == UIConstants.LIST_MODE_EFFECT ? rowId : this.state.selectedItem;

    return () => {
      this.setState({
        selectedItem: selectedItem,
      });
      this.props.onPress(rowId);
    }
  }
};

FigmentListView.propTypes = {
  items: PropTypes.array,
  onPress: PropTypes.func,
};

function selectProps(store) {
  return {
    listMode: store.ui.listMode,
    currentSelectedEffect: store.ui.currentEffectSelectionIndex,
  }
}
var styles = StyleSheet.create({
  listViewContainer: {
    height: 72,
  },
  photo: {
    height: 53,
    width: 56.8,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
    marginTop: 10,
  },
  photoSelection: {
    position: 'absolute',
    height: 53,
    width: 56.8,
    marginTop: 10,
  },
  submitText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 20
  }
});

module.exports = connect(selectProps)(FigmentListView);

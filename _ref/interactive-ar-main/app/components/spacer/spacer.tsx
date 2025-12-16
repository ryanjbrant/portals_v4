import React from 'react';
import { View } from 'react-native';
import { layout } from '@styles';
import { phoneType, safeAreaHeight } from '../../config/platform.config';

interface Props {
  width?: number;
  height?: number;
  topSafeAreaHeight?: boolean;
  bottomSafeAreaHeight?: boolean;
}

const Spacer = ({
  width,
  height,
  topSafeAreaHeight,
  bottomSafeAreaHeight,
}: Props) => {
  if (width) {
    return <View style={{ width }} />;
  }

  if (height) {
    return <View style={{ height }} />;
  }

  if (topSafeAreaHeight) {
    return <View style={{ height: safeAreaHeight[phoneType()].top }} />;
  }

  if (bottomSafeAreaHeight) {
    return <View style={{ height: safeAreaHeight[phoneType()].bottom }} />;
  }

  return <View style={layout.flex} />;
};

Spacer.defaultProps = {
  width: undefined,
  height: undefined,
  topSafeAreaHeight: undefined,
  bottomSafeAreaHeight: undefined,
};

export default Spacer;

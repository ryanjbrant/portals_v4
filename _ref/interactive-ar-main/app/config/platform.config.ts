/*
 * Main config location for device specific files.
 */

import { Dimensions, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const { width, height } = Dimensions.get('window');

export const dimensions: { screenWidth: number; screenHeight: number } = {
  screenWidth: width < height ? width : height,
  screenHeight: height < width ? height : width,
};

export type phoneTypeReturnType = 'android' | 'iphone' | 'iphoneNotch';

/**
 * safe area height based on specific platform
 */
export const safeAreaHeight = {
  iphoneNotch: {
    top: 0,
    bottom: 16,
  },
  iphone: {
    top: 0,
    bottom: 16,
  },
  android: {
    top: 0,
    bottom: 0,
  },
};

/**
 * Returns the phone type according to its platform
 * @returns {('android'|'iphoneNotch'|'iphone')} 'android' for Android devices, 'iphone' for iPhone 8, 8 plus etc, 'iphoneNotch' for iPhone X, 11, 12
 */
export const phoneType = (): phoneTypeReturnType => {
  if (Platform.OS === 'ios') {
    return DeviceInfo.hasNotch() ? 'iphoneNotch' : 'iphone';
  }
  return 'android';
};

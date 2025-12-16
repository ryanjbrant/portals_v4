const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const defaultAssetExts =
  require('metro-config/src/defaults/defaults').assetExts;

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    assetExts: [
      ...defaultAssetExts,
      'obj',
      'mtl',
      'JPG',
      'vrx',
      'hdr',
      'gltf',
      'glb',
      'bin',
      'arobject',
      'png',
      'jpg',
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

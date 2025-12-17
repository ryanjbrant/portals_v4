const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Add support for 3D model file extensions
config.resolver.assetExts.push(
    // 3D model formats
    'glb',
    'gltf',
    'obj',
    'mtl',
    'fbx',
    'dae',
    'vrx',
    'arobject',
    // Additional asset formats that ViroReact might use
    'hdr',
    'ktx'
);

// Ensure Metro can resolve assets from the project root
config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;

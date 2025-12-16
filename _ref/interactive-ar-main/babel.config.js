module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@components': './app/components',
          '@config': './app/config',
          '@styles': './app/styles',
          '@assets': './assets',
        },
      },
    ],
  ],
};

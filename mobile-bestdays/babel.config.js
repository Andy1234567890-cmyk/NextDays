// Babel für bare React Native 0.86. module-resolver für den @/-Alias,
// reanimated/gesture-handler brauchen kein eigenes Plugin in dieser Version.
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: { '@': './' },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
  ],
};

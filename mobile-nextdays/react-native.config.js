// React-Native-Config: bindet die TTF-Fonts nativ ein (iOS Info.plist UIAppFonts
// + Android assets/fonts). Linken mit `npx react-native-asset`.
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/fonts/'],
};

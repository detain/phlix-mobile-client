module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // reanimated 4 moved its babel plugin into react-native-worklets.
  // This MUST be the LAST plugin in the list.
  plugins: ['react-native-worklets/plugin'],
};

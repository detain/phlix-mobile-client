/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// Stub for react-native-reanimated when not installed
// This allows gesture-handler to import reanimated without errors
module.exports = {
  useSharedValue: function() { return { value: null }; },
  useAnimatedStyle: function() { return {}; },
  withTiming: function(v) { return v; },
  withSpring: function(v) { return v; },
  withDecay: function(v) { return v; },
  withDelay: function(v, t) { return t; },
  withSequence: function() { return arguments[0]; },
  withOrchestration: function(v) { return v; },
  runOnJS: function(fn) { return fn; },
  runOnUI: function(fn) { return fn; },
  createAnimatedComponent: function(c) { return c; },
  default: {},
};

/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/layout/SafeContainer.tsx
import React from 'react';
import { View, StyleSheet, StatusBar, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SafeContainerProps {
  children: React.ReactNode;
  backgroundColor?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

/**
 * Root-stack safe edges (MW-105, review mobile__gameux #6). M-MOBILE-36 grew
 * the TAB BAR itself for the home indicator — but root-stack screens render
 * WITHOUT any tab bar, so the top-only default parked their last row under
 * the 34pt gesture strip (the ProfileSelect CTA being the measured victim).
 * Stack screens opt in with this constant; TAB screens must NOT pass it —
 * the bar already carries the inset and doing both double-pads.
 */
export const STACK_EDGES: ('top' | 'bottom')[] = ['top', 'bottom'];

export const SafeContainer: React.FC<SafeContainerProps> = ({
  children,
  backgroundColor = '#0f0f1a',
  edges = ['top'],
}) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // MOB-54: in landscape the notch/cutout moves to a horizontal edge, so
  // left/right insets apply even when the caller did not list those edges.
  const isLandscape = width > height;

  const paddingStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: isLandscape || edges.includes('left') ? insets.left : 0,
    paddingRight: isLandscape || edges.includes('right') ? insets.right : 0,
  };

  return (
    <View style={[styles.container, { backgroundColor }, paddingStyle]}>
      <StatusBar barStyle="light-content" />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeContainer;

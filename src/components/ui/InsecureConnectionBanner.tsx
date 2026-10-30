/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/ui/InsecureConnectionBanner.tsx
//
// M-MOBILE-51 (review mobile__secnet m3) — the review's own MINIMUM: "a
// persistent insecure-connection indicator while any cleartext lane is live".
// This is that indicator: a non-dismissible bar pinned to the top of the
// root (same placement law as CastSessionPill in RootNavigator), rendered
// exactly while `useConnectionSecurityStore` reports a live cleartext lane.
//
// Copy discipline: it says WHAT (unencrypted) and WHAT TO DO (trusted
// networks only) — no scare red, since LAN-http is a ratified working mode;
// amber, once, persistent, gone the moment every lane is secure again.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  useConnectionSecurityStore,
  selectAnyCleartext,
} from '../../stores/useConnectionSecurityStore';

export const INSECURE_BANNER_TEXT =
  'Unencrypted connection — traffic is readable on this network. Use only on networks you trust.';

export const InsecureConnectionBanner: React.FC = () => {
  const anyCleartext = useConnectionSecurityStore(selectAnyCleartext);
  if (!anyCleartext) {
    return null;
  }
  return (
    <View style={styles.banner} testID="insecure-connection-banner">
      <Text style={styles.text} numberOfLines={2}>
        {INSECURE_BANNER_TEXT}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: 'rgba(255, 159, 10, 0.92)',
    paddingTop: 44,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default InsecureConnectionBanner;

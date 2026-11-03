/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/cast/CastSessionPill.tsx
//
// The persistent "Casting to X" affordance (M-MOBILE-16). Mounted once at the
// root (inside NavigationContainer), it is the reachability surface for a live
// server-mediated cast while the Cast screen itself is dismissed: tap re-opens
// the controller for the STORED session, from which pause/resume/seek and
// (where the backend supports it — see the capability gates in types/cast)
// Stop remain available. It renders nothing without a live session, hides
// itself while CastScreen is mounted, and retires when the server confirms the
// session ended (the store's refreshStatus clear) — no phantom pill, and no
// promised control the transport cannot deliver.
import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCastStore } from '../../stores/useCastStore';
import type { RootStackParamList } from '../../types/navigation';
import { castPillNavigateParams, isCastPillVisible } from './castPillHelpers';

/** Liveness poll while only the pill is up (CastScreen polls faster itself). */
const PILL_POLL_MS = 10000;

type CastNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Cast'>;

export const CastSessionPill: React.FC = () => {
  // M-MOBILE-77 (review mobile__gameux Minor 24)
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<CastNavigationProp>();
  const activeDevice = useCastStore((s) => s.activeDevice);
  const activeMedia = useCastStore((s) => s.activeMedia);
  const screenVisible = useCastStore((s) => s.screenVisible);
  const transport = useCastStore((s) => s.transport);
  const refreshStatus = useCastStore((s) => s.refreshStatus);

  const visible = isCastPillVisible(activeDevice, screenVisible);

  // While the pill stands in for the controller, it OWNS the status poll:
  // an immediate read (so the label is not stale after re-entry) plus a slow
  // interval, which doubles as end-detection — a server-confirmed `active:
  // false` retires the session in the store and this effect cleans up.
  useEffect(() => {
    if (!visible) {
      return;
    }
    // eslint-disable-next-line no-void -- fire-and-forget; refreshStatus owns its errors
    void refreshStatus();
    const timer = setInterval(() => {
      // eslint-disable-next-line no-void -- fire-and-forget; refreshStatus owns its errors
      void refreshStatus();
    }, PILL_POLL_MS);
    return () => clearInterval(timer);
  }, [visible, refreshStatus]);

  if (!visible || !activeDevice) {
    return null;
  }
  const params = castPillNavigateParams(activeMedia);
  if (!params) {
    return null;
  }

  const stateSuffix = transport?.state ? ` · ${transport.state}` : '';
  return (
    <TouchableOpacity
      // M-MOBILE-77: dynamic offset — mirrors the tab-bar height law
      // (60 + max(0, insets.bottom - 8)) plus 14pt clearance, so the pill
      // never overlaps the grown bar on gesture-bar phones.
      style={[styles.pill, { bottom: 60 + Math.max(0, insets.bottom - 8) + 14 }]}
      onPress={() => navigation.navigate('Cast', params)}
      accessibilityRole="button"
      accessibilityLabel={`Open cast controller, playing on ${activeDevice.name}`}
    >
      <Text style={styles.pillIcon}>📡</Text>
      <Text style={styles.pillText} numberOfLines={1}>
        Casting to {activeDevice.name}
        {stateSuffix}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    // M-MOBILE-77 (review mobile__gameux Minor 24): fixed 74 collided with the
    // DYNAMIC tab-bar height (60 + max(0, insets.bottom - 8), RootNavigator's
    // own law) — on 34-pt-inset iPhones the pill's lower 12pt sat inside the
    // bar. Now it rides the same inset math: bottom = 60 + inset term + 14.
    bottom: 74,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#0066cc',
    zIndex: 1000,
    elevation: 8,
  },
  pillIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  pillText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 240,
  },
});

export default CastSessionPill;

/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/networkState.ts
// M3 (deferred lane): data-plan guard primitives. The former
// "Download over Wi-Fi only" setting was REMOVED as theater (M-MOBILE-01)
// because bare RN exposes no network-type API. @react-native-community/netinfo
// is now in the lock, so the gate is implemented for real: a single trusted
// classifier feeds the download queue (hard gate) and the player (notice
// banner). Cell generations (cell_2g/3g/4g/5g) count as cellular too.
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Pure classifier — parse, don't validate: every consumer below trusts this
 * single verdict instead of re-reading NetInfo fields ad hoc.
 * Unknown-shaped / disconnected / probing states are NOT cellular; a broken
 * probe must never strand downloads or nag the viewer (fail-open by design,
 * the guard optimizes for data-plan SAFETY on honest readings, not paranoia
 * against its own API).
 */
export function isCellularConnection(state: NetInfoState | null | undefined): boolean {
  if (!state || state.isConnected !== true) {
    return false;
  }
  // String() bridge: NetInfoStateType is a string ENUM (nominal in TS), and
  // the legacy `cell_2g/3g/4g/5g` generation strings historically surfaced as
  // `type` on older native layers — both families count as cellular.
  const type = String(state.type);
  return type === 'cellular' || type.startsWith('cell_');
}

/** One-shot reading used by the download gate. Probe failure reads non-cellular. */
export async function isCellularNow(): Promise<boolean> {
  try {
    return isCellularConnection(await NetInfo.fetch());
  } catch {
    return false;
  }
}

/**
 * Subscribe to any connectivity change (the download queue re-runs on each).
 * Returns an unsubscribe fn; a throwing register (native module absent)
 * degrades to a no-op unsubscriber rather than crashing the service.
 */
export function onNetworkChange(listener: (state: NetInfoState) => void): () => void {
  try {
    return NetInfo.addEventListener(listener);
  } catch {
    return () => undefined;
  }
}

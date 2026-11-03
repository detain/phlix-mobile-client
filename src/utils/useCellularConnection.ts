/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/useCellularConnection.ts
// M3 (deferred lane): live cellular verdict for the PlayerScreen data-plan
// banner. NetInfo's listener contract delivers the CURRENT state immediately
// on subscribe, so no separate fetch() is needed. A throwing register (native
// module absent — jest without the setup mock, or a broken bridge) degrades
// to "never claim cellular": the notice is an optimization, not a gate.
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { isCellularConnection } from './networkState';

export function useCellularConnection(): boolean {
  const [cellular, setCellular] = useState(false);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = NetInfo.addEventListener((state) => {
        setCellular(isCellularConnection(state));
      });
    } catch {
      return undefined;
    }
    return () => unsubscribe?.();
  }, []);
  return cellular;
}

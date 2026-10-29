/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/cast/castPillHelpers.ts
//
// Pure decision helpers for the CastSessionPill (M-MOBILE-16): the root-level
// "Casting to X" affordance that keeps a live cast REACHABLE after the Cast
// screen is dismissed. Both are total functions over store state — they render
// nothing and touch no hooks, so the reachability law is unit-pinned without a
// renderer.

import type { CastMediaInput } from '../../api/CastManager';
import type { CastDevice } from '../../types/cast';
import type { RootStackParamList } from '../../types/navigation';

/** Params the `Cast` route needs to re-open its transport view. */
export type CastRouteParams = RootStackParamList['Cast'];

/**
 * The pill shows for a live session ONLY while the Cast screen itself is NOT
 * mounted — never two control surfaces at once, never a phantom pill without
 * a session (`activeDevice` is the session slot; it clears on stop, explicit
 * switch, and server-confirmed end — see the useCastStore lifecycle law).
 */
export const isCastPillVisible = (
  activeDevice: CastDevice | null,
  screenVisible: boolean
): boolean => activeDevice !== null && !screenVisible;

/**
 * Route params to re-open the controller for the STORED session — derived
 * from what was actually cast (`activeMedia`), never from whatever detail
 * page the re-entry happened to be launched from. A session without stored
 * media cannot be re-attached to a controller, so it yields null (the pill
 * renders nothing rather than promising a control it cannot deliver).
 */
export const castPillNavigateParams = (
  media: CastMediaInput | null
): CastRouteParams | null => {
  if (!media) {
    return null;
  }
  return {
    mediaItemId: media.mediaItemId,
    streamUrl: media.mediaUrl,
    ...(media.title != null ? { title: media.title } : {}),
    ...(media.thumbnail != null ? { thumbnail: media.thumbnail } : {}),
    ...(media.durationSecs != null ? { durationSecs: media.durationSecs } : {}),
  };
};

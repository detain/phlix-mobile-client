/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/cast/__tests__/castPillHelpers.test.ts
// Pure decision law behind the M-MOBILE-16 re-entry pill.
import type { CastMediaInput } from '../../../api/CastManager';
import type { CastDevice } from '../../../types/cast';
import { castPillNavigateParams, isCastPillVisible } from '../castPillHelpers';

const tv: CastDevice = { backend: 'chromecast', id: 'cc1', name: 'TV' };

describe('isCastPillVisible', () => {
  it('renders nothing without a session (no phantom pill)', () => {
    expect(isCastPillVisible(null, false)).toBe(false);
    expect(isCastPillVisible(null, true)).toBe(false);
  });

  it('renders nothing while the Cast screen itself is up (never two surfaces)', () => {
    expect(isCastPillVisible(tv, true)).toBe(false);
  });

  it('renders for a live session once the Cast screen is dismissed', () => {
    expect(isCastPillVisible(tv, false)).toBe(true);
  });
});

describe('castPillNavigateParams', () => {
  it('maps the stored media onto the Cast route contract', () => {
    const media: CastMediaInput = {
      mediaItemId: 'm1',
      mediaUrl: 'https://srv/stream.m3u8',
      title: 'Big Show',
      thumbnail: 'https://srv/t.jpg',
      durationSecs: 120,
    };
    expect(castPillNavigateParams(media)).toEqual({
      mediaItemId: 'm1',
      streamUrl: 'https://srv/stream.m3u8',
      title: 'Big Show',
      thumbnail: 'https://srv/t.jpg',
      durationSecs: 120,
    });
  });

  it('omits optional keys that were never cast (exact-absence, not undefined)', () => {
    const media: CastMediaInput = { mediaItemId: 'm2', mediaUrl: 'u' };
    const params = castPillNavigateParams(media);
    expect(params).not.toBeNull();
    expect(Object.keys(params as object).sort()).toEqual([
      'mediaItemId',
      'streamUrl',
    ]);
  });

  it('yields null without stored media — no affordance we cannot honor', () => {
    expect(castPillNavigateParams(null)).toBeNull();
  });
});

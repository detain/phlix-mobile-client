/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/__tests__/mediaFallback.test.ts
//
// M-MOBILE-42 (review mobile__crossfe): the pure decision behind every
// missing-artwork surface. The LAW: a card with no usable image yields
// `undefined` (= render `LocalPlaceholder`) — never a third-party uri.

import { firstUsableUri } from '../mediaFallback';

describe('firstUsableUri (M-MOBILE-42 local fallback law)', () => {
  it('returns the first truthy candidate, in order', () => {
    expect(firstUsableUri('https://srv/a.jpg', 'https://srv/b.jpg')).toBe(
      'https://srv/a.jpg'
    );
    expect(
      firstUsableUri(undefined, '', null, 'https://srv/poster.jpg')
    ).toBe('https://srv/poster.jpg');
  });

  it('returns undefined when NOTHING is usable — no remote placeholder is invented', () => {
    expect(firstUsableUri()).toBeUndefined();
    expect(firstUsableUri(undefined, null, '')).toBeUndefined();
  });
});

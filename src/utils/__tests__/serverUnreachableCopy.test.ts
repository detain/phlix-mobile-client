/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/__tests__/serverUnreachableCopy.test.ts
//
// MOB-35: the "can't reach your server" stem is single-sourced. Both lanes
// must start with the exact shared stem and keep their own, distinct remedy
// tail (transport lane: full address; Home blackout: sign out → sign in).

import fs from 'fs';
import path from 'path';

import { SERVER_UNREACHABLE_STEM } from '../serverUnreachableCopy';
import { SERVER_UNREACHABLE_MESSAGE } from '../../api/client';
import { HOME_SERVER_BLACKOUT_MESSAGE } from '../../screens/homeFailurePolicy';

const read = (rel: string): string => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('serverUnreachableCopy (MOB-35)', () => {
  it('the stem is one honest checklist sentence pair', () => {
    expect(SERVER_UNREACHABLE_STEM).toBe(
      "Can't reach your Phlix server. Check that it's running and that this device is on the same network."
    );
  });

  it('transport lane = stem + full-address remedy', () => {
    expect(SERVER_UNREACHABLE_MESSAGE.startsWith(`${SERVER_UNREACHABLE_STEM} `)).toBe(true);
    expect(SERVER_UNREACHABLE_MESSAGE).toContain('http://192.168.1.100:8096');
    expect(SERVER_UNREACHABLE_MESSAGE).not.toContain('sign out');
  });

  it('Home blackout lane = stem + sign-out remedy', () => {
    expect(HOME_SERVER_BLACKOUT_MESSAGE.startsWith(`${SERVER_UNREACHABLE_STEM} `)).toBe(true);
    expect(HOME_SERVER_BLACKOUT_MESSAGE).toContain('sign out');
    expect(HOME_SERVER_BLACKOUT_MESSAGE).not.toContain('192.168.1.100');
  });

  it('no consumer re-types the stem literally (drift guard)', () => {
    for (const rel of ['../../api/client.ts', '../../screens/homeFailurePolicy.ts']) {
      const src = read(rel);
      expect(src).not.toContain("Can't reach your Phlix server");
      expect(src).toContain("from '../utils/serverUnreachableCopy'");
    }
  });
});

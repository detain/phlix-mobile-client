/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/screens/w09L1ErrorRouting.test.ts
//
// Source-read pins (w04L4StructuralPins.test.ts precedent) for the two
// error-copy items whose law is about WHICH door the text travels through.
// The behavior behind the door is already pinned where the door lives
// (`apiErrorMessage` in src/api/__tests__/client.test.ts; the cast Alert
// flow in src/screens/__tests__/CastScreen.test.tsx; the native-failure
// mapper in src/services/__tests__/DownloadService.failureCopy.test.ts).
// What these pins keep from regressing is the routing itself: no catch on
// these surfaces may print a raw `err.message` again.
//
// - MW-098 (review mobile__casualgamer #1): "raw technical error text as the
//   entire user-facing response" — MediaDetailScreen's three catches and
//   CastScreen's local errText helper (a raw-message pass-through with extra
//   steps) all route through apiErrorMessage now.
// - MW-045 (review mobile__casualgamer #2): the native download failure
//   string is mapped by describeDownloadFailure before it reaches the store;
//   the JS-side beginDownload catch rides apiErrorMessage.

import fs from 'fs';
import path from 'path';

const read = (...parts: string[]): string =>
  fs.readFileSync(path.resolve(__dirname, '..', '..', ...parts), 'utf8');

describe('MW-098 — MediaDetailScreen catches speak through apiErrorMessage', () => {
  const detail = read('screens', 'MediaDetailScreen.tsx');

  it('the REST error door is imported from the api client', () => {
    expect(detail).toContain("import { apiErrorMessage } from '../api/client';");
  });

  it('load, favorite and rating failures all ride the door with their fallbacks', () => {
    expect(detail).toContain("setError(apiErrorMessage(err, 'Failed to load media details'));");
    expect(detail).toContain("apiErrorMessage(err, 'Could not update favorite')");
    expect(detail).toContain("apiErrorMessage(err, 'Could not update rating')");
  });

  it('the raw err.message pass-through is retired in this file', () => {
    expect(detail).not.toMatch(/err instanceof Error \? err\.message/);
  });
});

describe('MW-098 — CastScreen retired its local errText helper', () => {
  const cast = read('screens', 'CastScreen.tsx');

  it('errText (a bare err.message echo) no longer exists', () => {
    // The provenance comment may NAMED the retired helper; no definition or
    // call may survive.
    expect(cast).not.toMatch(/\berrText\s*[(=]/);
  });

  it('all four cast failure Alerts ride apiErrorMessage', () => {
    const calls = cast.match(/apiErrorMessage\(err, 'Could not /g) ?? [];
    expect(calls).toHaveLength(4);
    expect(cast).toContain("import { apiErrorMessage } from '../api/client';");
  });
});

describe('MW-045 — download failures are mapped before they reach the store', () => {
  const service = read('services', 'DownloadService.ts');

  it('the native failure event stores the mapped prose, not the raw string', () => {
    expect(service).toContain(
      "store.updateTaskStatus(taskId, 'failed', describeDownloadFailure(error));",
    );
    expect(service).toMatch(/export const describeDownloadFailure/);
  });

  it('the JS-side beginDownload catch rides apiErrorMessage', () => {
    expect(service).toContain("import { apiErrorMessage } from '../api/client';");
    expect(service).toMatch(
      /updateTaskStatus\(taskId, 'failed', apiErrorMessage\(err, '[^']+'\)\)/,
    );
  });
});

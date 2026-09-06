/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/SyncPlayManager.join.test.ts
//
// S441 (finish-S293) — the REST join leg of the SyncPlay protocol boundary.
// The wire speaks MILLISECONDS; `joinRoom()`'s `currentState` is consumed as
// app-internal SECONDS. These fixtures are 1000×-sensitive in BOTH directions:
// an undecoded passthrough lands 42 500, a double decode lands 0.0425 — every
// assertion below goes red for either mistake.

import apiClient from '../../api/client';
import {syncPlayManager} from '../../api/SyncPlayManager';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn()},
  getApiBaseUrl: jest.fn(() => 'https://api.invalid'),
}));

const mockPost = (apiClient as unknown as {post: jest.Mock}).post;

function joinedGroup(overrides: Record<string, unknown>) {
  return {
    group: {
      group_id: 'g1',
      group_name: 'Movie night',
      members: {},
      host_id: 'host-1',
      playback_state: 'playing',
      last_activity_at: 1_700_000_000,
      ...overrides,
    },
  };
}

describe('SyncPlayManager.joinRoom — S441 inbound ms→s decode (REST leg)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('decodes a 42 500 ms wire anchor into 42.5 s exactly once', async () => {
    mockPost.mockResolvedValueOnce(joinedGroup({playback_position: 42_500}));

    const result = await syncPlayManager.joinRoom('g1');

    expect(result.sessionId).toBe('g1');
    expect(result.currentState.position).toBe(42.5);
  });

  it('keeps an absent anchor at 0 s (no NaN leak into the seconds contract)', async () => {
    mockPost.mockResolvedValueOnce(joinedGroup({playback_position: undefined}));

    const result = await syncPlayManager.joinRoom('g1');

    expect(result.currentState.position).toBe(0);
  });
});

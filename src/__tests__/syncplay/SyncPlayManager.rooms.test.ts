/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/SyncPlayManager.rooms.test.ts
//
// MW-026 (review mobile__exploiter #7) — the room-list mapping leg of the
// SyncPlay REST boundary. `isoFromUnixSeconds` guarded only `Number.isFinite`
// before building the Date: a hostile/stale `created_at` (1e20 is finite)
// passed the guard and `toISOString()` threw RangeError on it — the reject
// was caught in the modal but reddened the ENTIRE room list for one junk row.
// The law now: values outside the Date epoch range degrade to `''` exactly
// like the non-finite lane already did; one junk row never sinks the list.

import apiClient from '../../api/client';
import { syncPlayManager } from '../../api/SyncPlayManager';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  getApiBaseUrl: jest.fn(() => 'https://api.invalid'),
}));

const mockGet = (apiClient as unknown as { get: jest.Mock }).get;

function groupRow(overrides: Record<string, unknown>) {
  return {
    group_id: 'g1',
    group_name: 'Movie night',
    host_id: 'host-1',
    has_password: false,
    member_count: 2,
    created_at: 1_700_000_000,
    ...overrides,
  };
}

describe('SyncPlayManager.getPublicRooms — MW-026 epoch hygiene', () => {
  it('maps an honest epoch to the ISO stamp the row view expects', async () => {
    mockGet.mockResolvedValueOnce({ groups: [groupRow({})] });

    const [room] = await syncPlayManager.getPublicRooms();

    expect(room.createdAt).toBe('2023-11-14T22:13:20.000Z');
  });

  it.each([
    ['a far-future epoch', 1e20],
    ['a far-past epoch', -1e20],
    ['just past the Date millisecond ceiling', 8.641e12],
  ])('degrades %s to an empty stamp instead of throwing', async (_label, createdAt) => {
    mockGet.mockResolvedValueOnce({ groups: [groupRow({ created_at: createdAt })] });

    const [room] = await syncPlayManager.getPublicRooms();

    expect(room.createdAt).toBe('');
    // The row itself still renders — the guard is per-field, not per-row.
    expect(room.name).toBe('Movie night');
  });

  it('one out-of-range row never reddens the whole list', async () => {
    mockGet.mockResolvedValueOnce({
      groups: [
        groupRow({ group_id: 'junk', created_at: 1e20 }),
        groupRow({ group_id: 'good', created_at: 1_700_000_000 }),
      ],
    });

    const rooms = await syncPlayManager.getPublicRooms();

    expect(rooms).toHaveLength(2);
    expect(rooms[0].createdAt).toBe('');
    expect(rooms[1].createdAt).toBe('2023-11-14T22:13:20.000Z');
  });
});

/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/syncplay/SyncPlayManager.rooms.test.ts
//
// MW-026 (review mobile__exploiter #7) — epoch hygiene at the SyncPlay REST
// boundary. `isoFromUnixSeconds` guarded only `Number.isFinite` before
// building the Date: a hostile/stale epoch (1e20 is finite) passed the guard
// and `toISOString()` threw RangeError — one junk value sunk the whole
// result. The law now: values outside the Date buildable span degrade to `''`
// exactly like the non-finite lane did; one junk row never sinks anything.
//
// w07L2 wire-truth correction (review w06L3 minor): this file's original
// story claimed a hostile `created_at` on a ROOM-LIST row reddened the list.
// The live list wire — server `SyncPlaySnapshotService::listGroups`
// (re-anchored at phlix-server a63dc0db, src/Session/SyncPlay/
// SyncPlaySnapshotService.php:127-160) — emits per row ONLY
// {id, name, member_count, has_password, current_media, is_playing}: NO
// `created_at`, and rows use the SHORT `id` spelling (no `group_id`). On
// that path the mapRoom epoch arm is belt (defensive): an unknown key must
// degrade and never throw — pinned below exactly that way. The guard's
// PRODUCTION conviction arm is `group.members[].joined_at` on the
// create/join envelope: `GroupState::getState` (:1059-1067) serializes each
// member as {id, name, is_host, joined_at} with joined_at from server
// `time()` — so the out-of-range conviction suite drives joinRoom here.

import apiClient from '../../api/client';
import { syncPlayManager } from '../../api/SyncPlayManager';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  getApiBaseUrl: jest.fn(() => 'https://api.invalid'),
}));

const mockGet = (apiClient as unknown as { get: jest.Mock }).get;
const mockPost = (apiClient as unknown as { post: jest.Mock }).post;

/** One row EXACTLY as the list wire emits it (listGroups@a63dc0db) —
 *  short `id`, and no timestamp field exists to forge on this leg. */
function listRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    name: 'Movie night',
    member_count: 2,
    has_password: false,
    current_media: null,
    is_playing: false,
    ...overrides,
  };
}

/** The `{success, group}` create/join envelope (SyncPlayGroupResponse);
 *  `getState`-shape group: full `group_id` spelling + members dict keyed
 *  by member id. */
function envelope(
  members: Record<string, Record<string, unknown>>,
  groupOverrides: Record<string, unknown> = {}
) {
  return {
    success: true,
    group: {
      group_id: 'g1',
      playback_state: 'playing',
      playback_position: 42_000,
      last_activity_at: 1_700_000_100,
      members,
      ...groupOverrides,
    },
  };
}

const HONEST_MEMBER = { id: 'm-1', name: 'Ada', is_host: true, joined_at: 1_700_000_000 };
const HONEST_ISO = '2023-11-14T22:13:20.000Z';

describe('SyncPlayManager.getPublicRooms — the list wire as emitted', () => {
  it('maps the real row shape; createdAt stays empty because the list carries no timestamp', async () => {
    mockGet.mockResolvedValueOnce({ groups: [listRow()] });

    const [room] = await syncPlayManager.getPublicRooms();

    expect(room).toMatchObject({
      id: 'g1',
      name: 'Movie night',
      memberCount: 2,
      isPublic: true,
      hasPassword: false,
      createdAt: '',
    });
  });

  it('belt law: a fabricated out-of-range created_at degrades to an empty stamp and never throws', async () => {
    // Not reachable on the live list wire — pinned as the defensive arm:
    // if a server (or middlebox) ever smuggles the field, the row survives.
    mockGet.mockResolvedValueOnce({
      groups: [
        listRow({ group_id: 'junk', created_at: 1e20 }),
        listRow({ group_id: 'good' }),
      ],
    });

    const rooms = await syncPlayManager.getPublicRooms();

    expect(rooms).toHaveLength(2);
    expect(rooms[0].createdAt).toBe('');
    expect(rooms[0].id).toBe('junk'); // `group_id` keeps precedence over `id`
    expect(rooms[1].createdAt).toBe(''); // the honest spelling carries none
  });
});

describe('SyncPlayManager.joinRoom — MW-026 epoch conviction (live arm)', () => {
  it('maps an honest member joined_at to the ISO stamp the member view expects', async () => {
    mockPost.mockResolvedValueOnce(envelope({ 'm-1': HONEST_MEMBER }));

    const { members } = await syncPlayManager.joinRoom('g1');

    expect(members).toHaveLength(1);
    expect(members[0]).toEqual({ id: 'm-1', name: 'Ada', isHost: true, joinedAt: HONEST_ISO });
  });

  it.each([
    ['a far-future epoch', 1e20],
    ['a far-past epoch', -1e20],
    ['just past the Date millisecond ceiling', 8.641e12],
  ])('degrades a hostile member %s to an empty stamp instead of throwing', async (_label, joinedAt) => {
    mockPost.mockResolvedValueOnce(
      envelope({ 'm-1': HONEST_MEMBER, 'm-2': { id: 'm-2', name: 'Eve', is_host: false, joined_at: joinedAt } })
    );

    const { members } = await syncPlayManager.joinRoom('g1');

    expect(members.find((m) => m.id === 'm-2')?.joinedAt).toBe('');
    // The guard is per-field: the honest member's stamp survives alongside.
    expect(members.find((m) => m.id === 'm-1')?.joinedAt).toBe(HONEST_ISO);
  });

  it('one out-of-range member never reddens the join', async () => {
    mockPost.mockResolvedValueOnce(
      envelope({
        'm-1': HONEST_MEMBER,
        'm-2': { id: 'm-2', name: 'Eve', is_host: false, joined_at: 1e20 },
        'm-3': { id: 'm-3', name: 'Bob', is_host: false, joined_at: 'not-a-number' },
      })
    );

    const { members } = await syncPlayManager.joinRoom('g1');

    expect(members).toHaveLength(3);
    expect(members.map((m) => m.joinedAt)).toEqual([HONEST_ISO, '', '']);
  });
});

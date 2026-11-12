/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/components/syncplay/SyncPlayModal.inflight.test.tsx
//
// MW-023 (review mobile__exploiter #3) + MW-026 (review mobile__exploiter #7),
// renderer-free per the SeekBar/SkipButton doctrine (no React renderer in
// test deps): a slot-backed hook host stands in for the dispatcher, so
// re-invoking the component reads back the mutated state slots.
//
//   MW-023 — the Refresh button fired `loadPublicRooms` with no disabled /
//   in-flight gate: two GET /syncplay/groups raced and the LATER-ARRIVING
//   (possibly older) response overwrote the fresher one. Cure: the button is
//   disabled while a load is in flight AND every load carries a monotonic
//   sequence token — only the most-recently-STARTED request may write rooms,
//   clear the error, or lower the spinner.
//   MW-026 — the modal dialed `connectWithRoom` even when the create/join
//   answer carried NO group id: an empty `group_id` rides the socket join and
//   silently strands the viewer outside their own party. Cure: refuse the
//   dial with a named error (both from a blank create answer and from a
//   blank-id list row).

import type { ReactElement } from 'react';

// ── slot-backed hook host (useState/useRef; useEffect/useCallback stubs) ───
class SlotHost {
  private slots: Array<{ value: unknown }> = [];
  private cursor = 0;

  useState<T>(init: T | (() => T)): [T, (v: T | ((p: T) => T)) => void] {
    const i = this.cursor++;
    if (this.slots[i] === undefined) {
      const value = typeof init === 'function' ? (init as () => T)() : init;
      this.slots[i] = { value };
    }
    const slot = this.slots[i] as { value: T };
    const setter = (v: T | ((p: T) => T)) => {
      slot.value = typeof v === 'function' ? (v as (p: T) => T)(slot.value) : v;
    };
    return [slot.value, setter];
  }

  useRef<T>(init: T): { current: T } {
    const [box] = this.useState({ current: init });
    return box;
  }

  render<R>(fn: () => R): R {
    this.cursor = 0;
    mockHost.current = this;
    try {
      return fn();
    } finally {
      mockHost.current = null;
    }
  }
}

const mockHost: { current: SlotHost | null } = { current: null };

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useState: (init: unknown) => mockHost.current!.useState(init as never),
    useRef: (init: unknown) => mockHost.current!.useRef(init),
    // The mount effect (visible → first load) is NOT what these pins drive —
    // handlers are pressed directly, mirroring the user's taps.
    useEffect: () => undefined,
    useCallback: (fn: unknown) => fn,
  };
});

// Import AFTER the hook mock is registered (jest hoists the mock call).
import SyncPlayModal from '../../../components/syncplay/SyncPlayModal';

// ── seams the two findings ride ─────────────────────────────────────────────
import { syncPlayManager } from '../../../api/SyncPlayManager';
import { syncPlayService } from '../../../syncplay/SyncPlayService';

jest.mock('../../../api/SyncPlayManager', () => ({
  syncPlayManager: {
    getPublicRooms: jest.fn(),
    createRoom: jest.fn(),
    joinRoom: jest.fn(),
  },
}));
jest.mock('../../../syncplay/SyncPlayService', () => ({
  syncPlayService: { connectWithRoom: jest.fn(), leaveGroup: jest.fn() },
}));
jest.mock('../../../utils/haptics', () => ({ fireHaptic: jest.fn() }));
jest.mock('../../../store/syncplayStore', () => ({
  // The modal reads its three store slots through selector hooks; the
  // browse-tab fixture keeps currentGroup null (the in-group panel branches
  // into a different tree and is pinned elsewhere).
  useSyncplayStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ currentGroup: null, isHost: false, timeSyncStable: true }),
}));

const mockGetPublicRooms = syncPlayManager.getPublicRooms as jest.Mock;
const mockCreateRoom = syncPlayManager.createRoom as jest.Mock;
const mockJoinRoom = syncPlayManager.joinRoom as jest.Mock;
const mockConnectWithRoom = syncPlayService.connectWithRoom as jest.Mock;

// ── element-tree helpers (renderer-free: props are invoked directly) ───────
type El = ReactElement<Record<string, any>>;

function findEl(node: unknown, pred: (el: El) => boolean): El | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findEl(child, pred);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === 'object' && 'props' in (node as El)) {
    const el = node as El;
    if (pred(el)) return el;
    return findEl(el.props.children, pred);
  }
  return null;
}

function textLabels(node: unknown, acc: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) textLabels(child, acc);
    return acc;
  }
  if (node && typeof node === 'object' && 'props' in (node as El)) {
    const el = node as El;
    if (typeof el.props.children === 'string') acc.push(el.props.children);
    textLabels(el.props.children, acc);
  }
  return acc;
}

const findRefresh = (tree: unknown): El => {
  const el = findEl(tree, (e) => e.props.testID === 'syncplay-refresh');
  if (!el) throw new Error('Refresh control (testID=syncplay-refresh) not rendered');
  return el;
};

const findRoomRow = (tree: unknown): El => {
  const el = findEl(tree, (e) => e.props.testID === 'syncplay-room-row');
  if (!el) throw new Error('Room row (testID=syncplay-room-row) not rendered');
  return el;
};

const findButtonByText = (tree: unknown, label: string): El => {
  // Leaf-button match: a direct, single Text child carrying the label. A
  // subtree-wide text search would match the tap-outside overlay (it contains
  // every label) and press the wrong responder.
  const el = findEl(tree, (e) => {
    if (typeof e.props.onPress !== 'function' || Array.isArray(e.props.children)) {
      return false;
    }
    const child = e.props.children as El | undefined;
    return (
      !!child &&
      typeof child.props === 'object' &&
      child.props !== null &&
      typeof child.props.children === 'string' &&
      child.props.children.trim() === label
    );
  });
  if (!el) throw new Error(`Button "${label}" not rendered`);
  return el;
};

const findInputByPlaceholder = (tree: unknown, placeholder: string): El => {
  const el = findEl(tree, (e) => e.props.placeholder === placeholder);
  if (!el) throw new Error(`Input "${placeholder}" not rendered`);
  return el;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setImmediate(r));

const room = (overrides: Record<string, unknown>) => ({
  id: 'g1',
  name: 'Movie night',
  isPublic: true,
  hasPassword: false,
  memberCount: 2,
  createdAt: '2023-11-14T22:13:20.000Z',
  hostId: 'host-1',
  hostName: 'host-1',
  ...overrides,
});

describe('SyncPlayModal — MW-023 refresh in-flight discipline', () => {
  let host: SlotHost;
  const render = () =>
    host.render(() =>
      SyncPlayModal({ visible: true, onClose: jest.fn(), itemId: 'media-1' })
    );

  beforeEach(() => {
    host = new SlotHost();
    jest.clearAllMocks();
  });

  it('the Refresh control is disabled for the whole life of a load', async () => {
    const load = deferred<ReturnType<typeof room>[]>();
    mockGetPublicRooms.mockReturnValueOnce(load.promise);

    findRefresh(render()).props.onPress();
    expect(findRefresh(render()).props.disabled).toBe(true);

    load.resolve([]);
    await flush();
    expect(findRefresh(render()).props.disabled).toBe(false);
  });

  it('a late-still-older response can never overwrite the fresher list', async () => {
    // Two overlapping loads (the shape RN's disabled gate prevents from the
    // tap lane, but the store-reopen race reaches it in the real dispatcher):
    // request #2 started AFTER #1, so #2 owns the list whichever lands last.
    const first = deferred<any[]>();
    const second = deferred<any[]>();
    mockGetPublicRooms.mockReturnValueOnce(first.promise);
    mockGetPublicRooms.mockReturnValueOnce(second.promise);

    findRefresh(render()).props.onPress(); // seq 1
    findRefresh(render()).props.onPress(); // seq 2

    second.resolve([room({ id: 'fresh', name: 'Fresh party' })]);
    await flush();
    first.resolve([room({ id: 'stale', name: 'Stale party' })]); // lands last, stale
    await flush();

    const labels = textLabels(render());
    expect(labels).toContain('Fresh party');
    expect(labels).not.toContain('Stale party');
  });

  it('a failed in-flight load still clears the spinner and surfaces the catalog text', async () => {
    const load = deferred<any[]>();
    mockGetPublicRooms.mockReturnValueOnce(load.promise);

    findRefresh(render()).props.onPress();
    expect(findRefresh(render()).props.disabled).toBe(true);

    load.reject({ response: { data: { error_code: 'syncplay.create_failed' } } });
    await flush();

    expect(findRefresh(render()).props.disabled).toBe(false);
    expect(textLabels(render()).join(' ')).toContain('Could not create the SyncPlay room');
  });
});

describe('SyncPlayModal — MW-026 refuse the dial with no group id', () => {
  let host: SlotHost;
  const render = () =>
    host.render(() =>
      SyncPlayModal({ visible: true, onClose: jest.fn(), itemId: 'media-1' })
    );

  const toCreateTab = () => {
    findButtonByText(render(), 'Create').props.onPress();
  };
  const fillRoomName = (name: string) => {
    findInputByPlaceholder(render(), 'Enter room name').props.onChangeText(name);
  };
  const pressCreateRoom = async () => {
    findButtonByText(render(), 'Create Room').props.onPress();
    await flush();
  };

  beforeEach(() => {
    host = new SlotHost();
    jest.clearAllMocks();
  });

  it('a create answer WITHOUT a group id refuses the socket dial and says why', async () => {
    // A 2xx create whose envelope carries no group id is a contract
    // violation; dialing `connectWithRoom('')` opens a WS join with an empty
    // group_id and silently strands the viewer (the finding's exact class).
    mockCreateRoom.mockResolvedValueOnce({ roomId: '', sessionId: '', serverUrl: '' });

    toCreateTab();
    fillRoomName('Party');
    await pressCreateRoom();

    expect(mockConnectWithRoom).not.toHaveBeenCalled();
    expect(textLabels(render()).join(' ')).toContain('returned no room ID');
  });

  it('a well-formed create still dials (positive control)', async () => {
    mockCreateRoom.mockResolvedValueOnce({
      roomId: 'g42',
      sessionId: 'g42',
      serverUrl: '',
    });

    toCreateTab();
    fillRoomName('Party');
    await pressCreateRoom();

    expect(mockConnectWithRoom).toHaveBeenCalledTimes(1);
    expect(mockConnectWithRoom.mock.calls[0][0]).toBe('g42');
  });

  it('a list row with a blank id cannot be joined (the same junk lands there)', async () => {
    mockGetPublicRooms.mockResolvedValueOnce([room({ id: '', name: 'Ghost party' })]);
    findRefresh(render()).props.onPress();
    await flush();

    findRoomRow(render()).props.onPress();
    await flush();

    expect(mockJoinRoom).not.toHaveBeenCalled();
    expect(textLabels(render()).join(' ')).toContain('no room ID');
  });
});

/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/__tests__/PlaybackProgressReporter.test.ts
//
// The resume WRITE-path engine (review mobile__gameux C-1). PlayerScreen's
// wiring is pinned in the screen harness; everything the reporter OWNS lives
// here: the 30s resume floor, the 15s throttle with forced transitions, the
// lazy session (never created for sub-floor plays, never re-created merely to
// finish), the seconds→ticks conversion at the wire boundary, the retained
// snapshot flushed on teardown, the cross-account session reset on logout,
// and the best-effort law that no failure path ever throws or jams later
// reports.

import { playbackProgressReporter, RESUME_MIN_SECONDS } from '../PlaybackProgressReporter';
import { playbackManager } from '../../api/PlaybackManager';

jest.mock('../../api/PlaybackManager', () => ({
  playbackManager: {
    createSession: jest.fn(),
    reportProgress: jest.fn(),
    completeSession: jest.fn(),
  },
}));

jest.mock('../../api/deviceIdentity', () => ({
  getCachedDeviceId: jest.fn(() => 'device-uuid-1'),
  getDeviceName: jest.fn(() => 'Phlix Phone'),
}));

// Mutable auth latch — the reporter reads `getState()` per decision, like the
// real zustand store does.
const mockAuth = { isAuthenticated: true };
jest.mock('../../stores/useAuthStore', () => ({
  useAuthStore: { getState: () => mockAuth },
}));

const mockCreate = playbackManager.createSession as jest.Mock;
const mockReport = playbackManager.reportProgress as jest.Mock;
const mockComplete = playbackManager.completeSession as jest.Mock;

const START = new Date('2026-10-29T12:00:00Z').getTime();

const snapshot = (over: Partial<Parameters<typeof playbackProgressReporter.report>[0]> = {}) => ({
  mediaItemId: 'm-1',
  positionSeconds: 120,
  durationSeconds: 600,
  paused: false,
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers({ now: START });
  jest.clearAllMocks();
  mockAuth.isAuthenticated = true;
  mockCreate.mockResolvedValue('sess-1');
  mockReport.mockResolvedValue(undefined);
  mockComplete.mockResolvedValue(undefined);
  playbackProgressReporter.forgetSession();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PlaybackProgressReporter', () => {
  it('stays completely silent below the resume floor — no session, no POST', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: RESUME_MIN_SECONDS }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('the first reportable tick opens a device session and POSTs TICKS', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: 120.4 }));

    expect(mockCreate).toHaveBeenCalledWith({
      deviceId: 'device-uuid-1',
      deviceName: 'Phlix Phone',
      deviceType: 'ios',
    });
    expect(mockReport).toHaveBeenCalledWith('sess-1', {
      mediaItemId: 'm-1',
      positionTicks: 1_204_000_000, // 120.4s × 10^7, floored
      durationTicks: 6_000_000_000,
      isPaused: false,
    });
  });

  it('ticks inside the 15s window are throttled; the next window POSTs again', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: 120 }));
    expect(mockReport).toHaveBeenCalledTimes(1);

    await playbackProgressReporter.report(snapshot({ positionSeconds: 125 }));
    expect(mockReport).toHaveBeenCalledTimes(1);

    jest.setSystemTime(START + 15_000);
    await playbackProgressReporter.report(snapshot({ positionSeconds: 135 }));
    expect(mockReport).toHaveBeenCalledTimes(2);
    expect(mockReport).toHaveBeenLastCalledWith('sess-1', {
      mediaItemId: 'm-1',
      positionTicks: 1_350_000_000,
      durationTicks: 6_000_000_000,
      isPaused: false,
    });
  });

  it('forced reports (play/pause transitions) bypass the throttle', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: 120 }));
    await playbackProgressReporter.report(
      snapshot({ positionSeconds: 121, paused: true }),
      true,
    );

    expect(mockReport).toHaveBeenCalledTimes(2);
    expect(mockReport).toHaveBeenLastCalledWith('sess-1', {
      mediaItemId: 'm-1',
      positionTicks: 1_210_000_000,
      durationTicks: 6_000_000_000,
      isPaused: true,
    });
  });

  it('reuses ONE session across many reports (idempotent per device id)', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: 120 }));
    jest.setSystemTime(START + 16_000);
    await playbackProgressReporter.report(snapshot({ positionSeconds: 136 }));
    jest.setSystemTime(START + 32_000);
    await playbackProgressReporter.report(snapshot({ positionSeconds: 152 }));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledTimes(3);
  });

  it('complete() finalizes on the SAME session and never creates one just to finish', async () => {
    // Sub-floor play → nothing to finalize.
    await playbackProgressReporter.complete('m-1');
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();

    // After a reportable tick → the explicit /complete signal (reached_end).
    await playbackProgressReporter.report(snapshot());
    await playbackProgressReporter.complete('m-1');
    expect(mockComplete).toHaveBeenCalledWith('sess-1', 'm-1', true);
    expect(mockCreate).toHaveBeenCalledTimes(1); // complete did NOT re-create
  });

  it('flush() forces the retained (or live) snapshot past the throttle', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: 120 }));
    expect(mockReport).toHaveBeenCalledTimes(1);

    // The quit happens 3s later — inside the throttle window; flush still lands.
    jest.setSystemTime(START + 3_000);
    await playbackProgressReporter.flush(snapshot({ positionSeconds: 123 }));
    expect(mockReport).toHaveBeenCalledTimes(2);
    expect(mockReport).toHaveBeenLastCalledWith('sess-1', {
      mediaItemId: 'm-1',
      positionTicks: 1_230_000_000,
      durationTicks: 6_000_000_000,
      isPaused: false,
    });
  });

  it('flush() falls back to the LAST RETAINED snapshot when the live read is stale', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: 120 }));
    // Teardown hands over a meaningless live read (live stream never does —
    // guard kept honest): retained 120s wins.
    await playbackProgressReporter.flush(snapshot({ positionSeconds: 5, durationSeconds: 0 }));

    expect(mockReport).toHaveBeenLastCalledWith('sess-1', {
      mediaItemId: 'm-1',
      positionTicks: 1_200_000_000,
      durationTicks: 6_000_000_000,
      isPaused: false,
    });
  });

  it('flush()/complete() without a session are no-ops (sub-floor plays)', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: 10 }));
    await playbackProgressReporter.flush(snapshot({ positionSeconds: 300 }));
    await playbackProgressReporter.complete('m-1');

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockReport).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('logout drops the session handle — the next account never aims at it', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: 120 }));
    expect(mockCreate).toHaveBeenCalledTimes(1);

    mockAuth.isAuthenticated = false;
    await playbackProgressReporter.report(snapshot({ positionSeconds: 240 }));
    expect(mockReport).toHaveBeenCalledTimes(1); // no stray cross-account POST

    mockAuth.isAuthenticated = true;
    jest.setSystemTime(START + 16_000);
    await playbackProgressReporter.report(snapshot({ positionSeconds: 250 }));
    expect(mockCreate).toHaveBeenCalledTimes(2); // fresh session for the new login
    expect(mockReport).toHaveBeenCalledTimes(2);
  });

  it('a failed session creation is swallowed and retried on a later window', async () => {
    mockCreate.mockRejectedValueOnce(new Error('offline'));

    await playbackProgressReporter.report(snapshot({ positionSeconds: 120 }));
    expect(mockReport).not.toHaveBeenCalled();

    jest.setSystemTime(START + 16_000);
    await playbackProgressReporter.report(snapshot({ positionSeconds: 136 }));
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it('a failed progress POST is swallowed and never jams later reports', async () => {
    mockReport.mockRejectedValueOnce(new Error('500'));

    await playbackProgressReporter.report(snapshot({ positionSeconds: 120 }));
    jest.setSystemTime(START + 16_000);
    await playbackProgressReporter.report(snapshot({ positionSeconds: 136 }));

    expect(mockReport).toHaveBeenCalledTimes(2);
  });

  it('unknown duration (live) is never reported', async () => {
    await playbackProgressReporter.report(snapshot({ positionSeconds: 300, durationSeconds: 0 }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockReport).not.toHaveBeenCalled();
  });
});

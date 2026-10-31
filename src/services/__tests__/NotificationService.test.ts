/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/__tests__/NotificationService.test.ts
// Note: notifee is already mocked in jest.setup.js
// This tests the service's public interface with notifee properly stubbed.

describe('NotificationService', () => {
  // Get references to the already-loaded singleton and notifee mock
  // NotificationService is a singleton, created when the module is first loaded
  const notificationService = require('../NotificationService').notificationService;
  const notifee = require('@notifee/react-native');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('showLocalNotification', () => {
    it('displays notification with title and message', () => {
      notificationService.showLocalNotification({
        title: 'Test Title',
        message: 'Test Message',
      });

      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Title',
          body: 'Test Message',
          data: expect.any(Object),
          android: expect.objectContaining({
            channelId: 'phlix-general',
            importance: 4, // AndroidImportance.HIGH
          }),
        })
      );
    });

    it('includes type in notification data', () => {
      notificationService.showLocalNotification({
        title: 'Test',
        message: 'Message',
        type: 'test_type',
      });

      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'test_type',
          }),
        })
      );
    });

    it('merges custom data into notification', () => {
      notificationService.showLocalNotification({
        title: 'Test',
        message: 'Message',
        data: { customKey: 'customValue' },
      });

      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customKey: 'customValue',
          }),
        })
      );
    });

    it('does not include type in data when not provided', () => {
      notificationService.showLocalNotification({
        title: 'Test',
        message: 'Message',
      });

      const call = notifee.displayNotification.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('type');
    });
  });

  describe('showPlaybackNotification', () => {
    it('displays playback notification with now playing status when playing', () => {
      notificationService.showPlaybackNotification('My Movie', true);

      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'phlix-playback',
          title: 'My Movie',
          body: 'Now Playing',
          android: expect.objectContaining({
            channelId: 'phlix-playback',
            importance: 2, // AndroidImportance.LOW
            ongoing: true,
            autoCancel: false,
          }),
        })
      );
    });

    it('shows paused status when not playing', () => {
      notificationService.showPlaybackNotification('My Movie', false);

      expect(notifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Paused',
        })
      );
    });
  });

  describe('cancelPlaybackNotification', () => {
    it('cancels the playback notification by id', () => {
      notificationService.cancelPlaybackNotification();

      expect(notifee.cancelNotification).toHaveBeenCalledWith('phlix-playback');
    });
  });

  describe('cancelAll', () => {
    it('cancels all notifications', () => {
      notificationService.cancelAll();

      expect(notifee.cancelAllNotifications).toHaveBeenCalled();
    });
  });
});

// ── M-MOBILE-06 (review mobile__crossfe M3): the press router must know the
// notification type the completion call site actually sends. Pre-cure the
// subsystem had ZERO production call sites; the wired one is
// DownloadService.handleNativeComplete → showLocalNotification(type:
// 'download_complete'), pinned in DownloadService.test.ts.
describe('NotificationService — M-MOBILE-06 download_complete press routing', () => {
  // The router itself is the law under test: configure() registers
  // handleForegroundEvent via notifee.onForegroundEvent at module-load, and
  // the FILE-GLOBAL jest.clearAllMocks() in the sibling describe wipes that
  // registration history before any test body runs. So invoke the same
  // function object the registration would have received — it is an own
  // property of the singleton instance — instead of chasing the lost call
  // record. Precondition: it exists and is the registered shape (arity 1).
  const notificationService = require('../NotificationService').notificationService;
  const handleEvent = (notificationService as any).handleForegroundEvent as (e: {
    type: number;
    detail: { notification?: { data?: Record<string, string> } };
  }) => void;

  it('the foreground press handler exists (law precondition)', () => {
    expect(typeof handleEvent).toBe('function');
    expect(handleEvent.length).toBe(1);
  });

  it('press on download_complete routes to its lane, not the unknown-type fall-through', () => {
    const notifeeMod = require('@notifee/react-native');
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    try {
      handleEvent({
        type: notifeeMod.EventType.PRESS,
        detail: { notification: { data: { type: 'download_complete' } } },
      });
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Unknown notification type')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Download complete notification pressed'),
        expect.anything()
      );

      // Control: an unregistered type still lands in the unknown branch —
      // proving the assertions above are routing teeth, not logging silence.
      logSpy.mockClear();
      handleEvent({
        type: notifeeMod.EventType.PRESS,
        detail: { notification: { data: { type: 'bogus_type' } } },
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown notification type'),
        'bogus_type'
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});

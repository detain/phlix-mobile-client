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

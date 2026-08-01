/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/utils/__tests__/formatters.test.ts
import {
  formatTime,
  formatFileSize,
  formatRuntime,
  formatRelativeTime,
  truncateText,
} from '../formatters';

describe('formatters', () => {
  describe('formatTime', () => {
    it('formats seconds to MM:SS when under an hour', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(30)).toBe('0:30');
      expect(formatTime(59)).toBe('0:59');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(90)).toBe('1:30');
      expect(formatTime(125)).toBe('2:05');
      expect(formatTime(3599)).toBe('59:59');
    });

    it('formats seconds to H:MM:SS when over an hour', () => {
      expect(formatTime(3600)).toBe('1:00:00');
      expect(formatTime(3661)).toBe('1:01:01');
      expect(formatTime(7200)).toBe('2:00:00');
      expect(formatTime(36599)).toBe('10:09:59');
    });

    it('handles fractional seconds by rounding down', () => {
      expect(formatTime(0.9)).toBe('0:00');
      expect(formatTime(30.7)).toBe('0:30');
      expect(formatTime(59.9)).toBe('0:59');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes to B', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(512)).toBe('512 B');
    });

    it('formats bytes to KB', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(10240)).toBe('10 KB');
    });

    it('formats bytes to MB', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
      expect(formatFileSize(104857600)).toBe('100 MB');
    });

    it('formats bytes to GB', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(1610612736)).toBe('1.5 GB');
    });

    it('formats bytes to TB', () => {
      expect(formatFileSize(1099511627776)).toBe('1 TB');
    });

    it('rounds to two decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1048576 + 524288)).toBe('1.5 MB');
    });
  });

  describe('formatRuntime', () => {
    it('formats ticks to minutes when under an hour', () => {
      expect(formatRuntime(0)).toBe('0 min');
      expect(formatRuntime(600000000)).toBe('1 min');
      expect(formatRuntime(6000000000)).toBe('10 min');
      expect(formatRuntime(35400000000)).toBe('59 min');
    });

    it('formats ticks to hours and minutes when over an hour', () => {
      expect(formatRuntime(36000000000)).toBe('1h 0m');
      expect(formatRuntime(36600000000)).toBe('1h 1m');
      expect(formatRuntime(54000000000)).toBe('1h 30m');
      expect(formatRuntime(72000000000)).toBe('2h 0m');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns "Just now" for times under a minute', () => {
      const date = new Date('2026-08-01T11:59:30Z');
      expect(formatRelativeTime(date)).toBe('Just now');
    });

    it('formats minutes ago', () => {
      const date = new Date('2026-08-01T11:59:00Z');
      expect(formatRelativeTime(date)).toBe('1 minute ago');
    });

    it('formats multiple minutes ago', () => {
      const date = new Date('2026-08-01T11:55:00Z');
      expect(formatRelativeTime(date)).toBe('5 minutes ago');
    });

    it('formats hours ago', () => {
      const date = new Date('2026-08-01T10:00:00Z');
      expect(formatRelativeTime(date)).toBe('2 hours ago');
    });

    it('formats multiple hours ago', () => {
      const date = new Date('2026-08-01T06:00:00Z');
      expect(formatRelativeTime(date)).toBe('6 hours ago');
    });

    it('formats days ago', () => {
      const date = new Date('2026-07-31T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('1 day ago');
    });

    it('formats multiple days ago', () => {
      const date = new Date('2026-07-27T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('5 days ago');
    });

    it('returns locale date string for dates over a week old', () => {
      const date = new Date('2026-06-01T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('6/1/2026');
    });
  });

  describe('truncateText', () => {
    it('returns original text if under maxLength', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
      expect(truncateText('Hello', 5)).toBe('Hello');
    });

    it('truncates text with ellipsis if over maxLength', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...');
      expect(truncateText('Very long text here', 10)).toBe('Very lo...');
    });

    it('handles edge case of maxLength of 3 (minimum for "...")', () => {
      expect(truncateText('Hello', 3)).toBe('...');
    });

    it('handles text exactly at maxLength', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });

    it('handles empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });

    it('handles string longer than maxLength by exactly 3', () => {
      // If text is exactly 3 chars longer than maxLength, truncation leaves room for "..."
      expect(truncateText('Hello', 2)).toBe('...');
    });
  });
});

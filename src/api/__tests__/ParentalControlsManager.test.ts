/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/ParentalControlsManager.test.ts
import { parentalControlsManager } from '../ParentalControlsManager';
import apiClient from '../client';
import type { DayOfWeek } from '../../types/parental';

jest.mock('../client');
const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('ParentalControlsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Schedules ─────────────────────────────────────────────────────────────

  describe('getSchedules', () => {
    it('GETs /profiles/{id}/schedules and returns schedules array', async () => {
      const schedules = [
        {
          id: 1,
          profileId: 5,
          name: 'Weekday evenings',
          startTime: '16:00:00',
          endTime: '21:00:00',
          daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'] as const,
          isActive: true,
        },
      ];
      mockedClient.get.mockResolvedValue({ schedules });

      const result = await parentalControlsManager.getSchedules(5);

      expect(mockedClient.get).toHaveBeenCalledWith('/profiles/5/schedules');
      expect(result).toEqual(schedules);
    });

    it('returns empty array when schedules is undefined', async () => {
      mockedClient.get.mockResolvedValue({});

      const result = await parentalControlsManager.getSchedules(5);

      expect(result).toEqual([]);
    });
  });

  describe('createSchedule', () => {
    it('POSTs to /profiles/{id}/schedules with schedule data', async () => {
      const input = {
        name: 'Bedtime',
        startTime: '20:00:00',
        endTime: '07:00:00',
        daysOfWeek: ['sat', 'sun'] as DayOfWeek[],
        isActive: true,
      };
      const created = { id: 10, profileId: 5, ...input };
      mockedClient.post.mockResolvedValue(created);

      const result = await parentalControlsManager.createSchedule(5, input);

      expect(mockedClient.post).toHaveBeenCalledWith('/profiles/5/schedules', input);
      expect(result).toEqual(created);
    });
  });

  describe('updateSchedule', () => {
    it('POSTs to /profiles/{id}/schedules with schedule data including id', async () => {
      const input = {
        id: 10,
        name: 'Updated bedtime',
        startTime: '21:00:00',
        endTime: '06:00:00',
        daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as DayOfWeek[],
        isActive: false,
      };
      mockedClient.post.mockResolvedValue(input);

      const result = await parentalControlsManager.updateSchedule(5, input);

      expect(mockedClient.post).toHaveBeenCalledWith('/profiles/5/schedules', input);
      expect(result).toEqual(input);
    });
  });

  describe('deleteSchedule', () => {
    it('DELETEs /profiles/{id}/schedules/{scheduleId}', async () => {
      mockedClient.delete.mockResolvedValue({ message: 'deleted' });

      await parentalControlsManager.deleteSchedule(5, 10);

      expect(mockedClient.delete).toHaveBeenCalledWith('/profiles/5/schedules/10');
    });
  });

  // ── Tags ─────────────────────────────────────────────────────────────────

  describe('getTags', () => {
    it('GETs /profiles/{id}/tags and returns tags array', async () => {
      const tags = [
        { id: 1, profileId: 5, tag: 'kids', tagType: 'allowed' as const },
        { id: 2, profileId: 5, tag: 'adult', tagType: 'blocked' as const },
      ];
      mockedClient.get.mockResolvedValue({ tags });

      const result = await parentalControlsManager.getTags(5);

      expect(mockedClient.get).toHaveBeenCalledWith('/profiles/5/tags');
      expect(result).toEqual(tags);
    });

    it('returns empty array when tags is undefined', async () => {
      mockedClient.get.mockResolvedValue({});

      const result = await parentalControlsManager.getTags(5);

      expect(result).toEqual([]);
    });
  });

  describe('addTag', () => {
    it('POSTs to /profiles/{id}/tags with tag data', async () => {
      const input = { tag: 'restricted', tagType: 'blocked' as const };
      const created = { id: 3, profileId: 5, ...input };
      mockedClient.post.mockResolvedValue(created);

      const result = await parentalControlsManager.addTag(5, input);

      expect(mockedClient.post).toHaveBeenCalledWith('/profiles/5/tags', input);
      expect(result).toEqual(created);
    });
  });

  describe('removeTag', () => {
    it('DELETEs /profiles/{id}/tags/{tagId}', async () => {
      mockedClient.delete.mockResolvedValue({ message: 'tag removed' });

      await parentalControlsManager.removeTag(5, 3);

      expect(mockedClient.delete).toHaveBeenCalledWith('/profiles/5/tags/3');
    });
  });

  // ── Stream Limits ────────────────────────────────────────────────────────

  describe('getStreamLimit', () => {
    it('GETs /profiles/{id}/stream-limits', async () => {
      const limit = {
        profileId: 5,
        maxConcurrentStreams: 2,
        maxTotalBandwidthKbps: 10000,
      };
      mockedClient.get.mockResolvedValue(limit);

      const result = await parentalControlsManager.getStreamLimit(5);

      expect(mockedClient.get).toHaveBeenCalledWith('/profiles/5/stream-limits');
      expect(result).toEqual(limit);
    });
  });

  describe('updateStreamLimit', () => {
    it('PUTs to /profiles/{id}/stream-limits with new limits', async () => {
      const input = { maxConcurrentStreams: 3, maxTotalBandwidthKbps: 20000 };
      const updated = { profileId: 5, ...input };
      mockedClient.put.mockResolvedValue(updated);

      const result = await parentalControlsManager.updateStreamLimit(5, input);

      expect(mockedClient.put).toHaveBeenCalledWith('/profiles/5/stream-limits', input);
      expect(result).toEqual(updated);
    });

    it('allows null for unlimited bandwidth', async () => {
      const input = { maxConcurrentStreams: 1, maxTotalBandwidthKbps: null };
      mockedClient.put.mockResolvedValue({ profileId: 5, ...input });

      await parentalControlsManager.updateStreamLimit(5, input);

      expect(mockedClient.put).toHaveBeenCalledWith('/profiles/5/stream-limits', input);
    });
  });
});

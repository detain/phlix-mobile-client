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

// CHAR(36) UUID, as the server stores/emits it (S234).
const PROFILE = 'a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1';

describe('ParentalControlsManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Schedules ─────────────────────────────────────────────────────────────

  describe('getSchedules', () => {
    it('GETs /profiles/{id}/schedules and maps the wire profile_id key', async () => {
      // The server emits `profile_id` (snake_case) on list rows; the manager
      // maps it to the local `profileId` shape.
      const wireSchedules = [
        {
          id: 1,
          profile_id: PROFILE,
          name: 'Weekday evenings',
          start_time: '16:00:00',
          end_time: '21:00:00',
          days_of_week: ['mon', 'tue', 'wed', 'thu', 'fri'] as const,
          is_active: true,
        },
      ];
      mockedClient.get.mockResolvedValue({ schedules: wireSchedules });

      const result = await parentalControlsManager.getSchedules(PROFILE);

      expect(mockedClient.get).toHaveBeenCalledWith(`/profiles/${PROFILE}/schedules`);
      expect(result).toEqual([
        {
          id: 1,
          profileId: PROFILE,
          name: 'Weekday evenings',
          start_time: '16:00:00',
          end_time: '21:00:00',
          days_of_week: ['mon', 'tue', 'wed', 'thu', 'fri'],
          is_active: true,
        },
      ]);
    });

    it('returns empty array when schedules is undefined', async () => {
      mockedClient.get.mockResolvedValue({});

      const result = await parentalControlsManager.getSchedules(PROFILE);

      expect(result).toEqual([]);
    });
  });

  describe('createSchedule', () => {
    it('POSTs to /profiles/{id}/schedules with snake_case schedule data', async () => {
      const input = {
        name: 'Bedtime',
        start_time: '20:00:00',
        end_time: '07:00:00',
        days_of_week: ['sat', 'sun'] as DayOfWeek[],
        is_active: true,
      };
      const created = { id: 10, profileId: PROFILE, ...input };
      mockedClient.post.mockResolvedValue(created);

      const result = await parentalControlsManager.createSchedule(PROFILE, input);

      expect(mockedClient.post).toHaveBeenCalledWith(`/profiles/${PROFILE}/schedules`, input);
      expect(result).toEqual(created);
    });
  });

  describe('updateSchedule', () => {
    it('POSTs to /profiles/{id}/schedules with snake_case schedule data including id', async () => {
      const input = {
        id: 10,
        name: 'Updated bedtime',
        start_time: '21:00:00',
        end_time: '06:00:00',
        days_of_week: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as DayOfWeek[],
        is_active: false,
      };
      mockedClient.post.mockResolvedValue(input);

      const result = await parentalControlsManager.updateSchedule(PROFILE, input);

      expect(mockedClient.post).toHaveBeenCalledWith(`/profiles/${PROFILE}/schedules`, input);
      expect(result).toEqual(input);
    });
  });

  describe('deleteSchedule', () => {
    it('DELETEs /profiles/{id}/schedules/{scheduleId}', async () => {
      mockedClient.delete.mockResolvedValue({ message: 'deleted' });

      await parentalControlsManager.deleteSchedule(PROFILE, 10);

      expect(mockedClient.delete).toHaveBeenCalledWith(`/profiles/${PROFILE}/schedules/10`);
    });
  });

  // ── Tags ─────────────────────────────────────────────────────────────────

  describe('getTags', () => {
    it('GETs /profiles/{id}/tags and maps the wire profile_id key', async () => {
      const wireTags = [
        { id: 1, profile_id: PROFILE, tag: 'kids', tag_type: 'allowed' as const },
        { id: 2, profile_id: PROFILE, tag: 'adult', tag_type: 'blocked' as const },
      ];
      mockedClient.get.mockResolvedValue({ tags: wireTags });

      const result = await parentalControlsManager.getTags(PROFILE);

      expect(mockedClient.get).toHaveBeenCalledWith(`/profiles/${PROFILE}/tags`);
      expect(result).toEqual([
        { id: 1, profileId: PROFILE, tag: 'kids', tag_type: 'allowed' },
        { id: 2, profileId: PROFILE, tag: 'adult', tag_type: 'blocked' },
      ]);
    });

    it('returns empty array when tags is undefined', async () => {
      mockedClient.get.mockResolvedValue({});

      const result = await parentalControlsManager.getTags(PROFILE);

      expect(result).toEqual([]);
    });
  });

  describe('addTag', () => {
    it('POSTs to /profiles/{id}/tags with snake_case tag data', async () => {
      const input = { tag: 'restricted', tag_type: 'blocked' as const };
      const created = { id: 3, profileId: PROFILE, ...input };
      mockedClient.post.mockResolvedValue(created);

      const result = await parentalControlsManager.addTag(PROFILE, input);

      expect(mockedClient.post).toHaveBeenCalledWith(`/profiles/${PROFILE}/tags`, input);
      expect(result).toEqual(created);
    });
  });

  describe('removeTag', () => {
    it('DELETEs /profiles/{id}/tags/{tagId}', async () => {
      mockedClient.delete.mockResolvedValue({ message: 'tag removed' });

      await parentalControlsManager.removeTag(PROFILE, 3);

      expect(mockedClient.delete).toHaveBeenCalledWith(`/profiles/${PROFILE}/tags/3`);
    });
  });

  // ── Stream Limits ────────────────────────────────────────────────────────

  describe('getStreamLimit', () => {
    it('GETs /profiles/{id}/stream-limits', async () => {
      const limit = {
        profileId: PROFILE,
        maxConcurrentStreams: 2,
        maxTotalBandwidthKbps: 10000,
      };
      mockedClient.get.mockResolvedValue(limit);

      const result = await parentalControlsManager.getStreamLimit(PROFILE);

      expect(mockedClient.get).toHaveBeenCalledWith(`/profiles/${PROFILE}/stream-limits`);
      expect(result).toEqual(limit);
    });
  });

  describe('updateStreamLimit', () => {
    it('PUTs to /profiles/{id}/stream-limits with new limits', async () => {
      const input = { maxConcurrentStreams: 3, maxTotalBandwidthKbps: 20000 };
      const updated = { profileId: PROFILE, ...input };
      mockedClient.put.mockResolvedValue(updated);

      const result = await parentalControlsManager.updateStreamLimit(PROFILE, input);

      expect(mockedClient.put).toHaveBeenCalledWith(`/profiles/${PROFILE}/stream-limits`, input);
      expect(result).toEqual(updated);
    });

    it('allows null for unlimited bandwidth', async () => {
      const input = { maxConcurrentStreams: 1, maxTotalBandwidthKbps: null };
      mockedClient.put.mockResolvedValue({ profileId: PROFILE, ...input });

      await parentalControlsManager.updateStreamLimit(PROFILE, input);

      expect(mockedClient.put).toHaveBeenCalledWith(`/profiles/${PROFILE}/stream-limits`, input);
    });
  });
});

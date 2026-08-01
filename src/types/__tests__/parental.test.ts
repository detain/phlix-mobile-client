/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/parental.test.ts
//
// `parental.ts` declares only interfaces aligned with @phlix/contracts v0.3.5,
// so these are compile-time shape assertions.
import type {
  DayOfWeek,
  AccessSchedule,
  ProfileTag,
  ProfileStreamLimit,
} from '../parental';

describe('parental types', () => {
  describe('DayOfWeek', () => {
    it('accepts all seven day literals', () => {
      const days: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      expect(days).toHaveLength(7);
    });
  });

  describe('AccessSchedule', () => {
    it('matches the server shape', () => {
      const schedule: AccessSchedule = {
        id: 1,
        profileId: 42,
        name: 'Weekday Evenings',
        startTime: '18:00:00',
        endTime: '22:00:00',
        daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
        isActive: true,
      };
      expect(schedule.name).toBe('Weekday Evenings');
      expect(schedule.daysOfWeek).toHaveLength(5);
    });

    it('allows empty daysOfWeek', () => {
      const schedule: AccessSchedule = {
        id: 2,
        profileId: 42,
        name: 'Never active',
        startTime: '00:00:00',
        endTime: '00:00:00',
        daysOfWeek: [],
        isActive: false,
      };
      expect(schedule.daysOfWeek).toHaveLength(0);
    });

    it('allows weekends only', () => {
      const schedule: AccessSchedule = {
        id: 3,
        profileId: 42,
        name: 'Weekend All Day',
        startTime: '00:00:00',
        endTime: '23:59:59',
        daysOfWeek: ['sat', 'sun'],
        isActive: true,
      };
      expect(schedule.daysOfWeek).toContain('sat');
      expect(schedule.daysOfWeek).toContain('sun');
    });

    it('allows null id for new schedules', () => {
      // id is number but allow 0 as valid
      const schedule: AccessSchedule = {
        id: 0,
        profileId: 1,
        name: 'New',
        startTime: '08:00:00',
        endTime: '20:00:00',
        daysOfWeek: ['mon'],
        isActive: true,
      };
      expect(schedule.id).toBe(0);
    });
  });

  describe('ProfileTag', () => {
    it('matches the blocked tag shape', () => {
      const tag: ProfileTag = {
        id: 1,
        profileId: 42,
        tag: 'kids',
        tagType: 'blocked',
      };
      expect(tag.tag).toBe('kids');
      expect(tag.tagType).toBe('blocked');
    });

    it('matches the allowed tag shape', () => {
      const tag: ProfileTag = {
        id: 2,
        profileId: 42,
        tag: 'family',
        tagType: 'allowed',
      };
      expect(tag.tagType).toBe('allowed');
    });
  });

  describe('ProfileStreamLimit', () => {
    it('matches the server shape with null bandwidth', () => {
      const limit: ProfileStreamLimit = {
        profileId: 42,
        maxConcurrentStreams: 3,
        maxTotalBandwidthKbps: null,
      };
      expect(limit.maxConcurrentStreams).toBe(3);
      expect(limit.maxTotalBandwidthKbps).toBeNull();
    });

    it('matches the server shape with bandwidth cap', () => {
      const limit: ProfileStreamLimit = {
        profileId: 42,
        maxConcurrentStreams: 1,
        maxTotalBandwidthKbps: 10000,
      };
      expect(limit.maxTotalBandwidthKbps).toBe(10000);
    });

    it('allows zero streams (rare but valid)', () => {
      const limit: ProfileStreamLimit = {
        profileId: 1,
        maxConcurrentStreams: 0,
        maxTotalBandwidthKbps: null,
      };
      expect(limit.maxConcurrentStreams).toBe(0);
    });
  });
});

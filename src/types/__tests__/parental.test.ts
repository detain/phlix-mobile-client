/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/parental.test.ts
//
// `parental.ts` declares only interfaces aligned with @phlix/contracts v0.4.4
// (S234: snake_case wire keys, CHAR(36) string profile ids), so these are
// compile-time shape assertions.
import type {
  DayOfWeek,
  AccessSchedule,
  ProfileTag,
  ProfileStreamLimit,
} from '../parental';

// CHAR(36) UUID, as the server stores/emits it (S234).
const PROFILE = 'a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1';

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
        profileId: PROFILE,
        name: 'Weekday Evenings',
        start_time: '18:00:00',
        end_time: '22:00:00',
        days_of_week: ['mon', 'tue', 'wed', 'thu', 'fri'],
        is_active: true,
      };
      expect(schedule.name).toBe('Weekday Evenings');
      expect(schedule.days_of_week).toHaveLength(5);
    });

    it('allows empty days_of_week', () => {
      const schedule: AccessSchedule = {
        id: 2,
        profileId: PROFILE,
        name: 'Never active',
        start_time: '00:00:00',
        end_time: '00:00:00',
        days_of_week: [],
        is_active: false,
      };
      expect(schedule.days_of_week).toHaveLength(0);
    });

    it('allows weekends only', () => {
      const schedule: AccessSchedule = {
        id: 3,
        profileId: PROFILE,
        name: 'Weekend All Day',
        start_time: '00:00:00',
        end_time: '23:59:59',
        days_of_week: ['sat', 'sun'],
        is_active: true,
      };
      expect(schedule.days_of_week).toContain('sat');
      expect(schedule.days_of_week).toContain('sun');
    });

    it('allows id 0 for new schedules', () => {
      // id is number but allow 0 as valid
      const schedule: AccessSchedule = {
        id: 0,
        profileId: PROFILE,
        name: 'New',
        start_time: '08:00:00',
        end_time: '20:00:00',
        days_of_week: ['mon'],
        is_active: true,
      };
      expect(schedule.id).toBe(0);
    });
  });

  describe('ProfileTag', () => {
    it('matches the blocked tag shape', () => {
      const tag: ProfileTag = {
        id: 1,
        profileId: PROFILE,
        tag: 'kids',
        tag_type: 'blocked',
      };
      expect(tag.tag).toBe('kids');
      expect(tag.tag_type).toBe('blocked');
    });

    it('matches the allowed tag shape', () => {
      const tag: ProfileTag = {
        id: 2,
        profileId: PROFILE,
        tag: 'family',
        tag_type: 'allowed',
      };
      expect(tag.tag_type).toBe('allowed');
    });
  });

  describe('ProfileStreamLimit', () => {
    it('matches the server shape with null bandwidth', () => {
      const limit: ProfileStreamLimit = {
        profileId: PROFILE,
        maxConcurrentStreams: 3,
        maxTotalBandwidthKbps: null,
      };
      expect(limit.maxConcurrentStreams).toBe(3);
      expect(limit.maxTotalBandwidthKbps).toBeNull();
    });

    it('matches the server shape with bandwidth cap', () => {
      const limit: ProfileStreamLimit = {
        profileId: PROFILE,
        maxConcurrentStreams: 1,
        maxTotalBandwidthKbps: 10000,
      };
      expect(limit.maxTotalBandwidthKbps).toBe(10000);
    });

    it('allows zero streams (rare but valid)', () => {
      const limit: ProfileStreamLimit = {
        profileId: PROFILE,
        maxConcurrentStreams: 0,
        maxTotalBandwidthKbps: null,
      };
      expect(limit.maxConcurrentStreams).toBe(0);
    });
  });
});

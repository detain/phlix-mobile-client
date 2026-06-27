// src/types/__tests__/livetv.test.ts
import {
  programIsLive,
  currentProgram,
  formatProgramTime,
  channelTypeLabel,
  type Program,
} from '../livetv';

const makeProgram = (overrides: Partial<Program> = {}): Program => ({
  id: 'p1',
  channel_id: 'c1',
  title: 'News at Six',
  start_time: 1000,
  end_time: 2000,
  ...overrides,
});

describe('livetv helpers', () => {
  describe('programIsLive', () => {
    it('is true at the exact start boundary', () => {
      expect(programIsLive(makeProgram(), 1000)).toBe(true);
    });

    it('is true inside the window', () => {
      expect(programIsLive(makeProgram(), 1500)).toBe(true);
    });

    it('is false at the exact end boundary (exclusive)', () => {
      expect(programIsLive(makeProgram(), 2000)).toBe(false);
    });

    it('is false before the start', () => {
      expect(programIsLive(makeProgram(), 999)).toBe(false);
    });

    it('is false after the end', () => {
      expect(programIsLive(makeProgram(), 2001)).toBe(false);
    });
  });

  describe('currentProgram', () => {
    const programs = [
      makeProgram({ id: 'a', start_time: 0, end_time: 1000 }),
      makeProgram({ id: 'b', start_time: 1000, end_time: 2000 }),
      makeProgram({ id: 'c', start_time: 2000, end_time: 3000 }),
    ];

    it('returns the program airing at the given time', () => {
      expect(currentProgram(programs, 1500)?.id).toBe('b');
    });

    it('returns the first matching program at a boundary', () => {
      expect(currentProgram(programs, 1000)?.id).toBe('b');
    });

    it('returns null when nothing is live', () => {
      expect(currentProgram(programs, 5000)).toBeNull();
    });

    it('returns null for an empty list', () => {
      expect(currentProgram([], 1500)).toBeNull();
    });
  });

  describe('formatProgramTime', () => {
    it('formats a HH:MM – HH:MM range from UNIX seconds', () => {
      // Use UTC-anchored seconds and assert via a matching local-format check so
      // the test is timezone-independent: compute expected from the same Date.
      const start = 1_700_000_000;
      const end = start + 3600;
      const program = makeProgram({ start_time: start, end_time: end });
      const fmt = (secs: number): string => {
        const d = new Date(secs * 1000);
        const hh = d.getHours().toString().padStart(2, '0');
        const mm = d.getMinutes().toString().padStart(2, '0');
        return `${hh}:${mm}`;
      };
      expect(formatProgramTime(program)).toBe(`${fmt(start)} – ${fmt(end)}`);
    });

    it('zero-pads single-digit hours/minutes', () => {
      const result = formatProgramTime(makeProgram());
      expect(result).toMatch(/^\d{2}:\d{2} – \d{2}:\d{2}$/);
    });
  });

  describe('channelTypeLabel', () => {
    it('labels tv', () => {
      expect(channelTypeLabel('tv')).toBe('TV');
    });
    it('labels radio', () => {
      expect(channelTypeLabel('radio')).toBe('Radio');
    });
    it('labels data', () => {
      expect(channelTypeLabel('data')).toBe('Data');
    });
  });
});

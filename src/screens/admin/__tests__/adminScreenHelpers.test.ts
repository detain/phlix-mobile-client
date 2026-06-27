// src/screens/admin/__tests__/adminScreenHelpers.test.ts
import {
  USER_STATUS_FILTERS,
  filterUsersByStatus,
  parsePathsInput,
  pathsToInput,
  isJobActive,
  isScanJobActive,
  scanJobBadge,
  verbForJobType,
  LIBRARY_TYPES,
  supportsSeriesPerDirectory,
} from '../adminScreenHelpers';
import type { AdminUser, ScanJob, JobType } from '../../../types/admin';

const makeUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: 'u1',
  username: 'alice',
  email: 'alice@example.com',
  display_name: null,
  is_admin: false,
  status: 'active',
  created_at: null,
  updated_at: null,
  last_login: null,
  ...overrides,
});

const makeJob = (overrides: Partial<ScanJob> = {}): ScanJob => ({
  id: 'j1',
  library_id: 'l1',
  job_type: 'scan',
  status: 'running',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('filterUsersByStatus', () => {
  const users = [
    makeUser({ id: 'a', status: 'active' }),
    makeUser({ id: 'p', status: 'pending' }),
    makeUser({ id: 'd', status: 'disabled' }),
  ];

  it('returns all users for the "all" filter (unchanged reference list)', () => {
    expect(filterUsersByStatus(users, 'all')).toHaveLength(3);
  });

  it('filters to a single status', () => {
    expect(filterUsersByStatus(users, 'pending').map((u) => u.id)).toEqual(['p']);
    expect(filterUsersByStatus(users, 'active').map((u) => u.id)).toEqual(['a']);
    expect(filterUsersByStatus(users, 'disabled').map((u) => u.id)).toEqual(['d']);
  });

  it('exposes the chip order all→pending→active→disabled', () => {
    expect(USER_STATUS_FILTERS).toEqual(['all', 'pending', 'active', 'disabled']);
  });

  it('returns empty for an empty list', () => {
    expect(filterUsersByStatus([], 'active')).toEqual([]);
  });
});

describe('parsePathsInput', () => {
  it('splits on newlines and commas', () => {
    expect(parsePathsInput('/a\n/b,/c')).toEqual(['/a', '/b', '/c']);
  });

  it('trims whitespace and drops blanks', () => {
    expect(parsePathsInput('  /a  , \n , /b \n\n')).toEqual(['/a', '/b']);
  });

  it('dedupes preserving first-seen order', () => {
    expect(parsePathsInput('/a\n/b\n/a')).toEqual(['/a', '/b']);
  });

  it('returns empty array for empty / whitespace-only input', () => {
    expect(parsePathsInput('')).toEqual([]);
    expect(parsePathsInput('  , \n , ')).toEqual([]);
  });

  it('round-trips with pathsToInput', () => {
    const paths = ['/media/movies', '/mnt/films'];
    expect(parsePathsInput(pathsToInput(paths))).toEqual(paths);
  });

  it('pathsToInput tolerates undefined', () => {
    expect(pathsToInput(undefined)).toBe('');
  });
});

describe('isJobActive / isScanJobActive (poll start/stop predicate)', () => {
  it('is active only while queued or running', () => {
    expect(isJobActive('queued')).toBe(true);
    expect(isJobActive('running')).toBe(true);
  });

  it('is NOT active for terminal or absent states', () => {
    expect(isJobActive('completed')).toBe(false);
    expect(isJobActive('failed')).toBe(false);
    expect(isJobActive(null)).toBe(false);
    expect(isJobActive(undefined)).toBe(false);
  });

  it('isScanJobActive derives from the job status', () => {
    expect(isScanJobActive(makeJob({ status: 'running' }))).toBe(true);
    expect(isScanJobActive(makeJob({ status: 'completed' }))).toBe(false);
    expect(isScanJobActive(null)).toBe(false);
    expect(isScanJobActive(undefined)).toBe(false);
  });
});

describe('scanJobBadge', () => {
  it('returns null when there is no job', () => {
    expect(scanJobBadge(null)).toBeNull();
    expect(scanJobBadge(undefined)).toBeNull();
  });

  it('shows the verb + rounded percent while running', () => {
    expect(
      scanJobBadge(makeJob({ status: 'running', progress_percent: 41.6 }))
    ).toBe('Scanning… 42%');
    expect(
      scanJobBadge(
        makeJob({ job_type: 'rescan', status: 'running', progress_percent: 0 })
      )
    ).toBe('Rescanning… 0%');
    expect(
      scanJobBadge(makeJob({ job_type: 'metadata', status: 'running' }))
    ).toBe('Matching…');
  });

  it('shows queued / completed / failed labels', () => {
    expect(scanJobBadge(makeJob({ status: 'queued' }))).toBe('Queued');
    expect(scanJobBadge(makeJob({ status: 'completed' }))).toBe('Completed');
    expect(scanJobBadge(makeJob({ status: 'failed' }))).toBe('Failed');
  });
});

describe('verbForJobType', () => {
  it('maps each job kind to its present-progressive verb', () => {
    const cases: Array<[JobType, string]> = [
      ['scan', 'Scanning'],
      ['rescan', 'Rescanning'],
      ['metadata', 'Matching'],
    ];
    for (const [type, verb] of cases) {
      expect(verbForJobType(type)).toBe(verb);
    }
  });
});

describe('library type helpers', () => {
  it('exposes the server ENUM type set', () => {
    expect(LIBRARY_TYPES).toEqual([
      'movie',
      'series',
      'music',
      'photo',
      'book',
      'video',
    ]);
  });

  it('series_per_directory applies only to series', () => {
    expect(supportsSeriesPerDirectory('series')).toBe(true);
    expect(supportsSeriesPerDirectory('movie')).toBe(false);
    expect(supportsSeriesPerDirectory('music')).toBe(false);
  });
});

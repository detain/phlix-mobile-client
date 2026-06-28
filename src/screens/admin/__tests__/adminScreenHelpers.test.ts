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
  settingKindForType,
  isSecretField,
  pluginSettingFields,
  validatePluginUrl,
  settingFieldType,
  coerceSettingValue,
  settingValueToInput,
  isOverridden,
  formatBackupSize,
  validateScheduleInput,
  parentPath,
  breadcrumbs,
  LOG_LINE_OPTIONS,
  clampLogLines,
} from '../adminScreenHelpers';
import type {
  AdminUser,
  ScanJob,
  JobType,
  PluginSettingSchema,
} from '../../../types/admin';

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

// ── E10c helpers ──

describe('settingKindForType', () => {
  it('maps bool / boolean to bool', () => {
    expect(settingKindForType('bool')).toBe('bool');
    expect(settingKindForType('boolean')).toBe('bool');
    expect(settingKindForType('BOOLEAN')).toBe('bool');
  });

  it('maps numeric kinds to number', () => {
    for (const t of ['number', 'int', 'integer', 'float', 'double']) {
      expect(settingKindForType(t)).toBe('number');
    }
  });

  it('falls back to string for unknown / undefined', () => {
    expect(settingKindForType('text')).toBe('string');
    expect(settingKindForType(undefined)).toBe('string');
    expect(settingKindForType('')).toBe('string');
  });
});

describe('isSecretField', () => {
  it('is true only when secret is set', () => {
    expect(isSecretField({ type: 'string', secret: true })).toBe(true);
    expect(isSecretField({ type: 'string', secret: false })).toBe(false);
    expect(isSecretField({ type: 'string' })).toBe(false);
    expect(isSecretField(undefined)).toBe(false);
  });
});

describe('pluginSettingFields', () => {
  it('returns [] for undefined / empty schema', () => {
    expect(pluginSettingFields(undefined)).toEqual([]);
    expect(pluginSettingFields({})).toEqual([]);
  });

  it('flattens a schema preserving key order and deriving kind/required/secret/label', () => {
    const schema: Record<string, PluginSettingSchema> = {
      apiKey: { type: 'string', required: true, secret: true, label: 'API Key', description: 'secret' },
      maxItems: { type: 'integer' },
      enabled: { type: 'bool', label: '' },
    };

    const fields = pluginSettingFields(schema);

    expect(fields.map((f) => f.key)).toEqual(['apiKey', 'maxItems', 'enabled']);
    expect(fields[0]).toMatchObject({
      key: 'apiKey',
      kind: 'string',
      required: true,
      secret: true,
      label: 'API Key',
      description: 'secret',
    });
    expect(fields[1]).toMatchObject({ key: 'maxItems', kind: 'number', required: false, secret: false });
    // empty label falls back to the key
    expect(fields[2]).toMatchObject({ key: 'enabled', kind: 'bool', label: 'enabled' });
  });
});

describe('validatePluginUrl', () => {
  it('accepts https:// and file:// schemes', () => {
    expect(validatePluginUrl('https://example.com/p.zip')).toBeNull();
    expect(validatePluginUrl('file:///opt/plugins/p')).toBeNull();
    expect(validatePluginUrl('  https://x  ')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(validatePluginUrl('')).toMatch(/required/i);
    expect(validatePluginUrl('   ')).toMatch(/required/i);
  });

  it('rejects other schemes', () => {
    expect(validatePluginUrl('http://x')).toMatch(/https/);
    expect(validatePluginUrl('ftp://x')).toMatch(/https/);
    // eslint-disable-next-line no-script-url -- intentionally testing that a javascript: URL is rejected
    expect(validatePluginUrl('javascript:alert(1)')).toMatch(/https/);
  });
});

describe('settingFieldType', () => {
  it('reads the kind off the types map', () => {
    const types = { darkMode: 'bool', port: 'integer', name: 'string' };
    expect(settingFieldType(types, 'darkMode')).toBe('bool');
    expect(settingFieldType(types, 'port')).toBe('number');
    expect(settingFieldType(types, 'name')).toBe('string');
  });

  it('falls back to string for an unknown key / missing map', () => {
    expect(settingFieldType({}, 'x')).toBe('string');
    expect(settingFieldType(undefined, 'x')).toBe('string');
  });
});

describe('coerceSettingValue', () => {
  it('coerces bool from common truthy strings', () => {
    expect(coerceSettingValue('bool', 'true')).toBe(true);
    expect(coerceSettingValue('bool', '1')).toBe(true);
    expect(coerceSettingValue('bool', 'YES')).toBe(true);
    expect(coerceSettingValue('bool', 'false')).toBe(false);
    expect(coerceSettingValue('bool', 'nope')).toBe(false);
  });

  it('coerces number to a finite number, else keeps the raw string', () => {
    expect(coerceSettingValue('number', '42')).toBe(42);
    expect(coerceSettingValue('number', '3.5')).toBe(3.5);
    expect(coerceSettingValue('number', '')).toBe('');
    expect(coerceSettingValue('number', 'abc')).toBe('abc');
  });

  it('passes strings through verbatim', () => {
    expect(coerceSettingValue('string', 'hello')).toBe('hello');
    expect(coerceSettingValue('string', '  spaced  ')).toBe('  spaced  ');
  });
});

describe('settingValueToInput', () => {
  it('renders primitives', () => {
    expect(settingValueToInput('hi')).toBe('hi');
    expect(settingValueToInput(7)).toBe('7');
    expect(settingValueToInput(true)).toBe('true');
  });

  it('null/undefined become empty string', () => {
    expect(settingValueToInput(null)).toBe('');
    expect(settingValueToInput(undefined)).toBe('');
  });

  it('JSON-stringifies objects/arrays', () => {
    expect(settingValueToInput({ a: 1 })).toBe('{"a":1}');
    expect(settingValueToInput([1, 2])).toBe('[1,2]');
  });
});

describe('isOverridden', () => {
  it('is true only when the key is in the overridden list', () => {
    expect(isOverridden(['a', 'b'], 'a')).toBe(true);
    expect(isOverridden(['a', 'b'], 'c')).toBe(false);
    expect(isOverridden([], 'a')).toBe(false);
    expect(isOverridden(undefined, 'a')).toBe(false);
  });
});

// ── E10d helpers ──

describe('formatBackupSize', () => {
  it('formats finite non-negative sizes via formatFileSize', () => {
    expect(formatBackupSize(0)).toBe('0 B');
    expect(formatBackupSize(1024)).toBe('1 KB');
  });

  it('returns an em-dash for missing / invalid sizes', () => {
    expect(formatBackupSize(undefined)).toBe('—');
    expect(formatBackupSize(null)).toBe('—');
    expect(formatBackupSize(NaN)).toBe('—');
    expect(formatBackupSize(-5)).toBe('—');
  });
});

describe('validateScheduleInput', () => {
  it('accepts empty fields (treated as unchanged)', () => {
    expect(validateScheduleInput('', '')).toBeNull();
    expect(validateScheduleInput('  ', '  ')).toBeNull();
  });

  it('accepts valid whole numbers (days ≥ 0, count ≥ 1)', () => {
    expect(validateScheduleInput('0', '1')).toBeNull();
    expect(validateScheduleInput('7', '5')).toBeNull();
  });

  it('rejects a negative or non-integer interval', () => {
    expect(validateScheduleInput('-1', '5')).toMatch(/Interval/);
    expect(validateScheduleInput('1.5', '5')).toMatch(/Interval/);
    expect(validateScheduleInput('abc', '5')).toMatch(/Interval/);
  });

  it('rejects a retention count below 1 or non-integer', () => {
    expect(validateScheduleInput('7', '0')).toMatch(/Retention/);
    expect(validateScheduleInput('7', '-2')).toMatch(/Retention/);
    expect(validateScheduleInput('7', '2.5')).toMatch(/Retention/);
  });
});

describe('parentPath', () => {
  it('returns null for root / empty / null / bare segment', () => {
    expect(parentPath('/')).toBeNull();
    expect(parentPath('')).toBeNull();
    expect(parentPath(null)).toBeNull();
    expect(parentPath(undefined)).toBeNull();
    expect(parentPath('movies')).toBeNull();
  });

  it('returns "/" for a one-level absolute path', () => {
    expect(parentPath('/movies')).toBe('/');
  });

  it('returns the parent directory for deeper paths', () => {
    expect(parentPath('/a/b/c')).toBe('/a/b');
    expect(parentPath('/a/b')).toBe('/a');
  });

  it('ignores a trailing slash', () => {
    expect(parentPath('/a/b/')).toBe('/a');
    expect(parentPath('/a/b/c/')).toBe('/a/b');
  });
});

describe('breadcrumbs', () => {
  it('returns just the root crumb for null / empty / root', () => {
    expect(breadcrumbs(null)).toEqual([{ label: '/', path: '/' }]);
    expect(breadcrumbs('')).toEqual([{ label: '/', path: '/' }]);
    expect(breadcrumbs('/')).toEqual([{ label: '/', path: '/' }]);
  });

  it('accumulates segments for an absolute path with a leading root', () => {
    expect(breadcrumbs('/a/b/c')).toEqual([
      { label: '/', path: '/' },
      { label: 'a', path: '/a' },
      { label: 'b', path: '/a/b' },
      { label: 'c', path: '/a/b/c' },
    ]);
  });
});

describe('clampLogLines / LOG_LINE_OPTIONS', () => {
  it('exposes the 200/500/1000 picker options', () => {
    expect(LOG_LINE_OPTIONS).toEqual([200, 500, 1000]);
  });

  it('clamps into 1–2000 and defaults invalid input to 200', () => {
    expect(clampLogLines(500)).toBe(500);
    expect(clampLogLines(5000)).toBe(2000);
    expect(clampLogLines(0)).toBe(200);
    expect(clampLogLines(-10)).toBe(200);
    expect(clampLogLines(undefined)).toBe(200);
    expect(clampLogLines(NaN)).toBe(200);
    expect(clampLogLines(12.9)).toBe(12);
  });
});

/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/admin.test.ts
//
// `admin.ts` declares only interfaces (no runtime helpers), so these are
// compile-time shape assertions: if the DTO drifts from the verified server
// contract the build fails here.
import type {
  UserStatus,
  AdminUser,
  CreateUserInput,
  UpdateUserInput,
  JobType,
  JobStatus,
  ScanJob,
  CreateLibraryInput,
  UpdateLibraryInput,
  NowPlayingSession,
  TopUser,
  TopMedia,
  StorageStat,
  ActivityEntry,
  PlaybackStat,
  Plugin,
  PluginSettingSchema,
  PluginDetail,
  CatalogPlugin,
  PluginCatalog,
  CatalogError,
  CatalogResponse,
  AuthProvider,
  AuthProviderConfigSchema,
  ServerSettings,
  Backup,
  BackupSchedule,
  UpdateBackupScheduleInput,
  LogFile,
  LogTail,
  FsEntry,
  FsListing,
} from '../admin';

describe('admin types', () => {
  describe('UserStatus', () => {
    it('accepts valid status literals', () => {
      const statuses: UserStatus[] = ['pending', 'active', 'disabled'];
      expect(statuses).toHaveLength(3);
    });
  });

  describe('AdminUser', () => {
    it('matches the verified server shape', () => {
      const user: AdminUser = {
        id: 'u1',
        username: 'alice',
        email: 'alice@example.com',
        display_name: 'Alice',
        is_admin: false,
        status: 'active',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        last_login: '2026-06-01T12:00:00Z',
      };
      expect(user.id).toBe('u1');
      expect(user.is_admin).toBe(false);
      expect(user.status).toBe('active');
    });

    it('allows null display_name and timestamps', () => {
      const user: AdminUser = {
        id: 'u2',
        username: 'bob',
        email: 'bob@example.com',
        display_name: null,
        is_admin: true,
        status: 'pending',
        created_at: null,
        updated_at: null,
        last_login: null,
      };
      expect(user.display_name).toBeNull();
      expect(user.created_at).toBeNull();
    });
  });

  describe('CreateUserInput', () => {
    it('requires username, email, password', () => {
      const input: CreateUserInput = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'secret123',
      };
      expect(input.username).toBe('newuser');
    });

    it('allows optional is_admin', () => {
      const withAdmin: CreateUserInput = {
        username: 'admin',
        email: 'admin@example.com',
        password: 'secret',
        is_admin: true,
      };
      expect(withAdmin.is_admin).toBe(true);
    });
  });

  describe('UpdateUserInput', () => {
    it('is fully optional', () => {
      const empty: UpdateUserInput = {};
      const partial: UpdateUserInput = { email: 'updated@example.com' };
      expect(empty).toEqual({});
      expect(partial.email).toBe('updated@example.com');
    });
  });

  describe('JobType', () => {
    it('accepts valid job type literals', () => {
      const types: JobType[] = ['scan', 'rescan', 'metadata'];
      expect(types).toHaveLength(3);
    });
  });

  describe('JobStatus', () => {
    it('accepts valid status literals', () => {
      const statuses: JobStatus[] = ['queued', 'running', 'completed', 'failed'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('ScanJob', () => {
    it('matches the verified server shape', () => {
      const job: ScanJob = {
        id: 'j1',
        library_id: 'lib1',
        job_type: 'scan',
        status: 'running',
        current_path: '/mnt/media',
        progress_percent: 45,
        created_at: '2026-06-01T00:00:00Z',
        started_at: '2026-06-01T00:05:00Z',
        completed_at: null,
        error_message: null,
      };
      expect(job.job_type).toBe('scan');
      expect(job.progress_percent).toBe(45);
    });
  });

  describe('CreateLibraryInput', () => {
    it('requires name, type, paths', () => {
      const input: CreateLibraryInput = {
        name: 'Movies',
        type: 'movie',
        paths: ['/mnt/movies'],
      };
      expect(input.paths).toHaveLength(1);
    });

    it('allows optional fields', () => {
      const input: CreateLibraryInput = {
        name: 'TV Shows',
        type: 'series',
        paths: ['/mnt/tv'],
        series_per_directory: true,
      };
      expect(input.series_per_directory).toBe(true);
    });
  });

  describe('UpdateLibraryInput', () => {
    it('is fully optional', () => {
      const empty: UpdateLibraryInput = {};
      expect(empty).toEqual({});
    });
  });

  describe('NowPlayingSession', () => {
    it('matches the dashboard shape with index signature', () => {
      const session: NowPlayingSession = {
        session_id: 's1',
        user_id: 'u1',
        username: 'alice',
        media_item_id: 'm1',
        media_title: 'Movie A',
        device_name: 'iPhone',
        position_ticks: 36000000000,
        duration_ticks: 72000000000,
        progress_percent: 50,
        state: 'playing',
        started_at: '2026-06-01T12:00:00Z',
      };
      expect(session.progress_percent).toBe(50);
      // Index signature allows additional properties
      (session as Record<string, unknown>).custom_field = 'value';
      expect((session as Record<string, unknown>).custom_field).toBe('value');
    });
  });

  describe('TopUser', () => {
    it('matches the stats shape', () => {
      const user: TopUser = {
        user_id: 'u1',
        username: 'bob',
        display_name: 'Bob',
        play_count: 42,
        total_duration: 36000,
      };
      expect(user.play_count).toBe(42);
    });
  });

  describe('TopMedia', () => {
    it('matches the stats shape', () => {
      const media: TopMedia = {
        media_item_id: 'm1',
        title: 'Top Movie',
        type: 'movie',
        play_count: 100,
        poster_url: 'https://example.com/poster.jpg',
      };
      expect(media.play_count).toBe(100);
    });
  });

  describe('StorageStat', () => {
    it('matches the storage shape', () => {
      const stat: StorageStat = {
        library_id: 'lib1',
        library_name: 'Movies',
        item_count: 500,
        total_size: 100000000000,
      };
      expect(stat.item_count).toBe(500);
    });
  });

  describe('ActivityEntry', () => {
    it('matches the activity shape', () => {
      const entry: ActivityEntry = {
        id: 'a1',
        user_id: 'u1',
        username: 'alice',
        action: 'play',
        media_item_id: 'm1',
        media_title: 'Movie A',
        created_at: '2026-06-01T12:00:00Z',
      };
      expect(entry.action).toBe('play');
    });
  });

  describe('PlaybackStat', () => {
    it('matches the stats shape', () => {
      const stat: PlaybackStat = {
        date: '2026-06-01',
        play_count: 150,
        unique_users: 25,
        total_duration: 54000,
      };
      expect(stat.play_count).toBe(150);
    });
  });

  describe('Plugin', () => {
    it('matches the plugin shape', () => {
      const plugin: Plugin = {
        id: 'p1',
        name: 'My Plugin',
        version: '1.0.0',
        type: 'custom',
        enabled: true,
        installed_at: '2026-01-01T00:00:00Z',
      };
      expect(plugin.enabled).toBe(true);
    });
  });

  describe('PluginSettingSchema', () => {
    it('matches the schema shape', () => {
      const schema: PluginSettingSchema = {
        type: 'string',
        required: true,
        secret: false,
        label: 'API Key',
        description: 'Your API key',
      };
      expect(schema.type).toBe('string');
    });
  });

  describe('PluginDetail', () => {
    it('matches the plugin detail shape', () => {
      const detail: PluginDetail = {
        name: 'My Plugin',
        version: '1.0.0',
        type: 'custom',
        enabled: true,
        settings_schema: {
          api_key: { type: 'string', secret: true },
        },
      };
      expect(detail.settings_schema?.api_key?.secret).toBe(true);
    });
  });

  describe('CatalogPlugin', () => {
    it('matches the catalog plugin shape', () => {
      const catalogPlugin: CatalogPlugin = {
        name: 'Plugin A',
        version: '1.0.0',
        installed: true,
        enabled: false,
      };
      expect(catalogPlugin.installed).toBe(true);
    });
  });

  describe('PluginCatalog', () => {
    it('matches the catalog shape', () => {
      const catalog: PluginCatalog = {
        source: 'official',
        name: 'Official Plugins',
        plugins: [],
      };
      expect(catalog.plugins).toHaveLength(0);
    });
  });

  describe('CatalogError', () => {
    it('matches the error shape', () => {
      const error: CatalogError = {
        source: 'https://example.com/catalog.json',
        error: 'Connection timeout',
      };
      expect(error.error).toBe('Connection timeout');
    });
  });

  describe('CatalogResponse', () => {
    it('matches the full catalog response shape', () => {
      const response: CatalogResponse = {
        default_source: 'official',
        sources: ['official'],
        catalogs: [],
        errors: [],
      };
      expect(response.default_source).toBe('official');
    });
  });

  describe('AuthProvider', () => {
    it('matches the auth provider shape', () => {
      const provider: AuthProvider = {
        name: 'Local',
        supports_authentication: true,
      };
      expect(provider.supports_authentication).toBe(true);
    });
  });

  describe('AuthProviderConfigSchema', () => {
    it('is a free-form object', () => {
      const schema: AuthProviderConfigSchema = {
        enabled: true,
        domains: ['example.com'],
      };
      expect(schema.enabled).toBe(true);
    });
  });

  describe('ServerSettings', () => {
    it('matches the settings shape', () => {
      const settings: ServerSettings = {
        settings: { server_name: 'Phlix' },
        overridden: ['server_name'],
        types: { server_name: 'string' },
      };
      expect(settings.overridden).toContain('server_name');
    });
  });

  describe('Backup', () => {
    it('matches the backup shape', () => {
      const backup: Backup = {
        id: 'b1',
        created_at: '2026-06-01T00:00:00Z',
        label: 'Full Backup',
        size: 5000000000,
      };
      expect(backup.size).toBe(5000000000);
    });
  });

  describe('BackupSchedule', () => {
    it('matches the schedule shape', () => {
      const schedule: BackupSchedule = {
        auto_backup_interval_days: 7,
        retention_count: 3,
        next_scheduled_backup: '2026-06-08T00:00:00Z',
        next_scheduled_backup_iso: '2026-06-08T00:00:00Z',
      };
      expect(schedule.auto_backup_interval_days).toBe(7);
    });
  });

  describe('UpdateBackupScheduleInput', () => {
    it('is fully optional', () => {
      const empty: UpdateBackupScheduleInput = {};
      const partial: UpdateBackupScheduleInput = { retention_count: 5 };
      expect(empty).toEqual({});
      expect(partial.retention_count).toBe(5);
    });
  });

  describe('LogFile', () => {
    it('matches the log file shape', () => {
      const logFile: LogFile = {
        name: 'phlix.log',
        size: 1048576,
        modified_at: '2026-06-01T12:00:00Z',
      };
      expect(logFile.name).toBe('phlix.log');
    });
  });

  describe('LogTail', () => {
    it('matches the single-file tail shape', () => {
      const tail: LogTail = {
        file: '/var/log/phlix.log',
        lines: ['line1', 'line2'],
        truncated: false,
      };
      expect(tail.lines).toHaveLength(2);
    });

    it('matches the merged tail shape', () => {
      const tail: LogTail = {
        files: ['/var/log/phlix.log', '/var/log/phlix2.log'],
        lines: ['line1', 'line2'],
        truncated: true,
      };
      expect(tail.files).toHaveLength(2);
    });
  });

  describe('FsEntry', () => {
    it('matches the filesystem entry shape', () => {
      const entry: FsEntry = {
        name: 'media',
        path: '/mnt/media',
      };
      expect(entry.name).toBe('media');
    });
  });

  describe('FsListing', () => {
    it('matches the directory listing shape', () => {
      const listing: FsListing = {
        path: '/mnt',
        parent: '/',
        entries: [
          { name: 'media', path: '/mnt/media' },
          { name: 'downloads', path: '/mnt/downloads' },
        ],
      };
      expect(listing.entries).toHaveLength(2);
    });

    it('allows null path/parent at roots', () => {
      const listing: FsListing = {
        path: null,
        parent: null,
        entries: [],
      };
      expect(listing.path).toBeNull();
    });
  });
});

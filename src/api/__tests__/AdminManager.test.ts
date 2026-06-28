// src/api/__tests__/AdminManager.test.ts
import { adminManager } from '../AdminManager';
import apiClient from '../client';
import type { AdminUser, ScanJob } from '../../types/admin';
import type { Library } from '../../types/media';

jest.mock('../client');

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const sampleUser: AdminUser = {
  id: 'u1',
  username: 'alice',
  email: 'alice@example.com',
  display_name: 'Alice',
  is_admin: false,
  status: 'active',
  created_at: '2026-06-27T00:00:00Z',
  updated_at: null,
  last_login: null,
};

const sampleLibrary: Library = {
  id: 'lib1',
  name: 'Movies',
  type: 'movie',
  item_count: 42,
  paths: ['/data/movies'],
};

const sampleJob: ScanJob = {
  id: 'job1',
  library_id: 'lib1',
  job_type: 'scan',
  status: 'queued',
  created_at: '2026-06-27T00:00:00Z',
};

describe('AdminManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Dashboard ({ success, data, count }) ──

  it('getNowPlaying GETs /admin/dashboard/now-playing and unwraps .data', async () => {
    mockedClient.get.mockResolvedValue({ success: true, data: [{ session_id: 's1' }], count: 1 });

    const sessions = await adminManager.getNowPlaying();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/dashboard/now-playing');
    expect(sessions).toEqual([{ session_id: 's1' }]);
  });

  it('getDashboardTopUsers GETs /admin/dashboard/top-users with limit+days and unwraps .data', async () => {
    mockedClient.get.mockResolvedValue({ success: true, data: [{ user_id: 'u1' }], count: 1 });

    const users = await adminManager.getDashboardTopUsers(5, 7);

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/dashboard/top-users', {
      limit: 5,
      days: 7,
    });
    expect(users).toHaveLength(1);
  });

  it('getDashboardTopUsers defaults to limit=10 days=30', async () => {
    mockedClient.get.mockResolvedValue({ success: true, data: [], count: 0 });

    await adminManager.getDashboardTopUsers();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/dashboard/top-users', {
      limit: 10,
      days: 30,
    });
  });

  it('getDashboardTopMedia GETs /admin/dashboard/top-media with limit+days and unwraps .data', async () => {
    mockedClient.get.mockResolvedValue({ success: true, data: [{ media_item_id: 'm1' }], count: 1 });

    const media = await adminManager.getDashboardTopMedia(3, 14);

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/dashboard/top-media', {
      limit: 3,
      days: 14,
    });
    expect(media).toHaveLength(1);
  });

  it('getDashboardStorage GETs /admin/dashboard/storage and unwraps .data', async () => {
    mockedClient.get.mockResolvedValue({ success: true, data: [{ library_id: 'l1' }], count: 1 });

    const storage = await adminManager.getDashboardStorage();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/dashboard/storage');
    expect(storage).toHaveLength(1);
  });

  it('getActivity GETs /admin/dashboard/activity with limit and unwraps .data', async () => {
    mockedClient.get.mockResolvedValue({ success: true, data: [{ id: 'a1' }], count: 1 });

    const activity = await adminManager.getActivity(5);

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/dashboard/activity', {
      limit: 5,
    });
    expect(activity).toHaveLength(1);
  });

  it('getActivity defaults to limit=20', async () => {
    mockedClient.get.mockResolvedValue({ success: true, data: [], count: 0 });

    await adminManager.getActivity();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/dashboard/activity', {
      limit: 20,
    });
  });

  // ── Stats ({ data } — NO success/count) ──

  it('getPlaybackStats GETs /admin/stats/playback with from+to and unwraps .data', async () => {
    mockedClient.get.mockResolvedValue({ data: [{ date: '2026-06-01' }] });

    const stats = await adminManager.getPlaybackStats('2026-06-01', '2026-06-27');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/stats/playback', {
      from: '2026-06-01',
      to: '2026-06-27',
    });
    expect(stats).toHaveLength(1);
  });

  it('getStatsTopUsers GETs /admin/stats/top-users with limit+since and unwraps .data', async () => {
    mockedClient.get.mockResolvedValue({ data: [{ user_id: 'u1' }] });

    const users = await adminManager.getStatsTopUsers(5, '2026-06-01');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/stats/top-users', {
      limit: 5,
      since: '2026-06-01',
    });
    expect(users).toHaveLength(1);
  });

  it('getStatsTopMedia GETs /admin/stats/top-media with limit+since and unwraps .data', async () => {
    mockedClient.get.mockResolvedValue({ data: [{ media_item_id: 'm1' }] });

    const media = await adminManager.getStatsTopMedia(3, '2026-06-01');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/stats/top-media', {
      limit: 3,
      since: '2026-06-01',
    });
    expect(media).toHaveLength(1);
  });

  it('getStatsStorage GETs /admin/stats/storage and unwraps .data', async () => {
    mockedClient.get.mockResolvedValue({ data: [{ library_id: 'l1' }] });

    const storage = await adminManager.getStatsStorage();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/stats/storage');
    expect(storage).toHaveLength(1);
  });

  // ── Users (BARE { users } / { user } / { message }) ──

  it('getUsers GETs /admin/users with status param and unwraps { users }', async () => {
    mockedClient.get.mockResolvedValue({ users: [sampleUser] });

    const users = await adminManager.getUsers('pending');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/users', { status: 'pending' });
    expect(users[0].id).toBe('u1');
  });

  it('getUsers omits the params object when no status is given', async () => {
    mockedClient.get.mockResolvedValue({ users: [] });

    await adminManager.getUsers();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/users', undefined);
  });

  it('getUser GETs /admin/users/{id} and unwraps { user }', async () => {
    mockedClient.get.mockResolvedValue({ user: sampleUser });

    const user = await adminManager.getUser('u1');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/users/u1');
    expect(user.username).toBe('alice');
  });

  it('createUser POSTs /admin/users with body and returns { user_id, message }', async () => {
    mockedClient.post.mockResolvedValue({ user_id: 'u9', message: 'created' });

    const result = await adminManager.createUser({
      username: 'bob',
      email: 'bob@example.com',
      password: 'secret',
      is_admin: true,
    });

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/users', {
      username: 'bob',
      email: 'bob@example.com',
      password: 'secret',
      is_admin: true,
    });
    expect(result.user_id).toBe('u9');
  });

  it('updateUser PUTs /admin/users/{id} with the partial body', async () => {
    mockedClient.put.mockResolvedValue({ message: 'ok' });

    await adminManager.updateUser('u1', { email: 'new@example.com' });

    expect(mockedClient.put).toHaveBeenCalledWith('/admin/users/u1', {
      email: 'new@example.com',
    });
  });

  it('deleteUser DELETEs /admin/users/{id}', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await adminManager.deleteUser('u1');

    expect(mockedClient.delete).toHaveBeenCalledWith('/admin/users/u1');
  });

  it('setUserAdmin POSTs /admin/users/{id}/set-admin with { is_admin }', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok' });

    await adminManager.setUserAdmin('u1', true);

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/users/u1/set-admin', {
      is_admin: true,
    });
  });

  it('resetPassword POSTs /admin/users/{id}/reset-password and returns { message, new_password }', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok', new_password: 'p@ss' });

    const result = await adminManager.resetPassword('u1');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/users/u1/reset-password');
    expect(result.new_password).toBe('p@ss');
  });

  it('approveUser POSTs /admin/users/{id}/approve', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok' });

    await adminManager.approveUser('u1');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/users/u1/approve');
  });

  it('disableUser POSTs /admin/users/{id}/disable', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok' });

    await adminManager.disableUser('u1');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/users/u1/disable');
  });

  it('rejectUser POSTs /admin/users/{id}/reject', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok' });

    await adminManager.rejectUser('u1');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/users/u1/reject');
  });

  // ── Libraries (BARE { libraries } / { library } / { message }) ──

  it('getLibraries GETs /libraries and unwraps { libraries }', async () => {
    mockedClient.get.mockResolvedValue({ libraries: [sampleLibrary] });

    const libraries = await adminManager.getLibraries();

    expect(mockedClient.get).toHaveBeenCalledWith('/libraries');
    expect(libraries[0].id).toBe('lib1');
  });

  it('getLibrary GETs /libraries/{id} and unwraps { library }', async () => {
    mockedClient.get.mockResolvedValue({ library: sampleLibrary });

    const library = await adminManager.getLibrary('lib1');

    expect(mockedClient.get).toHaveBeenCalledWith('/libraries/lib1');
    expect(library.name).toBe('Movies');
  });

  it('createLibrary POSTs /libraries with body and returns { library_id, job_id }', async () => {
    mockedClient.post.mockResolvedValue({
      library_id: 'lib9',
      job_id: 'job9',
      status: 'queued',
      message: 'created',
    });

    const result = await adminManager.createLibrary({
      name: 'TV',
      type: 'series',
      paths: ['/data/tv'],
      series_per_directory: true,
    });

    expect(mockedClient.post).toHaveBeenCalledWith('/libraries', {
      name: 'TV',
      type: 'series',
      paths: ['/data/tv'],
      series_per_directory: true,
    });
    expect(result.library_id).toBe('lib9');
    expect(result.job_id).toBe('job9');
  });

  it('updateLibrary PUTs /libraries/{id} with the partial body', async () => {
    mockedClient.put.mockResolvedValue({ message: 'ok' });

    await adminManager.updateLibrary('lib1', { name: 'Films' });

    expect(mockedClient.put).toHaveBeenCalledWith('/libraries/lib1', { name: 'Films' });
  });

  it('deleteLibrary DELETEs /libraries/{id}', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await adminManager.deleteLibrary('lib1');

    expect(mockedClient.delete).toHaveBeenCalledWith('/libraries/lib1');
  });

  it('scanLibrary POSTs /libraries/{id}/scan and returns the job trigger', async () => {
    mockedClient.post.mockResolvedValue({ job_id: 'j1', status: 'queued', message: 'ok' });

    const result = await adminManager.scanLibrary('lib1');

    expect(mockedClient.post).toHaveBeenCalledWith('/libraries/lib1/scan');
    expect(result.job_id).toBe('j1');
  });

  it('rescanLibrary POSTs /libraries/{id}/rescan', async () => {
    mockedClient.post.mockResolvedValue({ job_id: 'j2', status: 'queued', message: 'ok' });

    const result = await adminManager.rescanLibrary('lib1');

    expect(mockedClient.post).toHaveBeenCalledWith('/libraries/lib1/rescan');
    expect(result.status).toBe('queued');
  });

  it('matchMetadata POSTs /libraries/{id}/match-metadata', async () => {
    mockedClient.post.mockResolvedValue({ job_id: 'j3', status: 'queued', message: 'ok' });

    const result = await adminManager.matchMetadata('lib1');

    expect(mockedClient.post).toHaveBeenCalledWith('/libraries/lib1/match-metadata');
    expect(result.job_id).toBe('j3');
  });

  it('getScanStatus GETs /libraries/{id}/scan-status and unwraps { scan_status }', async () => {
    mockedClient.get.mockResolvedValue({ scan_status: sampleJob });

    const status = await adminManager.getScanStatus('lib1');

    expect(mockedClient.get).toHaveBeenCalledWith('/libraries/lib1/scan-status');
    expect(status?.id).toBe('job1');
  });

  it('getScanStatus returns null when no job is running', async () => {
    mockedClient.get.mockResolvedValue({ scan_status: null });

    const status = await adminManager.getScanStatus('lib1');

    expect(status).toBeNull();
  });

  it('getScanHistory GETs /libraries/{id}/scan-history with limit and unwraps { history }', async () => {
    mockedClient.get.mockResolvedValue({ history: [sampleJob] });

    const history = await adminManager.getScanHistory('lib1', 5);

    expect(mockedClient.get).toHaveBeenCalledWith('/libraries/lib1/scan-history', {
      limit: 5,
    });
    expect(history).toHaveLength(1);
  });

  it('getScanHistory defaults to limit=20', async () => {
    mockedClient.get.mockResolvedValue({ history: [] });

    await adminManager.getScanHistory('lib1');

    expect(mockedClient.get).toHaveBeenCalledWith('/libraries/lib1/scan-history', {
      limit: 20,
    });
  });

  // ── Plugins (E10c — BARE { plugins } / { plugin } / { sources }) ──

  it('getPlugins GETs /admin/plugins and unwraps { plugins }', async () => {
    mockedClient.get.mockResolvedValue({
      plugins: [{ id: 'p1', name: 'trakt', version: '1.0', type: 'metadata', enabled: true }],
    });

    const plugins = await adminManager.getPlugins();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/plugins');
    expect(plugins[0].name).toBe('trakt');
  });

  it('getPlugin GETs /admin/plugins/{name} (encoded) and unwraps { plugin }', async () => {
    mockedClient.get.mockResolvedValue({
      plugin: { name: 'last.fm', version: '2.0', type: 'scrobbler', enabled: false },
    });

    const plugin = await adminManager.getPlugin('last.fm');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/plugins/last.fm');
    expect(plugin.version).toBe('2.0');
  });

  it('installPlugin POSTs /admin/plugins/install with { url } and unwraps { plugin }', async () => {
    mockedClient.post.mockResolvedValue({
      plugin: { name: 'new', version: '0.1', type: 'x', enabled: true },
    });

    const plugin = await adminManager.installPlugin('https://example.com/p.zip');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/plugins/install', {
      url: 'https://example.com/p.zip',
    });
    expect(plugin.name).toBe('new');
  });

  it('updatePluginSettings PUTs /admin/plugins/{name}/settings with { settings } and unwraps { plugin }', async () => {
    mockedClient.put.mockResolvedValue({
      plugin: { name: 'trakt', version: '1.0', type: 'metadata', enabled: true },
    });

    const plugin = await adminManager.updatePluginSettings('trakt', { apiKey: 'abc' });

    expect(mockedClient.put).toHaveBeenCalledWith('/admin/plugins/trakt/settings', {
      settings: { apiKey: 'abc' },
    });
    expect(plugin.name).toBe('trakt');
  });

  it('enablePlugin POSTs /admin/plugins/{name}/enable and unwraps { plugin }', async () => {
    mockedClient.post.mockResolvedValue({
      plugin: { name: 'trakt', version: '1.0', type: 'metadata', enabled: true },
    });

    const plugin = await adminManager.enablePlugin('trakt');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/plugins/trakt/enable');
    expect(plugin.enabled).toBe(true);
  });

  it('disablePlugin POSTs /admin/plugins/{name}/disable and unwraps { plugin }', async () => {
    mockedClient.post.mockResolvedValue({
      plugin: { name: 'trakt', version: '1.0', type: 'metadata', enabled: false },
    });

    const plugin = await adminManager.disablePlugin('trakt');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/plugins/trakt/disable');
    expect(plugin.enabled).toBe(false);
  });

  it('uninstallPlugin DELETEs /admin/plugins/{name} and resolves void (204)', async () => {
    mockedClient.delete.mockResolvedValue(undefined);

    const result = await adminManager.uninstallPlugin('trakt');

    expect(mockedClient.delete).toHaveBeenCalledWith('/admin/plugins/trakt');
    expect(result).toBeUndefined();
  });

  it('getPluginCatalog GETs /admin/plugins/catalog and returns the WHOLE object', async () => {
    const catalog = {
      default_source: 'https://catalog',
      sources: ['https://catalog'],
      catalogs: [{ source: 'https://catalog', name: 'Main', plugins: [] }],
      errors: [],
    };
    mockedClient.get.mockResolvedValue(catalog);

    const result = await adminManager.getPluginCatalog();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/plugins/catalog');
    expect(result).toEqual(catalog);
  });

  it('addCatalogSource POSTs /admin/plugins/catalog/sources with { url } and unwraps { sources }', async () => {
    mockedClient.post.mockResolvedValue({ sources: ['https://a', 'https://b'] });

    const sources = await adminManager.addCatalogSource('https://b');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/plugins/catalog/sources', {
      url: 'https://b',
    });
    expect(sources).toEqual(['https://a', 'https://b']);
  });

  it('removeCatalogSource DELETEs /admin/plugins/catalog/sources with a BODY { url } and unwraps { sources }', async () => {
    mockedClient.delete.mockResolvedValue({ sources: ['https://a'] });

    const sources = await adminManager.removeCatalogSource('https://b');

    expect(mockedClient.delete).toHaveBeenCalledWith('/admin/plugins/catalog/sources', {
      data: { url: 'https://b' },
    });
    expect(sources).toEqual(['https://a']);
  });

  // ── Auth providers (E10c — BARE) ──

  it('getAuthProviders GETs /admin/auth-providers and unwraps { providers }', async () => {
    mockedClient.get.mockResolvedValue({
      providers: [{ name: 'local', supports_authentication: true }],
    });

    const providers = await adminManager.getAuthProviders();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/auth-providers');
    expect(providers[0].name).toBe('local');
  });

  it('enableAuthProvider POSTs /admin/auth-providers/{name}/enable and returns { name, enabled, message }', async () => {
    mockedClient.post.mockResolvedValue({ name: 'oidc', enabled: true, message: 'on' });

    const result = await adminManager.enableAuthProvider('oidc');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/auth-providers/oidc/enable');
    expect(result.enabled).toBe(true);
  });

  it('disableAuthProvider POSTs /admin/auth-providers/{name}/disable and returns the result', async () => {
    mockedClient.post.mockResolvedValue({ name: 'oidc', enabled: false, message: 'off' });

    const result = await adminManager.disableAuthProvider('oidc');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/auth-providers/oidc/disable');
    expect(result.enabled).toBe(false);
  });

  it('getAuthProviderConfigSchema GETs the schema route and unwraps { schema }', async () => {
    mockedClient.get.mockResolvedValue({ schema: { type: 'object', properties: {} } });

    const schema = await adminManager.getAuthProviderConfigSchema('oidc');

    expect(mockedClient.get).toHaveBeenCalledWith(
      '/admin/auth-providers/oidc/config-schema'
    );
    expect(schema).toEqual({ type: 'object', properties: {} });
  });

  // ── Server settings (E10c — ENVELOPED { success, data } → unwrap .data) ──

  it('getServerSettings GETs /admin/settings and unwraps .data', async () => {
    const data = { settings: { a: 1 }, overridden: ['a'], types: { a: 'number' } };
    mockedClient.get.mockResolvedValue({ success: true, data });

    const result = await adminManager.getServerSettings();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/settings');
    expect(result).toEqual(data);
  });

  it('updateServerSettings PUTs /admin/settings with { settings } and unwraps .data', async () => {
    const data = { settings: { a: 2 }, overridden: [], types: { a: 'number' } };
    mockedClient.put.mockResolvedValue({ success: true, data });

    const result = await adminManager.updateServerSettings({ a: 2 });

    expect(mockedClient.put).toHaveBeenCalledWith('/admin/settings', {
      settings: { a: 2 },
    });
    expect(result.settings.a).toBe(2);
  });

  // ── Backup (E10d — ENVELOPED { success, data|message, count? } → .data) ──

  it('createBackup POSTs /admin/backup/create with { label } and unwraps .data', async () => {
    const backup = { id: 'b1', created_at: '2026-06-27', label: 'pre', size: 100 };
    mockedClient.post.mockResolvedValue({ success: true, message: 'ok', data: backup });

    const result = await adminManager.createBackup('pre');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/backup/create', {
      label: 'pre',
    });
    expect(result).toEqual(backup);
  });

  it('createBackup POSTs an empty body when no label is given', async () => {
    const backup = { id: 'b1', created_at: '2026-06-27', label: '', size: 100 };
    mockedClient.post.mockResolvedValue({ success: true, message: 'ok', data: backup });

    await adminManager.createBackup();

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/backup/create', {});
  });

  it('listBackups GETs /admin/backup/list and unwraps .data', async () => {
    const backups = [{ id: 'b1', created_at: '2026-06-27', label: 'a', size: 1 }];
    mockedClient.get.mockResolvedValue({ success: true, data: backups, count: 1 });

    const result = await adminManager.listBackups();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/backup/list');
    expect(result).toEqual(backups);
  });

  it('deleteBackup DELETEs /admin/backup/{id} (encoded) and resolves void', async () => {
    mockedClient.delete.mockResolvedValue({ success: true, message: 'ok' });

    const result = await adminManager.deleteBackup('b 1');

    expect(mockedClient.delete).toHaveBeenCalledWith('/admin/backup/b%201');
    expect(result).toBeUndefined();
  });

  it('restoreBackup POSTs /admin/backup/{id}/restore and resolves void', async () => {
    mockedClient.post.mockResolvedValue({ success: true, message: 'ok' });

    const result = await adminManager.restoreBackup('b1');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/backup/b1/restore');
    expect(result).toBeUndefined();
  });

  it('uploadBackupS3 POSTs /admin/backup/{id}/upload-s3 and resolves void', async () => {
    mockedClient.post.mockResolvedValue({ success: true, message: 'ok' });

    const result = await adminManager.uploadBackupS3('b1');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/backup/b1/upload-s3');
    expect(result).toBeUndefined();
  });

  it('getBackupSchedule GETs /admin/backup/schedule and unwraps .data', async () => {
    const schedule = {
      auto_backup_interval_days: 7,
      retention_count: 5,
      next_scheduled_backup: '2026-07-04',
      next_scheduled_backup_iso: '2026-07-04T00:00:00Z',
    };
    mockedClient.get.mockResolvedValue({ success: true, data: schedule });

    const result = await adminManager.getBackupSchedule();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/backup/schedule');
    expect(result).toEqual(schedule);
  });

  it('updateBackupSchedule PUTs /admin/backup/schedule with the body and unwraps .data', async () => {
    const schedule = {
      auto_backup_interval_days: 3,
      retention_count: 10,
      next_scheduled_backup: null,
      next_scheduled_backup_iso: null,
    };
    mockedClient.put.mockResolvedValue({ success: true, message: 'ok', data: schedule });

    const result = await adminManager.updateBackupSchedule({
      auto_backup_interval_days: 3,
      retention_count: 10,
    });

    expect(mockedClient.put).toHaveBeenCalledWith('/admin/backup/schedule', {
      auto_backup_interval_days: 3,
      retention_count: 10,
    });
    expect(result.retention_count).toBe(10);
  });

  // ── Logs (E10d — BARE) ──

  it('getLogFiles GETs /admin/logs and unwraps { files }', async () => {
    const files = [{ name: 'app.log', size: 100, modified_at: '2026-06-27' }];
    mockedClient.get.mockResolvedValue({ files });

    const result = await adminManager.getLogFiles();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/logs');
    expect(result).toEqual(files);
  });

  it('tailLog GETs /admin/logs/tail with file+lines and returns the whole tail', async () => {
    const tail = { file: 'app.log', lines: ['a', 'b'], truncated: false };
    mockedClient.get.mockResolvedValue(tail);

    const result = await adminManager.tailLog('app.log', 500);

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/logs/tail', {
      file: 'app.log',
      lines: 500,
    });
    expect(result).toEqual(tail);
  });

  it('tailLog omits lines when not given', async () => {
    mockedClient.get.mockResolvedValue({ file: 'app.log', lines: [], truncated: false });

    await adminManager.tailLog('app.log');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/logs/tail', {
      file: 'app.log',
    });
  });

  it('tailAllLogs GETs /admin/logs/tail-all with lines and returns the whole tail', async () => {
    const tail = { files: ['a.log', 'b.log'], lines: ['x'], truncated: true };
    mockedClient.get.mockResolvedValue(tail);

    const result = await adminManager.tailAllLogs(1000);

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/logs/tail-all', {
      lines: 1000,
    });
    expect(result).toEqual(tail);
  });

  it('tailAllLogs passes undefined params when no lines given', async () => {
    mockedClient.get.mockResolvedValue({ files: [], lines: [], truncated: false });

    await adminManager.tailAllLogs();

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/logs/tail-all', undefined);
  });

  // ── FS browse (E10d — ENVELOPED { success, data } → .data) ──

  it('browseFs GETs /admin/fs/browse with { path } and unwraps .data', async () => {
    const listing = {
      path: '/media',
      parent: '/',
      entries: [{ name: 'movies', path: '/media/movies' }],
    };
    mockedClient.get.mockResolvedValue({ success: true, data: listing });

    const result = await adminManager.browseFs('/media');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/fs/browse', {
      path: '/media',
    });
    expect(result).toEqual(listing);
  });

  it('browseFs passes undefined params for the roots (empty/absent path)', async () => {
    const listing = { path: null, parent: null, entries: [] };
    mockedClient.get.mockResolvedValue({ success: true, data: listing });

    await adminManager.browseFs();
    expect(mockedClient.get).toHaveBeenCalledWith('/admin/fs/browse', undefined);

    await adminManager.browseFs('');
    expect(mockedClient.get).toHaveBeenLastCalledWith('/admin/fs/browse', undefined);
  });
});

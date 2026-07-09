/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useAdminStore.test.ts
import { useAdminStore } from '../useAdminStore';
import { adminManager } from '../../api/AdminManager';
import type { AdminUser } from '../../types/admin';
import type { Library } from '../../types/media';

jest.mock('../../api/AdminManager', () => ({
  adminManager: {
    getNowPlaying: jest.fn(),
    getDashboardTopUsers: jest.fn(),
    getDashboardTopMedia: jest.fn(),
    getDashboardStorage: jest.fn(),
    getActivity: jest.fn(),
    getUsers: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    setUserAdmin: jest.fn(),
    resetPassword: jest.fn(),
    approveUser: jest.fn(),
    disableUser: jest.fn(),
    rejectUser: jest.fn(),
    getLibraries: jest.fn(),
    getLibrary: jest.fn(),
    createLibrary: jest.fn(),
    updateLibrary: jest.fn(),
    deleteLibrary: jest.fn(),
    scanLibrary: jest.fn(),
    rescanLibrary: jest.fn(),
    matchMetadata: jest.fn(),
    getScanStatus: jest.fn(),
    getScanHistory: jest.fn(),
    getPlugins: jest.fn(),
    getPlugin: jest.fn(),
    installPlugin: jest.fn(),
    updatePluginSettings: jest.fn(),
    enablePlugin: jest.fn(),
    disablePlugin: jest.fn(),
    uninstallPlugin: jest.fn(),
    getPluginCatalog: jest.fn(),
    addCatalogSource: jest.fn(),
    removeCatalogSource: jest.fn(),
    getAuthProviders: jest.fn(),
    enableAuthProvider: jest.fn(),
    disableAuthProvider: jest.fn(),
    getAuthProviderConfigSchema: jest.fn(),
    getServerSettings: jest.fn(),
    updateServerSettings: jest.fn(),
    createBackup: jest.fn(),
    listBackups: jest.fn(),
    deleteBackup: jest.fn(),
    restoreBackup: jest.fn(),
    uploadBackupS3: jest.fn(),
    getBackupSchedule: jest.fn(),
    updateBackupSchedule: jest.fn(),
    getLogFiles: jest.fn(),
    tailLog: jest.fn(),
    tailAllLogs: jest.fn(),
    browseFs: jest.fn(),
  },
}));

const mocked = adminManager as jest.Mocked<typeof adminManager>;

const makeUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: 'u1',
  username: 'alice',
  email: 'alice@example.com',
  display_name: 'Alice',
  is_admin: false,
  status: 'active',
  created_at: null,
  updated_at: null,
  last_login: null,
  ...overrides,
});

const makeLibrary = (overrides: Partial<Library> = {}): Library => ({
  id: 'lib1',
  name: 'Movies',
  type: 'movie',
  ...overrides,
});

const resetStore = () => {
  useAdminStore.setState({
    nowPlaying: [],
    topUsers: [],
    topMedia: [],
    storage: [],
    activity: [],
    dashboardLoading: false,
    dashboardError: null,
    users: [],
    usersLoading: false,
    usersError: null,
    libraries: [],
    librariesLoading: false,
    librariesError: null,
    plugins: [],
    pluginsLoading: false,
    pluginsError: null,
    catalog: null,
    catalogLoading: false,
    catalogError: null,
    authProviders: [],
    authProvidersLoading: false,
    authProvidersError: null,
    serverSettings: null,
    serverSettingsLoading: false,
    serverSettingsError: null,
    backups: [],
    backupsLoading: false,
    backupsError: null,
    backupSchedule: null,
    backupScheduleLoading: false,
    backupScheduleError: null,
    logFiles: [],
    logFilesLoading: false,
    logFilesError: null,
    currentTail: null,
    tailLoading: false,
    tailError: null,
    fsListing: null,
    fsLoading: false,
    fsError: null,
    fsPickedPath: null,
  });
};

const makePlugin = (overrides = {}) => ({
  id: 'p1',
  name: 'trakt',
  version: '1.0',
  type: 'metadata',
  enabled: true,
  ...overrides,
});

describe('useAdminStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // ── Dashboard ──

  it('loadDashboard populates all five dashboard slices and clears loading', async () => {
    mocked.getNowPlaying.mockResolvedValue([{ session_id: 's1' }]);
    mocked.getDashboardTopUsers.mockResolvedValue([{ user_id: 'u1' }]);
    mocked.getDashboardTopMedia.mockResolvedValue([{ media_item_id: 'm1' }]);
    mocked.getDashboardStorage.mockResolvedValue([{ library_id: 'l1' }]);
    mocked.getActivity.mockResolvedValue([{ id: 'a1' }]);

    await useAdminStore.getState().loadDashboard();

    const state = useAdminStore.getState();
    expect(state.nowPlaying).toHaveLength(1);
    expect(state.topUsers).toHaveLength(1);
    expect(state.topMedia).toHaveLength(1);
    expect(state.storage).toHaveLength(1);
    expect(state.activity).toHaveLength(1);
    expect(state.dashboardLoading).toBe(false);
    expect(state.dashboardError).toBeNull();
  });

  it('loadDashboard sets dashboardError on failure without throwing', async () => {
    mocked.getNowPlaying.mockRejectedValue(new Error('forbidden'));
    mocked.getDashboardTopUsers.mockResolvedValue([]);
    mocked.getDashboardTopMedia.mockResolvedValue([]);
    mocked.getDashboardStorage.mockResolvedValue([]);
    mocked.getActivity.mockResolvedValue([]);

    await useAdminStore.getState().loadDashboard();

    const state = useAdminStore.getState();
    expect(state.dashboardError).toBe('forbidden');
    expect(state.dashboardLoading).toBe(false);
  });

  // ── Users (loaders swallow) ──

  it('loadUsers populates users and forwards the status filter', async () => {
    mocked.getUsers.mockResolvedValue([makeUser(), makeUser({ id: 'u2' })]);

    await useAdminStore.getState().loadUsers('pending');

    expect(mocked.getUsers).toHaveBeenCalledWith('pending');
    expect(useAdminStore.getState().users).toHaveLength(2);
    expect(useAdminStore.getState().usersLoading).toBe(false);
  });

  it('loadUsers sets usersError on failure without throwing', async () => {
    mocked.getUsers.mockRejectedValue(new Error('boom'));

    await useAdminStore.getState().loadUsers();

    expect(useAdminStore.getState().usersError).toBe('boom');
  });

  // ── Users (mutators rethrow) ──

  it('createUser delegates, reloads, and returns the result', async () => {
    mocked.createUser.mockResolvedValue({ user_id: 'u9', message: 'created' });
    mocked.getUsers.mockResolvedValue([makeUser({ id: 'u9' })]);

    const result = await useAdminStore.getState().createUser({
      username: 'bob',
      email: 'bob@example.com',
      password: 'secret',
    });

    expect(mocked.createUser).toHaveBeenCalled();
    expect(mocked.getUsers).toHaveBeenCalled();
    expect(result.user_id).toBe('u9');
    expect(useAdminStore.getState().users[0].id).toBe('u9');
  });

  it('createUser rethrows and sets usersError on failure', async () => {
    mocked.createUser.mockRejectedValue(new Error('dupe'));

    await expect(
      useAdminStore.getState().createUser({
        username: 'bob',
        email: 'bob@example.com',
        password: 'secret',
      })
    ).rejects.toThrow('dupe');
    expect(useAdminStore.getState().usersError).toBe('dupe');
  });

  it('updateUser replaces the edited user with the refreshed copy', async () => {
    useAdminStore.setState({ users: [makeUser({ id: 'u1', email: 'old@x.com' })] });
    mocked.updateUser.mockResolvedValue(undefined);
    mocked.getUser.mockResolvedValue(makeUser({ id: 'u1', email: 'new@x.com' }));

    await useAdminStore.getState().updateUser('u1', { email: 'new@x.com' });

    expect(useAdminStore.getState().users[0].email).toBe('new@x.com');
  });

  it('deleteUser removes the user from the list', async () => {
    useAdminStore.setState({ users: [makeUser({ id: 'u1' }), makeUser({ id: 'u2' })] });
    mocked.deleteUser.mockResolvedValue(undefined);

    await useAdminStore.getState().deleteUser('u1');

    const ids = useAdminStore.getState().users.map((u) => u.id);
    expect(ids).toEqual(['u2']);
  });

  it('setUserAdmin patches is_admin on the matching user', async () => {
    useAdminStore.setState({ users: [makeUser({ id: 'u1', is_admin: false })] });
    mocked.setUserAdmin.mockResolvedValue(undefined);

    await useAdminStore.getState().setUserAdmin('u1', true);

    expect(mocked.setUserAdmin).toHaveBeenCalledWith('u1', true);
    expect(useAdminStore.getState().users[0].is_admin).toBe(true);
  });

  it('resetPassword returns the new password from the manager', async () => {
    mocked.resetPassword.mockResolvedValue({ message: 'ok', new_password: 'p@ss' });

    const result = await useAdminStore.getState().resetPassword('u1');

    expect(result.new_password).toBe('p@ss');
  });

  it('approveUser flips status to active', async () => {
    useAdminStore.setState({ users: [makeUser({ id: 'u1', status: 'pending' })] });
    mocked.approveUser.mockResolvedValue(undefined);

    await useAdminStore.getState().approveUser('u1');

    expect(useAdminStore.getState().users[0].status).toBe('active');
  });

  it('disableUser flips status to disabled', async () => {
    useAdminStore.setState({ users: [makeUser({ id: 'u1', status: 'active' })] });
    mocked.disableUser.mockResolvedValue(undefined);

    await useAdminStore.getState().disableUser('u1');

    expect(useAdminStore.getState().users[0].status).toBe('disabled');
  });

  it('rejectUser removes the user from the list', async () => {
    useAdminStore.setState({ users: [makeUser({ id: 'u1' })] });
    mocked.rejectUser.mockResolvedValue(undefined);

    await useAdminStore.getState().rejectUser('u1');

    expect(useAdminStore.getState().users).toHaveLength(0);
  });

  // ── Libraries ──

  it('loadLibraries populates libraries and clears loading', async () => {
    mocked.getLibraries.mockResolvedValue([makeLibrary(), makeLibrary({ id: 'lib2' })]);

    await useAdminStore.getState().loadLibraries();

    expect(useAdminStore.getState().libraries).toHaveLength(2);
    expect(useAdminStore.getState().librariesLoading).toBe(false);
  });

  it('loadLibraries sets librariesError on failure without throwing', async () => {
    mocked.getLibraries.mockRejectedValue(new Error('no access'));

    await useAdminStore.getState().loadLibraries();

    expect(useAdminStore.getState().librariesError).toBe('no access');
  });

  it('createLibrary delegates, reloads, and returns the result', async () => {
    mocked.createLibrary.mockResolvedValue({
      library_id: 'lib9',
      job_id: 'j9',
      status: 'queued',
      message: 'ok',
    });
    mocked.getLibraries.mockResolvedValue([makeLibrary({ id: 'lib9' })]);

    const result = await useAdminStore.getState().createLibrary({
      name: 'TV',
      type: 'series',
      paths: ['/data/tv'],
    });

    expect(result.library_id).toBe('lib9');
    expect(useAdminStore.getState().libraries[0].id).toBe('lib9');
  });

  it('updateLibrary replaces the edited library with the refreshed copy', async () => {
    useAdminStore.setState({ libraries: [makeLibrary({ id: 'lib1', name: 'Old' })] });
    mocked.updateLibrary.mockResolvedValue(undefined);
    mocked.getLibrary.mockResolvedValue(makeLibrary({ id: 'lib1', name: 'New' }));

    await useAdminStore.getState().updateLibrary('lib1', { name: 'New' });

    expect(useAdminStore.getState().libraries[0].name).toBe('New');
  });

  it('deleteLibrary removes the library from the list', async () => {
    useAdminStore.setState({
      libraries: [makeLibrary({ id: 'lib1' }), makeLibrary({ id: 'lib2' })],
    });
    mocked.deleteLibrary.mockResolvedValue(undefined);

    await useAdminStore.getState().deleteLibrary('lib1');

    expect(useAdminStore.getState().libraries.map((l) => l.id)).toEqual(['lib2']);
  });

  it('scanLibrary returns the job trigger result', async () => {
    mocked.scanLibrary.mockResolvedValue({ job_id: 'j1', status: 'queued', message: 'ok' });

    const result = await useAdminStore.getState().scanLibrary('lib1');

    expect(mocked.scanLibrary).toHaveBeenCalledWith('lib1');
    expect(result.job_id).toBe('j1');
  });

  it('rescanLibrary rethrows and sets librariesError on failure', async () => {
    mocked.rescanLibrary.mockRejectedValue(new Error('busy'));

    await expect(useAdminStore.getState().rescanLibrary('lib1')).rejects.toThrow('busy');
    expect(useAdminStore.getState().librariesError).toBe('busy');
  });

  it('matchMetadata returns the job trigger result', async () => {
    mocked.matchMetadata.mockResolvedValue({ job_id: 'j3', status: 'queued', message: 'ok' });

    const result = await useAdminStore.getState().matchMetadata('lib1');

    expect(result.job_id).toBe('j3');
  });

  it('getScanStatus delegates to the manager', async () => {
    mocked.getScanStatus.mockResolvedValue(null);

    const status = await useAdminStore.getState().getScanStatus('lib1');

    expect(mocked.getScanStatus).toHaveBeenCalledWith('lib1');
    expect(status).toBeNull();
  });

  it('getScanHistory delegates to the manager with limit', async () => {
    mocked.getScanHistory.mockResolvedValue([]);

    await useAdminStore.getState().getScanHistory('lib1', 5);

    expect(mocked.getScanHistory).toHaveBeenCalledWith('lib1', 5);
  });

  // ── Plugins (E10c) ──

  it('loadPlugins populates plugins and clears loading', async () => {
    mocked.getPlugins.mockResolvedValue([makePlugin(), makePlugin({ name: 'lastfm' })]);

    await useAdminStore.getState().loadPlugins();

    expect(useAdminStore.getState().plugins).toHaveLength(2);
    expect(useAdminStore.getState().pluginsLoading).toBe(false);
  });

  it('loadPlugins sets pluginsError on failure without throwing', async () => {
    mocked.getPlugins.mockRejectedValue(new Error('nope'));

    await useAdminStore.getState().loadPlugins();

    expect(useAdminStore.getState().pluginsError).toBe('nope');
  });

  it('installPlugin delegates, reloads, and returns the detail', async () => {
    mocked.installPlugin.mockResolvedValue(makePlugin({ name: 'new' }));
    mocked.getPlugins.mockResolvedValue([makePlugin({ name: 'new' })]);

    const result = await useAdminStore.getState().installPlugin('https://x');

    expect(mocked.installPlugin).toHaveBeenCalledWith('https://x');
    expect(mocked.getPlugins).toHaveBeenCalled();
    expect(result.name).toBe('new');
  });

  it('installPlugin rethrows and sets pluginsError on failure', async () => {
    mocked.installPlugin.mockRejectedValue(new Error('bad scheme'));

    await expect(
      useAdminStore.getState().installPlugin('ftp://x')
    ).rejects.toThrow('bad scheme');
    expect(useAdminStore.getState().pluginsError).toBe('bad scheme');
  });

  it('enablePlugin flips enabled true on the matching row', async () => {
    useAdminStore.setState({ plugins: [makePlugin({ name: 'trakt', enabled: false })] });
    mocked.enablePlugin.mockResolvedValue(makePlugin({ enabled: true }));

    await useAdminStore.getState().enablePlugin('trakt');

    expect(useAdminStore.getState().plugins[0].enabled).toBe(true);
  });

  it('disablePlugin flips enabled false on the matching row', async () => {
    useAdminStore.setState({ plugins: [makePlugin({ name: 'trakt', enabled: true })] });
    mocked.disablePlugin.mockResolvedValue(makePlugin({ enabled: false }));

    await useAdminStore.getState().disablePlugin('trakt');

    expect(useAdminStore.getState().plugins[0].enabled).toBe(false);
  });

  it('uninstallPlugin removes the plugin from the list', async () => {
    useAdminStore.setState({
      plugins: [makePlugin({ name: 'a' }), makePlugin({ name: 'b' })],
    });
    mocked.uninstallPlugin.mockResolvedValue(undefined);

    await useAdminStore.getState().uninstallPlugin('a');

    expect(useAdminStore.getState().plugins.map((p) => p.name)).toEqual(['b']);
  });

  it('uninstallPlugin rethrows and sets pluginsError on failure', async () => {
    mocked.uninstallPlugin.mockRejectedValue(new Error('locked'));

    await expect(
      useAdminStore.getState().uninstallPlugin('a')
    ).rejects.toThrow('locked');
    expect(useAdminStore.getState().pluginsError).toBe('locked');
  });

  it('updatePluginSettings merges the refreshed detail into the row', async () => {
    useAdminStore.setState({ plugins: [makePlugin({ name: 'trakt', enabled: false })] });
    mocked.updatePluginSettings.mockResolvedValue(makePlugin({ name: 'trakt', enabled: true }));

    const result = await useAdminStore
      .getState()
      .updatePluginSettings('trakt', { apiKey: 'x' });

    expect(mocked.updatePluginSettings).toHaveBeenCalledWith('trakt', { apiKey: 'x' });
    expect(useAdminStore.getState().plugins[0].enabled).toBe(true);
    expect(result.name).toBe('trakt');
  });

  it('loadCatalog populates the catalog and clears loading', async () => {
    const catalog = {
      default_source: 'https://c',
      sources: ['https://c'],
      catalogs: [],
      errors: [],
    };
    mocked.getPluginCatalog.mockResolvedValue(catalog);

    await useAdminStore.getState().loadCatalog();

    expect(useAdminStore.getState().catalog).toEqual(catalog);
    expect(useAdminStore.getState().catalogLoading).toBe(false);
  });

  it('loadCatalog sets catalogError on failure without throwing', async () => {
    mocked.getPluginCatalog.mockRejectedValue(new Error('offline'));

    await useAdminStore.getState().loadCatalog();

    expect(useAdminStore.getState().catalogError).toBe('offline');
  });

  it('addCatalogSource delegates and reloads the catalog', async () => {
    mocked.addCatalogSource.mockResolvedValue(['https://a', 'https://b']);
    mocked.getPluginCatalog.mockResolvedValue({
      default_source: 'https://a',
      sources: ['https://a', 'https://b'],
      catalogs: [],
      errors: [],
    });

    await useAdminStore.getState().addCatalogSource('https://b');

    expect(mocked.addCatalogSource).toHaveBeenCalledWith('https://b');
    expect(mocked.getPluginCatalog).toHaveBeenCalled();
  });

  it('removeCatalogSource rethrows and sets catalogError on failure', async () => {
    mocked.removeCatalogSource.mockRejectedValue(new Error('protected'));

    await expect(
      useAdminStore.getState().removeCatalogSource('https://b')
    ).rejects.toThrow('protected');
    expect(useAdminStore.getState().catalogError).toBe('protected');
  });

  // ── Auth providers (E10c) ──

  it('loadAuthProviders populates providers and clears loading', async () => {
    mocked.getAuthProviders.mockResolvedValue([
      { name: 'local', supports_authentication: true },
    ]);

    await useAdminStore.getState().loadAuthProviders();

    expect(useAdminStore.getState().authProviders).toHaveLength(1);
    expect(useAdminStore.getState().authProvidersLoading).toBe(false);
  });

  it('loadAuthProviders sets authProvidersError on failure without throwing', async () => {
    mocked.getAuthProviders.mockRejectedValue(new Error('denied'));

    await useAdminStore.getState().loadAuthProviders();

    expect(useAdminStore.getState().authProvidersError).toBe('denied');
  });

  it('enableAuthProvider delegates, reloads, and returns the result', async () => {
    mocked.enableAuthProvider.mockResolvedValue({ name: 'oidc', enabled: true, message: 'on' });
    mocked.getAuthProviders.mockResolvedValue([]);

    const result = await useAdminStore.getState().enableAuthProvider('oidc');

    expect(mocked.enableAuthProvider).toHaveBeenCalledWith('oidc');
    expect(mocked.getAuthProviders).toHaveBeenCalled();
    expect(result.enabled).toBe(true);
  });

  it('disableAuthProvider rethrows and sets authProvidersError on failure', async () => {
    mocked.disableAuthProvider.mockRejectedValue(new Error('busy'));

    await expect(
      useAdminStore.getState().disableAuthProvider('oidc')
    ).rejects.toThrow('busy');
    expect(useAdminStore.getState().authProvidersError).toBe('busy');
  });

  it('getAuthProviderConfigSchema delegates to the manager', async () => {
    mocked.getAuthProviderConfigSchema.mockResolvedValue({ type: 'object' });

    const schema = await useAdminStore
      .getState()
      .getAuthProviderConfigSchema('oidc');

    expect(mocked.getAuthProviderConfigSchema).toHaveBeenCalledWith('oidc');
    expect(schema).toEqual({ type: 'object' });
  });

  // ── Server settings (E10c) ──

  it('loadServerSettings populates settings and clears loading', async () => {
    const data = { settings: { a: 1 }, overridden: [], types: { a: 'number' } };
    mocked.getServerSettings.mockResolvedValue(data);

    await useAdminStore.getState().loadServerSettings();

    expect(useAdminStore.getState().serverSettings).toEqual(data);
    expect(useAdminStore.getState().serverSettingsLoading).toBe(false);
  });

  it('loadServerSettings sets serverSettingsError on failure without throwing', async () => {
    mocked.getServerSettings.mockRejectedValue(new Error('forbidden'));

    await useAdminStore.getState().loadServerSettings();

    expect(useAdminStore.getState().serverSettingsError).toBe('forbidden');
  });

  it('updateServerSettings stores the refreshed settings and returns them', async () => {
    const data = { settings: { a: 2 }, overridden: [], types: { a: 'number' } };
    mocked.updateServerSettings.mockResolvedValue(data);

    const result = await useAdminStore.getState().updateServerSettings({ a: 2 });

    expect(mocked.updateServerSettings).toHaveBeenCalledWith({ a: 2 });
    expect(useAdminStore.getState().serverSettings).toEqual(data);
    expect(result.settings.a).toBe(2);
  });

  it('updateServerSettings rethrows and sets serverSettingsError on failure', async () => {
    mocked.updateServerSettings.mockRejectedValue(new Error('unknown key'));

    await expect(
      useAdminStore.getState().updateServerSettings({ bogus: 1 })
    ).rejects.toThrow('unknown key');
    expect(useAdminStore.getState().serverSettingsError).toBe('unknown key');
  });

  // ── Backups (E10d) ──

  it('loadBackups populates the list and clears loading', async () => {
    const backups = [{ id: 'b1', created_at: 'x', label: 'a', size: 1 }];
    mocked.listBackups.mockResolvedValue(backups);

    await useAdminStore.getState().loadBackups();

    expect(useAdminStore.getState().backups).toEqual(backups);
    expect(useAdminStore.getState().backupsLoading).toBe(false);
  });

  it('loadBackups sets backupsError on failure without throwing', async () => {
    mocked.listBackups.mockRejectedValue(new Error('nope'));

    await useAdminStore.getState().loadBackups();

    expect(useAdminStore.getState().backupsError).toBe('nope');
  });

  it('loadBackupSchedule populates the schedule', async () => {
    const schedule = {
      auto_backup_interval_days: 7,
      retention_count: 5,
      next_scheduled_backup: null,
      next_scheduled_backup_iso: null,
    };
    mocked.getBackupSchedule.mockResolvedValue(schedule);

    await useAdminStore.getState().loadBackupSchedule();

    expect(useAdminStore.getState().backupSchedule).toEqual(schedule);
    expect(useAdminStore.getState().backupScheduleLoading).toBe(false);
  });

  it('createBackup reloads the list and returns the new backup', async () => {
    const newBackup = { id: 'b2', created_at: 'y', label: 'pre', size: 9 };
    mocked.createBackup.mockResolvedValue(newBackup);
    mocked.listBackups.mockResolvedValue([newBackup]);

    const result = await useAdminStore.getState().createBackup('pre');

    expect(mocked.createBackup).toHaveBeenCalledWith('pre');
    expect(mocked.listBackups).toHaveBeenCalled();
    expect(result).toEqual(newBackup);
  });

  it('createBackup rethrows and sets backupsError on failure', async () => {
    mocked.createBackup.mockRejectedValue(new Error('disk full'));

    await expect(useAdminStore.getState().createBackup()).rejects.toThrow(
      'disk full'
    );
    expect(useAdminStore.getState().backupsError).toBe('disk full');
  });

  it('deleteBackup removes the row on success', async () => {
    useAdminStore.setState({
      backups: [
        { id: 'b1', created_at: 'x', label: 'a', size: 1 },
        { id: 'b2', created_at: 'y', label: 'b', size: 2 },
      ],
    });
    mocked.deleteBackup.mockResolvedValue(undefined);

    await useAdminStore.getState().deleteBackup('b1');

    expect(useAdminStore.getState().backups.map((b) => b.id)).toEqual(['b2']);
  });

  it('deleteBackup rethrows and keeps the list on failure', async () => {
    useAdminStore.setState({
      backups: [{ id: 'b1', created_at: 'x', label: 'a', size: 1 }],
    });
    mocked.deleteBackup.mockRejectedValue(new Error('404'));

    await expect(useAdminStore.getState().deleteBackup('b1')).rejects.toThrow(
      '404'
    );
    expect(useAdminStore.getState().backups).toHaveLength(1);
    expect(useAdminStore.getState().backupsError).toBe('404');
  });

  it('restoreBackup rethrows and sets backupsError on failure (500)', async () => {
    mocked.restoreBackup.mockRejectedValue(new Error('restore failed'));

    await expect(useAdminStore.getState().restoreBackup('b1')).rejects.toThrow(
      'restore failed'
    );
    expect(useAdminStore.getState().backupsError).toBe('restore failed');
  });

  it('uploadBackupS3 rethrows and sets backupsError on failure (500)', async () => {
    mocked.uploadBackupS3.mockRejectedValue(new Error('s3 down'));

    await expect(useAdminStore.getState().uploadBackupS3('b1')).rejects.toThrow(
      's3 down'
    );
    expect(useAdminStore.getState().backupsError).toBe('s3 down');
  });

  it('updateBackupSchedule stores the refreshed schedule and returns it', async () => {
    const schedule = {
      auto_backup_interval_days: 3,
      retention_count: 10,
      next_scheduled_backup: null,
      next_scheduled_backup_iso: null,
    };
    mocked.updateBackupSchedule.mockResolvedValue(schedule);

    const result = await useAdminStore
      .getState()
      .updateBackupSchedule({ retention_count: 10 });

    expect(mocked.updateBackupSchedule).toHaveBeenCalledWith({
      retention_count: 10,
    });
    expect(useAdminStore.getState().backupSchedule).toEqual(schedule);
    expect(result.retention_count).toBe(10);
  });

  it('updateBackupSchedule rethrows and sets backupScheduleError on failure', async () => {
    mocked.updateBackupSchedule.mockRejectedValue(new Error('bad'));

    await expect(
      useAdminStore.getState().updateBackupSchedule({ retention_count: 0 })
    ).rejects.toThrow('bad');
    expect(useAdminStore.getState().backupScheduleError).toBe('bad');
  });

  // ── Logs (E10d) ──

  it('loadLogFiles populates the file list and clears loading', async () => {
    const files = [{ name: 'app.log', size: 1, modified_at: 'x' }];
    mocked.getLogFiles.mockResolvedValue(files);

    await useAdminStore.getState().loadLogFiles();

    expect(useAdminStore.getState().logFiles).toEqual(files);
    expect(useAdminStore.getState().logFilesLoading).toBe(false);
  });

  it('loadLogFiles sets logFilesError on failure without throwing', async () => {
    mocked.getLogFiles.mockRejectedValue(new Error('forbidden'));

    await useAdminStore.getState().loadLogFiles();

    expect(useAdminStore.getState().logFilesError).toBe('forbidden');
  });

  it('tailLog populates currentTail', async () => {
    const tail = { file: 'app.log', lines: ['a'], truncated: false };
    mocked.tailLog.mockResolvedValue(tail);

    await useAdminStore.getState().tailLog('app.log', 500);

    expect(mocked.tailLog).toHaveBeenCalledWith('app.log', 500);
    expect(useAdminStore.getState().currentTail).toEqual(tail);
    expect(useAdminStore.getState().tailLoading).toBe(false);
  });

  it('tailLog sets tailError on failure without throwing', async () => {
    mocked.tailLog.mockRejectedValue(new Error('no file'));

    await useAdminStore.getState().tailLog('missing.log');

    expect(useAdminStore.getState().tailError).toBe('no file');
  });

  it('tailAllLogs populates currentTail', async () => {
    const tail = { files: ['a.log'], lines: ['x'], truncated: true };
    mocked.tailAllLogs.mockResolvedValue(tail);

    await useAdminStore.getState().tailAllLogs(1000);

    expect(mocked.tailAllLogs).toHaveBeenCalledWith(1000);
    expect(useAdminStore.getState().currentTail).toEqual(tail);
  });

  // ── FS browse (E10d) ──

  it('browseFs populates the listing and clears loading', async () => {
    const listing = {
      path: '/media',
      parent: '/',
      entries: [{ name: 'movies', path: '/media/movies' }],
    };
    mocked.browseFs.mockResolvedValue(listing);

    await useAdminStore.getState().browseFs('/media');

    expect(mocked.browseFs).toHaveBeenCalledWith('/media');
    expect(useAdminStore.getState().fsListing).toEqual(listing);
    expect(useAdminStore.getState().fsLoading).toBe(false);
  });

  it('browseFs sets fsError on failure without throwing', async () => {
    mocked.browseFs.mockRejectedValue(new Error('traversal'));

    await useAdminStore.getState().browseFs('/etc');

    expect(useAdminStore.getState().fsError).toBe('traversal');
  });

  it('setFsPickedPath / clearFsPickedPath set and clear the hand-off', () => {
    useAdminStore.getState().setFsPickedPath('/media/movies');
    expect(useAdminStore.getState().fsPickedPath).toBe('/media/movies');

    useAdminStore.getState().clearFsPickedPath();
    expect(useAdminStore.getState().fsPickedPath).toBeNull();
  });
});

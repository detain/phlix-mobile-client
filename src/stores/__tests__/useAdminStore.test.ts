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
  });
};

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
});

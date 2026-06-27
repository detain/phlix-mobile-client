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
});

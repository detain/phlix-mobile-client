// src/api/__tests__/ProfileManager.test.ts
import { profileManager } from '../ProfileManager';
import apiClient from '../client';
import type { Profile } from '../../types/profile';

jest.mock('../client');

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const sampleProfile: Profile = {
  id: 'p1',
  user_id: 'u1',
  name: 'Kids',
  avatar_url: null,
  is_active: true,
  is_admin: false,
  created_at: '2026-06-27T00:00:00Z',
  updated_at: null,
  settings: {
    content_rating: 'PG',
    pin_required_for_admin: false,
    max_daily_watch_time: 120,
    allow_unrated: false,
  },
};

describe('ProfileManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listProfiles GETs /admin/users/{userId}/profiles and unwraps { profiles }', async () => {
    mockedClient.get.mockResolvedValue({ profiles: [sampleProfile] });

    const profiles = await profileManager.listProfiles('u1');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/users/u1/profiles');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('p1');
  });

  it('getProfile GETs /admin/profiles/{id} and unwraps { profile }', async () => {
    mockedClient.get.mockResolvedValue({ profile: sampleProfile });

    const profile = await profileManager.getProfile('p1');

    expect(mockedClient.get).toHaveBeenCalledWith('/admin/profiles/p1');
    expect(profile.name).toBe('Kids');
  });

  it('createProfile POSTs /admin/users/{userId}/profiles with body and unwraps { profile_id }', async () => {
    mockedClient.post.mockResolvedValue({ profile_id: 'p2', message: 'created' });

    const id = await profileManager.createProfile('u1', { name: 'Teen', rating: 2 });

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/users/u1/profiles', {
      name: 'Teen',
      rating: 2,
    });
    expect(id).toBe('p2');
  });

  it('updateProfile PUTs /admin/profiles/{id} with the partial body', async () => {
    mockedClient.put.mockResolvedValue({ message: 'ok' });

    await profileManager.updateProfile('p1', { name: 'Family', rating: 1 });

    expect(mockedClient.put).toHaveBeenCalledWith('/admin/profiles/p1', {
      name: 'Family',
      rating: 1,
    });
  });

  it('deleteProfile DELETEs /admin/profiles/{id}', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await profileManager.deleteProfile('p1');

    expect(mockedClient.delete).toHaveBeenCalledWith('/admin/profiles/p1');
  });

  it('setPin POSTs /admin/profiles/{id}/pin with { pin }', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok' });

    await profileManager.setPin('p1', '1234');

    expect(mockedClient.post).toHaveBeenCalledWith('/admin/profiles/p1/pin', {
      pin: '1234',
    });
  });

  it('clearPin DELETEs /admin/profiles/{id}/pin', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await profileManager.clearPin('p1');

    expect(mockedClient.delete).toHaveBeenCalledWith('/admin/profiles/p1/pin');
  });
});

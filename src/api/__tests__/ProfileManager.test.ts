/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/ProfileManager.test.ts
//
// M-MOBILE-07 repointed this manager from the admin-scoped
// `/admin/users/{userId}/profiles` lane to the server's SELF-SERVICE
// `/profiles` routes (identity = bearer token, no admin hat, no userId in any
// path). These pins are the law: the exact path + body each leg puts on the
// wire, and the named envelope key each leg unwraps.
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

describe('ProfileManager (self-service /profiles lane)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listProfiles GETs /profiles and unwraps { profiles }', async () => {
    mockedClient.get.mockResolvedValue({ profiles: [sampleProfile] });

    const profiles = await profileManager.listProfiles();

    expect(mockedClient.get).toHaveBeenCalledWith('/profiles');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('p1');
  });

  it('getProfile GETs /profiles/{id} and unwraps { profile }', async () => {
    mockedClient.get.mockResolvedValue({ profile: sampleProfile });

    const profile = await profileManager.getProfile('p1');

    expect(mockedClient.get).toHaveBeenCalledWith('/profiles/p1');
    expect(profile.name).toBe('Kids');
  });

  it('createProfile POSTs /profiles with the label-shaped body and unwraps { profile_id }', async () => {
    mockedClient.post.mockResolvedValue({ profile_id: 'p2', message: 'Profile created' });

    const id = await profileManager.createProfile({ name: 'Teen', content_rating: 'PG-13' });

    expect(mockedClient.post).toHaveBeenCalledWith('/profiles', {
      name: 'Teen',
      content_rating: 'PG-13',
    });
    expect(id).toBe('p2');
  });

  it('updateProfile PUTs /profiles/{id} with the partial body', async () => {
    mockedClient.put.mockResolvedValue({ message: 'Profile updated' });

    await profileManager.updateProfile('p1', { name: 'Family', content_rating: 'PG' });

    expect(mockedClient.put).toHaveBeenCalledWith('/profiles/p1', {
      name: 'Family',
      content_rating: 'PG',
    });
  });

  it('deleteProfile DELETEs /profiles/{id}', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await profileManager.deleteProfile('p1');

    expect(mockedClient.delete).toHaveBeenCalledWith('/profiles/p1');
  });

  it('setPin POSTs /profiles/{id}/pin with { pin }', async () => {
    mockedClient.post.mockResolvedValue({ message: 'ok' });

    await profileManager.setPin('p1', '1234');

    expect(mockedClient.post).toHaveBeenCalledWith('/profiles/p1/pin', {
      pin: '1234',
    });
  });

  it('clearPin DELETEs /profiles/{id}/pin', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await profileManager.clearPin('p1');

    expect(mockedClient.delete).toHaveBeenCalledWith('/profiles/p1/pin');
  });

  it('never puts an admin path or a userId segment on the wire', async () => {
    // The M-MOBILE-07 law: this manager is the SELF-SERVICE lane. A regression
    // back to `/admin/...` (or a `{userId}` path) re-gates family management
    // behind the server-admin hat, so the shape is pinned across every leg.
    mockedClient.get.mockResolvedValue({ profiles: [] });
    mockedClient.post.mockResolvedValue({ profile_id: 'x', message: 'ok' });
    mockedClient.put.mockResolvedValue({ message: 'ok' });
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await profileManager.listProfiles();
    await profileManager.getProfile('p1');
    await profileManager.createProfile({ name: 'Kid' });
    await profileManager.updateProfile('p1', { name: 'Kid 2' });
    await profileManager.deleteProfile('p1');
    await profileManager.setPin('p1', '1234');
    await profileManager.clearPin('p1');

    const urls: string[] = [
      ...mockedClient.get.mock.calls.map((call) => String(call[0])),
      ...mockedClient.post.mock.calls.map((call) => String(call[0])),
      ...mockedClient.put.mock.calls.map((call) => String(call[0])),
      ...mockedClient.delete.mock.calls.map((call) => String(call[0])),
    ];
    expect(urls).toHaveLength(7);
    for (const url of urls) {
      expect(url).not.toMatch(/^\/admin\//);
      expect(url).not.toMatch(/\/users\//);
    }
  });
});

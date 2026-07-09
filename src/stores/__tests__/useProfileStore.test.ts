/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useProfileStore.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '../useProfileStore';
import { profileManager } from '../../api/ProfileManager';
import type { Profile } from '../../types/profile';

jest.mock('../../api/ProfileManager', () => ({
  profileManager: {
    listProfiles: jest.fn(),
    getProfile: jest.fn(),
    createProfile: jest.fn(),
    updateProfile: jest.fn(),
    deleteProfile: jest.fn(),
    setPin: jest.fn(),
    clearPin: jest.fn(),
  },
}));

const mockedManager = profileManager as jest.Mocked<typeof profileManager>;

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: 'p1',
  user_id: 'u1',
  name: 'Primary',
  avatar_url: null,
  is_active: true,
  is_admin: true,
  created_at: null,
  updated_at: null,
  ...overrides,
});

const resetStore = () => {
  useProfileStore.setState({
    profiles: [],
    activeProfile: null,
    activeProfileId: null,
    isLoading: false,
    error: null,
  });
};

describe('useProfileStore', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    resetStore();
  });

  it('loadProfiles populates profiles and clears loading', async () => {
    const profiles = [makeProfile(), makeProfile({ id: 'p2', name: 'Kids' })];
    mockedManager.listProfiles.mockResolvedValue(profiles);

    await useProfileStore.getState().loadProfiles('u1');

    const state = useProfileStore.getState();
    expect(mockedManager.listProfiles).toHaveBeenCalledWith('u1');
    expect(state.profiles).toHaveLength(2);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('loadProfiles sets error on failure without throwing', async () => {
    mockedManager.listProfiles.mockRejectedValue(new Error('forbidden'));

    await useProfileStore.getState().loadProfiles('u1');

    const state = useProfileStore.getState();
    expect(state.error).toBe('forbidden');
    expect(state.isLoading).toBe(false);
  });

  it('loadProfiles rehydrates the active profile from a persisted id', async () => {
    await AsyncStorage.setItem('phlix_active_profile_id', 'p2');
    const profiles = [makeProfile(), makeProfile({ id: 'p2', name: 'Kids' })];
    mockedManager.listProfiles.mockResolvedValue(profiles);

    await useProfileStore.getState().loadProfiles('u1');

    expect(useProfileStore.getState().activeProfile?.id).toBe('p2');
  });

  it('selectProfile sets the active profile and persists its id', async () => {
    const profile = makeProfile({ id: 'p3' });

    useProfileStore.getState().selectProfile(profile);

    expect(useProfileStore.getState().activeProfile?.id).toBe('p3');
    expect(useProfileStore.getState().activeProfileId).toBe('p3');
    await Promise.resolve();
    expect(await AsyncStorage.getItem('phlix_active_profile_id')).toBe('p3');
  });

  it('clearActiveProfile resets state and removes the persisted id', async () => {
    useProfileStore.getState().selectProfile(makeProfile());

    useProfileStore.getState().clearActiveProfile();

    expect(useProfileStore.getState().activeProfile).toBeNull();
    expect(useProfileStore.getState().activeProfileId).toBeNull();
  });

  it('createProfile delegates to the manager then reloads', async () => {
    mockedManager.createProfile.mockResolvedValue('p9');
    mockedManager.listProfiles.mockResolvedValue([makeProfile({ id: 'p9' })]);

    await useProfileStore.getState().createProfile('u1', { name: 'New', rating: 1 });

    expect(mockedManager.createProfile).toHaveBeenCalledWith('u1', {
      name: 'New',
      rating: 1,
    });
    expect(mockedManager.listProfiles).toHaveBeenCalledWith('u1');
    expect(useProfileStore.getState().profiles[0].id).toBe('p9');
  });

  it('updateProfile replaces the edited profile in the list', async () => {
    useProfileStore.setState({ profiles: [makeProfile({ id: 'p1', name: 'Old' })] });
    mockedManager.updateProfile.mockResolvedValue(undefined);
    mockedManager.getProfile.mockResolvedValue(makeProfile({ id: 'p1', name: 'New' }));

    await useProfileStore.getState().updateProfile('p1', { name: 'New' });

    expect(useProfileStore.getState().profiles[0].name).toBe('New');
  });

  it('deleteProfile removes the profile and clears it if active', async () => {
    const profile = makeProfile({ id: 'p1' });
    useProfileStore.setState({ profiles: [profile] });
    useProfileStore.getState().selectProfile(profile);
    mockedManager.deleteProfile.mockResolvedValue(undefined);

    await useProfileStore.getState().deleteProfile('p1');

    const state = useProfileStore.getState();
    expect(state.profiles).toHaveLength(0);
    expect(state.activeProfile).toBeNull();
  });

  it('setPin and clearPin delegate to the manager', async () => {
    mockedManager.setPin.mockResolvedValue(undefined);
    mockedManager.clearPin.mockResolvedValue(undefined);

    await useProfileStore.getState().setPin('p1', '123456');
    await useProfileStore.getState().clearPin('p1');

    expect(mockedManager.setPin).toHaveBeenCalledWith('p1', '123456');
    expect(mockedManager.clearPin).toHaveBeenCalledWith('p1');
  });

  it('createProfile rethrows and sets error on failure', async () => {
    mockedManager.createProfile.mockRejectedValue(new Error('limit reached'));

    await expect(
      useProfileStore.getState().createProfile('u1', { name: 'X' })
    ).rejects.toThrow('limit reached');
    expect(useProfileStore.getState().error).toBe('limit reached');
  });
});

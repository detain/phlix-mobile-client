/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/stores/__tests__/useWebAuthnStore.test.ts
import { useWebAuthnStore } from '../useWebAuthnStore';
import { webAuthnService } from '../../services/WebAuthnService';
import type { PasskeyCredential } from '../../types/webauthn';

jest.mock('../../services/WebAuthnService', () => ({
  __esModule: true,
  webAuthnService: {
    listPasskeys: jest.fn(),
    registerPasskey: jest.fn(),
    deletePasskey: jest.fn(),
  },
}));

const mockedService = webAuthnService as jest.Mocked<typeof webAuthnService>;

const credA: PasskeyCredential = {
  id: 'a',
  created_at: '2026-06-01T00:00:00Z',
  last_used_at: null,
  name: 'A',
};
const credB: PasskeyCredential = {
  id: 'b',
  created_at: '2026-06-02T00:00:00Z',
  last_used_at: '2026-06-10T00:00:00Z',
  name: 'B',
};

describe('useWebAuthnStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWebAuthnStore.getState().reset();
  });

  it('loadCredentials populates the list and clears loading', async () => {
    mockedService.listPasskeys.mockResolvedValue([credA, credB]);
    await useWebAuthnStore.getState().loadCredentials();
    const state = useWebAuthnStore.getState();
    expect(state.credentials).toEqual([credA, credB]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('loadCredentials swallows errors into error (does not throw)', async () => {
    mockedService.listPasskeys.mockRejectedValue(new Error('boom'));
    await expect(
      useWebAuthnStore.getState().loadCredentials()
    ).resolves.toBeUndefined();
    const state = useWebAuthnStore.getState();
    expect(state.error).toBe('boom');
    expect(state.loading).toBe(false);
  });

  it('registerPasskey reloads the list on success and returns the result', async () => {
    mockedService.registerPasskey.mockResolvedValue({
      credential_id: 'a',
      message: 'ok',
    });
    mockedService.listPasskeys.mockResolvedValue([credA]);
    const result = await useWebAuthnStore.getState().registerPasskey('A');
    expect(mockedService.registerPasskey).toHaveBeenCalledWith('A');
    expect(result).toEqual({ credential_id: 'a', message: 'ok' });
    expect(useWebAuthnStore.getState().credentials).toEqual([credA]);
  });

  it('registerPasskey sets error AND rethrows on failure', async () => {
    mockedService.registerPasskey.mockRejectedValue(new Error('cancelled'));
    await expect(
      useWebAuthnStore.getState().registerPasskey()
    ).rejects.toThrow('cancelled');
    expect(useWebAuthnStore.getState().error).toBe('cancelled');
  });

  it('deletePasskey filters the row out of the list on success', async () => {
    useWebAuthnStore.setState({ credentials: [credA, credB] });
    mockedService.deletePasskey.mockResolvedValue(undefined);
    await useWebAuthnStore.getState().deletePasskey('a');
    expect(mockedService.deletePasskey).toHaveBeenCalledWith('a');
    expect(useWebAuthnStore.getState().credentials).toEqual([credB]);
  });

  it('deletePasskey sets error AND rethrows on failure (list unchanged)', async () => {
    useWebAuthnStore.setState({ credentials: [credA, credB] });
    mockedService.deletePasskey.mockRejectedValue(new Error('nope'));
    await expect(
      useWebAuthnStore.getState().deletePasskey('a')
    ).rejects.toThrow('nope');
    expect(useWebAuthnStore.getState().error).toBe('nope');
    expect(useWebAuthnStore.getState().credentials).toEqual([credA, credB]);
  });
});

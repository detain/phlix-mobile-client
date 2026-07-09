/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/__tests__/WebAuthnService.test.ts
import { webAuthnService } from '../WebAuthnService';
import { webAuthnManager } from '../../api/WebAuthnManager';
import { authManager } from '../../api/AuthManager';
import { useAuthStore } from '../../stores/useAuthStore';
import * as PhlixWebAuthn from '../../native/PhlixWebAuthn';

jest.mock('../../api/WebAuthnManager', () => ({
  __esModule: true,
  webAuthnManager: {
    registerOptions: jest.fn(),
    registerVerify: jest.fn(),
    loginOptions: jest.fn(),
    loginVerify: jest.fn(),
    getCredentials: jest.fn(),
    deleteCredential: jest.fn(),
  },
}));

jest.mock('../../api/AuthManager', () => ({
  __esModule: true,
  authManager: {
    savePasskeyLogin: jest.fn(),
  },
}));

jest.mock('../../native/PhlixWebAuthn', () => ({
  __esModule: true,
  isSupported: jest.fn(),
  register: jest.fn(),
  authenticate: jest.fn(),
}));

const mockedManager = webAuthnManager as jest.Mocked<typeof webAuthnManager>;
const mockedAuth = authManager as jest.Mocked<typeof authManager>;
const mockedNative = PhlixWebAuthn as jest.Mocked<typeof PhlixWebAuthn>;

describe('WebAuthnService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    });
  });

  it('isSupported delegates to the native wrapper', async () => {
    mockedNative.isSupported.mockResolvedValue(true);
    await expect(webAuthnService.isSupported()).resolves.toBe(true);
  });

  it('registerPasskey runs options -> native.register -> verify in order', async () => {
    const options = { challenge: 'CHAL', rp: { id: 'phlix.app' } };
    const order: string[] = [];
    mockedManager.registerOptions.mockImplementation(async () => {
      order.push('options');
      return options as never;
    });
    mockedNative.register.mockImplementation(async () => {
      order.push('native');
      return JSON.stringify({ id: 'x', type: 'public-key' });
    });
    mockedManager.registerVerify.mockImplementation(async () => {
      order.push('verify');
      return { credential_id: 'x', message: 'ok' };
    });

    const result = await webAuthnService.registerPasskey('alice');

    expect(order).toEqual(['options', 'native', 'verify']);
    expect(mockedManager.registerOptions).toHaveBeenCalledWith('alice');
    expect(mockedNative.register).toHaveBeenCalledWith(JSON.stringify(options));
    // The original challenge is echoed through to verify with the parsed credential.
    expect(mockedManager.registerVerify).toHaveBeenCalledWith(
      { id: 'x', type: 'public-key' },
      'CHAL'
    );
    expect(result).toEqual({ credential_id: 'x', message: 'ok' });
  });

  it('loginWithPasskey runs the assertion ceremony and stores tokens + sets auth store', async () => {
    const options = {
      challenge: 'REQCHAL',
      rpId: 'phlix.app',
      allowCredentials: [],
    };
    const user = { id: 'u1', username: 'alice' };
    const order: string[] = [];

    mockedManager.loginOptions.mockImplementation(async () => {
      order.push('options');
      return options as never;
    });
    mockedNative.authenticate.mockImplementation(async () => {
      order.push('native');
      return JSON.stringify({ id: 'assert', type: 'public-key' });
    });
    mockedManager.loginVerify.mockImplementation(async () => {
      order.push('verify');
      return { access_token: 'A', refresh_token: 'R', user };
    });
    mockedAuth.savePasskeyLogin.mockImplementation(async () => {
      order.push('save');
      return user;
    });

    await webAuthnService.loginWithPasskey('alice');

    expect(order).toEqual(['options', 'native', 'verify', 'save']);
    expect(mockedManager.loginOptions).toHaveBeenCalledWith('alice');
    expect(mockedNative.authenticate).toHaveBeenCalledWith(JSON.stringify(options));
    expect(mockedManager.loginVerify).toHaveBeenCalledWith(
      'alice',
      { id: 'assert', type: 'public-key' },
      'REQCHAL'
    );
    expect(mockedAuth.savePasskeyLogin).toHaveBeenCalledWith({
      access_token: 'A',
      refresh_token: 'R',
      user,
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.isLoading).toBe(false);
  });

  it('loginWithPasskey rejects (and does not auth) when the ceremony fails', async () => {
    mockedManager.loginOptions.mockResolvedValue({
      challenge: 'X',
      rpId: 'phlix.app',
    } as never);
    mockedNative.authenticate.mockRejectedValue(new Error('cancelled'));

    await expect(webAuthnService.loginWithPasskey('alice')).rejects.toThrow(
      'cancelled'
    );
    expect(mockedManager.loginVerify).not.toHaveBeenCalled();
    expect(mockedAuth.savePasskeyLogin).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('listPasskeys / deletePasskey proxy the manager', async () => {
    mockedManager.getCredentials.mockResolvedValue([]);
    await webAuthnService.listPasskeys();
    expect(mockedManager.getCredentials).toHaveBeenCalled();

    mockedManager.deleteCredential.mockResolvedValue(undefined);
    await webAuthnService.deletePasskey('cred-1');
    expect(mockedManager.deleteCredential).toHaveBeenCalledWith('cred-1');
  });
});

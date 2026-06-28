// src/api/__tests__/WebAuthnManager.test.ts
import { webAuthnManager } from '../WebAuthnManager';
import apiClient from '../client';
import type {
  CreationOptions,
  RequestOptions,
  RegistrationResult,
  AuthResult,
  PasskeyCredential,
} from '../../types/webauthn';

jest.mock('../client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const sampleCreationOptions: CreationOptions = {
  challenge: 'Y2hhbGxlbmdl',
  rp: { id: 'phlix.app', name: 'Phlix' },
  user: { id: 'dXNlcg', name: 'alice' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
};

const sampleRequestOptions: RequestOptions = {
  challenge: 'cmVxLWNoYWxsZW5nZQ',
  rpId: 'phlix.app',
  allowCredentials: [{ type: 'public-key', id: 'Y3JlZA' }],
  userVerification: 'preferred',
};

const sampleCredential: PasskeyCredential = {
  id: 'cred-1',
  created_at: '2026-06-27T00:00:00Z',
  last_used_at: null,
  name: "Alice's iPhone",
};

describe('WebAuthnManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registerOptions POSTs /auth/webauthn/register/options with {username} and returns raw options', async () => {
    mockedClient.post.mockResolvedValue(sampleCreationOptions);
    const result = await webAuthnManager.registerOptions('alice');
    expect(mockedClient.post).toHaveBeenCalledWith(
      '/auth/webauthn/register/options',
      { username: 'alice' }
    );
    expect(result).toEqual(sampleCreationOptions);
  });

  it('registerOptions sends an empty body when no username given', async () => {
    mockedClient.post.mockResolvedValue(sampleCreationOptions);
    await webAuthnManager.registerOptions();
    expect(mockedClient.post).toHaveBeenCalledWith(
      '/auth/webauthn/register/options',
      {}
    );
  });

  it('registerVerify POSTs /auth/webauthn/register/verify with {credential, challenge}', async () => {
    const expected: RegistrationResult = {
      credential_id: 'cred-1',
      message: 'ok',
    };
    mockedClient.post.mockResolvedValue(expected);
    const credential = { id: 'abc', type: 'public-key' };
    const result = await webAuthnManager.registerVerify(credential, 'CHAL');
    expect(mockedClient.post).toHaveBeenCalledWith(
      '/auth/webauthn/register/verify',
      { credential, challenge: 'CHAL' }
    );
    expect(result).toEqual(expected);
  });

  it('loginOptions POSTs /auth/webauthn/login/options with {username} and returns raw options', async () => {
    mockedClient.post.mockResolvedValue(sampleRequestOptions);
    const result = await webAuthnManager.loginOptions('alice');
    expect(mockedClient.post).toHaveBeenCalledWith(
      '/auth/webauthn/login/options',
      { username: 'alice' }
    );
    expect(result).toEqual(sampleRequestOptions);
  });

  it('loginVerify POSTs /auth/webauthn/login/verify with {username, credential, challenge} and returns the token envelope', async () => {
    const expected: AuthResult = {
      access_token: 'access',
      refresh_token: 'refresh',
      user: { id: 'u1', username: 'alice' },
    };
    mockedClient.post.mockResolvedValue(expected);
    const credential = { id: 'abc', type: 'public-key' };
    const result = await webAuthnManager.loginVerify('alice', credential, 'CHAL');
    expect(mockedClient.post).toHaveBeenCalledWith(
      '/auth/webauthn/login/verify',
      { username: 'alice', credential, challenge: 'CHAL' }
    );
    expect(result).toEqual(expected);
    expect(result.access_token).toBe('access');
    expect(result.refresh_token).toBe('refresh');
  });

  it('getCredentials GETs /me/webauthn/credentials and unwraps .credentials', async () => {
    mockedClient.get.mockResolvedValue({ credentials: [sampleCredential] });
    const result = await webAuthnManager.getCredentials();
    expect(mockedClient.get).toHaveBeenCalledWith('/me/webauthn/credentials');
    expect(result).toEqual([sampleCredential]);
  });

  it('deleteCredential DELETEs /me/webauthn/credentials/{id} (id encoded) and resolves void', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'deleted' });
    const result = await webAuthnManager.deleteCredential('a/b id');
    expect(mockedClient.delete).toHaveBeenCalledWith(
      '/me/webauthn/credentials/a%2Fb%20id'
    );
    expect(result).toBeUndefined();
  });
});

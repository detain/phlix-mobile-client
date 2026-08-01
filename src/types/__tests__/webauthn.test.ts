/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/webauthn.test.ts
//
// `webauthn.ts` declares WebAuthn / passkeys domain types. The server's
// PublicKeyCredentialCreationOptions / PublicKeyCredentialRequestOptions
// binary fields are base64url strings in JSON. These are compile-time shape
// assertions.
import type {
  PasskeyCredential,
  PublicKeyRp,
  PublicKeyUser,
  CreationOptions,
  RequestOptions,
  RegistrationResult,
  AuthResult,
} from '../webauthn';

describe('webauthn types', () => {
  describe('PasskeyCredential', () => {
    it('matches the credential shape from GET /me/webauthn/credentials', () => {
      const cred: PasskeyCredential = {
        id: 'credential-id-123',
        created_at: '2026-01-15T10:30:00Z',
        last_used_at: '2026-06-01T14:22:00Z',
        name: 'MacBook Pro',
      };
      expect(cred.id).toBe('credential-id-123');
      expect(cred.name).toBe('MacBook Pro');
    });

    it('allows null last_used_at for never-used credentials', () => {
      const cred: PasskeyCredential = {
        id: 'new-credential',
        created_at: '2026-06-01T00:00:00Z',
        last_used_at: null,
        name: 'New iPhone',
      };
      expect(cred.last_used_at).toBeNull();
    });

    it('allows empty name', () => {
      const cred: PasskeyCredential = {
        id: 'cred-456',
        created_at: '2026-01-01T00:00:00Z',
        last_used_at: null,
        name: '',
      };
      expect(cred.name).toBe('');
    });
  });

  describe('PublicKeyRp', () => {
    it('matches the RP shape with id and name', () => {
      const rp: PublicKeyRp = {
        id: 'phlix.app',
        name: 'Phlix',
      };
      expect(rp.id).toBe('phlix.app');
    });

    it('supports index signature for loose typing', () => {
      const rp: PublicKeyRp = {
        id: 'phlix.app',
        name: 'Phlix',
        icon: 'https://example.com/icon.png',
      };
      // Index signature allows additional properties
      expect((rp as Record<string, unknown>).icon).toBe('https://example.com/icon.png');
    });
  });

  describe('PublicKeyUser', () => {
    it('matches the user shape with base64url id', () => {
      const user: PublicKeyUser = {
        id: 'dXNlcmlkMTIz', // base64url encoded
        name: 'user@example.com',
        displayName: 'User Name',
      };
      expect(user.name).toBe('user@example.com');
      expect(user.displayName).toBe('User Name');
    });

    it('supports index signature for loose typing', () => {
      const user: PublicKeyUser = {
        id: 'abc123',
        icon: 'https://example.com/user.png',
      };
      expect((user as Record<string, unknown>).icon).toBe('https://example.com/user.png');
    });
  });

  describe('CreationOptions', () => {
    it('matches the creation options shape', () => {
      const opts: CreationOptions = {
        challenge: 'random-challenge-base64url',
        rp: { id: 'phlix.app', name: 'Phlix' },
        user: { id: 'dXNlcmlk', name: 'user', displayName: 'User' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
        attestation: 'none',
        excludeCredentials: [],
      };
      expect(opts.rp?.id).toBe('phlix.app');
      expect(opts.timeout).toBe(60000);
    });

    it('supports all pubKeyCredParams algorithms', () => {
      const opts: CreationOptions = {
        challenge: 'challenge',
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          requireResidentKey: true,
          userVerification: 'preferred',
        },
      };
      expect(opts.pubKeyCredParams).toHaveLength(2);
    });

    it('supports index signature for loose typing', () => {
      const opts: CreationOptions = {
        challenge: 'challenge',
        extensions: { appid: 'https://phlix.app' },
      };
      expect((opts as Record<string, unknown>).extensions).toBeDefined();
    });
  });

  describe('RequestOptions', () => {
    it('matches the request options shape', () => {
      const opts: RequestOptions = {
        challenge: 'random-challenge-base64url',
        timeout: 30000,
        rpId: 'phlix.app',
        allowCredentials: [],
        userVerification: 'preferred',
      };
      expect(opts.rpId).toBe('phlix.app');
      expect(opts.timeout).toBe(30000);
    });

    it('allows allowCredentials with id as base64url', () => {
      const creds = [
        { id: 'credential-id-base64url', type: 'public-key', transports: ['usb', 'nfc'] as string[] },
      ];
      const opts: RequestOptions = {
        challenge: 'challenge',
        timeout: 30000,
        rpId: 'phlix.app',
        allowCredentials: creds,
        userVerification: 'required',
      };
      expect(opts.allowCredentials).toHaveLength(1);
      expect(opts.allowCredentials?.[0].id).toBe('credential-id-base64url');
      expect(opts.allowCredentials?.[0].transports).toContain('usb');
    });

    it('supports index signature for loose typing', () => {
      const opts: RequestOptions = {
        challenge: 'challenge',
        appid: 'https://phlix.app',
      };
      expect((opts as Record<string, unknown>).appid).toBe('https://phlix.app');
    });
  });

  describe('RegistrationResult', () => {
    it('matches the registration result shape', () => {
      const result: RegistrationResult = {
        credential_id: 'cred-123',
        message: 'Passkey registered successfully',
      };
      expect(result.credential_id).toBe('cred-123');
      expect(result.message).toBe('Passkey registered successfully');
    });
  });

  describe('AuthResult', () => {
    it('matches the auth result shape with tokens', () => {
      // AuthResult includes a User type from AuthManager - we just verify shape here
      const result: AuthResult = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'refresh-token-abc123',
        // User is imported from AuthManager
        user: {
          id: 'u1',
          username: 'testuser',
          email: 'test@example.com',
        } as AuthResult['user'],
      };
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.user.username).toBe('testuser');
    });
  });
});

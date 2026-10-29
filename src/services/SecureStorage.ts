/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/services/SecureStorage.ts
/**
 * Token vault: the ONLY sanctioned home for auth JWTs, server AND hub.
 *
 * Historically this module was dead code and every token read/write went
 * straight to AsyncStorage — plaintext in the app sandbox (audit M1). Both
 * the access and refresh JWTs now live in the OS keychain via
 * `react-native-keychain` (installed, previously unused), and the call sites
 * (`api/client.ts`, `api/AuthManager.ts`, `api/SyncPlayManager.ts`,
 * `syncplay/wsEndpoint.ts`) go through this module. The hub lane was the
 * hole that stayed open after M1 (review mobile__crossfe M2):
 * `store/hubStore.ts` serialized the whole hub session — both JWTs included
 * — into one plaintext AsyncStorage blob. It now routes them through the
 * hub slots below (`storeHubTokens`/`getHubAccessToken`/
 * `getHubRefreshToken`/`clearHubTokens`); only non-secret session metadata
 * stays in the blob. A third piece of state joins the vault with review
 * mobile__exploiter M2: the MINTED HOST of the server pair — configuration,
 * not a credential, but integrity metadata whose lifecycle must be welded to
 * the tokens' (the direct SyncPlay lane refuses to dial any host but that
 * one, and an orphaned pin is as misleading as an orphaned token).
 *
 * Migration: sessions created before the vault put `access_token` /
 * `refresh_token` in AsyncStorage. The first read of each slot in a process
 * moves any legacy value: read → secure-write → delete-plaintext. The delete
 * only happens AFTER the secure write settled, and a failed secure write
 * leaves the plaintext copy in place for the next attempt — an existing
 * session is never orphaned. New writes also sweep the legacy keys so a stale
 * plaintext copy can never resurrect over a fresh login.
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hostOf } from '../utils/serverHost';

const SERVICE_NAME = 'com.phlix.mobile';
const ACCESS_SERVICE = `${SERVICE_NAME}.access`;
const REFRESH_SERVICE = `${SERVICE_NAME}.refresh`;
const HUB_ACCESS_SERVICE = `${SERVICE_NAME}.hub.access`;
const HUB_REFRESH_SERVICE = `${SERVICE_NAME}.hub.refresh`;
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
/**
 * Which host minted the currently-stored server pair (review
 * mobile__exploiter M2). NOT a secret — a hostname is configuration the user
 * typed or the hub announced, already sitting plaintext in settings — but it
 * is vault INTEGRITY metadata, so its lifecycle is welded to the pair's:
 * written by every `storeTokens`, wiped by every `clearTokens`, never
 * surviving without the tokens it authenticates.
 */
const ISSUED_HOST_KEY = 'phlix.access_issued_host';
/** Keychain username half — the password half is the credential itself. */
const TOKEN_USERNAME = 'phlix';

async function readSlot(service: string): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service });
  return credentials ? credentials.password : null;
}

async function writeSlot(service: string, secret: string): Promise<void> {
  await Keychain.setGenericPassword(TOKEN_USERNAME, secret, { service });
}

/**
 * Move one legacy AsyncStorage token into its keychain slot, then delete the
 * plaintext. Order matters (never orphan): the secure write is awaited before
 * the removal, and a throwing secure write propagates WITHOUT touching the
 * legacy copy so a later read retries the migration.
 */
async function migrateSlot(service: string, legacyKey: string): Promise<void> {
  const legacy = await AsyncStorage.getItem(legacyKey);
  if (legacy === null) {
    return; // nothing (left) to migrate
  }
  const current = await readSlot(service);
  if (current === null) {
    await writeSlot(service, legacy);
  }
  // The secure side is settled (pre-existing vault value or fresh write) —
  // the plaintext copy is redundant either way.
  await AsyncStorage.removeItem(legacyKey);
}

/** One-shot per process; reset on failure so the next read retries. */
let migrationPromise: Promise<void> | null = null;

function migratedOnce(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = Promise.all([
      migrateSlot(ACCESS_SERVICE, ACCESS_TOKEN_KEY),
      migrateSlot(REFRESH_SERVICE, REFRESH_TOKEN_KEY),
    ]).then(
      () => undefined,
      (error: unknown) => {
        migrationPromise = null; // allow a retry on the next read
        throw error;
      }
    );
  }
  return migrationPromise;
}

class SecureStorage {
  /**
   * Persist a fresh token pair AND the host that minted it. The vault is the
   * only store: the legacy AsyncStorage keys are swept so a later first-read
   * cannot resurrect an older plaintext session over these values.
   *
   * `issuedHost` is REQUIRED (fail fast): a token stored without its origin
   * is a token the SyncPlay direct lane must refuse to carry anywhere, and
   * the refusal is only honest if the pin was written at issuance. The value
   * is normalized through the shared `hostOf` parser, so callers may hand the
   * minting base URL itself and the vault stores the canonical host.
   */
  async storeTokens(accessToken: string, refreshToken: string, issuedHost: string): Promise<void> {
    const pinnedHost = typeof issuedHost === 'string' ? hostOf(issuedHost) : '';
    if (pinnedHost === '') {
      throw new Error(
        'SecureStorage: storeTokens requires the minting host of the token pair'
      );
    }
    await AsyncStorage.setItem(ISSUED_HOST_KEY, pinnedHost);
    await writeSlot(ACCESS_SERVICE, accessToken);
    await writeSlot(REFRESH_SERVICE, refreshToken);
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  }

  /**
   * The host the stored pair was minted for — the anchor the direct SyncPlay
   * dial is checked against — or null for a pre-pin (migrated) session, in
   * which case consumers must FAIL CLOSED. A successful re-issuance (login,
   * register, passkey, or the REST refresh leg) re-pins the pair.
   */
  async getIssuedHost(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(ISSUED_HOST_KEY);
    } catch {
      return null;
    }
  }

  /** The access JWT, or null (migrating a pre-vault session on first read). */
  async getAccessToken(): Promise<string | null> {
    try {
      await migratedOnce();
    } catch (error) {
      console.error('SecureStorage: token migration failed', error);
    }
    try {
      return await readSlot(ACCESS_SERVICE);
    } catch {
      return null;
    }
  }

  /** The refresh JWT, or null (same migration guarantee as getAccessToken). */
  async getRefreshToken(): Promise<string | null> {
    try {
      await migratedOnce();
    } catch (error) {
      console.error('SecureStorage: token migration failed', error);
    }
    try {
      return await readSlot(REFRESH_SERVICE);
    } catch {
      return null;
    }
  }

  /** Wipe every token trace: both vault slots, the minted-host pin, and both legacy keys. */
  async clearTokens(): Promise<void> {
    await Keychain.resetGenericPassword({ service: ACCESS_SERVICE });
    await Keychain.resetGenericPassword({ service: REFRESH_SERVICE });
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, ISSUED_HOST_KEY]);
    // A pending (or failed-and-cached) migration must not move values the
    // user just revoked; arm a fresh pass over the now-empty legacy keys.
    migrationPromise = null;
  }

  // ── Hub session vault slots (review mobile__crossfe M2) ──────────────────
  //
  // The hub sign-in mints its OWN access+refresh JWT pair (HubSession),
  // distinct credentials from the server pair above — separate service slots
  // keep them separate (signing out of the hub must never wipe a server
  // session, and vice versa). Pre-vault hub sessions kept the pair inside
  // the `phlix_hub_session` AsyncStorage blob, so the legacy sweep for this
  // lane is blob-level and lives in `store/hubStore.ts` (loadPersistedState),
  // not behind the bare-key `migratedOnce` latch above.

  /** Persist a fresh hub JWT pair into the hub vault slots. */
  async storeHubTokens(accessToken: string, refreshToken: string): Promise<void> {
    await writeSlot(HUB_ACCESS_SERVICE, accessToken);
    await writeSlot(HUB_REFRESH_SERVICE, refreshToken);
  }

  /** The hub access JWT, or null when the vault slot is empty/unreadable. */
  async getHubAccessToken(): Promise<string | null> {
    try {
      return await readSlot(HUB_ACCESS_SERVICE);
    } catch {
      return null;
    }
  }

  /** The hub refresh JWT, or null when the vault slot is empty/unreadable. */
  async getHubRefreshToken(): Promise<string | null> {
    try {
      return await readSlot(HUB_REFRESH_SERVICE);
    } catch {
      return null;
    }
  }

  /** Wipe the hub slots only — the server vault and blob keys stay untouched. */
  async clearHubTokens(): Promise<void> {
    await Keychain.resetGenericPassword({ service: HUB_ACCESS_SERVICE });
    await Keychain.resetGenericPassword({ service: HUB_REFRESH_SERVICE });
  }

  // ── Biometric gate (unchanged surface) ───────────────────────────────────

  async enableBiometric(): Promise<boolean> {
    try {
      const result = await Keychain.setGenericPassword(
        'biometric_enabled',
        'true',
        {
          service: `${SERVICE_NAME}.biometric`,
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
          accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        }
      );
      return !!result;
    } catch {
      return false;
    }
  }

  async isBiometricEnabled(): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: `${SERVICE_NAME}.biometric`,
      });
      return !!credentials;
    } catch {
      return false;
    }
  }

  async authenticateWithBiometric(): Promise<boolean> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: REFRESH_SERVICE,
        authenticationPrompt: {
          title: 'Authenticate to access Phlix',
          subtitle: 'Use biometric authentication',
          cancel: 'Cancel',
        },
      });
      return !!credentials;
    } catch {
      return false;
    }
  }

  /** Test seam: clear the once-per-process migration latch between cases. */
  __resetMigrationLatchForTests(): void {
    migrationPromise = null;
  }
}

export const secureStorage = new SecureStorage();
export default secureStorage;

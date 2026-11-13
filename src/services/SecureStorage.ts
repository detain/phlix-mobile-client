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
/**
 * The RAW minting base URL of the currently-stored server pair (MW-108,
 * review mobile__secnet #2). ISSUED_HOST_KEY keeps the canonical HOSTNAME,
 * which is lossy for calling BACK at the minting origin: the logout revoke
 * leg must land where the pair was minted even after the user moved the
 * current-server setting elsewhere. Stored only when the writer hands an
 * absolute http(s) URL (saveCredentials passes the live API base); empty
 * otherwise, consumers then fall back to the current-settings join. Same
 * lifecycle as the host pin — configuration, not a credential.
 */
const ISSUED_ORIGIN_KEY = 'phlix.access_issued_origin';
/**
 * Which HUB host minted the stored hub pair (MOB-8) — the hub lane's twin of
 * ISSUED_HOST_KEY: configuration, not a secret, welded to the hub slots'
 * lifecycle (written by storeHubTokens, wiped by clearHubTokens).
 */
const HUB_ISSUED_HOST_KEY = 'phlix.hub_issued_host';
const ABSOLUTE_URL_RE = /^https?:\/\//i;
/** Keychain username half — the password half is the credential itself. */
const TOKEN_USERNAME = 'phlix';

async function readSlot(service: string): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service });
  return credentials ? credentials.password : null;
}

async function writeSlot(service: string, secret: string): Promise<void> {
  // Review mobile__secnet m13: the biometric marker deliberately pins a
  // THIS_DEVICE_ONLY access class while the token slots used the keychain
  // default — backup-eligible. A device-backup extraction could therefore
  // carry live JWTs that the marker's own policy would refuse, and Android
  // was mitigated only by `allowBackup="false"`. Every vault secret now
  // writes non-migratable. AFTER_FIRST_UNLOCK (not WHEN_PASSCODE_SET) is the
  // chosen class: same no-backup, no-device-migration guarantee, but a
  // legitimate passcode CHANGE (or removal) does not silently vaporize the
  // session the user just earned.
  // (iOS class; Android: private-dir + allowBackup=false — see AndroidManifest.xml:42)
  await Keychain.setGenericPassword(TOKEN_USERNAME, secret, {
    service,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
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

/**
 * Vault WRITE-ORDERING law: `storeTokens` and `clearTokens` serialize on one
 * internal chain, so a wipe issued at time T can never land AFTER a store
 * issued at T+ε and orphan a freshly-issued session. This is not
 * hypothetical: the target-change teardown (useAuthStore's settings
 * subscription, review mobile__exploiter M1) fires `clearTokens()` and the
 * very same user gesture then dials a login whose success leg calls
 * `storeTokens` — unchained, the wipe's trailing `multiRemove` can delete the
 * new pair. Rejections still propagate to the awaiting caller; the chain
 * never wedges on a failed op. Reads are deliberately NOT chained (a read
 * racing a wipe has no durable effect, and chaining reads behind a hung
 * keycall would stall every request).
 */
let vaultWriteChain: Promise<void> = Promise.resolve();

function afterVaultWrite(op: () => Promise<void>): Promise<void> {
  const result = vaultWriteChain.then(op, op);
  vaultWriteChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

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

/**
 * MW-106 (review mobile__crossfe #13): the request interceptor awaits
 * `getAccessToken()` + `getIssuedHost()` on EVERY api call, which put a fresh
 * keychain decrypt (plus a storage read) on the hot path of the whole app.
 * The three server-vault reads now serve a read-through memo: concurrent and
 * later callers share one physical read until something invalidates it.
 *
 * Invalidation is WRITE-SIDE, never a TTL: every mutation of the server vault
 * funnels through storeTokens/clearTokens in this module, both drop the memo
 * on entry AND again once their queued write settles — a read that started
 * while a write sat in the queue can neither cache the value the write is
 * about to bury nor survive it. A FAILED physical read is never cached (the
 * next caller retries from the disk/vault), so the memo cannot stick a
 * transient keychain hiccup into a permanent logout-shaped shadow. The test
 * seam that re-arms the migration latch re-arms these memos too, which is
 * exactly why the existing real-vault suites keep passing unedited.
 */
let accessTokenMemo: Promise<string | null> | null = null;
let issuedHostMemo: Promise<string | null> | null = null;
let issuedOriginMemo: Promise<string | null> | null = null;

function invalidateServerMemos(): void {
  accessTokenMemo = null;
  issuedHostMemo = null;
  issuedOriginMemo = null;
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
    invalidateServerMemos(); // MW-106
    await afterVaultWrite(async () => {
      await AsyncStorage.setItem(ISSUED_HOST_KEY, pinnedHost);
      // MW-108: keep the RAW minting base URL when the caller had one, so a
      // later logout can revoke at the issuing origin across a server change.
      await AsyncStorage.setItem(
        ISSUED_ORIGIN_KEY,
        ABSOLUTE_URL_RE.test(issuedHost) ? issuedHost : ''
      );
      await writeSlot(ACCESS_SERVICE, accessToken);
      await writeSlot(REFRESH_SERVICE, refreshToken);
      await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
      invalidateServerMemos(); // MW-106: the NEXT read sees this fresh pair
    });
  }

  /**
   * The host the stored pair was minted for — the anchor the direct SyncPlay
   * dial is checked against — or null for a pre-pin (migrated) session, in
   * which case consumers must FAIL CLOSED. A successful re-issuance (login,
   * register, passkey, or the REST refresh leg) re-pins the pair.
   */
  async getIssuedHost(): Promise<string | null> {
    if (!issuedHostMemo) {
      issuedHostMemo = AsyncStorage.getItem(ISSUED_HOST_KEY).catch((error: unknown) => {
        issuedHostMemo = null; // never memoize a failed read
        throw error;
      });
    }
    try {
      return await issuedHostMemo;
    } catch {
      return null;
    }
  }

  /**
   * The raw base URL the stored pair was minted against (scheme + host +
   * port, typically `<root>/api/v1` as handed by saveCredentials), or null
   * when no absolute origin was ever pinned (bare host from older builds,
   * or a pre-pin migrated session) — consumers then fall back to the current
   * server setting. MW-108 (review mobile__secnet #2).
   */
  async getIssuedOrigin(): Promise<string | null> {
    if (!issuedOriginMemo) {
      issuedOriginMemo = AsyncStorage.getItem(ISSUED_ORIGIN_KEY).then(
        (raw) => (typeof raw === 'string' && raw !== '' ? raw : null),
        (error: unknown) => {
          issuedOriginMemo = null; // never memoize a failed read
          throw error;
        }
      );
    }
    try {
      return await issuedOriginMemo;
    } catch {
      return null;
    }
  }

  /** The access JWT, or null (migrating a pre-vault session on first read). */
  async getAccessToken(): Promise<string | null> {
    if (!accessTokenMemo) {
      accessTokenMemo = (async () => {
        try {
          await migratedOnce();
        } catch (error) {
          console.error('SecureStorage: token migration failed', error);
          // MW-106 folded into the M1 never-orphan law: a snapshot that
          // swallowed a FAILED migration must not be memoized — the next
          // read has to retry the move of the still-present plaintext copy.
          accessTokenMemo = null;
        }
        return await readSlot(ACCESS_SERVICE);
      })().catch((error: unknown) => {
        accessTokenMemo = null; // never memoize a failed read
        throw error;
      });
    }
    try {
      return await accessTokenMemo;
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
    invalidateServerMemos(); // MW-106: no in-flight read may cache across a wipe
    await afterVaultWrite(async () => {
      await Keychain.resetGenericPassword({ service: ACCESS_SERVICE });
      await Keychain.resetGenericPassword({ service: REFRESH_SERVICE });
      await AsyncStorage.multiRemove([
        ACCESS_TOKEN_KEY,
        REFRESH_TOKEN_KEY,
        ISSUED_HOST_KEY,
        ISSUED_ORIGIN_KEY,
      ]);
      // A pending (or failed-and-cached) migration must not move values the
      // user just revoked; arm a fresh pass over the now-empty legacy keys.
      migrationPromise = null;
      invalidateServerMemos(); // MW-106
    });
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
  async storeHubTokens(
    accessToken: string,
    refreshToken: string,
    issuedHubUrl: string
  ): Promise<void> {
    // MOB-8: the pin is REQUIRED (fail fast) — a hub pair with no minting
    // origin is one restore must refuse to ride anywhere.
    const pinnedHost = typeof issuedHubUrl === 'string' ? hostOf(issuedHubUrl) : '';
    if (pinnedHost === '') {
      throw new Error('SecureStorage: storeHubTokens requires the minting hub of the token pair');
    }
    await writeSlot(HUB_ACCESS_SERVICE, accessToken);
    await writeSlot(HUB_REFRESH_SERVICE, refreshToken);
    await AsyncStorage.setItem(HUB_ISSUED_HOST_KEY, pinnedHost);
  }

  /**
   * The hub host the stored hub pair was minted for, or null for a pre-pin
   * pair / unreadable key — consumers FAIL CLOSED (mirror of getIssuedHost).
   */
  async getHubIssuedHost(): Promise<string | null> {
    try {
      const raw = await AsyncStorage.getItem(HUB_ISSUED_HOST_KEY);
      return typeof raw === 'string' && raw !== '' ? raw : null;
    } catch {
      return null;
    }
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
    await AsyncStorage.removeItem(HUB_ISSUED_HOST_KEY);
  }

  // ── Biometric gate (M-MOBILE-33: the switch now GATES, not decorates) ────

  /**
   * Arm the OS-enforced biometric gate by writing the marker slot under
   * `BIOMETRY_ANY` + `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY` access control.
   * Devices without enrolled biometrics/passcode fail the secure write →
   * `false`, so the UI can say so instead of persisting theater.
   */
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

  /** Disarm the gate: wipe the protected marker slot (SettingsScreen toggle-off). */
  async disableBiometric(): Promise<void> {
    await Keychain.resetGenericPassword({ service: `${SERVICE_NAME}.biometric` });
  }

  /**
   * Cold-start gate check (M-MOBILE-33).
   *
   * The marker slot is the ONLY storage whose reads the OS protects with
   * `BIOMETRY_ANY` (the token slots are plain vault entries), so reading the
   * marker IS the authentication — one prompt, not two. Truth table:
   * - slot absent (gate never armed / disarmed) → `true`: nothing is gated,
   *   the caller proceeds exactly as before this feature existed;
   * - slot present, read succeeds → the OS accepted the biometric → `true`;
   * - slot present, read fails/cancels → `false`: the caller must NOT read
   *   the vault this launch (tokens stay intact for a retry).
   *
   * Platform caveat (honest): enforcement lives in the OS keystore — iOS
   * honors `BIOMETRY_ANY` fully; Android's prompt binding depends on the
   * device's keystore/biometric stack, where an unsupported control fails
   * the ENABLE write (→ the switch never sticks) rather than pretending.
   */
  async authenticateWithBiometric(): Promise<boolean> {
    try {
      await Keychain.getGenericPassword({
        service: `${SERVICE_NAME}.biometric`,
        authenticationPrompt: {
          title: 'Authenticate to access Phlix',
          subtitle: 'Use biometric authentication',
          cancel: 'Cancel',
        },
      });
      // Resolved — either the slot is absent (no prompt happened, gate not
      // armed) or the OS accepted the biometric and returned the marker.
      return true;
    } catch {
      // The protected read failed: prompt cancelled, biometric rejected, or
      // the OS refuses the item. The gate says no.
      return false;
    }
  }

  /**
   * Test seam: clear the once-per-process migration latch between cases —
   * and, with it, the MW-106 read-through memos, so a test that re-arms the
   * migration always re-arms fresh physical reads too.
   */
  __resetMigrationLatchForTests(): void {
    migrationPromise = null;
    invalidateServerMemos();
  }
}

export const secureStorage = new SecureStorage();
export default secureStorage;

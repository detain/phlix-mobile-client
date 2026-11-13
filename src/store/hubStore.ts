/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/store/hubStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HubSession, HubServer, hubAuthService } from '../hub/HubAuthService';
import { apiErrorMessage } from '../api/client';
import { hostOf } from '../utils/serverHost';
import { secureStorage } from '../services/SecureStorage';
import { resetServerScopedState } from './serverScope';

export type ConnectionMode = 'direct' | 'relay';

interface HubState {
  // Hub connection
  hubUrl: string | null;
  session: HubSession | null;
  servers: HubServer[];
  activeServerId: string | null;

  // Connection mode
  connectionMode: ConnectionMode;
  effectiveServerUrl: string;

  /**
   * Monotonic counter bumped ONLY when the active server identity actually
   * moves (M-MOBILE-18, review mobile__gameux M-G). It is the invalidation
   * channel `useFocusRefetch` subscribes to — mounted screens learn the data
   * they show just became another server's truth — and the generation stamp
   * `PlaybackProgressReporter` binds sessions with, so a queued progress
   * write can never land on a server that never hosted its session.
   */
  serverGeneration: number;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  signInToHub: (
    hubUrl: string,
    username: string,
    password: string
  ) => Promise<void>;
  signOutOfHub: () => void;
  refreshHubSession: () => Promise<void>;
  fetchServers: () => Promise<void>;
  setActiveServer: (serverId: string) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  clearError: () => void;
  loadPersistedState: () => Promise<void>;
}

const HUB_STORAGE_KEY = 'phlix_hub_session';

/**
 * Hydration idempotency memo (MW-099). loadPersistedState now runs at app
 * bootstrap (App.tsx) AND still as a belt on Settings-screen mount; the
 * restore — blob read, roster fetch, identity switch, migration sweep — must
 * execute AT MOST ONCE per process. A second caller receives the SAME
 * promise: no duplicate listServers round-trip, no second sweep racing the
 * first, no double switchServerIdentity wake-up.
 *
 * A restore that ends in the swallowed-error branch RE-ARMS the memo: the
 * vault-deferral law (M-MOBILE-12 case 4) demands the next read complete the
 * migration, and the error branch is exactly that deferral. A clean restore
 * — including a "nothing to restore" one — is final for the process.
 */
let hubHydration: Promise<void> | null = null;

/**
 * Test seam (precedent: wsEndpoint's __resetRelayTokenProvidersForTests):
 * the memo is process-lifetime by design, so a battery that drives cold-boot
 * hydration repeatedly must be able to re-arm it between cases.
 */
export function __resetHubHydrationForTests(): void {
  hubHydration = null;
}

/**
 * The ONE sanctioned shape of the `phlix_hub_session` blob: the JWT pair NEVER
 * lives inside it. Both writers — `persistSession` at issuance and
 * `loadPersistedState`'s migration/crash-residue sweep — serialize through this
 * builder so a sanitizing write can never drift into a token-bearing shape.
 * The retained fields are exactly the server lane's non-secret classification
 * (see SecureStorage's ISSUED_HOST_KEY docblock: endpoints and ids are
 * configuration, the minted JWTs are the secrets): connection metadata plus
 * the expiresAt/userId/displayName envelope the UI reads without the vault
 * (MW-025: `displayName` is the hub account's own username/email — the same
 * classification as `userId`, and the Settings row needs it on cold start).
 */
function buildSanitizedHubBlob(
  hubUrl: string,
  session: { expiresAt: number; userId: string; displayName?: string },
  activeServerId: string | null,
  connectionMode: ConnectionMode
): string {
  return JSON.stringify({
    hubUrl,
    session: {
      expiresAt: session.expiresAt,
      userId: session.userId,
      ...(typeof session.displayName === 'string' &&
        session.displayName !== '' && { displayName: session.displayName }),
    },
    activeServerId,
    connectionMode,
  });
}

export const useHubStore = create<HubState>((set, get) => {
  /**
   * The M-MOBILE-18 switch law in one place: when the active-server identity
   * MOVES (in either direction, including to/from "none"), the previous
   * server's cached rows can no longer be addressed here and must vanish in
   * the SAME frame, and generation watchers must wake. Call BEFORE the
   * `set()` that commits the new identity — the bump notifies subscribers
   * synchronously, so any screen refetching must never be able to observe a
   * row of the server it just left. Returns the new generation, or `null`
   * when nothing moved (same-id re-select: no cascade, no wake-up stampede).
   */
  const switchServerIdentity = (nextActiveServerId: string | null): number | null => {
    if (get().activeServerId === nextActiveServerId) {
      return null;
    }
    resetServerScopedState();
    return get().serverGeneration + 1;
  };

  return {
  hubUrl: null,
  session: null,
  servers: [],
  activeServerId: null,
  connectionMode: 'direct',
  effectiveServerUrl: '',
  serverGeneration: 0,
  isLoading: false,
  error: null,

  signInToHub: async (
    hubUrl: string,
    username: string,
    password: string
  ) => {
    set({ isLoading: true, error: null });
    try {
      const session = await hubAuthService.signIn(hubUrl, username, password);
      const servers = await hubAuthService.listServers(hubUrl, session);

      const activeServerId = servers.length > 0 ? servers[0].serverId : null;
      const effectiveServerUrl = resolveEffectiveUrl(
        servers.find((s) => s.serverId === activeServerId) ?? null,
        get().connectionMode
      );

      // A sign-in that lands the user on a different active server than the
      // app last knew (cold case: null → first server) moves the server
      // identity — same atomic cascade + wake-up law as setActiveServer.
      const nextGeneration = switchServerIdentity(activeServerId);
      const patch: Partial<HubState> = {
        hubUrl,
        session,
        servers,
        activeServerId,
        effectiveServerUrl,
        isLoading: false,
      };
      if (nextGeneration !== null) {
        patch.serverGeneration = nextGeneration;
      }
      set(patch);

      // Persist session
      await persistSession(hubUrl, session, activeServerId);
    } catch (err) {
      set({
        // M-MOBILE-34: hub failures ride the same `{ error, code }` contract —
        // parse it code-first instead of surfacing transport prose raw.
        error: apiErrorMessage(err, 'Failed to sign in to Hub.'),
        isLoading: false,
      });
      throw err;
    }
  },

  signOutOfHub: async () => {
    // Cut the hub-side lineage BEFORE wiping local state (M-MOBILE-53d): the
    // revoke call is best-effort inside HubAuthService.signOut, so a dead hub
    // cannot block the teardown below.
    const { hubUrl: leavingHubUrl, session: leavingSession } = get();
    if (leavingHubUrl !== null && leavingSession !== null) {
      await hubAuthService.signOut(leavingHubUrl, leavingSession);
    }
    // "No active server" is itself a server-identity move: every cached row
    // was addressed by the server we just left.
    const nextGeneration = switchServerIdentity(null);
    const patch: Partial<HubState> = {
      hubUrl: null,
      session: null,
      servers: [],
      activeServerId: null,
      effectiveServerUrl: '',
      error: null,
    };
    if (nextGeneration !== null) {
      patch.serverGeneration = nextGeneration;
    }
    set(patch);
    await AsyncStorage.removeItem(HUB_STORAGE_KEY);
    // The JWT half of the session lives in the vault — sign-out must
    // wipe it too, not just the metadata blob (M-MOBILE-05).
    await secureStorage.clearHubTokens();
  },

  refreshHubSession: async () => {
    const { hubUrl, session } = get();
    if (!hubUrl || !session) {
      throw new Error('Not signed in to Hub.');
    }

    try {
      const newSession = await hubAuthService.refresh(hubUrl, session.refreshToken);
      // MW-025: the current hub answers refresh through the SAME
      // createAuthResponse leg, so the display name rides along natively. If
      // an older hub's envelope omits the user row, keep the label the device
      // already knew — the identity behind these tokens has not moved.
      const merged: HubSession =
        newSession.displayName === undefined && session.displayName !== undefined
          ? { ...newSession, displayName: session.displayName }
          : newSession;
      set({ session: merged });
      await persistSession(hubUrl, merged, get().activeServerId);
    } catch (err) {
      // Refresh token expired - sign out
      get().signOutOfHub();
      throw err;
    }
  },

  fetchServers: async () => {
    const { hubUrl, session } = get();
    if (!hubUrl || !session) {
      throw new Error('Not signed in to Hub.');
    }

    set({ isLoading: true, error: null });
    try {
      const servers = await hubAuthService.listServers(hubUrl, session);
      set({ servers, isLoading: false });
    } catch (err) {
      set({
        // MW-022 (review mobile__exploiter #5): hub failures ride the same
        // `{ error, code }` contract as every other lane — route through the
        // code-first `apiErrorMessage` choke point (what signInToHub already
        // does) instead of surfacing raw axios protocol prose.
        error: apiErrorMessage(err, 'Failed to fetch servers.'),
        isLoading: false,
      });
      throw err;
    }
  },

  setActiveServer: (serverId: string) => {
    const { servers, connectionMode } = get();
    const server = servers.find((s) => s.serverId === serverId);
    if (!server) {
      return;
    }

    const nextGeneration = switchServerIdentity(serverId);
    if (nextGeneration === null) {
      // Re-selecting the active server: its caches are still the truth on
      // the wire we already speak. Waking every mounted screen to refetch
      // identical rows would be a stampede, not a cure.
      return;
    }

    // Order law (see switchServerIdentity): caches drop BEFORE the
    // generation bumps, so the synchronous subscriber wake-up can never
    // read a row of the server being left.
    const effectiveServerUrl = resolveEffectiveUrl(server, connectionMode);
    set({ activeServerId: serverId, effectiveServerUrl, serverGeneration: nextGeneration });

    // Persist active server ID
    const { hubUrl, session } = get();
    if (hubUrl && session) {
      persistSession(hubUrl, session, serverId);
    }
  },

  setConnectionMode: (mode: ConnectionMode) => {
    const { activeServerId, servers } = get();
    const server = servers.find((s) => s.serverId === activeServerId) ?? null;
    const effectiveServerUrl = resolveEffectiveUrl(server, mode);
    set({ connectionMode: mode, effectiveServerUrl });
  },

  clearError: () => set({ error: null }),

  loadPersistedState: () => {
    if (hubHydration === null) {
      hubHydration = (async () => {
    // MW-099 x M-MOBILE-12: "final" means NOTHING was deferred. Any swallowed
    // error — the outer catch or one of the vault-deferral arms below —
    // re-arms the memo so the next read completes the migration.
    let deferred = false;
    try {
      const data = await AsyncStorage.getItem(HUB_STORAGE_KEY);
      if (data) {
        const parsed: unknown = JSON.parse(data);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          // M-MOBILE-31 — a non-object blob is corruption/tampering: nothing
          // below this line may run against it.
          return;
        }
        const { hubUrl, session, activeServerId } = parsed as Record<string, unknown>;
        const rawMode = (parsed as Record<string, unknown>).connectionMode;
        const connectionMode: ConnectionMode =
          rawMode === 'direct' || rawMode === 'relay' ? rawMode : 'direct';
        // Shape-validate the whole restored envelope before use (review
        // M-MOBILE-31): the old truthiness-only gate let a non-string hubUrl
        // reach fetch() and a garbage `session` reach the hydrated HubSession.
        if (
          typeof hubUrl === 'string' &&
          hubUrl !== '' &&
          typeof activeServerId === 'string' &&
          activeServerId !== '' &&
          typeof session === 'object' &&
          session !== null &&
          typeof (session as Record<string, unknown>).expiresAt === 'number' &&
          Number.isFinite((session as Record<string, unknown>).expiresAt) &&
          typeof (session as Record<string, unknown>).userId === 'string'
        ) {
          const envelope = session as {
            expiresAt: number;
            userId: string;
            displayName?: unknown;
            accessToken?: unknown;
            refreshToken?: unknown;
          };
          // MW-025: the identity slice narrowed for the blob builder (the
          // restored JSON is `unknown` material — read, never re-cast).
          const blobIdentity = {
            expiresAt: envelope.expiresAt,
            userId: envelope.userId,
            displayName: typeof envelope.displayName === 'string' ? envelope.displayName : undefined,
          };
          // MOB-52: an expired access envelope is DISCARDED, never restored
          // (it used to hydrate a dead session and ride it to the hub).
          if (envelope.expiresAt <= Math.floor(Date.now() / 1000)) {
            await AsyncStorage.removeItem(HUB_STORAGE_KEY);
            await secureStorage.clearHubTokens();
            return;
          }
          // Resolve the JWT pair: vault first. A pre-vault blob carries
          // them in plaintext inside `session` — migrate on first read
          // (secure-write BEFORE the sanitized blob replaces it, the
          // same never-orphan order as SecureStorage.migrateSlot). If
          // the keychain itself fails, keep using the plaintext pair
          // in memory and leave the blob in place for a retry; an
          // existing session is never orphaned.
          let accessToken: string | null = await secureStorage.getHubAccessToken();
          let refreshToken: string | null = await secureStorage.getHubRefreshToken();
          const legacyPair: { accessToken: string; refreshToken: string } | null =
            typeof envelope.accessToken === 'string' &&
            typeof envelope.refreshToken === 'string'
              ? { accessToken: envelope.accessToken, refreshToken: envelope.refreshToken }
              : null;
          if (!accessToken || !refreshToken) {
            if (legacyPair) {
              accessToken = legacyPair.accessToken;
              refreshToken = legacyPair.refreshToken;
              try {
                await secureStorage.storeHubTokens(
                  legacyPair.accessToken,
                  legacyPair.refreshToken,
                  hubUrl
                );
                await AsyncStorage.setItem(
                  HUB_STORAGE_KEY,
                  buildSanitizedHubBlob(hubUrl, blobIdentity, activeServerId, connectionMode)
                );
              } catch {
                // Vault write failed — plaintext copy stays for retry.
                deferred = true;
              }
            }
          } else if (legacyPair) {
            // Crash residue (M-MOBILE-20): an earlier pass committed the vault
            // pair but died before the sanitizing rewrite — BOTH copies now
            // exist. The vault wins (we hydrate from its pair above), and the
            // plaintext half is redundant either way: sweep it, the same
            // never-orphan order law as SecureStorage.migrateSlot's
            // unconditional legacy removeItem once the secure side settled.
            // A throwing rewrite is fail-soft: the blob stays for the next
            // load to retry, and the session in memory carries the vault pair
            // regardless — the sweep is hygiene, never the credential source.
            try {
              await AsyncStorage.setItem(
                HUB_STORAGE_KEY,
                buildSanitizedHubBlob(hubUrl, blobIdentity, activeServerId, connectionMode)
              );
            } catch {
              // Next load retries the sweep; the vault holds the pair.
              deferred = true;
            }
          }
          if (!accessToken || !refreshToken) {
            // No credential on either side (e.g. the OS wiped the
            // keychain under a sanitized blob): the session is not
            // usable — wsEndpoint law says "do not open the socket",
            // never "open without a credential". Sweep the corpse.
            await AsyncStorage.removeItem(HUB_STORAGE_KEY);
            await secureStorage.clearHubTokens();
            return;
          }
          // MOB-8: the minted-origin pin. A vault pair rides ONLY to the hub
          // that minted it; the blob's hubUrl is tamperable plaintext, so a
          // mismatch (or a pre-pin pair with no pin) FAILS CLOSED — sweep,
          // the user re-authenticates once. A just-migrated legacy pair was
          // pinned to this very hubUrl above (deferred write: in-memory only).
          if (!deferred) {
            const hubPin = await secureStorage.getHubIssuedHost();
            if (hubPin === null || hubPin !== hostOf(hubUrl)) {
              await AsyncStorage.removeItem(HUB_STORAGE_KEY);
              await secureStorage.clearHubTokens();
              return;
            }
          }
          const hydrated: HubSession = {
            accessToken,
            refreshToken,
            expiresAt: envelope.expiresAt,
            userId: envelope.userId,
            ...(typeof envelope.displayName === 'string' &&
              envelope.displayName !== '' && { displayName: envelope.displayName }),
          };
          const servers = await hubAuthService.listServers(hubUrl, hydrated);
          const server = servers.find((s) => s.serverId === activeServerId);
          const effectiveServerUrl = resolveEffectiveUrl(
            server ?? null,
            connectionMode
          );
          // Hydration is not exempt from the switch law: `loadPersistedState`
          // runs at bootstrap (App.tsx) and via the Settings belt, so the identity it restores
          // CAN move under warm caches (same-id replay → no cascade, no bump).
          const nextGeneration = switchServerIdentity(activeServerId);
          const patch: Partial<HubState> = {
            hubUrl,
            session: hydrated,
            servers,
            activeServerId,
            connectionMode,
            effectiveServerUrl,
          };
          if (nextGeneration !== null) {
            patch.serverGeneration = nextGeneration;
          }
          set(patch);
        }
      }
    } catch {
      // Ignore errors loading persisted state — BUT re-arm the memo: a
      // swallowed failure (the vault-deferred migration of M-MOBILE-12 (4))
      // must complete on the NEXT read, so only a clean restore is
      // once-per-process.
      hubHydration = null;
    }
    if (deferred) {
      hubHydration = null;
    }
      })();
    }
    return hubHydration;
  },
  };
});

/**
 * Resolve the effective server URL based on the active server and connection mode.
 *
 * M-MOBILE-49: the hub's roster strings are HUB-PROVIDED, so they are
 * parsed here rather than trusted verbatim — only `https://` and `http://`
 * (the ratified LAN lane, made VISIBLE by the insecure banner that
 * client.ts's rest-lane report drives) may reach the axios base. A
 * scheme-less or foreign-scheme hostname is refused with a loud drop to
 * `''`, which consumers already read as "no hub server selected" — the
 * worst silence before was a malformed string surfacing later as an axios
 * Invalid URL on every call.
 */
function resolveEffectiveUrl(
  server: HubServer | null,
  mode: ConnectionMode
): string {
  if (!server) {
    return '';
  }

  const candidate =
    mode === 'relay'
      ? // Review mobile__secnet m8: the relay lane interpolates a HUB-SUPPLIED
        // id into the path — encode it exactly like the live WS lane
        // (hubRelay.ts) and the mint (RelayTokenProvider) already do. The
        // relay.phlix.app domain itself is an estate supply-chain pin: its
        // ownership must be re-verified at each release (see FIXLOG note).
        // MW-022: this URL is BUILT, never roster-supplied — the hub's
        // /me/servers payload carries no relay hostname, so the retired
        // `relayHostname` field (always `undefined` against a real hub)
        // could only ever fall through to exactly this line.
        `https://relay.phlix.app/relay/${encodeURIComponent(server.serverId)}`
      : server.hostname;

  if (candidate.startsWith('https://') || candidate.startsWith('http://')) {
    return candidate;
  }

  console.warn(
    `hubStore: refusing non-http(s) server URL '${candidate}' from the hub roster ` +
      `(server ${server.serverId}) — falling back to the direct lane`
  );
  return '';
}

/**
 * Persist hub session.
 *
 * The two JWTs go to the keychain vault (dedicated hub slots mirroring
 * the server ACCESS/REFRESH pair); only the non-secret session envelope
 * (expiresAt/userId/displayName) plus connection metadata stays in
 * AsyncStorage.
 * This closes the hub lane of audit M1's plaintext-storage class — the
 * vault module's docblock claims every auth JWT, and hub sign-in mints
 * its own access+refresh pair (`HubAuthService.HubSession`), which the
 * old whole-session serialization leaked in the app sandbox.
 */
async function persistSession(
  hubUrl: string,
  session: HubSession,
  activeServerId: string | null
): Promise<void> {
  const { connectionMode } = useHubStore.getState();
  await secureStorage.storeHubTokens(session.accessToken, session.refreshToken, hubUrl);
  await AsyncStorage.setItem(
    HUB_STORAGE_KEY,
    buildSanitizedHubBlob(hubUrl, session, activeServerId, connectionMode)
  );
}

// Re-export for convenience
export type { HubSession, HubServer };

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
import { secureStorage } from '../services/SecureStorage';

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

export const useHubStore = create<HubState>((set, get) => ({
  hubUrl: null,
  session: null,
  servers: [],
  activeServerId: null,
  connectionMode: 'direct',
  effectiveServerUrl: '',
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

      set({
        hubUrl,
        session,
        servers,
        activeServerId,
        effectiveServerUrl,
        isLoading: false,
      });

      // Persist session
      await persistSession(hubUrl, session, activeServerId);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to sign in to hub',
        isLoading: false,
      });
      throw err;
    }
  },

  signOutOfHub: async () => {
    hubAuthService.signOut();
    set({
      hubUrl: null,
      session: null,
      servers: [],
      activeServerId: null,
      effectiveServerUrl: '',
      error: null,
    });
    await AsyncStorage.removeItem(HUB_STORAGE_KEY);
    // The JWT half of the session lives in the vault — sign-out must
    // wipe it too, not just the metadata blob (M-MOBILE-05).
    await secureStorage.clearHubTokens();
  },

  refreshHubSession: async () => {
    const { hubUrl, session } = get();
    if (!hubUrl || !session) {
      throw new Error('Not signed in to hub');
    }

    try {
      const newSession = await hubAuthService.refresh(hubUrl, session.refreshToken);
      set({ session: newSession });
      await persistSession(hubUrl, newSession, get().activeServerId);
    } catch (err) {
      // Refresh token expired - sign out
      get().signOutOfHub();
      throw err;
    }
  },

  fetchServers: async () => {
    const { hubUrl, session } = get();
    if (!hubUrl || !session) {
      throw new Error('Not signed in to hub');
    }

    set({ isLoading: true, error: null });
    try {
      const servers = await hubAuthService.listServers(hubUrl, session);
      set({ servers, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch servers',
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

    const effectiveServerUrl = resolveEffectiveUrl(server, connectionMode);
    set({ activeServerId: serverId, effectiveServerUrl });

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

  loadPersistedState: async () => {
    try {
      const data = await AsyncStorage.getItem(HUB_STORAGE_KEY);
      if (data) {
        const { hubUrl, session, activeServerId, connectionMode } =
          JSON.parse(data);
        if (hubUrl && session && activeServerId) {
          // Resolve the JWT pair: vault first. A pre-vault blob carries
          // them in plaintext inside `session` — migrate on first read
          // (secure-write BEFORE the sanitized blob replaces it, the
          // same never-orphan order as SecureStorage.migrateSlot). If
          // the keychain itself fails, keep using the plaintext pair
          // in memory and leave the blob in place for a retry; an
          // existing session is never orphaned.
          let accessToken: string | null = await secureStorage.getHubAccessToken();
          let refreshToken: string | null = await secureStorage.getHubRefreshToken();
          if (!accessToken || !refreshToken) {
            if (
              typeof session.accessToken === 'string' &&
              typeof session.refreshToken === 'string'
            ) {
              const legacyAccess: string = session.accessToken;
              const legacyRefresh: string = session.refreshToken;
              accessToken = legacyAccess;
              refreshToken = legacyRefresh;
              try {
                await secureStorage.storeHubTokens(legacyAccess, legacyRefresh);
                await AsyncStorage.setItem(
                  HUB_STORAGE_KEY,
                  JSON.stringify({
                    hubUrl,
                    session: {
                      expiresAt: session.expiresAt,
                      userId: session.userId,
                    },
                    activeServerId,
                    connectionMode,
                  })
                );
              } catch {
                // Vault write failed — plaintext copy stays for retry.
              }
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
          const hydrated: HubSession = {
            accessToken,
            refreshToken,
            expiresAt: session.expiresAt,
            userId: session.userId,
          };
          const servers = await hubAuthService.listServers(hubUrl, hydrated);
          const server = servers.find((s) => s.serverId === activeServerId);
          const effectiveServerUrl = resolveEffectiveUrl(
            server ?? null,
            connectionMode
          );
          set({
            hubUrl,
            session: hydrated,
            servers,
            activeServerId,
            connectionMode,
            effectiveServerUrl,
          });
        }
      }
    } catch {
      // Ignore errors loading persisted state
    }
  },
}));

/**
 * Resolve the effective server URL based on the active server and connection mode.
 */
function resolveEffectiveUrl(
  server: HubServer | null,
  mode: ConnectionMode
): string {
  if (!server) {
    return '';
  }

  if (mode === 'relay') {
    return server.relayHostname ?? `https://relay.phlix.app/relay/${server.serverId}`;
  }

  return server.hostname;
}

/**
 * Persist hub session.
 *
 * The two JWTs go to the keychain vault (dedicated hub slots mirroring
 * the server ACCESS/REFRESH pair); only the non-secret session envelope
 * (expiresAt/userId) plus connection metadata stays in AsyncStorage.
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
  await secureStorage.storeHubTokens(session.accessToken, session.refreshToken);
  const data = JSON.stringify({
    hubUrl,
    session: { expiresAt: session.expiresAt, userId: session.userId },
    activeServerId,
    connectionMode,
  });
  await AsyncStorage.setItem(HUB_STORAGE_KEY, data);
}

// Re-export for convenience
export type { HubSession, HubServer };

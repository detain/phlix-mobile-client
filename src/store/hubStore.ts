// src/store/hubStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HubSession, HubServer, hubAuthService } from '../hub/HubAuthService';

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

const HUB_STORAGE_KEY = 'phlex_hub_session';

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
          const servers = await hubAuthService.listServers(hubUrl, session);
          const server = servers.find((s) => s.serverId === activeServerId);
          const effectiveServerUrl = resolveEffectiveUrl(
            server ?? null,
            connectionMode
          );
          set({
            hubUrl,
            session,
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
    return server.relayHostname ?? `https://relay.phlex.app/relay/${server.serverId}`;
  }

  return server.hostname;
}

/**
 * Persist hub session to AsyncStorage.
 */
async function persistSession(
  hubUrl: string,
  session: HubSession,
  activeServerId: string | null
): Promise<void> {
  const { connectionMode } = useHubStore.getState();
  const data = JSON.stringify({
    hubUrl,
    session,
    activeServerId,
    connectionMode,
  });
  await AsyncStorage.setItem(HUB_STORAGE_KEY, data);
}

// Re-export for convenience
export type { HubSession, HubServer };

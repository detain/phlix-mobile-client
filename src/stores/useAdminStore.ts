// src/stores/useAdminStore.ts
import { create } from 'zustand';
import { adminManager } from '../api/AdminManager';
import { Library } from '../types/media';
import type {
  AdminUser,
  CreateUserInput,
  UpdateUserInput,
  UserStatus,
  ScanJob,
  CreateLibraryInput,
  UpdateLibraryInput,
  NowPlayingSession,
  TopUser,
  TopMedia,
  StorageStat,
  ActivityEntry,
  Plugin,
  PluginDetail,
  CatalogResponse,
  AuthProvider,
  AuthProviderConfigSchema,
  ServerSettings,
} from '../types/admin';
import type {
  CreateUserResult,
  ResetPasswordResult,
  CreateLibraryResult,
  JobTriggerResult,
  AuthProviderToggleResult,
} from '../api/AdminManager';

/**
 * Admin store (slice E6a). Holds the Dashboard data, the admin user list and the
 * library list, plus all admin mutators. Convention (matches useProfileStore):
 *   - LOADERS swallow errors into `error` (screens render an ErrorView/retry).
 *   - MUTATORS set `error` AND rethrow so the calling screen can surface an Alert.
 * Section-scoped loading/error flags keep the three surfaces independent so a
 * dashboard refresh does not flicker the users list (E6b) and vice-versa.
 */
interface AdminState {
  // Dashboard
  nowPlaying: NowPlayingSession[];
  topUsers: TopUser[];
  topMedia: TopMedia[];
  storage: StorageStat[];
  activity: ActivityEntry[];
  dashboardLoading: boolean;
  dashboardError: string | null;

  // Users
  users: AdminUser[];
  usersLoading: boolean;
  usersError: string | null;

  // Libraries
  libraries: Library[];
  librariesLoading: boolean;
  librariesError: string | null;

  // Plugins (E10c)
  plugins: Plugin[];
  pluginsLoading: boolean;
  pluginsError: string | null;
  catalog: CatalogResponse | null;
  catalogLoading: boolean;
  catalogError: string | null;

  // Auth providers (E10c)
  authProviders: AuthProvider[];
  authProvidersLoading: boolean;
  authProvidersError: string | null;

  // Server settings (E10c)
  serverSettings: ServerSettings | null;
  serverSettingsLoading: boolean;
  serverSettingsError: string | null;

  // Dashboard actions
  loadDashboard: () => Promise<void>;

  // User actions
  loadUsers: (status?: UserStatus) => Promise<void>;
  createUser: (input: CreateUserInput) => Promise<CreateUserResult>;
  updateUser: (id: string, input: UpdateUserInput) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  setUserAdmin: (id: string, isAdmin: boolean) => Promise<void>;
  resetPassword: (id: string) => Promise<ResetPasswordResult>;
  approveUser: (id: string) => Promise<void>;
  disableUser: (id: string) => Promise<void>;
  rejectUser: (id: string) => Promise<void>;

  // Library actions
  loadLibraries: () => Promise<void>;
  createLibrary: (input: CreateLibraryInput) => Promise<CreateLibraryResult>;
  updateLibrary: (id: string, input: UpdateLibraryInput) => Promise<void>;
  deleteLibrary: (id: string) => Promise<void>;
  scanLibrary: (id: string) => Promise<JobTriggerResult>;
  rescanLibrary: (id: string) => Promise<JobTriggerResult>;
  matchMetadata: (id: string) => Promise<JobTriggerResult>;
  getScanStatus: (id: string) => Promise<ScanJob | null>;
  getScanHistory: (id: string, limit?: number) => Promise<ScanJob[]>;

  // Plugin actions (E10c)
  loadPlugins: () => Promise<void>;
  getPlugin: (name: string) => Promise<PluginDetail>;
  installPlugin: (url: string) => Promise<PluginDetail>;
  updatePluginSettings: (
    name: string,
    settings: Record<string, unknown>
  ) => Promise<PluginDetail>;
  enablePlugin: (name: string) => Promise<void>;
  disablePlugin: (name: string) => Promise<void>;
  uninstallPlugin: (name: string) => Promise<void>;
  loadCatalog: () => Promise<void>;
  addCatalogSource: (url: string) => Promise<void>;
  removeCatalogSource: (url: string) => Promise<void>;

  // Auth provider actions (E10c)
  loadAuthProviders: () => Promise<void>;
  enableAuthProvider: (name: string) => Promise<AuthProviderToggleResult>;
  disableAuthProvider: (name: string) => Promise<AuthProviderToggleResult>;
  getAuthProviderConfigSchema: (
    name: string
  ) => Promise<AuthProviderConfigSchema>;

  // Server settings actions (E10c)
  loadServerSettings: () => Promise<void>;
  updateServerSettings: (
    settings: Record<string, unknown>
  ) => Promise<ServerSettings>;
}

const errMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const useAdminStore = create<AdminState>((set, get) => ({
  nowPlaying: [],
  topUsers: [],
  topMedia: [],
  storage: [],
  activity: [],
  dashboardLoading: false,
  dashboardError: null,

  users: [],
  usersLoading: false,
  usersError: null,

  libraries: [],
  librariesLoading: false,
  librariesError: null,

  plugins: [],
  pluginsLoading: false,
  pluginsError: null,
  catalog: null,
  catalogLoading: false,
  catalogError: null,

  authProviders: [],
  authProvidersLoading: false,
  authProvidersError: null,

  serverSettings: null,
  serverSettingsLoading: false,
  serverSettingsError: null,

  // ── Dashboard ──
  loadDashboard: async () => {
    set({ dashboardLoading: true, dashboardError: null });
    try {
      const [nowPlaying, topUsers, topMedia, storage, activity] = await Promise.all([
        adminManager.getNowPlaying(),
        adminManager.getDashboardTopUsers(),
        adminManager.getDashboardTopMedia(),
        adminManager.getDashboardStorage(),
        adminManager.getActivity(),
      ]);
      set({
        nowPlaying,
        topUsers,
        topMedia,
        storage,
        activity,
        dashboardLoading: false,
      });
    } catch (error) {
      set({
        dashboardError: errMessage(error, 'Failed to load dashboard'),
        dashboardLoading: false,
      });
    }
  },

  // ── Users ──
  loadUsers: async (status?: UserStatus) => {
    set({ usersLoading: true, usersError: null });
    try {
      const users = await adminManager.getUsers(status);
      set({ users, usersLoading: false });
    } catch (error) {
      set({
        usersError: errMessage(error, 'Failed to load users'),
        usersLoading: false,
      });
    }
  },

  createUser: async (input: CreateUserInput) => {
    set({ usersError: null });
    try {
      const result = await adminManager.createUser(input);
      await get().loadUsers();
      return result;
    } catch (error) {
      set({ usersError: errMessage(error, 'Failed to create user') });
      throw error;
    }
  },

  updateUser: async (id: string, input: UpdateUserInput) => {
    set({ usersError: null });
    try {
      await adminManager.updateUser(id, input);
      const refreshed = await adminManager.getUser(id);
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? refreshed : u)),
      }));
    } catch (error) {
      set({ usersError: errMessage(error, 'Failed to update user') });
      throw error;
    }
  },

  deleteUser: async (id: string) => {
    set({ usersError: null });
    try {
      await adminManager.deleteUser(id);
      set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
    } catch (error) {
      set({ usersError: errMessage(error, 'Failed to delete user') });
      throw error;
    }
  },

  setUserAdmin: async (id: string, isAdmin: boolean) => {
    set({ usersError: null });
    try {
      await adminManager.setUserAdmin(id, isAdmin);
      set((state) => ({
        users: state.users.map((u) =>
          u.id === id ? { ...u, is_admin: isAdmin } : u
        ),
      }));
    } catch (error) {
      set({ usersError: errMessage(error, 'Failed to change admin status') });
      throw error;
    }
  },

  resetPassword: async (id: string) => {
    set({ usersError: null });
    try {
      return await adminManager.resetPassword(id);
    } catch (error) {
      set({ usersError: errMessage(error, 'Failed to reset password') });
      throw error;
    }
  },

  approveUser: async (id: string) => {
    set({ usersError: null });
    try {
      await adminManager.approveUser(id);
      set((state) => ({
        users: state.users.map((u) =>
          u.id === id ? { ...u, status: 'active' as UserStatus } : u
        ),
      }));
    } catch (error) {
      set({ usersError: errMessage(error, 'Failed to approve user') });
      throw error;
    }
  },

  disableUser: async (id: string) => {
    set({ usersError: null });
    try {
      await adminManager.disableUser(id);
      set((state) => ({
        users: state.users.map((u) =>
          u.id === id ? { ...u, status: 'disabled' as UserStatus } : u
        ),
      }));
    } catch (error) {
      set({ usersError: errMessage(error, 'Failed to disable user') });
      throw error;
    }
  },

  rejectUser: async (id: string) => {
    set({ usersError: null });
    try {
      await adminManager.rejectUser(id);
      set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
    } catch (error) {
      set({ usersError: errMessage(error, 'Failed to reject user') });
      throw error;
    }
  },

  // ── Libraries ──
  loadLibraries: async () => {
    set({ librariesLoading: true, librariesError: null });
    try {
      const libraries = await adminManager.getLibraries();
      set({ libraries, librariesLoading: false });
    } catch (error) {
      set({
        librariesError: errMessage(error, 'Failed to load libraries'),
        librariesLoading: false,
      });
    }
  },

  createLibrary: async (input: CreateLibraryInput) => {
    set({ librariesError: null });
    try {
      const result = await adminManager.createLibrary(input);
      await get().loadLibraries();
      return result;
    } catch (error) {
      set({ librariesError: errMessage(error, 'Failed to create library') });
      throw error;
    }
  },

  updateLibrary: async (id: string, input: UpdateLibraryInput) => {
    set({ librariesError: null });
    try {
      await adminManager.updateLibrary(id, input);
      const refreshed = await adminManager.getLibrary(id);
      set((state) => ({
        libraries: state.libraries.map((l) => (l.id === id ? refreshed : l)),
      }));
    } catch (error) {
      set({ librariesError: errMessage(error, 'Failed to update library') });
      throw error;
    }
  },

  deleteLibrary: async (id: string) => {
    set({ librariesError: null });
    try {
      await adminManager.deleteLibrary(id);
      set((state) => ({
        libraries: state.libraries.filter((l) => l.id !== id),
      }));
    } catch (error) {
      set({ librariesError: errMessage(error, 'Failed to delete library') });
      throw error;
    }
  },

  scanLibrary: async (id: string) => {
    set({ librariesError: null });
    try {
      return await adminManager.scanLibrary(id);
    } catch (error) {
      set({ librariesError: errMessage(error, 'Failed to start scan') });
      throw error;
    }
  },

  rescanLibrary: async (id: string) => {
    set({ librariesError: null });
    try {
      return await adminManager.rescanLibrary(id);
    } catch (error) {
      set({ librariesError: errMessage(error, 'Failed to start rescan') });
      throw error;
    }
  },

  matchMetadata: async (id: string) => {
    set({ librariesError: null });
    try {
      return await adminManager.matchMetadata(id);
    } catch (error) {
      set({ librariesError: errMessage(error, 'Failed to start metadata match') });
      throw error;
    }
  },

  getScanStatus: async (id: string) => {
    try {
      return await adminManager.getScanStatus(id);
    } catch (error) {
      set({ librariesError: errMessage(error, 'Failed to load scan status') });
      throw error;
    }
  },

  getScanHistory: async (id: string, limit?: number) => {
    try {
      return await adminManager.getScanHistory(id, limit);
    } catch (error) {
      set({ librariesError: errMessage(error, 'Failed to load scan history') });
      throw error;
    }
  },

  // ── Plugins (E10c) ──
  loadPlugins: async () => {
    set({ pluginsLoading: true, pluginsError: null });
    try {
      const plugins = await adminManager.getPlugins();
      set({ plugins, pluginsLoading: false });
    } catch (error) {
      set({
        pluginsError: errMessage(error, 'Failed to load plugins'),
        pluginsLoading: false,
      });
    }
  },

  getPlugin: async (name: string) => {
    set({ pluginsError: null });
    try {
      return await adminManager.getPlugin(name);
    } catch (error) {
      set({ pluginsError: errMessage(error, 'Failed to load plugin') });
      throw error;
    }
  },

  installPlugin: async (url: string) => {
    set({ pluginsError: null });
    try {
      const plugin = await adminManager.installPlugin(url);
      await get().loadPlugins();
      return plugin;
    } catch (error) {
      set({ pluginsError: errMessage(error, 'Failed to install plugin') });
      throw error;
    }
  },

  updatePluginSettings: async (
    name: string,
    settings: Record<string, unknown>
  ) => {
    set({ pluginsError: null });
    try {
      const updated = await adminManager.updatePluginSettings(name, settings);
      // Reflect the refreshed enabled/settings in the list row.
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.name === name ? { ...p, ...updated } : p
        ),
      }));
      return updated;
    } catch (error) {
      set({ pluginsError: errMessage(error, 'Failed to save plugin settings') });
      throw error;
    }
  },

  enablePlugin: async (name: string) => {
    set({ pluginsError: null });
    try {
      await adminManager.enablePlugin(name);
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.name === name ? { ...p, enabled: true } : p
        ),
      }));
    } catch (error) {
      set({ pluginsError: errMessage(error, 'Failed to enable plugin') });
      throw error;
    }
  },

  disablePlugin: async (name: string) => {
    set({ pluginsError: null });
    try {
      await adminManager.disablePlugin(name);
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.name === name ? { ...p, enabled: false } : p
        ),
      }));
    } catch (error) {
      set({ pluginsError: errMessage(error, 'Failed to disable plugin') });
      throw error;
    }
  },

  uninstallPlugin: async (name: string) => {
    set({ pluginsError: null });
    try {
      await adminManager.uninstallPlugin(name);
      set((state) => ({
        plugins: state.plugins.filter((p) => p.name !== name),
      }));
    } catch (error) {
      set({ pluginsError: errMessage(error, 'Failed to uninstall plugin') });
      throw error;
    }
  },

  loadCatalog: async () => {
    set({ catalogLoading: true, catalogError: null });
    try {
      const catalog = await adminManager.getPluginCatalog();
      set({ catalog, catalogLoading: false });
    } catch (error) {
      set({
        catalogError: errMessage(error, 'Failed to load catalog'),
        catalogLoading: false,
      });
    }
  },

  addCatalogSource: async (url: string) => {
    set({ catalogError: null });
    try {
      await adminManager.addCatalogSource(url);
      await get().loadCatalog();
    } catch (error) {
      set({ catalogError: errMessage(error, 'Failed to add source') });
      throw error;
    }
  },

  removeCatalogSource: async (url: string) => {
    set({ catalogError: null });
    try {
      await adminManager.removeCatalogSource(url);
      await get().loadCatalog();
    } catch (error) {
      set({ catalogError: errMessage(error, 'Failed to remove source') });
      throw error;
    }
  },

  // ── Auth providers (E10c) ──
  loadAuthProviders: async () => {
    set({ authProvidersLoading: true, authProvidersError: null });
    try {
      const authProviders = await adminManager.getAuthProviders();
      set({ authProviders, authProvidersLoading: false });
    } catch (error) {
      set({
        authProvidersError: errMessage(error, 'Failed to load auth providers'),
        authProvidersLoading: false,
      });
    }
  },

  enableAuthProvider: async (name: string) => {
    set({ authProvidersError: null });
    try {
      const result = await adminManager.enableAuthProvider(name);
      await get().loadAuthProviders();
      return result;
    } catch (error) {
      set({
        authProvidersError: errMessage(error, 'Failed to enable provider'),
      });
      throw error;
    }
  },

  disableAuthProvider: async (name: string) => {
    set({ authProvidersError: null });
    try {
      const result = await adminManager.disableAuthProvider(name);
      await get().loadAuthProviders();
      return result;
    } catch (error) {
      set({
        authProvidersError: errMessage(error, 'Failed to disable provider'),
      });
      throw error;
    }
  },

  getAuthProviderConfigSchema: async (name: string) => {
    set({ authProvidersError: null });
    try {
      return await adminManager.getAuthProviderConfigSchema(name);
    } catch (error) {
      set({
        authProvidersError: errMessage(error, 'Failed to load config schema'),
      });
      throw error;
    }
  },

  // ── Server settings (E10c) ──
  loadServerSettings: async () => {
    set({ serverSettingsLoading: true, serverSettingsError: null });
    try {
      const serverSettings = await adminManager.getServerSettings();
      set({ serverSettings, serverSettingsLoading: false });
    } catch (error) {
      set({
        serverSettingsError: errMessage(error, 'Failed to load settings'),
        serverSettingsLoading: false,
      });
    }
  },

  updateServerSettings: async (settings: Record<string, unknown>) => {
    set({ serverSettingsError: null });
    try {
      const updated = await adminManager.updateServerSettings(settings);
      set({ serverSettings: updated });
      return updated;
    } catch (error) {
      set({ serverSettingsError: errMessage(error, 'Failed to save settings') });
      throw error;
    }
  },
}));

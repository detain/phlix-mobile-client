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
} from '../types/admin';
import type {
  CreateUserResult,
  ResetPasswordResult,
  CreateLibraryResult,
  JobTriggerResult,
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
}));

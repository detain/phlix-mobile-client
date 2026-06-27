// src/api/index.ts
export { default as apiClient, setActiveSessionId } from './client';
export {
  default as authManager,
  type LoginResponse,
  type RegisterResponse,
  type RegisterPending,
  type User,
} from './AuthManager';
export {
  default as libraryManager,
  type PaginatedResponse,
  type BrowseMediaParams,
} from './LibraryManager';
export { default as userManager, type UserSettings } from './UserManager';
export { default as profileManager } from './ProfileManager';
export {
  default as adminManager,
  type CreateUserResult,
  type ResetPasswordResult,
  type CreateLibraryResult,
  type JobTriggerResult,
} from './AdminManager';
export {
  default as playbackManager,
  type CreateSessionParams,
  type ReportProgressParams,
} from './PlaybackManager';
export {
  default as transcodeManager,
  type PrepareOptions,
  type PrepareResult,
  type PrepareHandle,
} from './TranscodeManager';
export {
  default as markerManager,
  isWithinMarker,
  type MarkersResponse,
} from './MarkerManager';
export {
  getDeviceId,
  getDeviceName,
  getCachedDeviceId,
  initDeviceIdentity,
} from './deviceIdentity';

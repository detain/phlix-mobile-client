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
export type {
  LetterIndex,
  LetterIndexEntry,
  MediaFilters,
  RatingOption,
  SortOption,
  SortOrder,
} from '../types/search';
export { default as userManager, type UserSettings } from './UserManager';
export { default as profileManager } from './ProfileManager';
export {
  default as adminManager,
  type CreateUserResult,
  type ResetPasswordResult,
  type CreateLibraryResult,
  type JobTriggerResult,
  type AuthProviderToggleResult,
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
  default as castManager,
  type CastMediaInput,
} from './CastManager';
export {
  default as liveTvManager,
  isNotConfiguredError,
} from './LiveTvManager';
export {
  default as musicManager,
  type TracksResponse,
} from './MusicManager';
export {
  default as photoManager,
  type PhotosResponse,
  type SlideshowResponse,
} from './PhotoManager';
export {
  default as collectionManager,
  type CollectionWithItems,
  type BulkAddResult,
} from './CollectionManager';
export {
  getDeviceId,
  getDeviceName,
  getCachedDeviceId,
  initDeviceIdentity,
} from './deviceIdentity';

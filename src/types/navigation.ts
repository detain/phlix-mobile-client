/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/types/navigation.ts
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

// Root Stack
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  // `streamUrl`/`liveTitle` are ADDITIVE (E8 Live TV): when `streamUrl` is
  // present the player plays it directly and SKIPS the itemId
  // detail-fetch/transcode lifecycle. The existing itemId path is unchanged.
  Player: {
    itemId: string;
    startPosition?: number;
    streamUrl?: string;
    liveTitle?: string;
  };
  Profiles: undefined;
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminLibraries: undefined;
  // E10c (Remaining admin part 1).
  AdminPlugins: undefined;
  AdminAuthProviders: undefined;
  AdminServerSettings: undefined;
  // E10d (Remaining admin part 2). AdminFsBrowse doubles as a path picker:
  // in `mode:'pick'` it offers a "Select this folder" action that sets
  // `fsPickedPath` on useAdminStore for AdminLibraries to consume.
  AdminBackup: undefined;
  AdminLogs: undefined;
  AdminFsBrowse: { mode?: 'browse' | 'pick' } | undefined;
  LiveTv: undefined;
  LiveTvRecordings: undefined;
  // E9a (Music). Music aggregates across all music libs server-side, so
  // `libraryId` is informational only.
  Music: { libraryId?: string };
  MusicAlbum: { albumName: string };
  // E9b (Photos). `library_id` is REQUIRED on the album/photo/slideshow routes.
  // PhotoViewer re-fetches the album by (albumId, libraryId) and uses
  // startIndex — photo arrays are NEVER passed through nav params.
  Photos: { libraryId?: string };
  PhotoAlbum: { albumId: string; libraryId: string; title?: string };
  PhotoViewer: { libraryId: string; albumId: string; startIndex?: number };
  // E10a (Collections). CollectionDetail re-fetches the collection by id; only
  // serializable scalars are passed through nav params.
  Collections: undefined;
  CollectionDetail: { collectionId: string; title?: string };
  // E10 (Favorites). Account-level favorited items; the list re-fetches from
  // the server, so no params are passed.
  Favorites: undefined;
  // E10e (WebAuthn / passkeys). Passkey management for the current user;
  // re-fetches the credential list on mount, so no params are passed.
  Passkeys: undefined;
  Cast: {
    mediaItemId: string;
    streamUrl: string;
    title?: string;
    thumbnail?: string;
    durationSecs?: number;
  };
};

// Tab Navigator
export type TabParamList = {
  Home: undefined;
  Library: undefined;
  Search: undefined;
  Downloads: undefined;
  Settings: undefined;
};

// Home Stack
export type HomeStackParamList = {
  HomeMain: undefined;
  MediaDetail: { itemId: string };
  SeasonDetail: { seasonId: string };
};

// Library Stack
export type LibraryStackParamList = {
  LibraryMain: undefined;
  MediaDetail: { itemId: string };
};

// Search Stack
export type SearchStackParamList = {
  SearchMain: undefined;
  MediaDetail: { itemId: string };
};

// Screen props
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type HomeStackScreenProps<T extends keyof HomeStackParamList> =
  NativeStackScreenProps<HomeStackParamList, T>;

export type LibraryStackScreenProps<T extends keyof LibraryStackParamList> =
  NativeStackScreenProps<LibraryStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

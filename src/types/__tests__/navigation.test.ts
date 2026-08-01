/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/types/__tests__/navigation.test.ts
//
// `navigation.ts` declares navigation param lists and screen props types.
// These are compile-time shape assertions to ensure navigation params are
// correctly typed.
import type {
  RootStackParamList,
  TabParamList,
  HomeStackParamList,
  LibraryStackParamList,
  SearchStackParamList,
} from '../navigation';

describe('navigation types', () => {
  describe('RootStackParamList', () => {
    it('Login has no params', () => {
      const params: RootStackParamList['Login'] = undefined;
      expect(params).toBeUndefined();
    });

    it('Main has no params', () => {
      const params: RootStackParamList['Main'] = undefined;
      expect(params).toBeUndefined();
    });

    it('Player accepts itemId and optional fields', () => {
      const params: RootStackParamList['Player'] = {
        itemId: 'm123',
        startPosition: 120,
        streamUrl: 'https://server/stream.m3u8',
        liveTitle: 'Live TV',
      };
      expect(params.itemId).toBe('m123');
      expect(params.startPosition).toBe(120);
    });

    it('Player allows minimal params', () => {
      const params: RootStackParamList['Player'] = {
        itemId: 'm456',
      };
      expect(params.itemId).toBe('m456');
    });

    it('Profiles has no params', () => {
      const params: RootStackParamList['Profiles'] = undefined;
      expect(params).toBeUndefined();
    });

    it('AdminDashboard has no params', () => {
      const params: RootStackParamList['AdminDashboard'] = undefined;
      expect(params).toBeUndefined();
    });

    it('AdminUsers has no params', () => {
      const params: RootStackParamList['AdminUsers'] = undefined;
      expect(params).toBeUndefined();
    });

    it('AdminLibraries has no params', () => {
      const params: RootStackParamList['AdminLibraries'] = undefined;
      expect(params).toBeUndefined();
    });

    it('AdminPlugins has no params', () => {
      const params: RootStackParamList['AdminPlugins'] = undefined;
      expect(params).toBeUndefined();
    });

    it('AdminAuthProviders has no params', () => {
      const params: RootStackParamList['AdminAuthProviders'] = undefined;
      expect(params).toBeUndefined();
    });

    it('AdminServerSettings has no params', () => {
      const params: RootStackParamList['AdminServerSettings'] = undefined;
      expect(params).toBeUndefined();
    });

    it('AdminBackup has no params', () => {
      const params: RootStackParamList['AdminBackup'] = undefined;
      expect(params).toBeUndefined();
    });

    it('AdminLogs has no params', () => {
      const params: RootStackParamList['AdminLogs'] = undefined;
      expect(params).toBeUndefined();
    });

    it('AdminFsBrowse accepts optional mode', () => {
      const browseParams: RootStackParamList['AdminFsBrowse'] = { mode: 'browse' };
      expect(browseParams.mode).toBe('browse');

      const pickParams: RootStackParamList['AdminFsBrowse'] = { mode: 'pick' };
      expect(pickParams.mode).toBe('pick');

      const undefinedParams: RootStackParamList['AdminFsBrowse'] = undefined;
      expect(undefinedParams).toBeUndefined();
    });

    it('LiveTv has no params', () => {
      const params: RootStackParamList['LiveTv'] = undefined;
      expect(params).toBeUndefined();
    });

    it('LiveTvRecordings has no params', () => {
      const params: RootStackParamList['LiveTvRecordings'] = undefined;
      expect(params).toBeUndefined();
    });

    it('Music accepts optional libraryId', () => {
      const withLib: RootStackParamList['Music'] = { libraryId: 'lib-music' };
      expect(withLib.libraryId).toBe('lib-music');

      const withoutLib: RootStackParamList['Music'] = {};
      expect(withoutLib.libraryId).toBeUndefined();
    });

    it('MusicAlbum requires albumName', () => {
      const params: RootStackParamList['MusicAlbum'] = { albumName: 'Greatest Hits' };
      expect(params.albumName).toBe('Greatest Hits');
    });

    it('Photos accepts optional libraryId', () => {
      const withLib: RootStackParamList['Photos'] = { libraryId: 'lib-photos' };
      expect(withLib.libraryId).toBe('lib-photos');

      const withoutLib: RootStackParamList['Photos'] = {};
      expect(withoutLib.libraryId).toBeUndefined();
    });

    it('PhotoAlbum requires albumId and libraryId', () => {
      const params: RootStackParamList['PhotoAlbum'] = {
        albumId: 'album-123',
        libraryId: 'lib-photos',
        title: 'Vacation 2026',
      };
      expect(params.albumId).toBe('album-123');
      expect(params.libraryId).toBe('lib-photos');
      expect(params.title).toBe('Vacation 2026');
    });

    it('PhotoViewer requires libraryId and albumId', () => {
      const params: RootStackParamList['PhotoViewer'] = {
        libraryId: 'lib-photos',
        albumId: 'album-123',
        startIndex: 5,
      };
      expect(params.startIndex).toBe(5);
    });

    it('Collections has no params', () => {
      const params: RootStackParamList['Collections'] = undefined;
      expect(params).toBeUndefined();
    });

    it('CollectionDetail accepts collectionId and optional title', () => {
      const params: RootStackParamList['CollectionDetail'] = {
        collectionId: 'col-abc',
        title: 'My Favorites',
      };
      expect(params.collectionId).toBe('col-abc');
    });

    it('Favorites has no params', () => {
      const params: RootStackParamList['Favorites'] = undefined;
      expect(params).toBeUndefined();
    });

    it('WatchHistory has no params', () => {
      const params: RootStackParamList['WatchHistory'] = undefined;
      expect(params).toBeUndefined();
    });

    it('Passkeys has no params', () => {
      const params: RootStackParamList['Passkeys'] = undefined;
      expect(params).toBeUndefined();
    });

    it('ParentalControls has no params', () => {
      const params: RootStackParamList['ParentalControls'] = undefined;
      expect(params).toBeUndefined();
    });

    it('Cast requires mediaItemId and streamUrl', () => {
      const params: RootStackParamList['Cast'] = {
        mediaItemId: 'm123',
        streamUrl: 'https://server/stream.m3u8',
        title: 'Movie Title',
        thumbnail: 'https://example.com/thumb.jpg',
        durationSecs: 7200,
      };
      expect(params.mediaItemId).toBe('m123');
      expect(params.title).toBe('Movie Title');
      expect(params.durationSecs).toBe(7200);
    });
  });

  describe('TabParamList', () => {
    it('all tab screens have no params', () => {
      const home: TabParamList['Home'] = undefined;
      const library: TabParamList['Library'] = undefined;
      const search: TabParamList['Search'] = undefined;
      const downloads: TabParamList['Downloads'] = undefined;
      const settings: TabParamList['Settings'] = undefined;

      expect(home).toBeUndefined();
      expect(library).toBeUndefined();
      expect(search).toBeUndefined();
      expect(downloads).toBeUndefined();
      expect(settings).toBeUndefined();
    });
  });

  describe('HomeStackParamList', () => {
    it('HomeMain has no params', () => {
      const params: HomeStackParamList['HomeMain'] = undefined;
      expect(params).toBeUndefined();
    });

    it('MediaDetail requires itemId', () => {
      const params: HomeStackParamList['MediaDetail'] = { itemId: 'm123' };
      expect(params.itemId).toBe('m123');
    });

    it('SeasonDetail requires seasonId', () => {
      const params: HomeStackParamList['SeasonDetail'] = { seasonId: 's456' };
      expect(params.seasonId).toBe('s456');
    });

    it('Recommendations has no params', () => {
      const params: HomeStackParamList['Recommendations'] = undefined;
      expect(params).toBeUndefined();
    });
  });

  describe('LibraryStackParamList', () => {
    it('LibraryMain has no params', () => {
      const params: LibraryStackParamList['LibraryMain'] = undefined;
      expect(params).toBeUndefined();
    });

    it('MediaDetail requires itemId', () => {
      const params: LibraryStackParamList['MediaDetail'] = { itemId: 'm789' };
      expect(params.itemId).toBe('m789');
    });
  });

  describe('SearchStackParamList', () => {
    it('SearchMain has no params', () => {
      const params: SearchStackParamList['SearchMain'] = undefined;
      expect(params).toBeUndefined();
    });

    it('MediaDetail requires itemId', () => {
      const params: SearchStackParamList['MediaDetail'] = { itemId: 'm101' };
      expect(params.itemId).toBe('m101');
    });
  });
});

/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/UserManager.test.ts
import { userManager } from '../UserManager';
import apiClient from '../client';

jest.mock('../client');

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('UserManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getSettings GETs /users/me/settings and unwraps { settings }', async () => {
    mockedClient.get.mockResolvedValue({ settings: { theme: 'dark', max_streams: 3 } });

    const settings = await userManager.getSettings();

    expect(mockedClient.get).toHaveBeenCalledWith('/users/me/settings');
    expect(settings.max_streams).toBe(3);
  });

  it('updateSettings PUTs /users/me/settings with the partial body', async () => {
    mockedClient.put.mockResolvedValue({ message: 'ok' });

    await userManager.updateSettings({ theme: 'light' });

    expect(mockedClient.put).toHaveBeenCalledWith('/users/me/settings', { theme: 'light' });
  });

  it('getContinueWatching GETs /users/me/continue-watching and unwraps { items }', async () => {
    // Wire truth: rail rows carry TOP-LEVEL `position_ticks` (100ns). There is
    // no server `progress_percent` on the wire — the fixture used to fabricate
    // one (review mobile__gameux C-1: the client read fields that never land).
    mockedClient.get.mockResolvedValue({ items: [{ id: 'm1', name: 'A', type: 'movie', position_ticks: 420_000_000 }] });

    const items = await userManager.getContinueWatching();

    expect(mockedClient.get).toHaveBeenCalledWith('/users/me/continue-watching');
    expect(items[0].position_ticks).toBe(420_000_000);
  });

  it('getRecentlyWatched GETs /users/me/recently-watched and unwraps { items }', async () => {
    mockedClient.get.mockResolvedValue({ items: [] });

    await userManager.getRecentlyWatched();

    expect(mockedClient.get).toHaveBeenCalledWith('/users/me/recently-watched');
  });

  it('deleteHistoryItem DELETEs /users/me/history/{id}', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await userManager.deleteHistoryItem('m1');

    expect(mockedClient.delete).toHaveBeenCalledWith('/users/me/history/m1');
  });

  it('clearHistory DELETEs /users/me/history', async () => {
    mockedClient.delete.mockResolvedValue({ message: 'ok' });

    await userManager.clearHistory();

    expect(mockedClient.delete).toHaveBeenCalledWith('/users/me/history');
  });
});

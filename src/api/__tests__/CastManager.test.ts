/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/api/__tests__/CastManager.test.ts
import { castManager } from '../CastManager';
import apiClient from '../client';
import type { CastDevice } from '../../types/cast';

jest.mock('../client');

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const chromecast: CastDevice = {
  backend: 'chromecast',
  id: 'cc1',
  name: 'Living Room TV',
};
const roku: CastDevice = { backend: 'roku', id: 'rk1', name: 'Bedroom Roku' };
const airplay: CastDevice = {
  backend: 'airplay',
  id: 'ap1',
  name: 'Office AppleTV',
};
const dlna: CastDevice = { backend: 'dlna', id: 'udn-1', name: 'Den Renderer' };

const media = {
  mediaItemId: 'm1',
  mediaUrl: 'https://srv/stream?sig=abc',
  title: 'The Movie',
  thumbnail: 'https://srv/poster.jpg',
  durationSecs: 5400,
};

describe('CastManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Discovery: per-backend unwrap + normalization ──

  it('discover GETs all four backends and normalizes per-backend keys', async () => {
    mockedClient.get.mockImplementation(((url: string) => {
      switch (url) {
        case '/cast/devices':
          return Promise.resolve({
            devices: [{ device_id: 'cc1', name: 'Living Room TV', host: '10.0.0.5', port: 8009, model: 'Chromecast' }],
            count: 1,
          });
        case '/roku/devices':
          return Promise.resolve({
            devices: [{ device_id: 'rk1', name: 'Bedroom Roku', host: '10.0.0.6', software_version: '12.0' }],
            count: 1,
          });
        case '/airplay/devices':
          return Promise.resolve({
            devices: [{ device_id: 'ap1', name: 'Office AppleTV', supports_video: true }],
            count: 1,
          });
        case '/dlna/renderers':
          return Promise.resolve({
            renderers: [{ udn: 'udn-1', friendly_name: 'Den Renderer', manufacturer: 'Acme' }],
            count: 1,
          });
        default:
          return Promise.reject(new Error(`unexpected ${url}`));
      }
    }) as typeof mockedClient.get);

    const devices = await castManager.discover();

    expect(mockedClient.get).toHaveBeenCalledWith('/cast/devices');
    expect(mockedClient.get).toHaveBeenCalledWith('/roku/devices');
    expect(mockedClient.get).toHaveBeenCalledWith('/airplay/devices');
    expect(mockedClient.get).toHaveBeenCalledWith('/dlna/renderers');
    expect(devices).toHaveLength(4);

    const cc = devices.find((d) => d.backend === 'chromecast');
    expect(cc?.id).toBe('cc1');
    expect(cc?.name).toBe('Living Room TV');

    const dl = devices.find((d) => d.backend === 'dlna');
    expect(dl?.id).toBe('udn-1');
    expect(dl?.name).toBe('Den Renderer');

    const ap = devices.find((d) => d.backend === 'airplay');
    expect(ap?.supportsVideo).toBe(true);
  });

  it('discover is fault-tolerant: a rejected leg yields [] for that backend only', async () => {
    mockedClient.get.mockImplementation(((url: string) => {
      if (url === '/cast/devices') {
        return Promise.resolve({ devices: [{ device_id: 'cc1', name: 'TV' }], count: 1 });
      }
      if (url === '/roku/devices') {
        return Promise.reject(new Error('roku discovery socket timeout'));
      }
      return Promise.resolve({ devices: [], renderers: [], count: 0 });
    }) as typeof mockedClient.get);

    const devices = await castManager.discover();

    // Roku leg rejected → swallowed; Chromecast still present.
    expect(devices).toHaveLength(1);
    expect(devices[0].backend).toBe('chromecast');
  });

  it('discover handles missing devices/renderers keys gracefully', async () => {
    mockedClient.get.mockResolvedValue({});

    const devices = await castManager.discover();

    expect(devices).toEqual([]);
  });

  // ── Send / play: route + EXACT snake_case body ──

  it('castTo chromecast POSTs /cast/devices/{id}/cast with media_url + mime_type default', async () => {
    mockedClient.post.mockResolvedValue({ session_id: 's1', device_id: 'cc1', state: 'playing' });

    const session = await castManager.castTo(chromecast, media);

    expect(mockedClient.post).toHaveBeenCalledWith('/cast/devices/cc1/cast', {
      media_url: 'https://srv/stream?sig=abc',
      mime_type: 'application/x-mpegurl',
      title: 'The Movie',
      duration: 5400,
    });
    expect(session.sessionId).toBe('s1');
    expect(session.deviceId).toBe('cc1');
  });

  it('castTo roku POSTs /roku/devices/{id}/send with media_url + thumbnail', async () => {
    mockedClient.post.mockResolvedValue({ session_id: 's2', device_id: 'rk1' });

    await castManager.castTo(roku, media);

    expect(mockedClient.post).toHaveBeenCalledWith('/roku/devices/rk1/send', {
      media_url: 'https://srv/stream?sig=abc',
      mime_type: 'application/x-mpegurl',
      title: 'The Movie',
      thumbnail: 'https://srv/poster.jpg',
    });
  });

  it('castTo airplay POSTs /airplay/devices/{id}/stream with audio_url + content_type default', async () => {
    mockedClient.post.mockResolvedValue({ session_id: 's3', device_id: 'ap1' });

    await castManager.castTo(airplay, media);

    expect(mockedClient.post).toHaveBeenCalledWith('/airplay/devices/ap1/stream', {
      audio_url: 'https://srv/stream?sig=abc',
      content_type: 'audio/mp4',
      duration: 5400,
    });
  });

  it('castTo dlna POSTs /dlna/renderers/{id}/play with media_item_id + uri + metadata', async () => {
    mockedClient.post.mockResolvedValue({ session_id: 's4', renderer_id: 'udn-1' });

    const session = await castManager.castTo(dlna, media);

    expect(mockedClient.post).toHaveBeenCalledWith('/dlna/renderers/udn-1/play', {
      media_item_id: 'm1',
      uri: 'https://srv/stream?sig=abc',
      metadata: { title: 'The Movie' },
    });
    // renderer_id maps to deviceId on the normalized session.
    expect(session.deviceId).toBe('udn-1');
  });

  it('castTo honors a custom mimeType over the default', async () => {
    mockedClient.post.mockResolvedValue({ session_id: 's5' });

    await castManager.castTo(chromecast, { ...media, mimeType: 'video/mp4' });

    expect(mockedClient.post).toHaveBeenCalledWith(
      '/cast/devices/cc1/cast',
      expect.objectContaining({ mime_type: 'video/mp4' })
    );
  });

  it('castTo omits optional fields when not supplied', async () => {
    mockedClient.post.mockResolvedValue({ session_id: 's6' });

    await castManager.castTo(chromecast, { mediaItemId: 'm1', mediaUrl: 'u' });

    expect(mockedClient.post).toHaveBeenCalledWith('/cast/devices/cc1/cast', {
      media_url: 'u',
      mime_type: 'application/x-mpegurl',
    });
  });

  // ── Pause ──

  it('pause chromecast POSTs /cast/devices/{id}/pause', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.pause(chromecast);
    expect(mockedClient.post).toHaveBeenCalledWith('/cast/devices/cc1/pause');
  });

  it('pause roku POSTs key/Play (toggle)', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.pause(roku);
    expect(mockedClient.post).toHaveBeenCalledWith('/roku/devices/rk1/key/Play');
  });

  it('pause airplay POSTs /airplay/devices/{id}/pause', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.pause(airplay);
    expect(mockedClient.post).toHaveBeenCalledWith('/airplay/devices/ap1/pause');
  });

  it('pause dlna POSTs /dlna/renderers/{id}/pause', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.pause(dlna);
    expect(mockedClient.post).toHaveBeenCalledWith('/dlna/renderers/udn-1/pause');
  });

  // ── Resume (capability-gated: DLNA no-op) ──

  it('resume chromecast POSTs /cast/devices/{id}/play', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.resume(chromecast);
    expect(mockedClient.post).toHaveBeenCalledWith('/cast/devices/cc1/play');
  });

  it('resume roku POSTs key/Play (toggle)', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.resume(roku);
    expect(mockedClient.post).toHaveBeenCalledWith('/roku/devices/rk1/key/Play');
  });

  it('resume airplay POSTs /airplay/devices/{id}/resume', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.resume(airplay);
    expect(mockedClient.post).toHaveBeenCalledWith('/airplay/devices/ap1/resume');
  });

  it('resume dlna is a NO-OP (no resume endpoint)', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.resume(dlna);
    expect(mockedClient.post).not.toHaveBeenCalled();
  });

  // ── Stop (capability-gated: Roku no-op) ──

  it('stop chromecast POSTs /cast/devices/{id}/stop', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.stop(chromecast);
    expect(mockedClient.post).toHaveBeenCalledWith('/cast/devices/cc1/stop');
  });

  it('stop airplay POSTs /airplay/devices/{id}/stop', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.stop(airplay);
    expect(mockedClient.post).toHaveBeenCalledWith('/airplay/devices/ap1/stop');
  });

  it('stop dlna POSTs /dlna/renderers/{id}/stop', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.stop(dlna);
    expect(mockedClient.post).toHaveBeenCalledWith('/dlna/renderers/udn-1/stop');
  });

  it('stop roku is a NO-OP (no reliable stop key)', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.stop(roku);
    expect(mockedClient.post).not.toHaveBeenCalled();
  });

  // ── Seek (capability-gated: only Chromecast + DLNA) ──

  it('seek chromecast POSTs /cast/devices/{id}/seek with position_ms', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.seek(chromecast, 42000);
    expect(mockedClient.post).toHaveBeenCalledWith('/cast/devices/cc1/seek', {
      position_ms: 42000,
    });
  });

  it('seek dlna POSTs /dlna/renderers/{id}/seek with position_ticks (ms × 10000)', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.seek(dlna, 42000);
    expect(mockedClient.post).toHaveBeenCalledWith('/dlna/renderers/udn-1/seek', {
      position_ticks: 420000000,
    });
  });

  it('seek roku is a NO-OP (cannot seek)', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.seek(roku, 42000);
    expect(mockedClient.post).not.toHaveBeenCalled();
  });

  it('seek airplay is a NO-OP (cannot seek)', async () => {
    mockedClient.post.mockResolvedValue({});
    await castManager.seek(airplay, 42000);
    expect(mockedClient.post).not.toHaveBeenCalled();
  });

  // ── Status: per-backend route + normalization ──

  it('status chromecast GETs /cast/devices/{id}/status and normalizes active/state', async () => {
    mockedClient.get.mockResolvedValue({
      device_id: 'cc1',
      active: true,
      state: 'playing',
      session_id: 's1',
    });

    const status = await castManager.status(chromecast);

    expect(mockedClient.get).toHaveBeenCalledWith('/cast/devices/cc1/status');
    expect(status).toEqual({ active: true, state: 'playing', sessionId: 's1' });
  });

  it('status roku GETs /roku/devices/{id}/status', async () => {
    mockedClient.get.mockResolvedValue({ device_id: 'rk1', active: false });
    const status = await castManager.status(roku);
    expect(mockedClient.get).toHaveBeenCalledWith('/roku/devices/rk1/status');
    expect(status.active).toBe(false);
  });

  it('status airplay GETs /airplay/devices/{id}/status', async () => {
    mockedClient.get.mockResolvedValue({ device_id: 'ap1', active: true, state: 'paused' });
    const status = await castManager.status(airplay);
    expect(mockedClient.get).toHaveBeenCalledWith('/airplay/devices/ap1/status');
    expect(status.state).toBe('paused');
  });

  it('status dlna GETs /dlna/renderers/{id}/status and reads has_active_session/session_state', async () => {
    mockedClient.get.mockResolvedValue({
      renderer_id: 'udn-1',
      has_active_session: true,
      session_state: 'PLAYING',
    });

    const status = await castManager.status(dlna);

    expect(mockedClient.get).toHaveBeenCalledWith('/dlna/renderers/udn-1/status');
    expect(status).toEqual({ active: true, state: 'PLAYING', sessionId: undefined });
  });
});

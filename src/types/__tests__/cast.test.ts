// src/types/__tests__/cast.test.ts
import {
  CAST_BACKENDS,
  backendLabel,
  canResume,
  canSeek,
  canStop,
  normalizeAirplay,
  normalizeChromecast,
  normalizeDlna,
  normalizeRoku,
  normalizeSession,
  normalizeStatus,
} from '../cast';

describe('cast capability helpers', () => {
  it('canResume is true for all backends except dlna', () => {
    expect(canResume('chromecast')).toBe(true);
    expect(canResume('roku')).toBe(true);
    expect(canResume('airplay')).toBe(true);
    expect(canResume('dlna')).toBe(false);
  });

  it('canStop is true for all backends except roku', () => {
    expect(canStop('chromecast')).toBe(true);
    expect(canStop('roku')).toBe(false);
    expect(canStop('airplay')).toBe(true);
    expect(canStop('dlna')).toBe(true);
  });

  it('canSeek is true only for chromecast and dlna', () => {
    expect(canSeek('chromecast')).toBe(true);
    expect(canSeek('dlna')).toBe(true);
    expect(canSeek('roku')).toBe(false);
    expect(canSeek('airplay')).toBe(false);
  });

  it('CAST_BACKENDS lists all four backends', () => {
    expect(CAST_BACKENDS).toEqual(['chromecast', 'roku', 'airplay', 'dlna']);
  });

  it('backendLabel returns human labels', () => {
    expect(backendLabel('chromecast')).toBe('Chromecast');
    expect(backendLabel('roku')).toBe('Roku');
    expect(backendLabel('airplay')).toBe('AirPlay');
    expect(backendLabel('dlna')).toBe('DLNA');
  });
});

describe('cast device normalization', () => {
  it('normalizeChromecast maps device_id → id, host:port → detail', () => {
    expect(
      normalizeChromecast({ device_id: 'cc1', name: 'TV', host: '10.0.0.5', port: 8009, model: 'Gen3' })
    ).toEqual({
      backend: 'chromecast',
      id: 'cc1',
      name: 'TV',
      model: 'Gen3',
      detail: '10.0.0.5:8009',
    });
  });

  it('normalizeChromecast falls back to model then device_id for name', () => {
    expect(normalizeChromecast({ device_id: 'cc1', model: 'Gen3' }).name).toBe('Gen3');
    expect(normalizeChromecast({ device_id: 'cc1' }).name).toBe('cc1');
  });

  it('normalizeRoku includes software version in detail', () => {
    const d = normalizeRoku({
      device_id: 'rk1',
      name: 'Roku',
      host: '10.0.0.6',
      port: 8060,
      software_version: '12.0',
    });
    expect(d.id).toBe('rk1');
    expect(d.detail).toContain('10.0.0.6:8060');
    expect(d.detail).toContain('v12.0');
  });

  it('normalizeAirplay carries supports_video → supportsVideo', () => {
    const d = normalizeAirplay({ device_id: 'ap1', name: 'AppleTV', supports_video: true });
    expect(d.backend).toBe('airplay');
    expect(d.supportsVideo).toBe(true);
  });

  it('normalizeDlna maps udn → id and friendly_name → name, manufacturer in detail', () => {
    const d = normalizeDlna({
      udn: 'udn-1',
      friendly_name: 'Den',
      host: '10.0.0.7',
      port: 1400,
      model_name: 'X',
      manufacturer: 'Acme',
    });
    expect(d.id).toBe('udn-1');
    expect(d.name).toBe('Den');
    expect(d.model).toBe('X');
    expect(d.detail).toContain('Acme');
  });

  it('normalizeDlna falls back to model_name then udn for name', () => {
    expect(normalizeDlna({ udn: 'udn-1', model_name: 'X' }).name).toBe('X');
    expect(normalizeDlna({ udn: 'udn-1' }).name).toBe('udn-1');
  });
});

describe('cast status / session normalization', () => {
  it('normalizeStatus reads active/state (chromecast-style)', () => {
    expect(normalizeStatus({ device_id: 'cc1', active: true, state: 'playing', session_id: 's1' })).toEqual({
      active: true,
      state: 'playing',
      sessionId: 's1',
    });
  });

  it('normalizeStatus reads has_active_session/session_state (dlna-style)', () => {
    expect(normalizeStatus({ renderer_id: 'udn-1', has_active_session: true, session_state: 'PLAYING' })).toEqual({
      active: true,
      state: 'PLAYING',
      sessionId: undefined,
    });
  });

  it('normalizeStatus defaults active to false when both flags absent', () => {
    expect(normalizeStatus({}).active).toBe(false);
  });

  it('normalizeSession maps renderer_id → deviceId when device_id absent', () => {
    expect(normalizeSession({ session_id: 's4', renderer_id: 'udn-1', state: 'playing' })).toEqual({
      sessionId: 's4',
      deviceId: 'udn-1',
      state: 'playing',
    });
  });

  it('normalizeSession prefers device_id over renderer_id', () => {
    expect(normalizeSession({ device_id: 'cc1', renderer_id: 'udn-1' }).deviceId).toBe('cc1');
  });
});

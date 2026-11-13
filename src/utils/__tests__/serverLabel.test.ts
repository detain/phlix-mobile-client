import { serverCardLabel, isLiveTvEnabled, DEFAULT_SERVER_HOST } from '../serverLabel';

describe('serverLabel', () => {
  it('prefers name, then host, then default host', () => {
    expect(serverCardLabel('Home', 'https://x.example:8096')).toBe('Home');
    expect(serverCardLabel('', 'https://x.example:8096')).toBe('x.example');
    expect(serverCardLabel('', '')).toBe(DEFAULT_SERVER_HOST);
  });
  it('hides Live TV only on an explicit false flag', () => {
    expect(isLiveTvEnabled(undefined)).toBe(true);
    expect(isLiveTvEnabled({})).toBe(true);
    expect(isLiveTvEnabled({ livetv_enabled: false })).toBe(false);
    expect(isLiveTvEnabled({ livetv_enabled: true })).toBe(true);
    // Guessed aliases are no longer honoured (MOB-S12): the row fails open.
    expect(isLiveTvEnabled({ live_tv_enabled: false })).toBe(true);
  });
});

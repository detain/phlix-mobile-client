/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/player/__tests__/quality.test.ts
import { AUTO_QUALITY } from '@phlix/contracts';
import type { Rendition } from '@phlix/contracts';
import {
  buildQualityOptions,
  resolveQualityUrl,
  seedQualitySelection,
  activeQualityLabel,
} from '../quality';

const MASTER = 'https://srv/hls/job-1/master.m3u8?sig=a';

const rung = (
  id: Rendition['id'],
  over: Partial<Rendition> = {},
): Rendition => ({
  id,
  label: id,
  width: 1280,
  height: 720,
  bitrate: 3_000_000,
  codecs: 'avc1.640029,mp4a.40.2',
  url: `https://srv/hls/job-1/media_v${id}.m3u8?sig=a`,
  is_original: false,
  is_copy: false,
  video_bitrate: 2_800_000,
  ...over,
});

describe('buildQualityOptions', () => {
  it('prepends Auto (master) then keeps rungs highest-first', () => {
    const variants = [rung('1080p'), rung('720p'), rung('480p')];
    const options = buildQualityOptions(variants, MASTER);

    expect(options.map((o) => o.value)).toEqual([AUTO_QUALITY, '1080p', '720p', '480p']);
    expect(options[0]).toEqual({ value: AUTO_QUALITY, label: 'Auto', url: MASTER });
    expect(options[1].url).toBe('https://srv/hls/job-1/media_v1080p.m3u8?sig=a');
  });

  it('drops rungs with a null/empty url (not pinnable)', () => {
    const variants = [rung('1080p', { url: null }), rung('720p', { url: '' }), rung('480p')];
    const options = buildQualityOptions(variants, MASTER);

    expect(options.map((o) => o.value)).toEqual([AUTO_QUALITY, '480p']);
  });

  it('returns [] when there is neither a master nor any pinnable rung', () => {
    expect(buildQualityOptions([], '')).toEqual([]);
    expect(buildQualityOptions(null, undefined)).toEqual([]);
    expect(buildQualityOptions([rung('720p', { url: null })], '')).toEqual([]);
  });

  it('keeps Auto-only when a master exists but no rungs are pinnable', () => {
    const options = buildQualityOptions([rung('720p', { url: null })], MASTER);
    expect(options).toEqual([{ value: AUTO_QUALITY, label: 'Auto', url: MASTER }]);
  });
});

describe('resolveQualityUrl', () => {
  const variants = [rung('1080p'), rung('720p'), rung('480p')];

  it('returns the master for Auto (native ABR)', () => {
    expect(resolveQualityUrl(variants, AUTO_QUALITY, MASTER)).toBe(MASTER);
  });

  it('returns the pinned rungs own media playlist', () => {
    expect(resolveQualityUrl(variants, '720p', MASTER)).toBe(
      'https://srv/hls/job-1/media_v720p.m3u8?sig=a',
    );
  });

  it('falls back to the master for an unknown or urlless rung', () => {
    expect(resolveQualityUrl(variants, '2160p', MASTER)).toBe(MASTER);
    expect(resolveQualityUrl([rung('720p', { url: null })], '720p', MASTER)).toBe(MASTER);
    expect(resolveQualityUrl(null, '720p', MASTER)).toBe(MASTER);
  });
});

describe('seedQualitySelection', () => {
  const variants = [rung('1080p'), rung('720p'), rung('480p')];

  it('honours a persisted rung that is actually available', () => {
    expect(seedQualitySelection('720p', variants)).toBe('720p');
  });

  it('falls back to Auto for auto / unknown / stale / empty preferences', () => {
    expect(seedQualitySelection('auto', variants)).toBe(AUTO_QUALITY);
    expect(seedQualitySelection('2160p', variants)).toBe(AUTO_QUALITY);
    expect(seedQualitySelection(undefined, variants)).toBe(AUTO_QUALITY);
    expect(seedQualitySelection('', variants)).toBe(AUTO_QUALITY);
    expect(seedQualitySelection('720p', null)).toBe(AUTO_QUALITY);
  });

  it('does not honour a preferred rung whose url is null (not pinnable)', () => {
    expect(seedQualitySelection('1080p', [rung('1080p', { url: null })])).toBe(AUTO_QUALITY);
  });
});

describe('activeQualityLabel', () => {
  it('returns the matching options label', () => {
    const options = buildQualityOptions([rung('720p')], MASTER);
    expect(activeQualityLabel(options, '720p')).toBe('720p');
    expect(activeQualityLabel(options, AUTO_QUALITY)).toBe('Auto');
  });

  it('defaults to Auto when the selection is not in the option list', () => {
    expect(activeQualityLabel([], '1080p')).toBe('Auto');
  });
});

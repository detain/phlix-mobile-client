/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/components/CloseGlyph.test.tsx
//
// MW-103 (review mobile__gameux #4 — the M-MOBILE-46 recipe applied to the
// close family): every modal-dismiss control was a bare 20pt `✕` — no
// accessible name on the unlabeled sites, touch region equal to the glyph.
// CloseGlyph IS the law now: required label, role, 44pt effective via
// hitSlop, bounded text growth. These pins call the component as a function
// (renderer-free doctrine) and fs-scan the eight former sites.

import type { ReactElement } from 'react';
import * as fs from 'fs';
import * as path from 'path';

import CloseGlyph from '../../components/ui/CloseGlyph';
import { TEXT_MAX_FONT_SIZE_MULTIPLIER } from '../../utils/textScalePolicy';

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../../', rel), 'utf8');

describe('CloseGlyph contract (MW-103)', () => {
  const press = jest.fn();
  const el = CloseGlyph({
    onPress: press,
    accessibilityLabel: 'Close the thing',
  }) as ReactElement<Record<string, unknown>>;

  it('is a button with the mandatory label on the TOUCHABLE', () => {
    expect(el.props.accessibilityRole).toBe('button');
    expect(el.props.accessibilityLabel).toBe('Close the thing');
  });

  it('widens the press target to the 44pt floor via hitSlop', () => {
    // 20pt glyph / 24pt line box + 10pt slop per side = 44 effective.
    expect(el.props.hitSlop).toEqual({ top: 10, bottom: 10, left: 10, right: 10 });
  });

  it('pressing routes to onPress', () => {
    (el.props.onPress as () => void)();
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('the glyph text is the cross, chrome-white by default, bound-scaled', () => {
    const child = el.props.children as ReactElement<Record<string, unknown>>;
    expect(child.props.children).toBe('✕');
    expect(child.props.maxFontSizeMultiplier).toBe(TEXT_MAX_FONT_SIZE_MULTIPLIER);
    const styleList = child.props.style as Array<Record<string, unknown>>;
    expect(styleList).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );
  });

  it('the color prop recolors the ink and nothing else', () => {
    const dim = CloseGlyph({
      onPress: press,
      accessibilityLabel: 'x',
      color: '#888',
    }) as ReactElement<Record<string, unknown>>;
    const child = dim.props.children as ReactElement<Record<string, unknown>>;
    const styleList = child.props.style as Array<Record<string, unknown>>;
    expect(styleList).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#888' })])
    );
    expect(dim.props.accessibilityLabel).toBe('x');
  });
});

describe('every former bare close site now uses CloseGlyph (fs pins)', () => {
  const sites: Array<[string, string]> = [
    ['components/syncplay/SyncPlayModal.tsx', 'accessibilityLabel="Close SyncPlay"'],
    ['components/player/SubtitleTrackList.tsx', 'accessibilityLabel="Close subtitles menu"'],
    ['components/player/QualityMenu.tsx', 'accessibilityLabel="Close quality menu"'],
    ['components/player/AudioTrackList.tsx', 'accessibilityLabel="Close audio menu"'],
    ['components/player/SleepTimer.tsx', 'accessibilityLabel="Close sleep timer"'],
    ['screens/LiveTvRecordingsScreen.tsx', 'accessibilityLabel="Close schedule recording"'],
    ['components/ServerSwitcher.tsx', 'accessibilityLabel="Close server switcher"'],
  ];

  for (const [file, label] of sites) {
    it(`${file}: imports CloseGlyph, carries its label, and lost its raw glyph`, () => {
      const source = read(`src/${file}`);
      expect(source).toContain(`import CloseGlyph from`);
      expect(source).toContain('<CloseGlyph');
      expect(source).toContain(label);
      // The label lives ON THE GLYPH line (no un-labeled wrapper came back).
      const glyphLine = source
        .split('\n')
        .find((line) => line.includes('<CloseGlyph'));
      expect(glyphLine).toBeDefined();
      expect(glyphLine as string).toContain(label);
      // No hand-rolled ✕ survives in the screen's own JSX.
      expect(source).not.toContain('✕');
    });
  }

  it('SyncPlayModal has the glyph in BOTH modals (active group + lobby)', () => {
    const source = read('src/components/syncplay/SyncPlayModal.tsx');
    const uses = source.split('<CloseGlyph').length - 1;
    expect(uses).toBe(2);
  });

  it('the dead per-file close styles are gone (no orphan ink definitions)', () => {
    expect(read('src/components/syncplay/SyncPlayModal.tsx')).not.toMatch(/closeButton:/);
    for (const f of ['SubtitleTrackList', 'QualityMenu', 'AudioTrackList', 'SleepTimer']) {
      expect(read(`src/components/player/${f}.tsx`)).not.toMatch(/closeText:/);
    }
    expect(read('src/screens/LiveTvRecordingsScreen.tsx')).not.toMatch(/modalClose:/);
    // ServerSwitcher's old dim-glyph style retired; the color now rides the prop.
    expect(read('src/components/ServerSwitcher.tsx')).not.toMatch(/closeButton:/);
  });

  it('the ui barrel exports it', () => {
    expect(read('src/components/ui/index.ts')).toContain(
      `export { CloseGlyph } from './CloseGlyph';`
    );
  });
});

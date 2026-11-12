/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/__tests__/photoViewer.gate.test.ts
//
// MOB-S5 (fix-plan MOB-6, Major) — the M-MOBILE-75 downscale law reaches the
// full-screen photo pager. fs-gate precedent: loginScreen.gate.test.ts.
//
// PhotoViewerScreen pages through `full_url` — the ORIGINAL photo, not a
// thumbnail. Before this step the pager's <Image> carried no resizeMethod
// (Android "auto" may full-decode a 24MP JPEG to ~96MB of ARGB before
// scaling) and its FlatList ran on defaults (windowSize 21 / 10 initial /
// 10 per batch), so a quick swipe kept up to ~21 full-screen bitmaps live.
// The law: decode at the on-screen size, and cap the mounted window to the
// focused page plus one neighbour either side (windowSize 3–5), mounting a
// single page up front (initialNumToRender 1).

import fs from 'fs';
import path from 'path';

const viewer = fs.readFileSync(
  path.resolve(__dirname, '../PhotoViewerScreen.tsx'),
  'utf8'
);

/**
 * Source of every self-closing JSX element `<Tag …/>`. The tag must be
 * followed by whitespace so a generic like `useRef<FlatList<Photo>>` is
 * never mistaken for an element.
 */
function elementSource(src: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\s[\\s\\S]*?\\/>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push(m[0]);
  }
  return out;
}

/** Numeric value of a `prop={N}` literal inside an element's source. */
function numericProp(el: string, prop: string): number | null {
  const m = el.match(new RegExp(`\\b${prop}=\\{(\\d+)\\}`));
  return m ? Number(m[1]) : null;
}

describe('PhotoViewerScreen downscale law (M-MOBILE-75 / MOB-S5)', () => {
  it('every pager <Image> decodes at size (resizeMethod="resize")', () => {
    const images = elementSource(viewer, 'Image');
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img).toMatch(/\bresizeMethod="resize"/);
    }
  });

  it('the full-resolution source is the one being downscaled', () => {
    const fullImg = elementSource(viewer, 'Image').find((el) =>
      el.includes('item.full_url')
    );
    expect(fullImg).toBeDefined();
    expect(fullImg).toMatch(/\bresizeMethod="resize"/);
  });
});

describe('PhotoViewerScreen pager window caps (M-MOBILE-75 / MOB-S5)', () => {
  const pagers = elementSource(viewer, 'FlatList');

  it('there is exactly one horizontal paging FlatList', () => {
    expect(pagers).toHaveLength(1);
    expect(pagers[0]).toMatch(/\bhorizontal\b/);
    expect(pagers[0]).toMatch(/\bpagingEnabled\b/);
  });

  it('windowSize is capped to 3–5 (focused page ± one or two)', () => {
    const ws = numericProp(pagers[0], 'windowSize');
    expect(ws).not.toBeNull();
    expect(ws).toBeGreaterThanOrEqual(3);
    expect(ws).toBeLessThanOrEqual(5);
  });

  it('mounts a single page up front (initialNumToRender 1)', () => {
    expect(numericProp(pagers[0], 'initialNumToRender')).toBe(1);
  });

  it('batches stay page-sized (maxToRenderPerBatch ≤ 2)', () => {
    const batch = numericProp(pagers[0], 'maxToRenderPerBatch');
    expect(batch).not.toBeNull();
    expect(batch).toBeLessThanOrEqual(2);
  });

  it('keeps getItemLayout so initialScrollIndex lands without a measure pass', () => {
    expect(pagers[0]).toMatch(/\bgetItemLayout=\{getItemLayout\}/);
    expect(pagers[0]).toMatch(/\binitialScrollIndex=/);
  });
});

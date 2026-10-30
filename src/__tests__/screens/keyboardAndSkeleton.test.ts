/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/screens/keyboardAndSkeleton.test.ts
//
// M-MOBILE-47 (review mobile__gameux m13) + M-MOBILE-43 (m9), renderer-free
// source pins per the SeekBar.test doctrine:
//
//  * the Search filter sheet must avoid the keyboard and must NOT swallow the
//    first tap inside its ScrollView;
//  * every Login field must carry the keyboard's own action (next/go) and the
//    password field must SUBMIT on Enter;
//  * cold loads must render the layout-shaped skeletons (the re-fetch hold is
//    M-MOBILE-17 law, already shipped — its seam is re-pinned here too).

import * as fs from 'fs';
import * as path from 'path';

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../..', rel), 'utf8');

describe('M-MOBILE-47 — Search filter sheet', () => {
  const source = read('src/screens/SearchScreen.tsx');

  test('the sheet lives inside a KeyboardAvoidingView', () => {
    expect(source).toMatch(/<KeyboardAvoidingView[^>]*behavior="padding"[^>]*style=\{styles\.modalSheet\}/);
  });

  test('the body ScrollView keeps taps (first tap hits the field, not a dismiss)', () => {
    expect(source).toMatch(
      /<ScrollView\s+style=\{styles\.modalBody\}\s+keyboardShouldPersistTaps="handled"/
    );
  });
});

describe('M-MOBILE-47 — Login Enter path', () => {
  const source = read('src/screens/LoginScreen.tsx');

  test('server/username chain focus; password goes (submits)', () => {
    expect(source).toMatch(/returnKeyType="next"/);
    expect(source).toMatch(/returnKeyType="go"/);
    expect(source).toMatch(
      /onSubmitEditing=\{\(\) => usernameRef\.current\?\.focus\(\)\}/
    );
    expect(source).toMatch(
      /onSubmitEditing=\{\(\) => passwordRef\.current\?\.focus\(\)\}/
    );
    expect(source).toMatch(/onSubmitEditing=\{handleLogin\}/);
  });
});

describe('M-MOBILE-43 — cold loads render skeletons', () => {
  test('MediaDetail: DetailSkeleton on the cold branch', () => {
    const source = read('src/screens/MediaDetailScreen.tsx');
    expect(source).toMatch(/if \(isLoading\) \{[\s\S]{0,400}?<DetailSkeleton/);
    // And the M-MOBILE-17 hold law is intact: only a null item owns loading.
    expect(source).toMatch(/setIsLoading\(item === null\)/);
  });

  test('Search: GridSkeleton replaces the first-query full-screen spinner', () => {
    const source = read('src/screens/SearchScreen.tsx');
    expect(source).toMatch(
      /if \(loading && results\.length === 0\) \{[\s\S]{0,300}?<GridSkeleton/
    );
    expect(source).not.toMatch(/fullScreen/);
  });

  test('Home: GridSkeleton on the cold branch', () => {
    const source = read('src/screens/HomeScreen.tsx');
    expect(source).toMatch(/if \(isLoading\) \{[\s\S]{0,300}?<GridSkeleton/);
  });

  test('the skeleton loop is cancelled on unmount (no orphan Animation loops)', () => {
    expect(read('src/components/ui/ContentSkeleton.tsx')).toMatch(
      /return \(\) => loop\.stop\(\);/
    );
  });
});

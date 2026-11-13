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
    // MW-008 (review mobile__exploiter #1) rotated this pin: the old law
    // hard-coded `onSubmitEditing={handleLogin}` and was MEASURED red at the
    // parent — keyboard Go in signup mode fired POST /auth/login. The submit
    // must mirror the button's mode-aware dispatch (LoginScreen :278).
    expect(source).toMatch(
      /onSubmitEditing=\{mode === 'signup' \? handleSignup : handleLogin\}/
    );
    expect(source).not.toMatch(/onSubmitEditing=\{handleLogin\}/);
  });

  test('the focus chain walks the fields the mode actually renders', () => {
    // Signup inserts an Email field between Username and Password; the
    // Username "next" must reach it (MW-008 — the same affordance law: a
    // keyboard step must not skip a required signup field).
    expect(source).toMatch(/const emailRef = useRef<TextInput>\(null\)/);
    expect(source).toMatch(
      /onSubmitEditing=\{\(\) => \(mode === 'signup' \? emailRef\.current\?\.focus\(\) : passwordRef\.current\?\.focus\(\)\)\}/
    );
    // The refs must be ATTACHED — at the parent every chain handler focused a
    // ref no TextInput owned (zero `ref=` props in the file), so the whole
    // Enter path was inert decoration (MEASURED red: git-show of the parent
    // source greps zero ref attachments).
    expect(source).toMatch(/ref=\{usernameRef\}/);
    expect(source).toMatch(/ref=\{emailRef\}/);
    expect(source).toMatch(/ref=\{passwordRef\}/);
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

// MW-116 (review mobile__gameux #1 + mobile__crossfe #6): six modal sheets
// (SyncPlay bottom sheet, Hub sign-in, collection create, profile editor +
// PIN, passkey rename, admin user form) place TextInputs with NO keyboard
// avoidance — the keyboard covers the field/focus while typing. The cure is
// ONE single-source component; these are renderer-free law pins per the
// SeekBar.test doctrine.
describe('MW-116 — modal sheets avoid the keyboard (single source)', () => {
  const sheetFiles = [
    'src/components/syncplay/SyncPlayModal.tsx',
    'src/screens/SettingsScreen.tsx',
    'src/screens/CollectionsScreen.tsx',
    'src/screens/ProfileSelectScreen.tsx',
    'src/screens/PasskeysScreen.tsx',
    'src/screens/AdminUsersScreen.tsx',
  ];

  test('ModalSheet is the one KeyboardAvoidingView source, behavior="padding"', () => {
    const sheet = read('src/components/ui/ModalSheet.tsx');
    expect(sheet).toMatch(/<KeyboardAvoidingView\s+behavior="padding"/);
    // Repo modal law (M-MOBILE-47, SearchScreen): inside a transparent Modal
    // Android's adjustResize never sees the dialog window, so 'height' is a
    // snapping bug — the component must NOT branch by platform.
    expect(sheet).not.toMatch(/Platform\.OS/);
  });

  test.each(sheetFiles)('%s drives its sheet through ModalSheet', (rel) => {
    const source = read(rel);
    expect(source).toMatch(/import ModalSheet(?:, \{[^}]*\})? from '.*\/ui\/ModalSheet'/);
    expect(source).toMatch(/<ModalSheet/);
  });

  test('SyncPlayModal takes the bottom-sheet variant (centered={false})', () => {
    expect(read('src/components/syncplay/SyncPlayModal.tsx')).toMatch(
      /<ModalSheet centered=\{false\}/
    );
  });

  test.each(sheetFiles)('%s does not hand-roll a second KeyboardAvoidingView', (rel) => {
    expect(read(rel)).not.toMatch(/<KeyboardAvoidingView/);
  });
});

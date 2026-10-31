/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/androidPermissions.gate.test.ts
/**
 * fs-gate precedent: versionSync.test.ts / routeManifest.gate.test.ts /
 * linking.test.ts (manifest reads). Review mobile__crossfe M3: at targetSdk
 * 36, Android 13+ refuses to grant runtime notification permission unless
 * POST_NOTIFICATIONS is declared — so without this line,
 * notifee.requestPermission() could NEVER authorize and every wired
 * notification would silently die on Android while working on iOS.
 */
import fs from 'fs';
import path from 'path';

const manifest = fs.readFileSync(
  path.resolve(__dirname, '../../android/app/src/main/AndroidManifest.xml'),
  'utf8'
);

describe('AndroidManifest notification permission (review mobile__crossfe M3)', () => {
  it('declares POST_NOTIFICATIONS so notifee.requestPermission can grant on Android 13+', () => {
    expect(manifest).toContain(
      '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'
    );
  });
});

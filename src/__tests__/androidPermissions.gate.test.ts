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

/**
 * MW-013 (review mobile__crossfe): the READ_MEDIA_* trio declared a gallery
 * capability the app does not have — zero MediaStore/Environment usage in
 * android/ and src/, zero PermissionsAndroid calls in src/ (so on API 33+ the
 * trio was never even requested). Dead media permissions surface in the
 * Play Store permission disclosure; retirement is fs-pinned HERE, so a
 * re-declaration (or a resurrection of the legacy pair) reddens the gate
 * instead of silently shipping. If a real gallery feature lands, its lane
 * updates this table in the SAME change that wires the consumer.
 */
describe('AndroidManifest media-permission retirement (review mobile__crossfe, MW-013)', () => {
  const DEAD_MEDIA_PERMISSIONS = [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_AUDIO',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
  ];

  it.each(DEAD_MEDIA_PERMISSIONS)('does not declare %s', (permission) => {
    expect(manifest).not.toContain(`<uses-permission android:name="${permission}"`);
  });
});

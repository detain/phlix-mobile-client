/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/__tests__/iosInfoPlist.gate.test.ts
/**
 * fs-gate precedent: androidPermissions.gate.test.ts / versionSync.test.ts.
 * Review mobile__casualgamer #3 (MAJORS): iOS 14+ gates LOCAL-NETWORK access
 * through a TCC-style privacy prompt keyed on NSLocalNetworkUsageDescription.
 * That gate is separate from App Transport Security — the plist's
 * NSAllowsArbitraryLoads (deliberate, see the M-MOBILE-12 comment) subsumes
 * NSAllowsLocalNetworking, but it does NOT supply the usage-description
 * string, so without this key the prompt cannot appear and connections to
 * LAN server addresses are silently denied on modern iOS. Second pin guards
 * the class of defect already trimmed once (empty-string
 * NSLocationWhenInUseUsageDescription, M-MOBILE-17): a declared usage
 * description that is blank is worse than none — it ships a prompt with no
 * purpose text.
 */
import fs from 'fs';
import path from 'path';

const plist = fs.readFileSync(
  path.resolve(__dirname, '../../ios/PhlixMobile/Info.plist'),
  'utf8'
);

describe('ios/PhlixMobile/Info.plist local-network privacy (review mobile__casualgamer #3)', () => {
  it('declares NSLocalNetworkUsageDescription with a real purpose string', () => {
    const match = plist.match(
      /<key>NSLocalNetworkUsageDescription<\/key>\s*<string>([^<]*)<\/string>/
    );
    expect(match).not.toBeNull();
    expect((match as RegExpMatchArray)[1].trim()).not.toBe('');
  });

  it('carries no empty NS*UsageDescription string (blank prompt class)', () => {
    const offenders: string[] = [];
    const pattern = /<key>(NS\w*UsageDescription)<\/key>\s*<string>([^<]*)<\/string>/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(plist)) !== null) {
      if (m[2].trim() === '') {
        offenders.push(m[1]);
      }
    }
    expect(offenders).toEqual([]);
  });
});

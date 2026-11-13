import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(
  path.join(__dirname, '../../screens/ProfileSelectScreen.tsx'),
  'utf8'
);

describe('ProfileSelectScreen PIN gate honesty (MOB-2/MOB-3)', () => {
  test('labels the PIN as a courtesy lock, not a security gate', () => {
    expect(src).toContain('Courtesy PIN');
    expect(src).not.toContain('is PIN-gated');
    expect(src).not.toContain('>Enter PIN<');
  });
  test('active badge is scoped to this phone', () => {
    expect(src).toContain('Active (this phone)');
  });
});

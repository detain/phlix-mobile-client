import { readFileSync } from 'fs';
import { join } from 'path';

// MOB-19: Android adjustResize already handles the keyboard; 'height' double-adjusts.
describe('LoginScreen KeyboardAvoidingView', () => {
  const src = readFileSync(join(__dirname, '..', 'LoginScreen.tsx'), 'utf8');
  it('pads on iOS only and leaves Android to adjustResize', () => {
    expect(src).toMatch(/behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}/);
    expect(src).not.toMatch(/'height'\s*\}/);
  });
});

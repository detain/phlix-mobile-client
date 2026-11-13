/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// MOB-1 pin: both Continue Watching entry points (card press and the play
// button) must route through the resume handler, never a bare restart.
import * as fs from 'fs';
import * as path from 'path';

describe('Home Continue Watching resume wiring', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'HomeScreen.tsx'), 'utf8');

  it('wires the rail play button to the resume handler', () => {
    expect(src).toMatch(/onItemPress=\{handleContinueWatchingPress\}/);
    expect(src).toMatch(/onItemPlay=\{handleContinueWatchingPress\}/);
  });

  it('resume handler passes a startPosition derived from position_ticks', () => {
    expect(src).toMatch(/startPosition:\s*ticksToSeconds\(item\.position_ticks/);
  });

  it('has no restart-from-zero Player navigate left on Home', () => {
    expect(src).not.toMatch(/navigate\('Player',\s*\{\s*itemId:\s*item\.id\s*\}\)/);
  });
});

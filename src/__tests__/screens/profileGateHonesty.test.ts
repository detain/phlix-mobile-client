import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// MOB-S2: assert against the user-visible literals the screen can render
// (string literals, template chunks, JSX text) parsed from the AST — NOT the
// raw source, so a comment or identifier can neither satisfy nor trip a pin.
const file = path.join(__dirname, '../../screens/ProfileSelectScreen.tsx');
const sf = ts.createSourceFile(
  file,
  fs.readFileSync(file, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

const literals: string[] = [];
const visit = (node: ts.Node): void => {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    literals.push(node.text);
  } else if (ts.isJsxText(node)) {
    literals.push(node.text.trim());
  }
  ts.forEachChild(node, visit);
};
visit(sf);

const rendered = (needle: string) => literals.some((l) => l.includes(needle));

describe('ProfileSelectScreen PIN gate honesty (MOB-2/MOB-3)', () => {
  test('the AST walk actually sees rendered copy (guards the extractor)', () => {
    expect(literals.length).toBeGreaterThan(10);
  });
  test('labels the PIN as a courtesy lock, not a security gate', () => {
    expect(rendered('Courtesy PIN')).toBe(true);
    expect(rendered('is PIN-gated')).toBe(false);
    expect(literals).not.toContain('Enter PIN');
  });
  test('active badge is scoped to this phone', () => {
    expect(rendered('Active (this phone)')).toBe(true);
  });
});

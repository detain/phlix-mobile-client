#!/usr/bin/env node
/**
 * add-copyright.mjs - Idempotent copyright-header injector for phlix-mobile-client.
 * Re-run produces zero diff when all files already have the header.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const COPYRIGHT = ' * @copyright 2026 Joe Huss <detain@interserver.net>';

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'vendor', '.git', 'coverage', '.github', '__tests__', 'android', 'ios', 'docs', '.logs']);
const EXCLUDE_FILES = new Set(['tokens.generated.ts', 'tokens.generated.json']);
const TS_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walk(full, files);
    } else {
      const ext = extname(entry.name);
      const base = basename(entry.name);
      if (TS_EXTS.has(ext) && !EXCLUDE_FILES.has(base) && !base.includes('.test.')) {
        files.push(full);
      }
    }
  }
  return files;
}

function isShebang(line) {
  return line.startsWith('#!');
}

function findDocblockEnd(lines, start) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('*/')) return i;
  }
  return -1;
}

function injectTsDocblock(content) {
  const lines = content.split('\n');

  let offset = 0;
  if (lines.length > 0 && isShebang(lines[0])) offset = 1;

  if (lines.length <= offset || !lines[offset].includes('/**')) return null;

  const docStart = offset;
  const docEnd = findDocblockEnd(lines, docStart);
  if (docEnd === -1) return null;

  const block = lines.slice(docStart, docEnd + 1).join('\n');
  if (block.includes('detain@interserver.net')) return null;

  let insertAfter = docStart + 1;
  for (let i = docStart + 1; i < docEnd; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed === '*/' || trimmed.startsWith('* @')) break;
    insertAfter = i;
  }

  const out = [...lines];
  out.splice(insertAfter + 1, 0, COPYRIGHT);
  return out.join('\n');
}

function prependTsDocblock(content) {
  const lines = content.split('\n');
  let offset = 0;
  if (lines.length > 0 && isShebang(lines[0])) offset = 1;

  const docblock = [
    '/**',
    ' * Phlix Mobile client.',
    ' *',
    COPYRIGHT,
    ' */',
    '',
  ];

  return [...lines.slice(0, offset), ...docblock, ...lines.slice(offset)].join('\n');
}

function processTsFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  if (content.includes('detain@interserver.net')) return null;
  return injectTsDocblock(content) ?? prependTsDocblock(content);
}

const srcFiles = walk('src');

// M38 (deferred lane): --check mode makes the header a CI gate, not a
// one-off migration. Exit 1 with the missing list; zero drift means exit 0.
// (A gate that only prints is theater — this one blocks.)
if (process.argv.includes('--check')) {
  const missing = srcFiles.filter(
    (file) => !readFileSync(file, 'utf8').includes('detain@interserver.net'),
  );
  for (const file of missing) {
    console.log('MISSING: ' + file);
  }
  console.log(
    `\nCheck: ${srcFiles.length - missing.length}/${srcFiles.length} file(s) carry the header, ${missing.length} missing.`,
  );
  process.exit(missing.length > 0 ? 1 : 0);
}

let changed = 0;
let skipped = 0;
const touched = [];

for (const file of srcFiles) {
  const newContent = processTsFile(file);

  if (newContent !== null) {
    writeFileSync(file, newContent, 'utf8');
    changed++;
    touched.push(file);
    console.log('ADDED: ' + file);
  } else {
    skipped++;
    console.log('SKIP:  ' + file);
  }
}

console.log(`\nDone: ${changed} file(s) updated, ${skipped} skipped.`);
if (touched.length > 0) {
  console.log('\nTouched:');
  for (const f of touched) console.log('  ' + f);
}

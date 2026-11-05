#!/usr/bin/env node
// Make a copy of index.html for publishing as a claude.ai Artifact, whose host wraps the page in
// its own <!doctype>/<html>/<head>/<body> skeleton: strip those four wrappers, keep everything else.
// Usage: node scripts/build-artifact.mjs <output.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2]; if (!out) { console.error('usage: node scripts/build-artifact.mjs <output.html>'); process.exit(1); }
let h = readFileSync(join(root, 'index.html'), 'utf8');
h = h.replace(/^<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
// title first, so the host finds it in the first 8KB
const t = h.match(/<title>[\s\S]*?<\/title>/i)[0]; h = t + '\n' + h.replace(t, '');
writeFileSync(out, h);
console.log(`${out}: ${(h.length / 1024).toFixed(0)} KB`);

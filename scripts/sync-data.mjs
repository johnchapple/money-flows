#!/usr/bin/env node
// Copy data/data.json, data/glossary.json and data/history.json into the DATA block at the top of
// index.html, so the page stays a single self-contained file. Run it after editing any data file.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.stringify(JSON.parse(readFileSync(join(root, f), 'utf8')));
const page = join(root, 'index.html');
const html = readFileSync(page, 'utf8');
const begin = html.indexOf('/* DATA:BEGIN'), end = html.indexOf('/* DATA:END */');
if (begin < 0 || end < 0) throw new Error('DATA markers not found in index.html');
const headerEnd = html.indexOf('*/', begin) + 2;
const block = `\nconst DATA = ${read('data/data.json')};\nconst GLOSSARY = ${read('data/glossary.json')};\nconst HISTORY = ${read('data/history.json')};\n`;
writeFileSync(page, html.slice(0, headerEnd) + block + html.slice(end));
console.log(`index.html: DATA block updated (${(block.length / 1024).toFixed(0)} KB)`);

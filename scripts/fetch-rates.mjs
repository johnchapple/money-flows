#!/usr/bin/env node
// Daily policy and money-market rates since 2024 for the rate-corridor chart → data/rates-history.json
// Sources (via FRED): FOMC target range (DFEDTARL/U), IORB, ON RRP award rate (RRPONTSYAWARD),
// EFFR, SOFR and SOFR 99th percentile (NY Fed). The standing repo minimum bid rate equals the top of
// the target range (FOMC implementation notes), so the chart uses DFEDTARU for it.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureProxy } from './lib/net.mjs';
ensureProxy();
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const START = '2024-01-01';
const ids = { lo: 'DFEDTARL', hi: 'DFEDTARU', iorb: 'IORB', rrp: 'RRPONTSYAWARD', effr: 'EFFR', sofr: 'SOFR', sofr99: 'SOFR99' };
const cols = {};
for (const [k, id] of Object.entries(ids)) {
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${START}`);
  if (!r.ok) throw new Error(`${id} ${r.status}`);
  cols[k] = new Map((await r.text()).trim().split('\n').slice(1).map((l) => l.split(',')).filter(([, v]) => v && v !== '.').map(([d, v]) => [d, +v]));
  console.log('ok', id, cols[k].size);
}
// Business days where SOFR is published; carry administered rates forward.
const days = [...cols.sofr.keys()].sort();
const last = {}; const rows = [];
for (const d of days) {
  const row = [d];
  for (const k of Object.keys(ids)) { if (cols[k].has(d)) last[k] = cols[k].get(d); row.push(last[k] ?? null); }
  rows.push(row);
}
writeFileSync(join(root, 'data/rates-history.json'), JSON.stringify({
  _meta: { fetched: new Date().toISOString().slice(0, 10), unit: '%', columns: ['date', ...Object.keys(ids)], fred: ids,
    note: 'Daily, business days with a published SOFR. Administered rates carried forward. Standing repo rate = top of target range (hi).' },
  rows }) + '\n');
console.log(rows.length, 'rows', rows.at(-1));

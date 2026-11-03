#!/usr/bin/env node
// Sanity checks for the Phase 0 data files. Exit code 1 on any failure.
//  - every glossary `related` id resolves
//  - every figure in data.json has value/asOf/status, and either source+url or formula
//  - simple accounting identities hold within tolerance
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = JSON.parse(readFileSync(join(root, 'data/glossary.json'), 'utf8')).terms;
const d = JSON.parse(readFileSync(join(root, 'data/data.json'), 'utf8'));
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// Glossary
const ids = Object.keys(g);
for (const [id, t] of Object.entries(g)) {
  for (const k of ['term', 'def', 'why', 'related', 'kind']) ok(t[k] !== undefined, `glossary ${id}: missing ${k}`);
  ok(['fact', 'heuristic'].includes(t.kind), `glossary ${id}: bad kind ${t.kind}`);
  for (const r of t.related || []) ok(r in g, `glossary ${id}: related "${r}" not found`);
}
ok(ids.length >= 60 && ids.length <= 80, `glossary has ${ids.length} terms (want 60–80)`);

// Figures
const statuses = Object.keys(d._meta.status_legend);
let n = 0;
(function walk(obj, path) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_') || typeof v !== 'object' || v === null || Array.isArray(v)) continue;
    if ('status' in v) {
      n++;
      const p = `${path}.${k}`;
      ok(statuses.includes(v.status), `${p}: unknown status ${v.status}`);
      ok('value' in v || 'series' in v || 'dates' in v, `${p}: no value/series/dates`);
      ok(v.asOf || v.series || v.dates || /^\d{4}-/.test(String(v.value)), `${p}: no asOf`);
      if (v.status === 'derived') ok(v.formula, `${p}: derived without formula`);
      else ok(v.url, `${p}: no url`);
    } else walk(v, `${path}.${k}`);
  }
})(d, 'data');

// Identities
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);
near(d.debt.debtHeldByPublic.value + d.debt.intragovernmental.value, d.debt.totalPublicDebt.value, 0.01, 'public + intragov = gross (Sep 30)');
const lp = d.debt.totalPublicDebtLatest;
near(lp.parts.debtHeldByPublic + lp.parts.intragovernmental, lp.value, 0.01, 'public + intragov = gross (latest)');
const c = d.composition;
near(c.bills.value + c.notes.value + c.bonds.value + c.tips.value + c.frn.value, d.debt.marketableTotal.value, 25, 'instruments sum to marketable (±25bn)');
const f = d.fed;
near(f.reserves.value + f.tga.value + f.reverseRepoTotal.value + f.currency.value + f.otherLiabilitiesAndCapital.value, f.totalAssets.value, 0.01, 'Fed assets = liabilities (starting state)');
near(d.budget.deficitFY2026.parts.outlays - d.budget.deficitFY2026.parts.receipts, d.budget.deficitFY2026.value, 2, 'outlays − receipts = deficit');

console.log(`${ids.length} glossary terms, ${n} figures checked`);
if (fails.length) { console.error('FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('all checks pass');

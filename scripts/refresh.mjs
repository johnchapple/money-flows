#!/usr/bin/env node
// Pull the latest figures straight from primary sources and write them to data/refresh-output.json
// for a human to compare with data/data.json. It never overwrites data.json.
//
// NOTE: NOT YET RUN. When this was written (2026-11-03), the session's network policy blocked
// api.fiscaldata.treasury.gov and fred.stlouisfed.org. Field names follow the published API docs,
// but they are unverified. The script prints the available fields whenever an expected one is missing.
//
// Usage: node scripts/refresh.mjs            (Node 18+; no dependencies)
//        node scripts/refresh.mjs --mspd     also rebuild data/maturities.json from MSPD detail (CUSIP-level)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FD = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const out = { pulledAt: new Date().toISOString(), figures: {}, errors: [] };

async function fd(path, params = {}) {
  const q = new URLSearchParams({ format: 'json', ...params });
  const url = `${FD}${path}?${q}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const j = await r.json();
  return { rows: j.data, url };
}
function need(row, field) {
  if (!(field in row)) throw new Error(`field "${field}" missing; available: ${Object.keys(row).join(', ')}`);
  return row[field];
}
const bn = (millions) => Math.round(+millions) / 1000;
async function step(name, fn) {
  try { await fn(); console.log('ok   ', name); }
  catch (e) { out.errors.push({ name, error: String(e.message || e) }); console.log('FAIL ', name, '-', e.message); }
}

// --- Treasury: Debt to the Penny ---
await step('debt_to_penny', async () => {
  const { rows, url } = await fd('/v2/accounting/od/debt_to_penny', { sort: '-record_date', 'page[size]': '30' });
  const [a] = rows; const b = rows[rows.length - 1];
  const days = (new Date(a.record_date) - new Date(b.record_date)) / 864e5;
  out.figures.totalPublicDebtLatest = { value: +need(a, 'tot_pub_debt_out_amt') / 1e9, asOf: a.record_date, url,
    parts: { debtHeldByPublic: +a.debt_held_public_amt / 1e9, intragovernmental: +a.intragov_hold_amt / 1e9 } };
  out.figures.dailyGrowthEstimate = { value: (a.tot_pub_debt_out_amt - b.tot_pub_debt_out_amt) / 1e9 / days, asOf: a.record_date,
    formula: `(${a.record_date} − ${b.record_date}) / ${days} days` };
});

// --- Treasury: MSPD Table I (summary by security type) ---
await step('mspd_table_1', async () => {
  const { rows, url } = await fd('/v1/debt/mspd/mspd_table_1', { sort: '-record_date', 'page[size]': '60' });
  const date = rows[0].record_date;
  const latest = rows.filter((r) => r.record_date === date);
  out.figures.mspdTable1 = { asOf: date, url, rows: latest.map((r) => ({
    type: r.security_type_desc, class: r.security_class_desc,
    public: bn(r.debt_held_public_mil_amt), intragov: bn(r.intragov_hold_mil_amt), total: bn(need(r, 'total_mil_amt')),
  })) };
});

// --- Treasury: Average interest rates ---
await step('avg_interest_rates', async () => {
  const { rows, url } = await fd('/v2/accounting/od/avg_interest_rates', { sort: '-record_date', 'page[size]': '40' });
  const date = rows[0].record_date;
  out.figures.avgRates = { asOf: date, url, rows: rows.filter((r) => r.record_date === date)
    .map((r) => ({ type: r.security_type_desc, security: r.security_desc, rate: +need(r, 'avg_interest_rate_amt') })) };
});

// --- Treasury: Daily Treasury Statement, TGA closing balance ---
await step('dts_operating_cash_balance', async () => {
  const { rows, url } = await fd('/v1/accounting/dts/operating_cash_balance', { sort: '-record_date', 'page[size]': '40' });
  const tga = rows.filter((r) => /closing balance/i.test(r.account_type));
  if (!tga.length) throw new Error(`no closing-balance row; account types: ${[...new Set(rows.map((r) => r.account_type))].join(' | ')}`);
  out.figures.tga = { value: bn(tga[0].open_today_bal ?? tga[0].opening_balance_today_amt), asOf: tga[0].record_date, url,
    note: 'DTS reports in millions. For the Closing Balance row, the "open today" field holds the closing amount; check this.' };
});

// --- FRED (no API key needed for fredgraph.csv) ---
const fredSeries = {
  WALCL: 'Fed total assets (Wed, $mn)', WRESBAL: 'Reserve balances (week avg, $bn)', WTREGEN: 'TGA (week avg, $mn)',
  RRPONTSYD: 'ON RRP ($bn, daily)', WCURCIR: 'Currency in circulation (week avg, $bn)', WLRRAFOIAL: 'Reverse repo: foreign official ($mn)',
  DGS3MO: '3m', DGS2: '2y', DGS5: '5y', DGS10: '10y', DGS20: '20y', DGS30: '30y',
  SOFR: 'SOFR', IORB: 'IORB', EFFR: 'EFFR', RPONTSYD: 'Standing repo take-up ($bn)',
};
for (const [id, label] of Object.entries(fredSeries)) {
  await step(`FRED ${id}`, async () => {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
    const r = await fetch(url); if (!r.ok) throw new Error(`${r.status}`);
    const lines = (await r.text()).trim().split('\n').slice(1).map((l) => l.split(',')).filter(([, v]) => v && v !== '.');
    const [d, v] = lines[lines.length - 1];
    out.figures[`fred_${id}`] = { label, value: +v, asOf: d, url: `https://fred.stlouisfed.org/series/${id}`,
      spark: lines.slice(-260).map(([dd, vv]) => [dd, +vv]) };
  });
}

// --- Optional: real maturity schedule from MSPD Table III (one row per CUSIP) ---
if (process.argv.includes('--mspd')) {
  await step('mspd_table_3_market (maturity schedule)', async () => {
    let page = 1, all = [], date;
    for (;;) {
      const { rows } = await fd('/v1/debt/mspd/mspd_table_3_market', { sort: '-record_date', 'page[size]': '10000', 'page[number]': String(page) });
      if (!rows.length) break;
      date ??= rows[0].record_date;
      const cur = rows.filter((r) => r.record_date === date);
      all.push(...cur);
      if (cur.length < rows.length) break;
      page++;
    }
    const fam = (t) => /bill/i.test(t) ? 'bills' : /inflation/i.test(t) ? 'tips' : /floating/i.test(t) ? 'frn' : /bond/i.test(t) ? 'bonds' : 'notes';
    const monthly = {}, yearly = {};
    for (const r of all) {
      const mat = need(r, 'maturity_date'); const amt = bn(r.outstanding_amt ?? r.total_mil_amt); if (!mat || !amt) continue;
      const f = fam(r.security_type_desc + ' ' + (r.security_class1_desc || ''));
      const rate = +(r.interest_rate_pct ?? r.yield_pct ?? 0);
      for (const [map, k] of [[monthly, mat.slice(0, 7)], [yearly, mat.slice(0, 4)]]) {
        map[k] ??= {}; map[k][f] ??= { amount: 0, couponDollars: 0 };
        map[k][f].amount += amt; map[k][f].couponDollars += amt * rate;
      }
    }
    out.figures.maturities = { asOf: date, status: 'primary', monthly, yearly, rows: all.length };
  });
}

writeFileSync(join(root, 'data/refresh-output.json'), JSON.stringify(out, null, 1));
console.log(`\n${Object.keys(out.figures).length} figures, ${out.errors.length} errors → data/refresh-output.json`);

#!/usr/bin/env node
// Build data/maturities.json from Treasury's MSPD Table III ("Detail of Marketable Treasury
// Securities Outstanding"), with one or more rows per CUSIP.
//
// How the table is laid out (checked 2026-11-03 against Table I totals, to the dollar):
//  - The first row of each CUSIP carries `outstanding_amt` (USD millions) for the whole CUSIP.
//    Later rows are reopenings, with outstanding_amt = null, but each has its own issued_amt and yield.
//  - Subtotal rows have maturity_date = null and are skipped.
//  - TIPS outstanding includes inflation compensation. Notes, bonds and TIPS: interest_rate_pct is the coupon.
//  - Bills have no coupon. We use the issued-amount-weighted auction yield across the CUSIP's issues.
//  - FRNs: yield_pct is the fixed spread over the 13-week bill rate. Shown rate = current 13-week bill
//    rate (DGS3MO, data.json) + spread.
//
// Usage: node scripts/build-maturities-mspd.mjs [YYYY-MM-DD]   (default: latest record date)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureProxy } from './lib/net.mjs';
ensureProxy();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data/data.json'), 'utf8'));
const FD = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_3_market';

const get = async (q) => { const r = await fetch(`${FD}?${q}`); if (!r.ok) throw new Error(`${r.status} ${FD}?${q}`); return r.json(); };
let date = process.argv[2];
if (!date) date = (await get('sort=-record_date&page[size]=1')).data[0].record_date;
const { data: rows } = await get(`filter=record_date:eq:${date}&page[size]=10000`);

const num = (x) => { const v = parseFloat(x); return Number.isFinite(v) ? v : null; };
const famOf = (c) => /^Bills/.test(c) ? 'bills' : /^Notes/.test(c) ? 'notes' : /^Bonds/.test(c) ? 'bonds'
  : /^Inflation/.test(c) ? 'tips' : /^Floating/.test(c) ? 'frn' : null;
const billRate = data.market_yields.y3m.value;

// Group by CUSIP.
const sec = new Map();
for (const r of rows) {
  const fam = famOf(r.security_class1_desc);
  if (!fam || r.maturity_date === 'null') continue;
  const id = r.security_class2_desc;
  if (!sec.has(id)) sec.set(id, { id, fam, maturity: r.maturity_date, outstanding: 0, coupon: null, yIss: 0, yW: 0, spread: null, firstIssue: r.issue_date });
  const s = sec.get(id);
  const o = num(r.outstanding_amt); if (o) s.outstanding += o / 1000; // → USD bn
  const iss = num(r.issued_amt) || 0, y = num(r.yield_pct);
  if (fam === 'bills' && y !== null) { s.yIss += iss * y; s.yW += iss; }
  if (fam === 'frn' && y !== null && s.spread === null) s.spread = y;
  if (['notes', 'bonds', 'tips'].includes(fam) && num(r.interest_rate_pct) !== null) s.coupon = num(r.interest_rate_pct);
  if (r.issue_date < s.firstIssue) s.firstIssue = r.issue_date;
}
for (const s of sec.values()) {
  if (s.fam === 'bills') s.coupon = s.yW ? s.yIss / s.yW : null;
  if (s.fam === 'frn') s.coupon = billRate != null && s.spread != null ? billRate + s.spread : null;
}

const families = ['bills', 'notes', 'bonds', 'tips', 'frn'];
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const asOf = new Date(date);
const limit = new Date(asOf); limit.setMonth(limit.getMonth() + 24);
function bucket(keyFn, filter = () => true) {
  const m = new Map();
  for (const s of sec.values()) {
    if (!filter(s) || !s.outstanding) continue;
    const k = keyFn(s);
    if (!m.has(k)) m.set(k, Object.fromEntries(families.map((f) => [f, { a: 0, c: 0, w: 0, n: 0 }])));
    const b = m.get(k)[s.fam];
    b.a += s.outstanding; b.n++;
    if (s.coupon != null) { b.c += s.outstanding * s.coupon; b.w += s.outstanding; }
  }
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([period, f]) => ({
    period,
    total: round(families.reduce((t, k) => t + f[k].a, 0)),
    byInstrument: Object.fromEntries(families.map((k) => [k, { amount: round(f[k].a), avgCoupon: f[k].w ? round(f[k].c / f[k].w, 3) : null, securities: f[k].n }])),
  }));
}
const monthly = bucket((s) => s.maturity.slice(0, 7), (s) => new Date(s.maturity) <= limit);
// Compact month-by-month schedule for the refinancing simulator: one row per month from the record
// month to the last maturity, [amount, couponDollars] for each instrument in `families` order.
const allMonths = (() => {
  const start = date.slice(0, 7), idx = (ym) => (+ym.slice(0, 4) - +start.slice(0, 4)) * 12 + (+ym.slice(5, 7) - +start.slice(5, 7));
  const rows = [];
  for (const s of sec.values()) {
    if (!s.outstanding) continue;
    const i = idx(s.maturity.slice(0, 7)); rows[i] ??= families.map(() => [0, 0]);
    const f = families.indexOf(s.fam); rows[i][f][0] += s.outstanding; rows[i][f][1] += s.outstanding * (s.coupon ?? 0);
  }
  for (let i = 0; i < rows.length; i++) rows[i] = (rows[i] || families.map(() => [0, 0])).map(([a, c]) => [round(a, 2), round(c, 2)]);
  return { start, families, rows };
})();
const yearly = bucket((s) => s.maturity.slice(0, 4));

// Checks against Table I totals in data.json and against the earlier model.
const famTotal = (f) => [...sec.values()].filter((s) => s.fam === f).reduce((t, s) => t + s.outstanding, 0);
const in12 = new Date(asOf); in12.setMonth(in12.getMonth() + 12);
const next12 = [...sec.values()].filter((s) => new Date(s.maturity) <= in12);
const fixed12 = next12.filter((s) => s.fam === 'notes' || s.fam === 'bonds');
const f12 = fixed12.reduce((t, s) => t + s.outstanding, 0);
const checks = [
  ...families.map((f) => ({ what: `${f} total (USD bn) vs MSPD Table I`, mspd: round(famTotal(f), 3), tableI: data.composition[f].value })),
  { what: 'Fixed notes+bonds maturing in next 12 months (USD bn)', mspd: round(f12), published: 2950 },
  { what: 'Their avg coupon (%)', mspd: round(fixed12.reduce((t, s) => t + s.outstanding * s.coupon, 0) / f12, 3), published: 2.98 },
  { what: 'TIPS+FRN maturing next 12 months (USD bn)', mspd: round(next12.filter((s) => s.fam === 'tips' || s.fam === 'frn').reduce((t, s) => t + s.outstanding, 0)), published: 575.8 },
  { what: 'Share of marketable maturing within 12 months (%)', mspd: round(100 * next12.reduce((t, s) => t + s.outstanding, 0) / data.debt.marketableTotal.value), published: 33 },
];

const out = {
  _meta: {
    status: 'primary',
    asOf: date,
    method: 'Aggregated from MSPD Table III, one row per CUSIP (first-row outstanding_amt). Coupons: notes, bonds and TIPS use the stated coupon (TIPS = real coupon); bills use the issued-amount-weighted auction yield; FRNs use the current 3-month bill rate plus each FRN\'s spread. Amounts are face value; TIPS include inflation compensation.',
    unit: 'USD bn',
    source: `Treasury, Monthly Statement of the Public Debt, Table III (Detail of Marketable Treasury Securities), ${date}`,
    url: 'https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/detail-of-marketable-treasury-securities-outstanding',
    securities: sec.size,
    note: 'Bills and FRNs auctioned after the record date are not included, so bars beyond ~12 months show only securities already issued. Treasury will add new bills and notes on top as it refinances.',
    checks,
  },
  monthly,
  yearly,
  allMonths,
};
writeFileSync(join(root, 'data/maturities.json'), JSON.stringify(out, null, 1) + '\n');
console.table(checks);
console.log(`${sec.size} securities → ${monthly.length} monthly, ${yearly.length} yearly buckets → data/maturities.json`);

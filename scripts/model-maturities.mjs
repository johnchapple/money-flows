#!/usr/bin/env node
// Modeled maturity schedule for US marketable Treasury debt as of 2026-09-30.
//
// Why this is a model: the exact schedule comes from the MSPD "Detail of Marketable
// Treasury Securities Outstanding" (one row per CUSIP). This session could not reach
// fiscaldata.treasury.gov, so this script rebuilds the schedule from:
//   1. Approximate historical auction sizes per tenor (USD bn per month, reopenings included)
//   2. Treasury's auction/maturity calendar (which months each tenor matures in)
//   3. Approximate annual-average yields at issue (to estimate coupon rates)
// and then scales each instrument family to the MSPD Sep 2026 totals in data/data.json.
//
// Once the MSPD API is reachable, scripts/refresh.mjs computes the real schedule.
// Every number below is approximate (roughly ±20% per bucket). The output is labeled `modeled`.
//
// Usage: node scripts/model-maturities.mjs   → writes data/maturities.json and prints checks

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data/data.json'), 'utf8'));
const AS_OF = { y: 2026, m: 9 }; // Sep 30 2026, month index 1-12

// ---------- 1. Auction sizes: average USD bn auctioned per month, by issue year ----------
// Approximate, recalled from Treasury refunding statements. They only need to get the
// SHAPE right, because the totals are calibrated to MSPD in step 4.
const size = {
  n2:  { 2024: 66, 2025: 69, 2026: 69 },
  n3:  { 2023: 45, 2024: 57, 2025: 58, 2026: 58 },
  n5:  { 2021: 61, 2022: 46, 2023: 45, 2024: 68, 2025: 70, 2026: 70 },
  n7:  { 2019: 32, 2020: 46, 2021: 62, 2022: 38, 2023: 36, 2024: 43, 2025: 44, 2026: 44 },
  n10: { 2016: 21, 2017: 21, 2018: 24, 2019: 25, 2020: 33, 2021: 39, 2022: 34, 2023: 36, 2024: 41, 2025: 42, 2026: 42 },
  b20: { 2020: 20, 2021: 22, 2022: 15, 2023: 14, 2024: 14, 2025: 13, 2026: 13 },
  b30: { 1996: 4, 1997: 4, 1998: 4, 1999: 4, 2000: 3, 2001: 3, 2006: 3, 2007: 3, 2008: 6, 2009: 12,
         2010: 13, 2011: 13, 2012: 13, 2013: 13, 2014: 13, 2015: 13, 2016: 13, 2017: 13, 2018: 15,
         2019: 17, 2020: 24, 2021: 26, 2022: 21, 2023: 21, 2024: 23, 2025: 25, 2026: 25 },
};

// ---------- 2. Approximate annual average yields at issue (%), by tenor ----------
const y2  = { 2016: .84, 2017: 1.40, 2018: 2.53, 2019: 1.97, 2020: .39, 2021: .27, 2022: 2.99, 2023: 4.59, 2024: 4.37, 2025: 3.80, 2026: 3.90 };
const y5  = { 2016: 1.33, 2017: 1.91, 2018: 2.75, 2019: 1.96, 2020: .53, 2021: .86, 2022: 3.00, 2023: 4.06, 2024: 4.13, 2025: 3.90, 2026: 4.10 };
const y10 = { 2006: 4.79, 2007: 4.63, 2008: 3.66, 2009: 3.26, 2010: 3.22, 2011: 2.78, 2012: 1.80, 2013: 2.35, 2014: 2.54, 2015: 2.14,
              2016: 1.84, 2017: 2.33, 2018: 2.91, 2019: 2.14, 2020: .89, 2021: 1.45, 2022: 2.95, 2023: 3.96, 2024: 4.21, 2025: 4.30, 2026: 4.60 };
const y30 = { 1996: 6.71, 1997: 6.61, 1998: 5.58, 1999: 5.87, 2000: 5.94, 2001: 5.49, 2006: 4.91, 2007: 4.84, 2008: 4.28, 2009: 4.08,
              2010: 4.25, 2011: 3.91, 2012: 2.92, 2013: 3.45, 2014: 3.34, 2015: 2.84, 2016: 2.59, 2017: 2.89, 2018: 3.11, 2019: 2.58,
              2020: 1.56, 2021: 2.06, 2022: 3.11, 2023: 4.09, 2024: 4.41, 2025: 4.80, 2026: 5.00 };
const mix = (a, b, w) => (yr) => a[yr] * (1 - w) + b[yr] * w;
const yieldFor = {
  n2: (yr) => y2[yr], n3: mix(y2, y5, 1 / 3), n5: (yr) => y5[yr],
  n7: mix(y5, y10, 0.4), n10: (yr) => y10[yr], b20: mix(y10, y30, 0.6), b30: (yr) => y30[yr],
};

// ---------- 3. Calendar: tenor (years) and which issue months exist ----------
// Refunding tenors (3y, 10y, 30y, 20y) mature on the 15th of Feb/May/Aug/Nov. Reopenings share
// the original's maturity, so all monthly issuance is mapped to the next refunding maturity.
// 2y, 5y and 7y are issued and mature at each month-end.
const tenors = {
  n2:  { years: 2,  family: 'notes', refunding: false },
  n3:  { years: 3,  family: 'notes', refunding: false }, // 3y is monthly, matures the 15th
  n5:  { years: 5,  family: 'notes', refunding: false },
  n7:  { years: 7,  family: 'notes', refunding: false },
  n10: { years: 10, family: 'notes', refunding: true },
  b20: { years: 20, family: 'bonds', refunding: true },
  b30: { years: 30, family: 'bonds', refunding: true },
};
const refundMonths = [2, 5, 8, 11];
const ym = (y, m) => y * 12 + (m - 1);
const asOfIdx = ym(AS_OF.y, AS_OF.m);
const fromIdx = (i) => ({ y: Math.floor(i / 12), m: (i % 12) + 1 });
const key = (i) => { const { y, m } = fromIdx(i); return `${y}-${String(m).padStart(2, '0')}`; };

// ---------- Build fixed-rate coupon cohorts ----------
const cohorts = []; // { tenor, family, matIdx, amount, coupon }
for (const [t, cfg] of Object.entries(tenors)) {
  for (const [yrStr, perMonth] of Object.entries(size[t])) {
    const yr = +yrStr;
    for (let m = 1; m <= 12; m++) {
      const issueIdx = ym(yr, m);
      if (issueIdx > asOfIdx) continue; // not issued yet
      let matIdx = issueIdx + cfg.years * 12;
      if (cfg.refunding) {
        // Original issue months are Feb/May/Aug/Nov. Reopenings in the next two months share that maturity.
        const { m: im } = fromIdx(issueIdx);
        const back = (im - 2 + 12) % 3; // months since the last refunding month
        matIdx = issueIdx - back + cfg.years * 12;
        // A 10y reopened 1–2 months after issue has ~9y10m remaining; 30y reopenings work the same way.
      }
      if (matIdx <= asOfIdx) continue; // already matured
      cohorts.push({ tenor: t, family: cfg.family, matIdx, amount: perMonth, coupon: yieldFor[t](yr) });
    }
  }
}

// ---------- TIPS cohorts (5y Apr/Oct maturity, 10y Jan/Jul, 30y Feb) ----------
// Annual issuance (USD bn incl. reopenings), approximate; inflation accretion is handled by calibration.
const tipsAnnual = { t5: 105, t10: 95, t30: 17 };
const tipsReal = { // approximate real yields at issue
  2006: 2.3, 2007: 2.3, 2008: 1.8, 2009: 1.7, 2010: 1.2, 2011: .8, 2012: -.5, 2013: .1, 2014: .4, 2015: .5,
  2016: .3, 2017: .5, 2018: .8, 2019: .4, 2020: -.6, 2021: -1.0, 2022: .4, 2023: 1.8, 2024: 2.0, 2025: 1.9, 2026: 1.9 };
const tipsSpec = [
  { k: 't5', years: 5, months: [4, 10], first: 2021 },
  { k: 't10', years: 10, months: [1, 7], first: 2016 },
  { k: 't30', years: 30, months: [2], first: 2010 },
];
for (const s of tipsSpec) {
  for (let yr = s.first; yr <= 2026; yr++) {
    for (const m of s.months) {
      const matIdx = ym(yr + s.years, m);
      if (ym(yr, m) > asOfIdx || matIdx <= asOfIdx) continue;
      cohorts.push({ tenor: s.k, family: 'tips', matIdx, amount: tipsAnnual[s.k] / s.months.length, coupon: Math.max(0.125, tipsReal[yr] ?? 1) });
    }
  }
}

// ---------- FRNs: 2-year, roughly level issuance → uniform over the next 24 months ----------
for (let i = asOfIdx + 1; i <= asOfIdx + 24; i++) {
  cohorts.push({ tenor: 'frn2', family: 'frn', matIdx: i, amount: 1, coupon: 3.90 /* resets to 13w bill + spread; display rate only */ });
}

// ---------- Bills: steady weekly issuance → outstanding spread evenly over each tenor ----------
// Weekly auction sizes (USD bn), approximate for 2026. For tenor T weeks, outstanding is spread
// evenly over 0..T weeks to maturity. 52-week bills are issued every 4 weeks.
const billTenors = [ // [weeks, weekly size]
  [4, 100], [6, 75], [8, 90], [13, 85], [17, 70], [26, 75], [52, 12.5 /* 50 every 4w */],
];
const billByMonth = new Map();
for (const [weeks, sz] of billTenors) {
  for (let w = 0; w < weeks; w++) {
    const daysAhead = (w + 0.5) * 7;
    const idx = asOfIdx + 1 + Math.floor(daysAhead / 30.44);
    billByMonth.set(idx, (billByMonth.get(idx) || 0) + sz);
  }
}
for (const [idx, amt] of billByMonth) cohorts.push({ tenor: 'bills', family: 'bills', matIdx: idx, amount: amt, coupon: data.composition.bills.avgRate });

// ---------- 4. Calibrate each family to MSPD totals ----------
const target = {
  bills: data.composition.bills.value, notes: data.composition.notes.value, bonds: data.composition.bonds.value,
  tips: data.composition.tips.value, frn: data.composition.frn.value,
};
const raw = {};
for (const c of cohorts) raw[c.family] = (raw[c.family] || 0) + c.amount;
const scale = Object.fromEntries(Object.keys(target).map((f) => [f, target[f] / raw[f]]));
for (const c of cohorts) c.amount *= scale[c.family];

// ---------- 5. Aggregate ----------
const families = ['bills', 'notes', 'bonds', 'tips', 'frn'];
function bucket(filterFn, labelFn) {
  const out = new Map();
  for (const c of cohorts) {
    if (!filterFn(c)) continue;
    const k = labelFn(c);
    if (!out.has(k)) out.set(k, Object.fromEntries(families.map((f) => [f, { amount: 0, couponDollars: 0 }])));
    const b = out.get(k)[c.family];
    b.amount += c.amount; b.couponDollars += c.amount * c.coupon;
  }
  return [...out.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([period, fam]) => ({
    period,
    total: round(families.reduce((s, f) => s + fam[f].amount, 0)),
    byInstrument: Object.fromEntries(families.map((f) => [f, {
      amount: round(fam[f].amount),
      avgCoupon: fam[f].amount ? round(fam[f].couponDollars / fam[f].amount, 2) : null,
    }])),
  }));
}
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

const monthly = bucket((c) => c.matIdx <= asOfIdx + 24, (c) => key(c.matIdx));
const yearly = bucket((c) => true, (c) => String(fromIdx(c.matIdx).y));

// ---------- 6. Checks against published figures ----------
const next12 = cohorts.filter((c) => c.matIdx <= asOfIdx + 12);
const fixed12 = next12.filter((c) => c.family === 'notes' || c.family === 'bonds');
const fixed12Amt = fixed12.reduce((s, c) => s + c.amount, 0);
const fixed12Cpn = fixed12.reduce((s, c) => s + c.amount * c.coupon, 0) / fixed12Amt;
const tf12 = next12.filter((c) => c.family === 'tips' || c.family === 'frn').reduce((s, c) => s + c.amount, 0);
const all12 = next12.reduce((s, c) => s + c.amount, 0);
const avgCpn = (fam) => { const cs = cohorts.filter((c) => c.family === fam); return cs.reduce((s, c) => s + c.amount * c.coupon, 0) / cs.reduce((s, c) => s + c.amount, 0); };
const marketable = data.debt.marketableTotal.value;

const checks = [
  { what: 'Fixed notes+bonds maturing in next 12 months (USD bn)', model: round(fixed12Amt), published: 2950, source: 'dollarliquidity.com' },
  { what: 'Avg coupon of those (%)', model: round(fixed12Cpn, 2), published: 2.98, source: 'dollarliquidity.com' },
  { what: 'TIPS+FRN maturing next 12 months (USD bn)', model: round(tf12), published: 575.8, source: 'dollarliquidity.com' },
  { what: 'Share of marketable maturing within 12 months (%)', model: round((100 * all12) / marketable), published: 33, source: 'GAO-26-107529 / Conference Board' },
  { what: 'Avg coupon, notes (%)', model: round(avgCpn('notes'), 2), published: data.composition.notes.avgRate, source: 'Treasury Average Interest Rates' },
  { what: 'Avg coupon, bonds (%)', model: round(avgCpn('bonds'), 2), published: data.composition.bonds.avgRate, source: 'Treasury Average Interest Rates' },
  { what: 'Avg real coupon, TIPS (%)', model: round(avgCpn('tips'), 2), published: data.composition.tips.avgRate, source: 'Treasury Average Interest Rates' },
];

const out = {
  _meta: {
    status: 'modeled',
    asOf: '2026-09-30',
    method: 'Rebuilt from approximate auction-size history and the Treasury maturity calendar, then scaled per instrument to MSPD Sep 2026 totals. Coupons are approximate annual-average yields at issue. Bills assume steady weekly auction sizes. FRNs assume level issuance. Bucket error is roughly ±20%. Replace with scripts/refresh.mjs output once MSPD detail is reachable.',
    calibrationScale: Object.fromEntries(Object.entries(scale).map(([k, v]) => [k, round(v, 3)])),
    unit: 'USD bn face value (TIPS at inflation-adjusted principal via calibration)',
    source: 'Model inputs: Treasury refunding statements (auction sizes), Treasury par yields (coupons). Calibration totals: MSPD Sep 2026 via data/data.json.',
    url: 'https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/',
    checks,
  },
  monthly,
  yearly,
};
writeFileSync(join(root, 'data/maturities.json'), JSON.stringify(out, null, 1) + '\n');

console.log('Calibration scale per family:', out._meta.calibrationScale);
console.table(checks);
console.log(`Wrote ${monthly.length} monthly and ${yearly.length} yearly buckets → data/maturities.json`);

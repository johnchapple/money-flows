#!/usr/bin/env node
// Re-check figures in data/data.json against their primary sources and write docs/verification.md.
// Each check re-fetches the source (Treasury Fiscal Data API, Fed H.4.1 release, FRED, Treasury TIC,
// NY Fed markets API) and compares within a small tolerance (rounding). Exit code 1 on any mismatch.
// Figures with status secondary / derived / recall / conflict are listed but not machine-checked.
//
// Usage: node scripts/verify-figures.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureProxy } from './lib/net.mjs';
ensureProxy();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(readFileSync(join(root, 'data/data.json'), 'utf8'));
const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : Array.isArray(o) && isNaN(+k) ? o.find((x) => x.id === k || x.country === k || x.tenor === k || x.term === k) : o[k]), D);

// ---------- fetch helpers (cached) ----------
const cache = new Map();
async function text(url) { if (!cache.has(url)) cache.set(url, fetch(url).then(async (r) => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); })); return cache.get(url); }
const FD = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
async function fd(path, q) { return JSON.parse(await text(`${FD}${path}?${q}&page[size]=10000`)).data; }
async function fred(id) { const t = await text(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`); return new Map(t.trim().split('\n').slice(1).map((l) => l.split(',')).filter(([, v]) => v && v !== '.').map(([d, v]) => [d, +v])); }
const fredAt = async (id, d) => { const m = await fred(id); if (!m.has(d)) throw new Error(`${id} has no value for ${d}`); return m.get(d); };
const fredMax = async (id, from = '1900') => { let best = [null, -Infinity]; for (const [d, v] of await fred(id)) if (d >= from && v > best[1]) best = [d, v]; return best; };
const mspd1 = async (date, type, cls) => { const rows = await fd('/v1/debt/mspd/mspd_table_1', `filter=record_date:eq:${date}`); const r = rows.find((x) => x.security_type_desc === type && (cls == null || x.security_class_desc === cls)); if (!r) throw new Error(`MSPD row ${type}/${cls}`); return r; };
const penny = async (d) => (await fd('/v2/accounting/od/debt_to_penny', `filter=record_date:eq:${d}`))[0];
const avgRate = async (d, desc) => +(await fd('/v2/accounting/od/avg_interest_rates', `filter=record_date:eq:${d}`)).find((x) => x.security_desc === desc).avg_interest_rate_amt;
async function h41(date) { // H.4.1 release for that Thursday, Wednesday-level column
  const html = await text(`https://www.federalreserve.gov/releases/h41/${date.replace(/-/g, '')}/`);
  const t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/\s+/g, ' ').replace(/<\/t[dh]>/g, ' | ').replace(/<\/tr>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const all = t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const i5 = all.findIndex((l) => /5\. Consolidated Statement of Condition/i.test(l));
  return { table5: all.slice(i5), all };
}
// First numeric cell of the first row (after `nth` skips) whose label starts with `label` (footnote digits allowed).
const h41val = async (date, label, { nth = 0, table6 = false } = {}) => {
  const { table5, all } = await h41(date);
  const re = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\d* \\|');
  const hits = (table6 ? all : table5).filter((l) => re.test(l));
  if (!hits[nth]) throw new Error(`H.4.1 line not found: ${label}`);
  const num = hits[nth].split('|').slice(1).map((c) => c.trim().replace(/,/g, '').replace(/\s/g, '')).find((c) => /^-?\d+$/.test(c));
  if (num == null) throw new Error(`H.4.1 no number on line: ${label}`);
  return +num / 1000;
};
async function tic() { const t = await text('https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table5.txt'); const L = t.split('\n').map((l) => l.split('\t')); const hdr = L.find((r) => r[0] === 'Country'); return { hdr, row: (name) => L.find((r) => r[0].trim().toLowerCase() === name.toLowerCase()) }; }
const nyfed = async (rate) => JSON.parse(await text(`https://markets.newyorkfed.org/api/rates/secured/${rate}/search.json?startDate=2026-10-01&endDate=2026-11-30`)).refRates;

// ---------- checks: [data.json path, fetch the source value, tolerance, source label] ----------
const H41 = '2026-10-29';
const C = [];
const add = (path, fn, tol, src) => C.push({ path, fn, tol, src });
// MSPD Table I, Sep 30 2026
add('debt.totalPublicDebt.value', async () => +(await mspd1('2026-09-30', 'Total Public Debt Outstanding')).total_mil_amt / 1e3, 0.002, 'MSPD Table I');
add('debt.debtHeldByPublic.value', async () => +(await mspd1('2026-09-30', 'Total Public Debt Outstanding')).debt_held_public_mil_amt / 1e3, 0.002, 'MSPD Table I');
add('debt.intragovernmental.value', async () => +(await mspd1('2026-09-30', 'Total Public Debt Outstanding')).intragov_hold_mil_amt / 1e3, 0.002, 'MSPD Table I');
add('debt.marketableTotal.value', async () => +(await mspd1('2026-09-30', 'Total Marketable')).total_mil_amt / 1e3, 0.002, 'MSPD Table I');
add('debt.nonMarketableTotal.value', async () => +(await mspd1('2026-09-30', 'Total Nonmarketable')).total_mil_amt / 1e3, 0.002, 'MSPD Table I');
for (const [k, cls] of [['bills', 'Bills'], ['notes', 'Notes'], ['bonds', 'Bonds'], ['tips', 'Treasury Inflation-Protected Securities'], ['frn', 'Floating Rate Notes'], ['ffb', 'Federal Financing Bank']])
  add(`composition.${k}.value`, async () => +(await mspd1('2026-09-30', 'Marketable', cls)).total_mil_amt / 1e3, 0.002, 'MSPD Table I');
// Average interest rates
for (const [k, desc] of [['bills', 'Treasury Bills'], ['notes', 'Treasury Notes'], ['bonds', 'Treasury Bonds'], ['tips', 'Treasury Inflation-Protected Securities (TIPS)'], ['frn', 'Treasury Floating Rate Notes (FRN)'], ['ffb', 'Federal Financing Bank']])
  add(`composition.${k}.avgRate`, () => avgRate('2026-09-30', desc), 0.0005, 'Average Interest Rates');
add('rates_on_debt.avgRateMarketable.value', () => avgRate('2026-09-30', 'Total Marketable'), 0.0005, 'Average Interest Rates');
add('rates_on_debt.avgRateAllInterestBearing.value', () => avgRate('2026-09-30', 'Total Interest-bearing Debt'), 0.0005, 'Average Interest Rates');
add('rates_on_debt.avgRateMarketable2022.value', () => avgRate('2022-01-31', 'Total Marketable'), 0.0005, 'Average Interest Rates');
// Debt to the Penny
add('debt.totalPublicDebtLatest.value', async () => +(await penny('2026-11-02')).tot_pub_debt_out_amt / 1e9, 0.002, 'Debt to the Penny');
add('debt.totalPublicDebtLatest.exactDollars', async () => +(await penny('2026-11-02')).tot_pub_debt_out_amt, 0.01, 'Debt to the Penny');
add('debt.totalPublicDebtLatest.parts.debtHeldByPublic', async () => +(await penny('2026-11-02')).debt_held_public_amt / 1e9, 0.002, 'Debt to the Penny');
add('debt.totalPublicDebtLatest.parts.intragovernmental', async () => +(await penny('2026-11-02')).intragov_hold_amt / 1e9, 0.002, 'Debt to the Penny');
add('debt.totalPublicDebtOct16.value', async () => +(await penny('2026-10-16')).tot_pub_debt_out_amt / 1e9, 0.002, 'Debt to the Penny');
add('debt.crossed40T.amount', async () => +(await penny('2026-08-18')).tot_pub_debt_out_amt / 1e9, 0.002, 'Debt to the Penny');
// DTS: debt limit, TGA
const dsl = async () => (await fd('/v1/accounting/dts/debt_subject_to_limit', 'filter=record_date:eq:2026-11-02'));
add('debt.debtLimit.value', async () => +(await dsl()).find((r) => r.debt_catg === 'Statutory Debt Limit').close_today_bal / 1e3, 0.002, 'DTS Table III-C');
add('debt.debtSubjectToLimit.value', async () => { const r = await dsl(); const tot = +(await penny('2026-11-02')).tot_pub_debt_out_amt / 1e9; return tot - r.filter((x) => x.debt_catg === 'Debt Not Subject to Limit').reduce((t, x) => t + +x.close_today_bal / 1e3, 0); }, 0.01, 'DTS Table III-C');
const tgaClose = async (d) => +(await fd('/v1/accounting/dts/operating_cash_balance', `filter=record_date:eq:${d}`)).find((r) => /Closing Balance/.test(r.account_type)).open_today_bal / 1e3;
for (const h of D.fed.tga.history) add(`fed.tga.history.${D.fed.tga.history.indexOf(h)}.value`, () => tgaClose(h.asOf), 0.002, 'Daily Treasury Statement');
// Interest expense FY2026
const ie = async (catg, d = '2026-09-30') => (await fd('/v2/accounting/od/interest_expense', `filter=record_date:eq:${d}`)).filter((r) => !catg || r.expense_catg_desc === catg).reduce((t, r) => t + +r.fytd_expense_amt, 0) / 1e9;
add('budget.grossInterestFY2026.parts.publicIssues', () => ie('INTEREST EXPENSE ON PUBLIC ISSUES'), 0.06, 'Interest Expense dataset');
add('budget.grossInterestFY2026.parts.governmentAccountSeries', () => ie('INTEREST EXPENSE ON GOVT ACCOUNT SERIES'), 0.06, 'Interest Expense dataset');
add('budget.grossInterestFY2026.value', () => ie(null), 0.06, 'Interest Expense dataset');
add('budget.grossInterestFY2026.first10Months', () => ie(null, '2026-07-31'), 0.06, 'Interest Expense dataset');
// Monthly Treasury Statement, FY2026 (Table 9: receipts and outlays by function)
const mts9 = async () => fd('/v1/accounting/mts/mts_table_9', 'filter=record_date:eq:2026-09-30');
const mtsTotals = async () => (await mts9()).filter((r) => r.classification_desc === 'Total').map((r) => +r.current_fytd_rcpt_outly_amt / 1e9).sort((a, b) => b - a); // [outlays, receipts]
add('budget.netInterestFY2026.value', async () => +(await mts9()).find((r) => r.classification_desc === 'Net Interest').current_fytd_rcpt_outly_amt / 1e9, 0.6, 'MTS Table 9');
add('budget.deficitFY2026.parts.outlays', async () => (await mtsTotals())[0], 0.6, 'MTS Table 9');
add('budget.deficitFY2026.parts.receipts', async () => (await mtsTotals())[1], 0.6, 'MTS Table 9');
add('budget.deficitFY2026.value', async () => { const [o, r] = await mtsTotals(); return o - r; }, 0.6, 'MTS Table 9');
// Auctions
const auc = async (d, term) => (await fd('/v1/accounting/od/auctions_query', `filter=auction_date:eq:${d}`)).find((r) => r.security_term === term);
for (const [i, [d, term]] of [['2026-10-06', '3-Year'], ['2026-10-07', '9-Year 10-Month'], ['2026-10-08', '29-Year 10-Month']].entries()) {
  add(`issuance.auctionStats.series.${i}.highYield`, async () => +(await auc(d, term)).high_yield, 0.0005, 'Auction results');
  add(`issuance.auctionStats.series.${i}.bidToCover`, async () => +(await auc(d, term)).bid_to_cover_ratio, 0.005, 'Auction results');
  add(`issuance.auctionStats.series.${i}.dealers`, async () => +(await auc(d, term)).primary_dealer_accepted / 1e9, 0.002, 'Auction results');
}
// H.4.1 (Oct 29 2026 release, Wednesday Oct 28 levels)
for (const [path, label, o] of [['fed.totalAssets.value', 'Total assets'], ['fed.somaMBS.value', 'Mortgage-backed securities'], ['fed.currency.value', 'Federal Reserve notes, net of F.R. Bank holdings'],
  ['fed.reverseRepoTotal.value', 'Reverse repurchase agreements'], ['fed.reserves.value', 'Other deposits held by depository institutions'], ['fed.tga.value', 'U.S. Treasury, General Account']])
  add(path, () => h41val(H41, label, o), 0.002, 'H.4.1 Table 5');
add('fed.somaTreasuries.value', () => h41val(H41, 'U.S. Treasury securities'), 0.002, 'H.4.1 Table 5');
add('fed.deferredAsset.value', async () => -(await h41val(H41, 'Earnings remittances due to the U.S. Treasury', { table6: true })), 0.002, 'H.4.1 Table 6');
for (const [k, label, sign] of [['foreignOfficialDeposits', 'Foreign official'], ['otherDeposits', 'Other'], ['deferredAvailability', 'Deferred availability cash items'], ['otherLiabilities', 'Other liabilities and accrued dividends'], ['capital', 'Total capital']])
  add(`fed.otherLiabilitiesAndCapital.parts.${k}`, () => h41val(H41, label, { nth: k === 'foreignOfficialDeposits' ? 1 : k === 'otherDeposits' ? 1 : 0 }), 0.002, 'H.4.1 Table 5');
// Coupon auctions: recent high yields and sizes
for (const [i, a] of D.issuance.recentAuctionYields.series.entries()) {
  const term = { '2y': '2-Year', '5y': '5-Year', '7y': '7-Year', '3y': '3-Year', '10y (reopening)': '9-Year 10-Month', '30y (reopening)': '29-Year 10-Month' }[a.tenor];
  add(`issuance.recentAuctionYields.series.${i}.yield`, async () => +(await auc(a.date, term)).high_yield, 0.0005, 'Auction results');
}
for (const [tenor, d, term] of [['2y', '2026-09-22', '2-Year'], ['3y', '2026-10-06', '3-Year'], ['5y', '2026-09-23', '5-Year'], ['7y', '2026-09-24', '7-Year']])
  add(`issuance.couponMix.series.${tenor}.perMonth`, async () => +(await fd('/v1/accounting/od/auctions_query', `filter=auction_date:eq:${d}`)).find((r) => r.security_term === term && r.floating_rate !== 'Yes').offering_amt / 1e9, 0.01, 'Auction results (offering)');
// Treasury borrowing estimates press release (Nov 2 2026)
const sb = async () => (await text('https://home.treasury.gov/news/press-releases/sb0675')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const sbNum = async (re) => { const m = (await sb()).match(re); if (!m) throw new Error('not found ' + re); return +m[1].replace(/,/g, '') * (/trillion/.test(m[0]) ? 1000 : 1); };
add('issuance.borrowingEstimates.series.0.borrowing', () => sbNum(/July–September 2026 quarter, Treasury borrowed \$([\d,.]+) billion/), 0.5, 'Treasury sb0675');
add('issuance.borrowingEstimates.series.0.endCash', () => sbNum(/ended the quarter with a cash balance of \$([\d,.]+) billion/), 0.5, 'Treasury sb0675');
add('issuance.borrowingEstimates.series.1.borrowing', () => sbNum(/October–December 2026 quarter, Treasury expects to borrow \$([\d,.]+) billion/), 0.5, 'Treasury sb0675');
add('issuance.borrowingEstimates.series.1.endCash', () => sbNum(/end-of-December cash balance of \$([\d,.]+) billion/), 0.5, 'Treasury sb0675');
add('issuance.borrowingEstimates.series.2.borrowing', () => sbNum(/January–March 2027 quarter, Treasury expects to borrow \$([\d,.]+) billion/), 0.5, 'Treasury sb0675');
add('issuance.borrowingEstimates.series.2.endCash', () => sbNum(/end-of-March cash balance of \$([\d,.]+) trillion/), 0.5, 'Treasury sb0675');
// MSPD-derived maturity figures
const mat = JSON.parse(readFileSync(join(root, 'data/maturities.json'), 'utf8'));
add('rates_on_debt.couponsMaturingNext12m.value', async () => mat._meta.checks.find((c) => /Fixed notes\+bonds/.test(c.what)).mspd, 0.05, 'MSPD Table III (maturities.json)');
add('rates_on_debt.shareMaturingWithin12m.value', async () => mat._meta.checks.find((c) => /Share of marketable/.test(c.what)).mspd, 0.05, 'MSPD Table III (maturities.json)');
// FRED
for (const [path, id, d] of [['fed.onRrp.value', 'RRPONTSYD', '2026-10-28'], ['fed.foreignRepoPool.value', 'WLRRAFOIAL', '2026-10-28'], ['holders.fedSep30.value', 'WSHOTSL', '2026-09-30'],
  ['holders.bankDeposits.value', 'DPSACBW027SBOG', '2026-10-21'], ['policy_rates.sofr.value', 'SOFR', '2026-11-02'], ['policy_rates.effr.value', 'EFFR', '2026-11-02'],
  ['policy_rates.ffTargetLow.value', 'DFEDTARL', '2026-11-03'], ['policy_rates.ffTargetHigh.value', 'DFEDTARU', '2026-11-03'], ['policy_rates.iorb.value', 'IORB', '2026-11-03'],
  ['policy_rates.onRrpRate.value', 'RRPONTSYAWARD', '2026-11-03'], ['policy_rates.srfRate.value', 'DFEDTARU', '2026-11-03'],
  ['market_yields.y3m.value', 'DGS3MO', '2026-11-02'], ['market_yields.y2.value', 'DGS2', '2026-11-02'], ['market_yields.y5.value', 'DGS5', '2026-11-02'], ['market_yields.y10.value', 'DGS10', '2026-11-02'],
  ['market_yields.y20.value', 'DGS20', '2026-11-02'], ['market_yields.y30.value', 'DGS30', '2026-11-02'], ['market_plumbing.srfRecord.value', 'RPONTTLD', '2025-12-31'], ['market_plumbing.srfSep2026QuarterEnd.value', 'RPONTTLD', '2026-09-30'],
  ['history_anchors.repoSpike2019.value', 'SOFR', '2019-09-17'], ['connections.termPremium.value', 'THREEFYTP10', '2026-10-30'], ['connections.realYield10.value', 'DFII10', '2026-11-02'],
  ['connections.dollarIndex.value', 'DTWEXBGS', '2026-10-30'], ['connections.bitcoin.value', 'CBBTCUSD', '2026-11-03'], ['connections.swapLinesNow.value', 'SWPT', '2026-10-28'],
  ['connections.swapLinesPeak2008.value', 'SWPT', '2008-12-17'], ['connections.swapLinesPeak2020.value', 'SWPT', '2020-05-27']]) {
  const scale = ['WLRRAFOIAL', 'WSHOTSL', 'SWPT'].includes(id) ? 1e-3 : 1;
  add(path, async () => (await fredAt(id, d)) * scale, id === 'CBBTCUSD' ? 1 : 0.006, `FRED ${id}`);
}
add('fed.onRrpPeak.value', async () => (await fredMax('RRPONTSYD'))[1], 0.002, 'FRED RRPONTSYD (max)');
add('fed.totalAssetsPeak.value', async () => (await fredMax('WALCL'))[1] / 1e3, 0.002, 'FRED WALCL (max)');
add('history_anchors.reservesPeak.value', async () => (await fredMax('WRESBAL'))[1] / 1e3, 0.002, 'FRED WRESBAL (max)');
// Z.1 (Q2 2026)
for (const s of D.holders.bySector.series) add(`holders.bySector.series.${s.id}.value`, async () => (await fredAt(s.fred, '2026-04-01')) / 1e3, 0.002, `Z.1 via FRED ${s.fred}`);
add('holders.z1Total.value', async () => (await fredAt('BOGZ1FL313161100Q', '2026-04-01')) / 1e3, 0.002, 'Z.1 via FRED');
add('holders.foreignTotal.value', async () => (await fredAt('BOGZ1LM263061105Q', '2026-04-01')) / 1e3, 0.002, 'Z.1 via FRED');
add('holders.foreignTotal.parts.official', async () => (await fredAt('BOGZ1FL263061130Q', '2026-04-01')) / 1e3, 0.002, 'Z.1 via FRED');
// TIC Table 5 (Aug 2026)
const ticVal = async (name) => { const { hdr, row } = await tic(); const c = hdr.indexOf('2026-08'); return +row(name)[c]; };
for (const c of D.holders.foreignByCountry.series) add(`holders.foreignByCountry.series.${c.country}.value`, () => ticVal(c.country === 'China, mainland' ? 'China, Mainland' : c.country === 'All other' ? 'All Other' : c.country), 0.05, 'TIC Table 5');
add('holders.foreignTotalTIC.value', () => ticVal('Grand Total'), 0.05, 'TIC Table 5');
add('holders.foreignTotalTIC.parts.official', () => ticVal('Of Which: Foreign Official'), 0.05, 'TIC Table 5');
// NY Fed reference rates (Nov 2 2026)
const ref = async (r) => (await nyfed(r)).find((x) => x.effectiveDate === '2026-11-02');
add('market_plumbing.sofrVolume.value', async () => (await ref('sofr')).volumeInBillions, 0.5, 'NY Fed SOFR');
add('market_plumbing.sofrVolume.percentiles.p75', async () => (await ref('sofr')).percentPercentile75, 0.0005, 'NY Fed SOFR');
add('market_plumbing.sofrVolume.parts.triParty_TGCR', async () => (await ref('tgcr')).volumeInBillions, 0.5, 'NY Fed TGCR');
add('market_plumbing.sofrVolume.parts.broadGC_BGCR', async () => (await ref('bgcr')).volumeInBillions, 0.5, 'NY Fed BGCR');
// NY Fed Treasury operations: monthly bill purchases
const ops = async () => JSON.parse(await text('https://markets.newyorkfed.org/api/tsy/all/results/summary/last/200.json')).treasury.auctions;
for (const [i, m] of D.fed.billPurchases.series.entries()) add(`fed.billPurchases.series.${i}.value`, async () => (await ops()).filter((o) => o.operationType === 'Outright Bill Purchase' && o.operationDate.startsWith(m.month)).reduce((t, o) => t + +o.totalParAmtAccepted, 0) / 1e9, 0.006, 'NY Fed operations');

// ---------- run ----------
const results = [];
const srcOf = (r) => r.srcLabel;
for (const c of C) {
  const have = get(c.path);
  try { const src = await c.fn(); const ok = Math.abs(src - have) <= c.tol + 1e-9; results.push({ ...c, have, src, ok, srcLabel: c.src }); }
  catch (e) { results.push({ ...c, have, err: e.message, ok: false, srcLabel: c.src }); }
}
// non-machine-checked figures
const unchecked = [];
(function walk(o, p) { for (const [k, v] of Object.entries(o)) { if (k.startsWith('_') || !v || typeof v !== 'object' || Array.isArray(v)) continue; if ('status' in v) { if (v.status !== 'primary') unchecked.push({ path: `${p}${k}`, status: v.status, label: v.label, source: v.source || v.formula || '' }); } else walk(v, `${p}${k}.`); } })(D, '');
const bad = results.filter((r) => !r.ok);
const fmt = (x) => (x == null ? '—' : typeof x === 'number' ? (Math.abs(x) >= 1e6 ? x.toFixed(2) : +x.toFixed(4)) : String(x));
const md = `# Figure verification

Generated by \`scripts/verify-figures.mjs\` on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.
Each row re-fetches the primary source and compares it with \`data/data.json\` (tolerance covers rounding).

**${results.length - bad.length} of ${results.length} checks match.**${bad.length ? ` ${bad.length} need attention (marked ✗).` : ''}

| ✓ | Figure (data.json path) | data.json | Source value | Source |
|---|---|---|---|---|
${results.map((r) => `| ${r.ok ? '✓' : '✗'} | \`${r.path}\` | ${fmt(r.have)} | ${r.err ? 'error: ' + r.err : fmt(r.src)} | ${r.srcLabel} |`).join('\n')}

## Not machine-checked

These figures are not from a source this script can query: secondary sources (sites citing a primary source), derived values (computed from other figures, with the formula in data.json), values from memory, or conflicting sources. They are labeled that way on the page.

| Status | Figure | Label | Source or formula |
|---|---|---|---|
${unchecked.map((u) => `| ${u.status} | \`${u.path}\` | ${u.label || ''} | ${String(u.source).replace(/\|/g, '/')} |`).join('\n')}
`;
writeFileSync(join(root, 'docs/verification.md'), md);
// Record the result in data.json so the page can show when its numbers were last re-checked.
const raw = JSON.parse(readFileSync(join(root, 'data/data.json'), 'utf8'));
raw._meta.verification = { date: new Date().toISOString().slice(0, 10), checks: results.length, matched: results.length - bad.length, notMachineChecked: unchecked.length,
  checkedPaths: results.filter((r) => r.ok).map((r) => r.path.split('.').slice(0, 2).join('.')).filter((v, i, a) => a.indexOf(v) === i), report: 'docs/verification.md' };
writeFileSync(join(root, 'data/data.json'), JSON.stringify(raw, null, 2) + '\n');
console.log(`${results.length - bad.length}/${results.length} match; ${unchecked.length} not machine-checked → docs/verification.md`);
for (const r of bad) console.log('✗', r.path, 'have', r.have, r.err ? 'ERR ' + r.err : 'source ' + r.src);
process.exit(bad.length ? 1 : 0);

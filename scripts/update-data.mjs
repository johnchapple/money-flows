#!/usr/bin/env node
// Update data/data.json in place with the latest values of the figures that come from machine-readable
// primary sources. No Claude or manual step is needed; this is what the weekly GitHub Action runs.
//
//   Daily/weekly: Debt to the Penny, Daily Treasury Statement (TGA, debt limit), H.4.1 (Fed balance sheet),
//                 FRED (policy rates, SOFR/EFFR, Treasury yields, ON RRP, bank deposits, term premium, ...)
//   Monthly:      MSPD Table I (composition), Average Interest Rates, TIC Table 5 (foreign holders)
//   Quarterly:    Z.1 holders by sector (via FRED)
//
// Not updated (needs a person): secondary figures, prose that names specific events, scenario amounts,
// Treasury press-release figures (borrowing estimates, refunding), CBO and legal dates.
// Each updated figure gets a new value and asOf; its status stays "primary". Prints a change log.
//
// Usage: node scripts/update-data.mjs [--dry-run]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureProxy } from './lib/net.mjs';
ensureProxy();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'data/data.json');
const D = JSON.parse(readFileSync(file, 'utf8'));
const dry = process.argv.includes('--dry-run');
const log = [];
const set = (obj, key, v, label) => { const old = obj[key]; if (v == null || Number.isNaN(v)) throw new Error(`no value for ${label}`); if (old !== v) log.push(`${label}: ${old} → ${v}`); obj[key] = v; };
const r = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

const FD = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const get = async (u) => { const res = await fetch(u); if (!res.ok) throw new Error(`${res.status} ${u}`); return res; };
const fd = async (path, q) => (await (await get(`${FD}${path}?${q}`)).json()).data;
const fredRows = async (id, from = '2024-01-01') => (await (await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${from}`)).text()).trim().split('\n').slice(1).map((l) => l.split(',')).filter(([, v]) => v && v !== '.').map(([d, v]) => [d, +v]);
const fredLast = async (id) => (await fredRows(id)).at(-1);
async function step(name, fn) { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '-', e.message); process.exitCode = 1; } }

// ---------- Debt to the Penny: latest + 91-day growth ----------
await step('Debt to the Penny', async () => {
  const rows = await fd('/v2/accounting/od/debt_to_penny', 'sort=-record_date&page[size]=120');
  const a = rows[0], target = Date.parse(a.record_date) - 91 * 864e5;
  const b = rows.find((x) => Date.parse(x.record_date) <= target) || rows.at(-1);
  const days = (Date.parse(a.record_date) - Date.parse(b.record_date)) / 864e5;
  const L = D.debt.totalPublicDebtLatest;
  set(L, 'value', r(+a.tot_pub_debt_out_amt / 1e9), 'gross debt'); set(L, 'asOf', a.record_date, 'gross debt asOf');
  L.exactDollars = +a.tot_pub_debt_out_amt; L.exactPublicDollars = +a.debt_held_public_amt;
  L.parts = { debtHeldByPublic: r(+a.debt_held_public_amt / 1e9), intragovernmental: r(+a.intragov_hold_amt / 1e9) };
  const g = D.debt.dailyGrowthEstimate, gp = D.debt.dailyGrowthPublic;
  set(g, 'value', r((a.tot_pub_debt_out_amt - b.tot_pub_debt_out_amt) / 1e9 / days), 'daily growth'); g.asOf = a.record_date;
  g.formula = `(${r(+a.tot_pub_debt_out_amt / 1e9)} - ${r(+b.tot_pub_debt_out_amt / 1e9)}) / ${days} days (${b.record_date} → ${a.record_date}, Debt to the Penny)`;
  set(gp, 'value', r((a.debt_held_public_amt - b.debt_held_public_amt) / 1e9 / days), 'daily growth (public)'); gp.asOf = a.record_date;
  gp.formula = `(${r(+a.debt_held_public_amt / 1e9)} - ${r(+b.debt_held_public_amt / 1e9)}) / ${days} days (${b.record_date} → ${a.record_date}, Debt to the Penny)`;
});

// ---------- DTS: TGA history and debt subject to limit ----------
await step('Daily Treasury Statement', async () => {
  const from = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
  const ocb = (await fd('/v1/accounting/dts/operating_cash_balance', `filter=record_date:gte:${from}&sort=record_date&page[size]=500`)).filter((x) => /Closing Balance/.test(x.account_type));
  const hist = D.fed.tga.history; const have = new Set(hist.map((h) => h.asOf));
  for (const x of ocb.slice(-3)) if (!have.has(x.record_date)) { hist.push({ asOf: x.record_date, value: +x.open_today_bal / 1e3 }); log.push(`TGA ${x.record_date}: ${+x.open_today_bal / 1e3}`); }
  hist.sort((a, b) => (a.asOf < b.asOf ? -1 : 1)); while (hist.length > 8) hist.shift();
  const dsl = await fd('/v1/accounting/dts/debt_subject_to_limit', 'sort=-record_date&page[size]=20');
  const d0 = dsl[0].record_date, day = dsl.filter((x) => x.record_date === d0);
  const lim = +day.find((x) => x.debt_catg === 'Statutory Debt Limit').close_today_bal / 1e3;
  const pub = +day.find((x) => x.debt_catg === 'Debt Held by the Public').close_today_bal / 1e3, intra = +day.find((x) => x.debt_catg === 'Intragovernmental Holdings').close_today_bal / 1e3;
  const notSub = day.filter((x) => x.debt_catg === 'Debt Not Subject to Limit').reduce((t, x) => t + +x.close_today_bal / 1e3, 0);
  set(D.debt.debtLimit, 'value', lim, 'debt limit'); D.debt.debtLimit.asOf = d0;
  set(D.debt.debtSubjectToLimit, 'value', r(pub + intra - notSub), 'debt subject to limit'); D.debt.debtSubjectToLimit.asOf = d0;
  D.debt.debtSubjectToLimit.formula = `total public debt ${r(pub + intra)} − debt not subject to limit ${r(notSub)}`;
});

// ---------- H.4.1: Fed balance sheet (current release, Wednesday level) ----------
await step('H.4.1', async () => {
  const html = await (await get('https://www.federalreserve.gov/releases/h41/current/')).text();
  const t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/\s+/g, ' ').replace(/<\/t[dh]>/g, ' | ').replace(/<\/tr>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const all = t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const i5 = all.findIndex((l) => /5\. Consolidated Statement of Condition/i.test(l)); if (i5 < 0) throw new Error('Table 5 not found');
  const wed = all[i5].match(/Wednesday\s*([A-Z][a-z]{2})[a-z]* (\d{1,2}), (\d{4})/); if (!wed) throw new Error('Wednesday date not found');
  const asOf = new Date(`${wed[1]} ${wed[2]}, ${wed[3]} UTC`).toISOString().slice(0, 10);
  const rel = html.match(/h41\/(\d{8})\//); const url = rel ? `https://www.federalreserve.gov/releases/h41/${rel[1]}/` : 'https://www.federalreserve.gov/releases/h41/current/';
  const T5 = all.slice(i5);
  const v = (label, nth = 0, src = T5) => { const re = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\d* \\|'); const h = src.filter((l) => re.test(l))[nth]; if (!h) throw new Error('line not found: ' + label); const n = h.split('|').slice(1).map((c) => c.trim().replace(/[,\s]/g, '')).find((c) => /^-?\d+$/.test(c)); return +n / 1e3; };
  const F = D.fed;
  const upd = (fig, val, label) => { set(fig, 'value', r(val), label); fig.asOf = asOf; if (fig.url && /h41/.test(fig.url)) fig.url = url; };
  upd(F.totalAssets, v('Total assets'), 'Fed total assets');
  upd(F.somaTreasuries, v('U.S. Treasury securities'), 'Fed Treasuries');
  F.somaTreasuries.parts = { bills: r(v('Bills')), notesBondsNominal: r(v('Notes and bonds, nominal')), tips: r(v('Notes and bonds, inflation-indexed')), tipsInflationComp: r(v('Inflation compensation')) };
  upd(F.somaMBS, v('Mortgage-backed securities'), 'Fed MBS');
  upd(F.reserves, v('Other deposits held by depository institutions'), 'reserves');
  upd(F.tga, v('U.S. Treasury, General Account'), 'TGA (H.4.1)');
  upd(F.currency, v('Federal Reserve notes, net of F.R. Bank holdings'), 'currency');
  const rrpAll = v('Reverse repurchase agreements');
  const fo = (await fredRows('WLRRAFOIAL')).find(([d]) => d === asOf); if (!fo) throw new Error('FRED WLRRAFOIAL has no value for ' + asOf);
  const rrpOthers = rrpAll - fo[1] / 1e3; // ON RRP = all reverse repos − foreign official (Wednesday levels)
  upd(F.reverseRepoTotal, rrpAll, 'reverse repo total'); F.reverseRepoTotal.parts = { foreignOfficial: r(rrpAll - rrpOthers), others: r(rrpOthers) };
  upd(F.onRrp, rrpOthers, 'ON RRP (H.4.1 Others)'); upd(F.foreignRepoPool, rrpAll - rrpOthers, 'foreign repo pool');
  const parts = { repo: v('Repurchase agreements'), loans: v('Loans'), liquiditySwaps: v('Central bank liquidity swaps') };
  F.otherAssets.parts = { ...F.otherAssets.parts, ...Object.fromEntries(Object.entries(parts).map(([k, x]) => [k, r(x)])) };
  set(F.otherAssets, 'value', r(F.totalAssets.value - F.somaTreasuries.value - F.somaMBS.value), 'other Fed assets'); F.otherAssets.asOf = asOf;
  const lp = { foreignOfficialDeposits: v('Foreign official', 1), otherDeposits: v('Other', 1), deferredAvailability: v('Deferred availability cash items'), otherLiabilities: v('Other liabilities and accrued dividends'), capital: v('Total capital') };
  F.otherLiabilitiesAndCapital.parts = Object.fromEntries(Object.entries(lp).map(([k, x]) => [k, r(x)]));
  set(F.otherLiabilitiesAndCapital, 'value', r(Object.values(lp).reduce((a, b) => a + b, 0)), 'other liabilities & capital'); F.otherLiabilitiesAndCapital.asOf = asOf;
  upd(F.deferredAsset, -v('Earnings remittances due to the U.S. Treasury', 0, all), 'deferred asset');
  const liab = F.reserves.value + F.tga.value + F.reverseRepoTotal.value + F.currency.value + F.otherLiabilitiesAndCapital.value;
  if (Math.abs(liab - F.totalAssets.value) > 0.01) throw new Error(`H.4.1 identity off by ${r(liab - F.totalAssets.value)}`);
  D.holders.fed.value = F.somaTreasuries.value; D.holders.fed.asOf = asOf;
});

// ---------- FRED: rates, yields, deposits, connections ----------
await step('FRED', async () => {
  const P = D.policy_rates, Y = D.market_yields, C = D.connections;
  const map = [[P.sofr, 'SOFR'], [P.effr, 'EFFR'], [P.iorb, 'IORB'], [P.ffTargetLow, 'DFEDTARL'], [P.ffTargetHigh, 'DFEDTARU'], [P.onRrpRate, 'RRPONTSYAWARD'], [P.srfRate, 'DFEDTARU'],
    [Y.y3m, 'DGS3MO'], [Y.y2, 'DGS2'], [Y.y5, 'DGS5'], [Y.y10, 'DGS10'], [Y.y20, 'DGS20'], [Y.y30, 'DGS30'],
    [D.holders.bankDeposits, 'DPSACBW027SBOG'], [C.termPremium, 'THREEFYTP10'], [C.realYield10, 'DFII10'], [C.dollarIndex, 'DTWEXBGS'], [C.bitcoin, 'CBBTCUSD'], [C.swapLinesNow, 'SWPT', 1e-3], [D.holders.mmfTotalAssetsZ1, 'MMMFFAQ027S', 1e-3], [D.global.jgb10yMonthly, 'IRLTLT01JPM156N']];
  const qEnd = (d) => { const y = +d.slice(0, 4), q = Math.floor((+d.slice(5, 7) - 1) / 3); return new Date(Date.UTC(y, q * 3 + 3, 0)).toISOString().slice(0, 10); };
  const mEnd = (d) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).toISOString().slice(0, 10);
  for (const [fig, id, scale = 1] of map) { let [d, x] = (await fredRows(id, '2020-01-01')).at(-1); if (/Q$/.test(id)) d = qEnd(d); else if (/M156N$/.test(id)) d = mEnd(d); set(fig, 'value', r(x * scale, id === 'CBBTCUSD' ? 0 : 3), `${fig.label} (${id})`); fig.asOf = d; }
});

await step('Country comparison (FRED)', async () => {
  const cc = D.global.countryCompare;
  for (const c of cc.series) {
    const [dd, dv] = (await fredRows(c.debtId, '2015-01-01')).at(-1); set(c, 'debtPctGDP', r(dv), `${c.country} debt/GDP`); c.debtYear = +dd.slice(0, 4);
    const [yd, yv] = (await fredRows(c.y10Id, '2024-01-01')).at(-1); set(c, 'y10', r(yv, 4), `${c.country} 10y`); c.y10Month = yd.slice(0, 7);
  }
  cc.asOf = new Date(Date.UTC(+cc.series[0].y10Month.slice(0, 4), +cc.series[0].y10Month.slice(5, 7), 0)).toISOString().slice(0, 10);
});

// ---------- NY Fed: SOFR volume and segments ----------
await step('NY Fed reference rates', async () => {
  const last = async (k) => (await (await get(`https://markets.newyorkfed.org/api/rates/secured/${k}/last/1.json`)).json()).refRates[0];
  const s = await last('sofr'), t = await last('tgcr'), b = await last('bgcr'), V = D.market_plumbing.sofrVolume;
  set(V, 'value', s.volumeInBillions, 'SOFR volume'); V.asOf = s.effectiveDate;
  V.parts = { triParty_TGCR: t.volumeInBillions, broadGC_BGCR: b.volumeInBillions, clearedBilateral_derived: s.volumeInBillions - b.volumeInBillions };
  V.percentiles = { p1: s.percentPercentile1, p25: s.percentPercentile25, p75: s.percentPercentile75, p99: s.percentPercentile99 };
});

// ---------- Monthly: MSPD Table I + Average Interest Rates ----------
await step('MSPD + average rates', async () => {
  const rows = await fd('/v1/debt/mspd/mspd_table_1', 'sort=-record_date&page[size]=40'); const d0 = rows[0].record_date, m = rows.filter((x) => x.record_date === d0);
  const row = (type, cls) => m.find((x) => x.security_type_desc === type && (cls == null || x.security_class_desc === cls));
  const tot = row('Total Public Debt Outstanding'), mk = row('Total Marketable'), nm = row('Total Nonmarketable');
  const Db = D.debt;
  for (const [fig, val, lab] of [[Db.totalPublicDebt, +tot.total_mil_amt / 1e3, 'MSPD gross'], [Db.debtHeldByPublic, +tot.debt_held_public_mil_amt / 1e3, 'MSPD public'], [Db.intragovernmental, +tot.intragov_hold_mil_amt / 1e3, 'MSPD intragov'],
    [Db.marketableTotal, +mk.total_mil_amt / 1e3, 'MSPD marketable'], [Db.nonMarketableTotal, +nm.total_mil_amt / 1e3, 'MSPD non-marketable']]) { set(fig, 'value', r(val), lab); fig.asOf = d0; }
  D.holders.intragovernmental.value = Db.intragovernmental.value; D.holders.intragovernmental.asOf = d0;
  const ar = await fd('/v2/accounting/od/avg_interest_rates', 'sort=-record_date&page[size]=40'); const a0 = ar[0].record_date;
  const rate = (desc) => +ar.find((x) => x.record_date === a0 && x.security_desc === desc).avg_interest_rate_amt;
  for (const [k, cls, desc] of [['bills', 'Bills', 'Treasury Bills'], ['notes', 'Notes', 'Treasury Notes'], ['bonds', 'Bonds', 'Treasury Bonds'], ['tips', 'Treasury Inflation-Protected Securities', 'Treasury Inflation-Protected Securities (TIPS)'], ['frn', 'Floating Rate Notes', 'Treasury Floating Rate Notes (FRN)'], ['ffb', 'Federal Financing Bank', 'Federal Financing Bank']]) {
    const c = D.composition[k]; set(c, 'value', r(+row('Marketable', cls).total_mil_amt / 1e3), `${k} outstanding`); c.share = r(100 * c.value / Db.marketableTotal.value, 2); c.asOf = d0;
    if (a0 === d0) set(c, 'avgRate', rate(desc), `${k} avg rate`);
  }
  if (a0 === d0) { set(D.rates_on_debt.avgRateMarketable, 'value', rate('Total Marketable'), 'avg rate marketable'); D.rates_on_debt.avgRateMarketable.asOf = a0;
    set(D.rates_on_debt.avgRateAllInterestBearing, 'value', rate('Total Interest-bearing Debt'), 'avg rate all'); D.rates_on_debt.avgRateAllInterestBearing.asOf = a0; }
  D.composition.check = { formula: 'bills + notes + bonds + TIPS + FRNs + FFB = marketable', gap: r(['bills', 'notes', 'bonds', 'tips', 'frn', 'ffb'].reduce((t, k) => t + D.composition[k].value, 0) - Db.marketableTotal.value) };
});

// ---------- Monthly: TIC Table 5 ----------
await step('TIC Table 5', async () => {
  const t = await (await get('https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table5.txt')).text();
  const L = t.split('\n').map((l) => l.split('\t')); const hdr = L.find((x) => x[0] === 'Country'); const c = 1, m = hdr[c];
  const row = (n) => L.find((x) => x[0].trim().toLowerCase() === n.toLowerCase());
  const FC = D.holders.foreignByCountry, asOf = `${m}-${new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate()}`;
  FC.series = FC.series.map((x) => { const nm = x.country === 'China, mainland' ? 'China, Mainland' : x.country === 'All other' ? 'All Other' : x.country; const rw = row(nm); return rw ? { ...x, value: +rw[c], prev: +rw[c + 1] } : x; });
  FC.total = +row('Grand Total')[c]; FC.official = +row('Of Which: Foreign Official')[c]; FC.officialBills = +row('Of Which: Foreign Official Treasury Bills')[c]; FC.asOf = asOf; FC.prevMonth = hdr[c + 1];
  set(D.holders.foreignTotalTIC, 'value', FC.total, 'TIC total'); D.holders.foreignTotalTIC.asOf = asOf; D.holders.foreignTotalTIC.parts = { official: FC.official };
});

// ---------- Quarterly: Z.1 sectors ----------
await step('Z.1 sectors', async () => {
  let asOf = null;
  for (const s of D.holders.bySector.series) { const [d, x] = (await fredRows(s.fred, '2020-01-01')).at(-1); set(s, 'value', r(x / 1e3), `Z.1 ${s.id}`); asOf = d; }
  const qEnd = (d) => { const y = +d.slice(0, 4), q = Math.floor((+d.slice(5, 7) - 1) / 3); return new Date(Date.UTC(y, q * 3 + 3, 0)).toISOString().slice(0, 10); };
  D.holders.bySector.asOf = qEnd(asOf);
  const [, tot] = (await fredRows('BOGZ1FL313161100Q', '2020-01-01')).at(-1); set(D.holders.z1Total, 'value', r(tot / 1e3), 'Z.1 total'); D.holders.z1Total.asOf = qEnd(asOf);
  const [, row] = (await fredRows('BOGZ1LM263061105Q', '2020-01-01')).at(-1), [, off] = (await fredRows('BOGZ1FL263061130Q', '2020-01-01')).at(-1);
  set(D.holders.foreignTotal, 'value', r(row / 1e3), 'Z.1 foreign'); D.holders.foreignTotal.asOf = qEnd(asOf); D.holders.foreignTotal.parts = { ...D.holders.foreignTotal.parts, official: r(off / 1e3) };
});

D._meta.lastAutoUpdate = new Date().toISOString().slice(0, 10);
console.log(`\n${log.length} changes`); log.forEach((l) => console.log('  ' + l));
if (!dry) writeFileSync(file, JSON.stringify(D, null, 2) + '\n');

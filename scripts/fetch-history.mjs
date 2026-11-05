#!/usr/bin/env node
// Fetch history series for the flow-map sparklines → data/history.json
// All values are converted to USD bn and sampled monthly (the last observation in each month;
// for the standing repo, the monthly maximum). Z.1 series are quarterly.
// Sources: FRED (Fed H.4.1, H.8, Z.1, NY Fed) and Treasury Fiscal Data (MSPD).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureProxy } from './lib/net.mjs';
ensureProxy();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const START = '2007-01-01';
const series = {
  fedAssets:    { id: 'WALCL', scale: 1e-3, label: 'Fed total assets (Wednesday)' },
  reserves:     { id: 'WRESBAL', scale: 1e-3, label: 'Reserve balances (week average)' },
  tga:          { id: 'WTREGEN', scale: 1e-3, label: 'Treasury General Account (week average)' },
  onRrp:        { id: 'RRPONTSYD', scale: 1, label: 'ON RRP usage (daily)' },
  foreignRrp:   { id: 'WLRRAFOIAL', scale: 1e-3, label: 'Foreign official reverse repo (Wednesday)' },
  currency:     { id: 'WLFN', scale: 1e-3, label: 'Federal Reserve notes, net (Wednesday)' },
  deposits:     { id: 'DPSACBW027SBOG', scale: 1, label: 'Deposits, all commercial banks (H.8, SA)' },
  srf:          { id: 'RPONTTLD', scale: 1, label: 'Fed repo operations / standing repo take-up (daily)', agg: 'max' },
  sofr:         { id: 'SOFR', scale: 1, unit: '%', label: 'SOFR' },
  iorb:         { id: 'IORB', scale: 1, unit: '%', label: 'IORB' },
  mmf:          { id: 'BOGZ1FL633061105Q', scale: 1e-3, label: 'Money funds: Treasury securities (Z.1)' },
  foreign:      { id: 'BOGZ1LM263061105Q', scale: 1e-3, label: 'Rest of world: Treasury securities (Z.1)' },
  banks:        { id: 'BOGZ1FL763061100Q', scale: 1e-3, label: 'US-chartered banks: Treasury securities (Z.1)' },
  dealers:      { id: 'BOGZ1FL663061105Q', scale: 1e-3, label: 'Broker-dealers: Treasury securities, net (Z.1)' },
  households:   { id: 'BOGZ1LM153061105Q', scale: 1e-3, label: 'Households & nonprofits (incl. hedge funds): Treasury securities (Z.1)' },
  fedTreasuries:{ id: 'WSHOTSL', scale: 1e-3, label: 'Fed: Treasury securities held outright (Wednesday)' },
  fedMBS:       { id: 'WSHOMCB', scale: 1e-3, label: 'Fed: mortgage-backed securities (Wednesday)' },
  tgaWed:       { id: 'WDTGAL', scale: 1e-3, label: 'Treasury General Account (Wednesday)' },
  reservesWed:  { id: 'WRBWFRBL', scale: 1e-3, label: 'Reserve balances (Wednesday)' },
  rrpAllWed:    { id: 'WLRRAL', scale: 1e-3, label: 'Reverse repos, all (Wednesday)' },
  y10:          { id: 'DGS10', scale: 1, unit: '%', label: '10-year Treasury yield' },
  y30:          { id: 'DGS30', scale: 1, unit: '%', label: '30-year Treasury yield' },
  y2:           { id: 'DGS2', scale: 1, unit: '%', label: '2-year Treasury yield' },
  termPremium:  { id: 'THREEFYTP10', scale: 1, unit: '%', label: '10-year term premium (Kim-Wright model estimate)' },
  realYield:    { id: 'DFII10', scale: 1, unit: '%', label: '10-year TIPS (real) yield' },
  dollar:       { id: 'DTWEXBGS', scale: 1, unit: 'index', label: 'Nominal broad US dollar index (Jan 2006 = 100)' },
  bitcoin:      { id: 'CBBTCUSD', scale: 1, unit: 'USD', label: 'Bitcoin price, Coinbase (USD)' },
  swaps:        { id: 'SWPT', scale: 1e-3, label: 'Central bank liquidity swaps outstanding (Wednesday)' },
};

async function fred(id) {
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${START}`);
  if (!r.ok) throw new Error(`${id}: ${r.status}`);
  return (await r.text()).trim().split('\n').slice(1).map((l) => l.split(',')).filter(([, v]) => v && v !== '.').map(([d, v]) => [d, +v]);
}
function monthly(rows, agg) {
  const m = new Map();
  for (const [d, v] of rows) { const k = d.slice(0, 7); m.set(k, agg === 'max' ? Math.max(m.get(k) ?? -Infinity, v) : v); }
  return [...m.entries()];
}
const out = { _meta: { fetched: new Date().toISOString().slice(0, 10), unit: 'USD bn unless unit says %', start: START, note: 'Monthly sample: the last observation in each month (standing repo: the monthly maximum). Z.1 series are quarterly (first day of the quarter = end-of-quarter level).' }, series: {} };
for (const [k, s] of Object.entries(series)) {
  try {
    const rows = monthly(await fred(s.id), s.agg).map(([d, v]) => [d, s.unit === 'USD' ? Math.round(v) : s.unit ? Math.round(v * 100) / 100 : Math.round(v * s.scale * 10) / 10]);
    out.series[k] = { label: s.label, unit: s.unit || 'USD bn', source: `FRED ${s.id}`, url: `https://fred.stlouisfed.org/series/${s.id}`, data: rows };
    console.log('ok  ', k, rows.length, rows.at(-1));
  } catch (e) { console.log('FAIL', k, e.message); }
}
// Fed "net liquidity" (trader heuristic): Wednesday total assets − Wednesday TGA − ON RRP that Wednesday.
try {
  const [A, T, R] = await Promise.all([fred('WALCL'), fred('WDTGAL'), fred('RRPONTSYD')]);
  const tga = new Map(T), rrp = new Map(R);
  const weekly = A.filter(([d]) => tga.has(d)).map(([d, a]) => [d, (a - tga.get(d)) / 1e3 - (rrp.get(d) ?? 0)]);
  out.series.netLiquidity = { label: 'Fed net liquidity = total assets − TGA − ON RRP (Wednesdays; trader heuristic)', unit: 'USD bn', source: 'FRED WALCL, WDTGAL, RRPONTSYD', url: 'https://fred.stlouisfed.org/series/WALCL',
    data: monthly(weekly).map(([d, v]) => [d, Math.round(v * 10) / 10]) };
  console.log('ok   netLiquidity', out.series.netLiquidity.data.at(-1));
} catch (e) { console.log('FAIL netLiquidity', e.message); }
// Marketable debt outstanding, monthly (MSPD Table I)
try {
  const u = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_1?filter=security_type_desc:eq:Total%20Marketable,record_date:gte:2015-01-01&sort=record_date&page[size]=500&fields=record_date,total_mil_amt';
  const j = await (await fetch(u)).json();
  out.series.marketable = { label: 'Marketable Treasury debt outstanding (MSPD)', unit: 'USD bn', source: 'Treasury MSPD Table I', url: 'https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/',
    data: j.data.map((r) => [r.record_date.slice(0, 7), Math.round(+r.total_mil_amt / 100) / 10]) };
  console.log('ok   marketable', j.data.length);
} catch (e) { console.log('FAIL marketable', e.message); }
writeFileSync(join(root, 'data/history.json'), JSON.stringify(out) + '\n');

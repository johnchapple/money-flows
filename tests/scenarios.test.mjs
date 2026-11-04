// Runs the page's scenario engine outside the browser and checks that every step of every scenario
// keeps the books balanced:
//   1. Fed assets = Fed liabilities (+ capital)
//   2. Bank reserves and bank deposits move together (the bank-side T-account balances)
//   3. No bucket goes negative
// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); assert.ok(i > 0 && j > i, `markers ${a}`); return html.slice(i, j); };
const ctx = {};
vm.createContext(ctx);
vm.runInContext(block('/* DATA:BEGIN', '/* DATA:END */').replace(/^\/\*[^]*?\*\//, '').replace(/\bconst\b/g, 'var'), ctx);
vm.runInContext(block('/* ENGINE:BEGIN', '/* ENGINE:END */').replace(/^\/\*[^]*?\*\//, '').replace(/^const /gm, 'var '), ctx);
const { SCENARIOS, statesFor, checkStep, initialState, fedTotals, DATA } = ctx;

test('starting state balances and matches H.4.1 total assets', () => {
  const s0 = initialState(DATA);
  const t = fedTotals(s0);
  assert.ok(Math.abs(t.assets - DATA.fed.totalAssets.value) < 0.001, `assets ${t.assets}`);
  assert.ok(Math.abs(t.assets - t.liabs) < 0.01, `assets ${t.assets} vs liabilities ${t.liabs}`);
});

for (const sc of SCENARIOS) {
  const variants = sc.variants ? sc.variants.map((v) => v.id) : [null];
  for (const v of variants) {
    test(`scenario ${sc.id}${v ? ' / ' + v : ''}: every step balances`, () => {
      const s0 = initialState(DATA);
      const { states, steps } = statesFor(sc, v, s0);
      assert.ok(steps.length >= 3 && steps.length <= 5, `${steps.length} steps (want 3–5)`);
      assert.equal(checkStep(s0, states[0]).join('; '), '', 'start override');
      for (let i = 1; i < states.length; i++) {
        assert.equal(checkStep(states[i - 1], states[i]).join('; '), '', `step ${i}: ${steps[i - 1].t}`);
      }
    });
  }
}

// ---------- Part I refinancing simulator ----------
const { simulateInterest, MATURITIES } = ctx;
const mix = DATA.issuance.couponMix.series.map((s) => [s.months, s.share]);
const base = { short: 4.21, long: 4.77, billShare: 0.246, months: 120, deficit: false, primaryDeficit: 940, mix };

test('simulator: starting run-rate matches coupons on the books (~$1.07T)', () => {
  const r = simulateInterest(MATURITIES.allMonths, base);
  assert.ok(r[0].interest > 1040 && r[0].interest < 1100, `start ${r[0].interest}`);
  assert.ok(Math.abs(r[0].D + DATA.composition.ffb.value - DATA.debt.marketableTotal.value) < 0.5, `debt ${r[0].D} (MSPD detail excludes FFB)`);
});
test('simulator: without new borrowing the debt stays constant and the bill share holds', () => {
  const r = simulateInterest(MATURITIES.allMonths, base);
  for (const x of r.slice(1)) {
    assert.ok(Math.abs(x.D - r[0].D) < 1e-6, `debt drifted at month ${x.t}`);
    assert.ok(Math.abs(x.B / x.D - 0.246) < 1e-9 || x.B / x.D > 0.246, `bill share at month ${x.t}: ${x.B / x.D}`);
    assert.ok(Math.abs(x.B + x.coupons - x.D) < 1e-6, `bills + coupons ≠ debt at month ${x.t}`);
  }
});
test('simulator: once every existing security has matured, the average rate equals the new rates', () => {
  const r = simulateInterest(MATURITIES.allMonths, { ...base, short: 4.5, long: 4.5, months: 372 });
  assert.ok(Math.abs(r[372].avg - 4.5) < 1e-6, `avg after 31y ${r[372].avg}`);
});
test('simulator: higher short rates raise cost faster than higher long rates in year 1', () => {
  const b = simulateInterest(MATURITIES.allMonths, base);
  const s = simulateInterest(MATURITIES.allMonths, { ...base, short: base.short + 1 });
  const l = simulateInterest(MATURITIES.allMonths, { ...base, long: base.long + 1 });
  assert.ok(s[12].interest - b[12].interest > l[12].interest - b[12].interest);
  assert.ok(l[120].interest - b[120].interest > s[120].interest - b[120].interest);
});

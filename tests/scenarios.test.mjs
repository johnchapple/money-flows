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

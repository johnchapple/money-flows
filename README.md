# The Debt & The Plumbing

An interactive explainer of US federal debt and dollar flows, set up like a strategy game's codex. The finished product will be a single self-contained HTML page (vanilla JS + SVG).

**Status:** All four phases are built, plus a **Start here** path for newcomers: eight hands-on lessons with toy balance sheets, live "in real life" numbers and a self-check question each. Then come Part I (the debt), Part II (the plumbing), Part III (connections), a codex and sources & methodology. Data last verified against primary sources on 2026-11-04 (`docs/verification.md`). Open `index.html` in a browser; it needs no server and no build step.

| File | What it is |
|---|---|
| `index.html` | The page. Its data sits in one block at the top (copied from `data/*.json` by `scripts/sync-data.mjs`), followed by the scenario engine and the UI |
| `data/history.json` | Monthly history series for the sparklines and small multiples (FRED, MSPD) |
| `data/rates-history.json` | Daily corridor rates since 2024 (FRED) |
| `tests/scenarios.test.mjs` | Runs every scenario step and checks that Fed assets = liabilities, reserves and deposits move together, and nothing goes negative |
| `data/data.json` | Every figure, each with `value`, `asOf`, `source`, `url` and a `status` (`primary` / `secondary` / `derived` / `modeled` / `recall` / `conflict`) |
| `data/maturities.json` | Maturity schedule built from MSPD Table III (463 CUSIPs, Sep 30 2026): monthly for 24 months, then yearly to 2056, by instrument, with coupons |
| `data/maturities-model.json` | The earlier approximate model, kept for comparison (within ~5% per year) |
| `data/glossary.json` | 80 terms: plain definition, why it matters, related terms, and `kind` (`fact` or `heuristic`) |
| `docs/mechanisms.md` | Every flow in the system map, with T-accounts, plus the **TODO-verify** list |
| `scripts/build-maturities-mspd.mjs` | Builds `maturities.json` from the Fiscal Data API |
| `scripts/model-maturities.mjs` | Builds the comparison model from auction history |
| `scripts/refresh.mjs` | Pulls the latest figures from Treasury Fiscal Data and FRED into `data/refresh-output.json`, for comparing by hand with `data.json` |
| `scripts/fetch-history.mjs` | Rebuilds `data/history.json` |
| `scripts/fetch-rates.mjs` | Rebuilds `data/rates-history.json` |
| `scripts/sync-data.mjs` | Copies `data/*.json` into `index.html` |
| `scripts/verify-figures.mjs` | Re-fetches 164 figures from their primary sources and compares them with `data.json`. Writes `docs/verification.md` and records the result in `data.json` |
| `docs/verification.md` | Latest verification report, including the figures that can't be machine-checked |
| `scripts/validate-data.mjs` | Checks that glossary links resolve, every figure has source and date fields, and the identities balance |

To refresh the data (needs network access to api.fiscaldata.treasury.gov, fred.stlouisfed.org, www.federalreserve.gov and markets.newyorkfed.org), pull the latest figures for comparing by hand with `data/data.json`:

```bash
node scripts/refresh.mjs
```

Rebuild the maturity schedule from the latest MSPD:

```bash
node scripts/build-maturities-mspd.mjs
```

Rebuild the sparkline history:

```bash
node scripts/fetch-history.mjs
```

Rebuild the daily rate-corridor history:

```bash
node scripts/fetch-rates.mjs
```

After editing any data file, copy the data into the page:

```bash
node scripts/sync-data.mjs
```

Re-verify against the sources (exits non-zero on any mismatch):

```bash
node scripts/verify-figures.mjs
```

Then run the checks:

```bash
node scripts/validate-data.mjs
```

```bash
node --test
```

## Quality checks (Phase 4)

- **Balance-sheet tests** (`node --test`): every toy balance sheet in the lessons balances after every action, and linked lines stay equal (a bank's reserves = the Fed's reserve liability to it). Every scenario step keeps Fed assets = liabilities, moves reserves and deposits together and keeps every bucket non-negative. The refinancing simulator is tested for its starting run-rate, conservation and convergence.
- **Accessibility:** axe-core reports no violations in light, dark and mobile modes, including with a scenario and a glossary popover open. There is a skip link and arrow-key scenario tabs. Buckets, bars and sliders are keyboard-operable, Escape closes popovers and tooltips, and every focusable element shows a visible focus ring.
- **Mobile:** no horizontal page scroll on iPhone 13, Pixel 7 or iPad Mini. Controls meet the 24px target size (the map has enlarged invisible hit areas). The flow map becomes a list under 640px, and the maturity wall scrolls inside its own frame.

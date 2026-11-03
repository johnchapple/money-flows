# The Debt & The Plumbing

An interactive explainer of US federal debt and dollar flows, set up like a strategy game's codex. The finished product will be a single self-contained HTML page (vanilla JS + SVG).

**Status: Phase 0 (research and data). No UI yet.**

| File | What it is |
|---|---|
| `data/data.json` | Every figure, each with `value`, `asOf`, `source`, `url` and a `status` (`primary` / `secondary` / `derived` / `modeled` / `recall` / `conflict`) |
| `data/maturities.json` | **Modeled** maturity schedule: monthly for 24 months, then yearly to 2056, by instrument, with approximate coupons |
| `data/glossary.json` | 80 terms: plain definition, why it matters, related terms, and `kind` (`fact` or `heuristic`) |
| `docs/mechanisms.md` | Every flow in the system map, with T-accounts, plus the **TODO-verify** list |
| `scripts/model-maturities.mjs` | Builds `maturities.json` from auction history, calibrated to MSPD totals |
| `scripts/refresh.mjs` | Pulls from Treasury Fiscal Data and FRED into `data/refresh-output.json` (not yet run; hosts blocked) |
| `scripts/validate-data.mjs` | Checks that glossary links resolve, every figure has source and date fields, and the identities balance |

```bash
node scripts/validate-data.mjs
```

```bash
node scripts/model-maturities.mjs
```

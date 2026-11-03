# The Debt & The Plumbing

An interactive explainer of US federal debt and dollar flows, set up like a strategy game's codex. The finished product will be a single self-contained HTML page (vanilla JS + SVG).

**Status: Phase 0 (research and data). No UI yet.**

| File | What it is |
|---|---|
| `data/data.json` | Every figure, each with `value`, `asOf`, `source`, `url` and a `status` (`primary` / `secondary` / `derived` / `modeled` / `recall` / `conflict`) |
| `data/maturities.json` | Maturity schedule built from MSPD Table III (463 CUSIPs, Sep 30 2026): monthly for 24 months, then yearly to 2056, by instrument, with coupons |
| `data/maturities-model.json` | The earlier approximate model, kept for comparison (within ~5% per year) |
| `data/glossary.json` | 80 terms: plain definition, why it matters, related terms, and `kind` (`fact` or `heuristic`) |
| `docs/mechanisms.md` | Every flow in the system map, with T-accounts, plus the **TODO-verify** list |
| `scripts/build-maturities-mspd.mjs` | Builds `maturities.json` from the Fiscal Data API |
| `scripts/model-maturities.mjs` | Builds the comparison model from auction history |
| `scripts/refresh.mjs` | Pulls the latest figures from Treasury Fiscal Data and FRED into `data/refresh-output.json`, for comparing by hand with `data.json` |
| `scripts/validate-data.mjs` | Checks that glossary links resolve, every figure has source and date fields, and the identities balance |

```bash
node scripts/validate-data.mjs
```

```bash
node scripts/model-maturities.mjs
```

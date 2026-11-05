# The Debt & The Plumbing

An interactive explainer of the US federal debt and the "plumbing" that moves dollars between the Treasury, the Federal Reserve, banks, money market funds, repo markets, foreign holders and stablecoins. It's written for curious non-specialists and set up like a strategy game's codex: every term is clickable, every number is dated and sourced.

**Open `index.html` in any browser.** It is one self-contained file, with no server, no build step and no external requests.

![A lesson: paying taxes moves reserves into the Treasury's account at the Fed](docs/img/lesson.png)

## What's inside

| Section | What you can do |
|---|---|
| **Start here** | Eight short lessons (about 10 minutes): IOUs and reserves → the Treasury's account at the Fed → borrowing with bills → short vs long debt → QE and QT → the ON RRP → repo and leverage → the Fed's rate corridor. Each has toy balance sheets you change with a button, a live "in real life" figure and a self-check question. |
| **Part I · The Debt** | Gross vs public vs marketable debt with an estimate ticker, the mix of bills/notes/bonds/TIPS/FRNs, a **maturity wall** built from every security Treasury has outstanding, a **refinancing simulator** (short rate, long rate, bill share) and who owns the debt. |
| **Part II · The Plumbing** | A to-scale map of the Fed's balance sheet and the buckets around it, with **seven step-by-step scenarios** (bill issuance, tax day and TGA rebuild, QT, quarter-end repo squeeze, a rate cut, a stablecoin inflow, a basis-trade unwind). After every step the page checks that the books still balance. |
| **Part III · Connections** | A decoder for headline phrases ("the RRP is drained", "term premium is rising", "fiscal dominance"…), the rate corridor since 2024, a crypto bridge (stablecoins, net liquidity, real yields, the dollar, with caveats) and the global dollar. |
| **Codex & Sources** | 80 defined terms, each tagged *fact* or *heuristic*, and every figure grouped by publisher with its date, status and link. |

![The flow map mid-scenario: Treasury sells bills, reserves drain into the TGA](docs/img/map.png)

![The maturity wall: marketable debt maturing by month, then by year to 2056](docs/img/wall.png)

## How the numbers are kept honest

- **One data file.** Every figure lives in `data/data.json` with `value`, `asOf`, `source`, `url` and a `status`: `primary` (read from the publisher's own data), `secondary`, `derived` (formula stored), `conflict` or `recall`. The page shows the status next to each figure.
- **Re-checked against the source.** `scripts/verify-figures.mjs` re-downloads 170 figures from Treasury Fiscal Data, Treasury TIC and press releases, the Fed's H.4.1 and Z.1, the Monthly Treasury Statement, the NY Fed and FRED, and compares them with `data.json`. Last run: **2026-11-05, 170/170 matched** ([docs/verification.md](docs/verification.md)). 28 figures can't be machine-checked and stay labeled on the page as secondary, derived or conflicting.
- **Facts vs heuristics.** Accounting identities are stated as facts. Market rules of thumb (net liquidity, "ample" reserves, term premium) are labeled as heuristics, with the competing views. The page takes no position on whether the debt is good or bad.
- **Open questions** are listed as TODO-verify in [docs/mechanisms.md](docs/mechanisms.md), which also documents every flow in the system with its balance-sheet entries.

## Checks

```bash
node --test
```

Runs 29 tests:
- **Scenarios:** every step keeps Fed assets = liabilities and moves bank reserves and deposits together.
- **Lessons:** every toy balance sheet balances after every action, and lines that are two views of the same money (a bank's reserves and the Fed's liability to it) stay equal.
- **Refinancing simulator:** tested for its starting run-rate, conservation and convergence.

```bash
node scripts/validate-data.mjs
```

Checks data structure, glossary links and accounting identities. A GitHub Actions workflow (`.github/workflows/check.yml`) runs both on every push, and also fails if `index.html` is out of sync with `data/*.json`.

The page was also checked in headless Chromium:
- **Accessibility:** axe-core reports no violations in light, dark and mobile views. There is a keyboard walkthrough (skip link, arrow-key scenario tabs, focus handling for popovers and tooltips).
- **Mobile:** no horizontal scroll and 24px touch targets on phone and tablet sizes.

## Refreshing the data

The scripts need Node 22+ and network access to `api.fiscaldata.treasury.gov`, `fred.stlouisfed.org`, `www.federalreserve.gov`, `markets.newyorkfed.org`, `ticdata.treasury.gov` and `home.treasury.gov`. They use the `HTTPS_PROXY` setting when one is configured.

1. Pull the latest values for comparison (writes `data/refresh-output.json`, which is git-ignored), then update `data/data.json` by hand:

   ```bash
   node scripts/refresh.mjs
   ```

2. Rebuild the maturity schedule from the latest Monthly Statement of the Public Debt:

   ```bash
   node scripts/build-maturities-mspd.mjs
   ```

3. Rebuild the history series for sparklines, the corridor chart and the crypto panels:

   ```bash
   node scripts/fetch-history.mjs
   ```

   ```bash
   node scripts/fetch-rates.mjs
   ```

4. Re-verify. This exits non-zero on any mismatch; its checks name exact dates, so update them when you move the as-of dates:

   ```bash
   node scripts/verify-figures.mjs
   ```

5. Copy the data into the page, then run the checks:

   ```bash
   node scripts/sync-data.mjs
   ```

   ```bash
   node --test
   ```

## Publishing

`index.html` works anywhere static files are served, for example GitHub Pages. To publish it as a claude.ai Artifact, whose host adds its own `<html>/<head>/<body>` wrapper, first make a wrapper-free copy:

```bash
node scripts/build-artifact.mjs /path/to/out.html
```

## Files

| Path | Purpose |
|---|---|
| `index.html` | The page: data block (generated), then the tested engine (scenarios, lessons, simulator), then the UI |
| `data/data.json` | Every figure with value, date, source, link and status |
| `data/maturities.json` | Maturity schedule from MSPD Table III (463 securities, Sep 30 2026) |
| `data/maturities-model.json` | An earlier approximate model, kept for comparison |
| `data/history.json`, `data/rates-history.json` | Monthly and daily history series (FRED, MSPD) |
| `data/glossary.json` | 80 terms: definition, why it matters, related terms, fact/heuristic |
| `docs/mechanisms.md` | Every flow with T-accounts; TODO-verify list |
| `docs/verification.md` | Latest source-verification report |
| `scripts/` | Data refresh, verification, sync, artifact build and validation scripts (see above) |
| `tests/scenarios.test.mjs` | Balance-sheet tests for scenarios, lessons and the simulator |

## Known limitations

- Data is a snapshot as of late Oct – early Nov 2026. Refreshing is a manual, scripted process (above), not automatic.
- Still secondary for lack of an accessible primary source: money-fund totals (ICI blocks automated access), hedge-fund repo borrowing (SEC Form PF), stablecoin supply and Tether/Circle reserves, OFR's repo-market size, and the Japanese rate figures. Legal dates and CBO projections were read through search excerpts and are labeled secondary.
- The refinancing simulator is a sketch of the mechanics, not a forecast: TIPS at their real coupon, FRNs treated as bills, a fixed primary deficit.
- The lessons' toy balance sheets simplify on purpose (for example, the Treasury's "net position" as a balancing line).

Ideas not yet built: a historical slider (2007 → today), an automated data-refresh job, and comparisons with Japan's and the UK's debt profiles.

# Getting the blocked figures from primary sources

As of Nov 5, 2026, the page reads about 170 figures directly from the publisher (Treasury, Federal Reserve, NY Fed, FRED) and re-checks them automatically. About 28 are still **secondary** (taken from a site that cites the source) or **conflicting**. This note explains, for each one, where the primary version lives and what it would take to read it automatically.

## The short version

Two different machines fetch data, and they have different restrictions:

| Where the fetch runs | Network | What to do |
|---|---|---|
| **GitHub Actions** (the weekly `update-data` workflow) | Open internet | Most blocked sources below work here as-is. Add a fetcher to `scripts/update-data.mjs` and it runs every Friday. |
| **Claude Code cloud environment** (where this project was built) | Allow-list | Add each host under the environment's *Network access → Allowed domains*, then start a new session. |

So the cheapest path to better data is to write fetchers for the sources below and let the GitHub Action run them. This environment only needs the hosts if you want Claude to work with them interactively.

Hosts that were still refused here on Nov 5, 2026:
`data.financialresearch.gov`, `www.sec.gov`, `tether.to`, `www.circle.com`, `www.federalregister.gov`, `api.congress.gov`, `www.cbo.gov`, `files.gao.gov`, `www.mof.go.jp`, `www.boj.or.jp`, `stablecoins.llama.fi`. `www.ici.org` is reachable but answers **403** to automated clients (bot protection).

## Figure by figure

### Money market fund assets (weekly) · ICI
- **Now:** the weekly ICI total ($7.9T, Oct 28) is secondary. The page also shows the Fed's **Z.1 money-fund total assets** ($8.44T, Q2 2026, primary via FRED `MMMFFAQ027S`), which updates automatically.
- **Primary source:** ICI's weekly *Money Market Fund Assets* release (Thursdays). ICI blocks scripted downloads. Read the release by hand, or ask ICI about a data subscription. Don't work around the block.
- **Free automated alternatives:**
  - **OFR Money Market Fund Monitor** (`data.financialresearch.gov`, no key). Monthly, built from SEC Form N-MFP; breaks holdings into Treasuries, repo and Fed ON RRP.
  - **SEC Form N-MFP filings** (`www.sec.gov`). The SEC asks automated clients to send a `User-Agent` naming the app and a contact email, and to stay under 10 requests per second.

### Hedge-fund repo borrowing and the basis trade · SEC Form PF, OFR
- **Now:** $3.38T gross repo borrowing (mid-2026), secondary (via a newsletter).
- **Primary source:** SEC *Private Funds Statistics* (quarterly, `www.sec.gov`) and OFR's **Hedge Fund Monitor** (`data.financialresearch.gov/hf/v1/...`, free JSON API), which republishes Form PF aggregates including repo borrowing.
- **To automate:** add a fetcher for the OFR Hedge Fund Monitor series to `update-data.mjs`. CFTC *Traders in Financial Futures* (`www.cftc.gov`, weekly) adds leveraged-fund Treasury futures shorts, a public proxy for basis-trade size.

### Repo market size · OFR
- **Now:** $12.6T (Q3 2025), secondary.
- **Primary source:** OFR **Short-term Funding Monitor** (`data.financialresearch.gov/v1/...`, free API): tri-party, cleared (DVP and GCF) and uncleared bilateral repo volumes (OFR's newer non-centrally-cleared bilateral repo collection).
- **To automate:** one fetcher in `update-data.mjs`. The NY Fed daily volumes (SOFR, TGCR, BGCR) already update automatically.

### Stablecoin supply and reserves · issuers, blockchains
- **Now:** total supply (~$300B), USDT and USDC supply, and Tether's T-bills are secondary or conflicting.
- **Primary sources:**
  - **Token supply** is public on-chain. Read the `totalSupply()` of the USDT and USDC contracts on each major chain through a public node or explorer API. That's the most primary source there is, but each chain must be added up.
  - **Reserves:**
    - Tether: quarterly attestation reports (BDO) at `tether.to/en/transparency`, PDFs.
    - Circle: monthly reserve reports at `www.circle.com/transparency`. Daily holdings of the Circle Reserve Fund (BlackRock, ticker USDXX) are on BlackRock's site.
  - Once the GENIUS Act takes full effect (expected by Jan 18, 2027), US-regulated issuers must publish monthly reserve reports examined by an accountant, which should make this much easier.
- **Aggregate supply:** DefiLlama's free API (`stablecoins.llama.fi`) is a reputable aggregator, but still a secondary source.

### Legal dates · GENIUS Act, eSLR, Treasury clearing mandate
- **Now:** dates read via search excerpts, labeled secondary.
- **Primary sources:**
  - **Congress.gov API** (`api.congress.gov`; free key from api.data.gov) for public laws.
  - **Federal Register API** (`www.federalregister.gov/api/v1`, no key) for the eSLR final rule and the OCC's GENIUS Act rules.
  - **SEC** (`www.sec.gov`) for the clearing-mandate compliance dates.
- These rarely change, so one manual check against the Federal Register is enough.

### CBO projections · net interest 2026–2036
- **Now:** secondary (search excerpt of CBO's *Budget and Economic Outlook*, Feb 2026).
- **Primary source:** CBO publishes the baseline as Excel files (`www.cbo.gov/data/budget-economic-data`). Allow `www.cbo.gov`, or download the "10-Year Budget Projections" file when CBO updates it (usually Jan/Feb and in the summer).

### Japan: BOJ policy rate and JGB yields
- **Now:** 10-year JGB monthly average **3.05% (Sep 2026), primary** via FRED (OECD data, `IRLTLT01JPM156N`), updated automatically. The daily close (2.829%, Oct 27) and the BOJ policy rate (1.25%) are still secondary.
- **Primary sources:** Japan's Ministry of Finance daily yield curve (`www.mof.go.jp`, CSV `jgbcme.csv`) and the BOJ time-series database (`www.stat-search.boj.or.jp`) for the policy rate.

### GAO, history anchors and event dates
- GAO's "33% maturing within a year" is replaced by our own calculation from the MSPD (33.4%).
- The BTFP peak and some event dates (SVB, April 2025) are from memory and labeled "recall". The Fed's H.4.1 archive (the BTFP line, 2023–24) can confirm the BTFP peak.

### Cross-currency basis
- No free daily series found. Commercial terminals (Bloomberg, LSEG) carry it. The BIS publishes research datasets occasionally, but nothing suitable for a live page.

## Suggested order of work

1. **OFR API** (`data.financialresearch.gov`): one host covers money funds, repo size and hedge-fund repo. Biggest gain.
2. **On-chain stablecoin supply:** makes the crypto bridge fully primary.
3. **CBO Excel baseline:** twice a year.
4. **Federal Register / Congress.gov:** a one-off check of the legal dates.
5. **MOF / BOJ:** daily JGB and policy rate.

When a figure moves to a primary source, set its `status` to `primary` in `data/data.json` and update `source` and `url`. If possible, add a check for it in `scripts/verify-figures.mjs`.

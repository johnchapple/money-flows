# Mechanisms: how dollars move between the buckets

Phase 0 working notes for *The Debt & The Plumbing*. Each flow lists **what moves**, **from → to**, **what triggers it** and **the balance-sheet entries** (T-accounts) that the flow-map animation has to enforce. Numbers are starting points from `data/data.json` (as of late Oct 2026).

Labels:
- **[identity]**: accounting that has to hold, true by construction.
- **[mechanism]**: how it usually works in practice; well documented.
- **[heuristic]**: market shorthand. Useful, but contested or approximate.

---

## 0. The core identity

**[identity]** The Fed's balance sheet always balances:

```
ASSETS                                   LIABILITIES (+ capital)
  Treasuries (SOMA)          ~4.4T         Currency in circulation   ~2.4T  (placeholder)
  Agency MBS                 ~1.9T         Bank reserves             ~2.9T  (conflicting sources)
  Repo lending (SRF, FIMA)    ~0           TGA                       ~1.0T
  Loans, swaps, other        small         ON RRP                    ~0.0002T
                                           Foreign official RRP      ~0.33T
                                           Other, capital, minus deferred asset (residual)
  TOTAL                     ~6.75T         TOTAL                    ~6.75T
```

Consequences used everywhere below:
1. **If Fed assets are unchanged, liabilities can only swap with each other.** If the TGA rises by $X, then reserves + ON RRP + currency + the rest must fall by $X combined.
2. **Fed assets change only when the Fed acts**: buying or running off securities, lending through repo, the discount window or swap lines, or paying down the deferred asset.
3. **Reserves exist only at the Fed.** Banks can pass reserves among themselves but can't create or destroy them in aggregate. Only changes on the Fed's balance sheet do that.

The flow map has to check (1) after every animation step (`assets === sum(liabilities)`).

---

## 1. Treasury spends and taxes

| Flow | From → to | Trigger | T-accounts |
|---|---|---|---|
| Government spending | TGA → recipients' bank deposits | Daily payments (Social Security, contracts, interest) | Fed: TGA −X, reserves +X. Banks: reserves +X, deposits +X |
| Tax receipts | Taxpayers' deposits → TGA | Withholding daily; big lumps on Apr 15, Jun 15, Sep 15, Dec 15 | Fed: reserves −X, TGA +X. Banks: reserves −X, deposits −X |

**[identity]** Payments between the private sector and Treasury move money between reserves and the TGA one for one.

**[mechanism]** Tax day is a known reserve drain: a few hundred billion can move into the TGA within days around mid-April.

---

## 2. Treasury borrows: bill and coupon issuance

When Treasury sells $X of new securities, cash goes into the TGA. **Where the buyer's cash came from** decides the liquidity effect:

| Buyer's cash came from | Effect on the Fed's liabilities | Net "liquidity" effect |
|---|---|---|
| **Money fund pulling cash from the ON RRP** | ON RRP −X, TGA +X | Reserves unchanged. This was the 2023–24 pattern, which is why heavy bill issuance didn't hurt then. |
| **Bank deposits** (household, company or MMF cash held at a bank) | Reserves −X, TGA +X | Reserves fall. With the ON RRP near zero, this is now the main case. |
| **Another holder selling an existing Treasury** | None (secondary-market swap) | None directly. Prices adjust instead. |
| **The Fed (RMPs or reinvestment)** | Fed buys from the market, so reserves +X; Treasury's sale does TGA +X, reserves −X | Net: Fed assets +X, TGA +X, reserves unchanged |

**[mechanism]** Money funds move between the ON RRP, private repo and bills by comparing yields. When bills yield more than the ON RRP rate (3.75%), funds leave the RRP to buy bills. This is the "MMFs left the RRP to buy bills" story of 2023–25, and it's why the ON RRP fell from $2.55T (Dec 2022) to about $0.

**[mechanism]** Treasury then spends the money (section 1), so the drain is temporary unless the TGA balance itself is rising. **The level of the TGA matters, not gross issuance.**

---

## 3. Debt ceiling cycle → TGA drawdown, then rebuild

1. **Limit binds.** Treasury can't issue net new debt. It uses extraordinary measures and spends down the TGA. TGA falls, so reserves (or ON RRP) rise: **liquidity added**.
2. **Limit raised or suspended.** Treasury issues a burst of bills, including cash-management bills, to rebuild the TGA to its target (about $850B at quarter-ends in recent guidance; check this). TGA rises and reserves or ON RRP fall: **liquidity drained**.
3. 2023 example: about $1T of bills after the June 2023 deal, absorbed mostly from the ON RRP, so reserves held up. In 2025, after the July 4 OBBBA increase, the ON RRP was already small, so more of the drain fell on reserves.

**[mechanism]** Now: the limit is $41.104T and debt subject to the limit is about $40.24T (Oct 22, 2026), leaving about $860B of headroom. NTU expects the limit to be hit around May 2027, CRFB mid-to-late 2027. The next drawdown-and-rebuild cycle is likely in 2027.

---

## 4. Fed balance-sheet policy: QE, QT, RMPs

| Action | T-accounts |
|---|---|
| **QE**: Fed buys $X of Treasuries from a dealer or investor | Fed: Treasuries +X, reserves +X |
| **QT, Treasury runoff**: $X of Fed-held Treasuries mature and are not rolled | Treasury repays the Fed from the TGA (TGA −X, Fed Treasuries −X), then borrows $X from the public to refill it (TGA +X, reserves or ON RRP −X). Net: Fed assets −X, reserves/ON RRP −X |
| **QT, MBS runoff**: homeowners repay $X of mortgages | Fed: MBS −X, reserves −X (paid through the servicers' banks) |
| **RMPs** (since Dec 12, 2025): Fed buys $X of bills | Fed: bills +X, reserves +X. The same accounting as QE, but short-dated and sized to offset growth in currency and the TGA |
| **MBS reinvestment into bills** | MBS −X, bills +X. Total assets unchanged |

**[mechanism]** QT (June 2022 – Dec 1, 2025) drained the ON RRP first, because money funds found bills more attractive, and then reserves. QT ended Dec 1, 2025. Reserve-management purchases started Dec 12, 2025. *Current pace: see TODO-verify.*

**[heuristic]** "QT is a liquidity drain" is true in terms of reserves and RRP. Whether it moves asset prices much is debated.

---

## 5. The rate corridor and overnight funding

```
 4.00%  ── Standing repo (SRP/SRF) minimum bid rate = ceiling, also discount window primary credit
 3.90%  ── IORB (interest on reserve balances)
 ~3.88% ── EFFR (mid-Oct)        SOFR ~3.90–3.95% (late Oct) ← at or above IORB = cash getting scarce
 3.75%  ── ON RRP offering rate = floor
        Target range 3.75–4.00% (raised 25bp on Sep 16, 2026; held Oct 28, 2026)
```

**[mechanism]** Money funds won't lend for less than the ON RRP rate, because they can always lend to the Fed instead. Dealers won't pay much more than the standing-repo rate, because they can borrow from the Fed. **Where SOFR sits between these lines is a live gauge of reserve scarcity.** SOFR trading above IORB, as it has at times in late Oct 2026, is the sign usually cited for reserves no longer being "ample".

**[mechanism]** Quarter-end: foreign banks shrink their balance sheets on reporting dates (their leverage ratios are measured on those dates), so repo supply falls, SOFR jumps, and standing-repo use rises. Record: $74.6B on Dec 31, 2025. T-accounts: Fed repo assets +X, reserves +X, reversing the next day.

---

## 6. Repo: the pawn shop for bonds

**[mechanism]** One side hands over a Treasury and receives cash, then buys it back tomorrow for slightly more. The difference is the repo rate. There are three venues:
- **Tri-party** (BNY holds the collateral): money funds lend here. The ON RRP and standing repo settle here too.
- **Cleared through FICC** (sponsored / DVP): trades can be netted, which saves dealer balance sheet. The SEC clearing mandate pushes Treasury repo here by **Jun 30, 2027** (cash trades by **Dec 31, 2026**).
- **Uncleared bilateral**: dealer ↔ hedge fund, often with no haircut. The least visible segment.

Chain of a typical leveraged position:
```
Money fund ──cash──▶ (tri-party) ──▶ Dealer ──cash──▶ (bilateral/FICC) ──▶ Hedge fund
         ◀─collateral──                   ◀──collateral──
```

Sizes: SOFR covers about $3T/day of underlying trades (NY Fed, Sep 2026). Total repo outstanding is about $12.6T (OFR, Q3 2025).

---

## 7. Basis trade and its unwind

**[mechanism]** A hedge fund buys a cash Treasury, sells the matching Treasury future, and finances the bond in repo at 50–100× leverage. It earns the small gap between the cash and futures prices. OFR estimated about $2T at end-2025, and gross hedge-fund repo borrowing was $3.38T in Jun 2026 (Form PF).

**Unwind sequence** (this is the scenario 7 script):
1. Shock: volatility spikes, so futures margins and repo haircuts rise.
2. Funds sell cash Treasuries and buy back futures. Hedge fund: Treasuries −X, repo borrowing −X.
3. Dealers absorb the bonds and need financing. Dealer: Treasuries +X, repo borrowing +X, constrained by the SLR. Swap spreads fall and yields jump.
4. If private repo can't fund the dealers, the standing repo (SRF) does. Fed: repo +X, reserves +X.
5. In 2020 the Fed also bought outright (QE): Fed Treasuries +X, reserves +X.

**[mechanism]** The eSLR reform (effective Apr 1, 2026) and central clearing are meant to give dealers more room in step 3.

---

## 8. Who holds the debt, and what changes it

- **Trust funds** ($7.7T, intragovernmental) grow with payroll-tax surpluses and shrink as Social Security draws them down.
- **Fed** (about $4.4T of Treasuries) grows through RMPs and reinvestment, shrinks through QT.
- **Foreign** (about $9.3T, Jun 2026). Japan $1.07T, UK $1.01T (much of it custody for hedge funds), China $0.59T and falling. About 41% official, 59% private. TIC records where a security is held, not who ultimately owns it.
- **Money funds** (about $7.9T in total assets): bills plus repo. *Their exact Treasury holdings are a TODO.*
- **Banks**, **mutual funds**, **pensions and insurers**, **state and local governments**, **households**: *need Fed Z.1 Table L.210*.
- **Stablecoin issuers** (about $300B in total supply; Tether about $115B in bills by its attestation).

---

## 9. Global dollar system

**[mechanism]** Banks and firms outside the US have trillions of dollar debts (eurodollars). In a scramble for dollars:
- The **cross-currency basis** widens, because borrowing dollars by swapping another currency gets more expensive.
- **Swap lines**: the Fed swaps dollars for euros, yen etc. with a central bank, which lends them on to its own banks. Fed: swaps +X; foreign CB deposits +X, then reserves +X as the dollars are used.
- **FIMA repo**: a foreign central bank borrows against its Treasuries instead of selling them. Fed: repo +X, reserves +X. This avoids a fire sale in the Treasury market.

**[mechanism]** Japan: the BOJ policy rate is 1.25% after the Sep 2026 hike, the 10y JGB went above 3% (Sep 1, 2026) and the 30y JGB reached a record 4.235% (Oct 5, 2026). Higher yields at home reduce Japanese life insurers' and pensions' appetite for unhedged US duration. Yen carry unwinds (Aug 2024 is the template) can force selling of US assets.

---

## 10. Stablecoins: the crypto bridge

Sequence for a $10B inflow (scenario 6):
1. A user sends $10B from a bank deposit to the issuer's bank account. Deposits move between banks; total reserves don't change.
2. The issuer buys $10B of T-bills (≤93 days per the GENIUS Act):
   - **from the secondary market**: the seller (say, a money fund) now holds the cash. No net change to Fed liabilities. Who holds bills changes.
   - **from new issuance**: TGA +10, reserves −10, the same as section 2.
3. Or the issuer keeps part of the reserve as bank deposits, overnight repo or a government MMF (Circle mostly uses a BlackRock government MMF).

**[mechanism]** Stablecoins become structural buyers of short bills, which lets Treasury lean on bills. **[heuristic]** How much *net new* demand that is depends on where the dollars came from: displaced bank deposits, money-fund shares or offshore dollars. That is debated (see TODO-verify).

---

## 11. Why markets and bitcoin watch "liquidity"

**[heuristic]** **Fed net liquidity = Fed total assets − TGA − ON RRP.** On current figures: 6,746 − 1,016 − 0.2 ≈ **$5.73T**. It is a trader's measure, not an official one.

Why people watch it: if the TGA or ON RRP absorbs cash, less of the Fed's balance sheet is left as reserves in private hands, and supposedly less is available to buy risk assets. With the ON RRP at about $0, the measure now mostly tracks Fed assets minus the TGA.

The honest caveats:
- The correlation with stocks and bitcoin held up well in some periods (2020–22) and broke down in others. Correlation is not mechanism.
- It leaves out bank lending, money-fund cash, foreign dollars, rate expectations and risk appetite.
- Real yields (TIPS) and the dollar (DXY) are at least as commonly cited. Bitcoin's own supply and demand dynamics (ETF flows, halvings, leverage) often dominate.
- Best read as one input, not a forecasting rule.

---

## 12. Interest cost: how fast rates pass through

**[mechanism]**
- About 22% of marketable debt is bills, which reprice within weeks. FRNs (2%) reset weekly.
- About 33% of marketable debt matures within 12 months (GAO), so a one-point change in short rates moves interest costs by about 0.33 × $31.8T ≈ **$105B a year within a year** (rough; ignores new deficits).
- Notes and bonds lock in their coupon until maturity. A 10-year issued in 2020 at about 0.9% only reprices in 2030.
- The average rate on marketable debt was 3.518% (Sep 2026), up from about 1.56% (early 2022), and is still rising as low-coupon 2020–21 debt matures.
- Fed losses add a further channel: the Fed's losses (the deferred asset) mean the $55–110B a year it remitted in 2019–21 no longer reduces the deficit.

The simulator in Phase 1 will use `data/maturities.json` (modeled) to roll each bucket over at the slider rates.

---

## TODO-verify

### Figures to confirm against primary sources (blocked: primary hosts unreachable)
1. **MSPD Table I, Sep 30 2026**: exact million-level values for marketable total, bills, notes, bonds, TIPS, FRNs, and the non-marketable breakdown (GAS, savings bonds, SLGS). The current values come from JEC and Pier20 excerpts.
2. **Reserve balances, Oct 28 2026**: 2.89T (H.4.1, garbled), 2.96T (week average to Oct 21) or 3.11T (Substack)?
3. **Currency in circulation, Oct 2026**: 2,430 is a placeholder. The last confirmed figure is 2,416.9bn (Oct 2025).
4. **SOMA Treasury holdings**: 4.41T, 4.44T or 4.57T? Sources conflict.
5. **RMP pace**: still $10–15bn/month, or paused since Aug 14 2026? Get the latest NY Fed Desk statement.
6. **3-month and 5-year yields** on Oct 30 2026 (not found). The **2-year 4.56%** has only one source.
7. **SOFR, Oct 27 2026**: 3.91% or 3.95%?
8. **Gross debt in Aug 2026**: your starting note says ≈$39.9T. MSPD excerpts give $40.176T at Aug 31, and NTU gives $39.7T on Aug 10. Both could be right for different dates in August. Also check when debt first crossed $40T.
9. **"Interest $1.17T in the first 10 months of FY2026"**: not found. I have $1.36T gross for the full year (secondary) and $1.052T net (MTS).
10. **Fed total assets**: your "≈$6.76T (Oct 2026)" vs $6.746T on Oct 28. Probably a different week.
11. **Tether T-bills**: $114.9bn (attestation) vs about $141bn (probably including reverse repo). Which date's attestation?
12. **Standing repo take-up on Sep 30 2026**: $1.2bn, single blog source.
13. **Total foreign holdings, Aug 2026** (only Jun 2026 found, $9.29T). India $219.7bn is secondary.
14. **Money funds' Treasury holdings** (ICI/SEC N-MFP), and **Z.1 L.210** holder shares for banks, mutual funds, pensions, insurers, state and local governments, and households.
15. **ON RRP peak ($2,553.7bn, Dec 30 2022)**, **Fed assets peak ($8.965T, Apr 13 2022)**, **reserves peak (~$4.27T, Dec 2021)**, **SOFR 5.25% on Sep 17 2019**, **BTFP peak (~$168bn)**: all entered from memory.
16. **Average rate on marketable debt, early 2022**: 1.56% from memory. Find the exact low month.

### Mechanisms I'm not sure about (questions, not claims)
17. When money funds buy bills with cash they would otherwise lend in **private repo** (not the ON RRP), does the drain fall on reserves one for one, or do dealers replace the funding in ways that change the split? The flow map currently treats "private repo" as ultimately backed by bank deposits, so reserves fall.
18. Does the **foreign official repo pool** pay the ON RRP rate, or a rate tied to it? What has kept it at about $325bn?
19. Is the Fed's **deferred asset** still shrinking after the Sep 2026 hike? A higher IORB raises Fed expenses, while RMP bills earn more income.
20. What is Treasury's current **TGA target** (end-of-quarter cash balance), and is the TGA's rise to about $1.04T at end-October in line with it?
21. **GENIUS Act final rules**: did the OCC final rule (Bulletin 2026-50) keep the 93-day limit unchanged, and what is the binding effective date: Jan 18 2027, or 120 days after the final rules?
22. **Net T-bill demand from stablecoins**: how much is new demand versus displaced demand from money funds and banks? Is there research from the Fed, BIS or Treasury (TBAC's 2025 stablecoin charge) to cite?
23. **eSLR reform details**: is the new buffer exactly 50% of the method-1 G-SIB surcharge, and does the depository-institution-level cap matter for Treasury market making?
24. **Standing repo central clearing**: has the Fed started clearing standing repo through FICC, or announced dates?
25. **Debt-ceiling timing**: does the Oct 2026 headroom (~$860bn) pull the 2027 hit date earlier than May 2027?
26. **Who cast the dissents on Oct 28 2026** (reported as Cook and Hammack, favoring a hike)? Secondary sources only. Not needed for the page unless quoted.
27. The **Warsh chairmanship** and the **Sep 2026 hike** are confirmed by Fed documents in search results. Confirm the date Warsh took office, for the codex.

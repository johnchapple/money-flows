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
ASSETS  (H.4.1, Wed Oct 28 2026, $bn)    LIABILITIES (+ capital)
  Treasuries (SOMA)       4,576.6          Currency (Fed notes, net)  2,434.0
  Agency MBS              1,883.5          Bank reserves              2,895.2
  Repo lending (SRF/FIMA)     0.0          TGA                        1,015.6
  Loans                       9.6          ON RRP ("others")              0.2
  Swaps                       0.2          Foreign official RRP         325.7
  Premiums, gold, FX, other 275.8          Other deposits               248.8
                                           Other liabilities           −221.9  (includes deferred asset −232.5)
                                           Capital                       47.7
  TOTAL                   6,745.6          TOTAL                      6,745.6
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

**[mechanism]** QT (June 2022 – Dec 1, 2025) drained the ON RRP first, because money funds found bills more attractive, and then reserves. QT ended Dec 1, 2025. Fed bill purchases (reserve management plus MBS reinvestment) began Dec 12, 2025: $38B in Dec, a peak of $60B in Mar 2026, slowing to about $12–13B a month in Sep–Oct 2026 ($378B in total, NY Fed operation results).

**[heuristic]** "QT is a liquidity drain" is true in terms of reserves and RRP. Whether it moves asset prices much is debated.

---

## 5. The rate corridor and overnight funding

```
 4.00%  ── Standing repo (SRP/SRF) minimum bid rate = ceiling, also discount window primary credit
 3.90%  ── IORB (interest on reserve balances)
 3.88%  ── EFFR (Nov 2)          SOFR 3.95% (Nov 2) ← above IORB = cash getting scarce
 3.75%  ── ON RRP offering rate = floor
        Target range 3.75–4.00% (raised 25bp on Sep 16, 2026; held Oct 28, 2026)
```

**[mechanism]** Money funds won't lend for less than the ON RRP rate, because they can always lend to the Fed instead. Dealers won't pay much more than the standing-repo rate, because they can borrow from the Fed. **Where SOFR sits between these lines is a live gauge of reserve scarcity.** SOFR trading above IORB (3.95% vs 3.90% on Nov 2 2026) is the sign usually cited for reserves no longer being "ample".

**[mechanism]** Quarter-end: foreign banks shrink their balance sheets on reporting dates (their leverage ratios are measured on those dates), so repo supply falls, SOFR jumps, and standing-repo use rises. Record: $74.6B on Dec 31, 2025. After bill purchases resumed, quarter-end use fell to about zero in Mar and Jun 2026 and $1.2B on Sep 30, 2026. T-accounts: Fed repo assets +X, reserves +X, reversing the next day.

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

Fed Z.1 Financial Accounts, Q2 2026 (base: $31.49T held by the public, Z.1 definition), plus H.4.1 and MSPD:

| Holder | $bn | Note |
|---|---|---|
| Foreign | 9,269 | 41% official (central banks), 59% private. TIC: Japan 1,068, UK 1,010 (much of it custody for hedge funds), China 591 (Aug 2026) |
| Federal trust funds | 7,747 | Intragovernmental, not in the $31.49T base (MSPD, Sep 30) |
| Federal Reserve | 4,577 | H.4.1, Oct 28. Z.1 shows 4,083 for Q2 (valuation gap: TODO) |
| Money market funds | 3,282 | Mostly bills, plus repo |
| Households & nonprofits | 2,831 | **Z.1 residual: includes hedge funds** |
| Banks (US-chartered) | 1,799 | |
| Mutual funds | 1,741 | |
| State & local governments | 1,648 | Excluding SLGS |
| Pension funds | 1,175 | Private 590, state & local DB 562, federal 23 |
| ETFs | 808 | |
| Insurers | 609 | Property-casualty 380, life 229 |
| Broker-dealers (net) | 567 | |
| Stablecoin issuers | ~150 | Not a Z.1 sector. Tether about $115B in bills (attestation, secondary source). Total stablecoin supply about $300B |

Rows can't simply be added up: Z.1 uses market value for some sectors and face value for others, and the residual sectors (credit unions, GSEs, nonfinancial corporations, other financial firms) aren't listed.

What changes the holdings: trust funds grow with payroll-tax surpluses and shrink as benefits are paid. The Fed's grow with bill purchases and shrink with QT. Money funds' follow the bill share of issuance. Foreign holdings follow reserve management and hedged yields (Japan).

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

**[heuristic]** **Fed net liquidity = Fed total assets − TGA − ON RRP.** On Oct 28 2026: 6,745.6 − 1,015.6 − 0.2 = **$5,729.8B**. It is a trader's measure, not an official one.

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
- 33.4% of marketable debt matures within 12 months (MSPD detail, Sep 30 2026: $10.6T, including $2.95T of notes and bonds at an average coupon of 2.98%), so a one-point change in short rates moves interest costs by about 0.33 × $31.8T ≈ **$105B a year within a year** (rough; ignores new deficits).
- Notes and bonds lock in their coupon until maturity. A 10-year issued in 2020 at about 0.9% only reprices in 2030.
- The average rate on marketable debt was 3.518% (Sep 2026), up from an all-time low of 1.424% (Jan 2022), and is still rising as low-coupon 2020–21 debt matures.
- Fed losses add a further channel: the Fed's losses (the deferred asset) mean the $55–110B a year it remitted in 2019–21 no longer reduces the deficit.

The simulator in Phase 1 will use `data/maturities.json` (built from MSPD Table III, CUSIP by CUSIP) to roll each bucket over at the slider rates.

---

## TODO-verify

Rechecked 2026-11-03 against primary sources. Items marked ✅ are resolved, with the answer noted.

### Figures
1. ✅ **MSPD Table I**: marketable $31,834.878B. Bills 7,118.145, notes 16,281.507, bonds 5,551.018, TIPS 2,172.642, FRNs 707.975, FFB 3.591. Non-marketable 8,336.947 (Government Account Series 8,094.3, savings 146.3, SLGS 81.0).
2. ✅ **Reserves**: $2,895.2B (H.4.1 Wednesday level, Oct 28).
3. ✅ **Currency**: $2,434.0B (H.4.1, Federal Reserve notes, net). My placeholder was 2,430.
4. ✅ **SOMA Treasuries**: $4,576.6B (H.4.1, Oct 28).
5. ✅ **Bill purchases**: not paused. About $12–13B a month in Sep–Oct 2026, $378B since Dec 2025.
6. ✅ **Yields, Nov 2**: 3m 4.21, 2y 4.59, 5y 4.70, 10y 4.91, 20y 5.31, 30y 5.28. The 3-month bill sits above the top of the funds range, pricing in another hike.
7. ✅ **SOFR**: 3.95% on Nov 2 (FRED).
8. ✅ **Gross debt in August**: $39,891.8B on Aug 10 (your ≈$39.9T). First above $40T on **Aug 18, 2026**. $40,175.6B on Aug 31.
9. ✅ **Interest in the first 10 months**: $1,170.0B gross through July (Interest Expense dataset). Full FY2026 $1,360.4B gross, $1,052B net (MTS).
10. ✅ **Fed total assets**: $6,745.6B (Oct 28).
11. ⬜ **Tether T-bills**: $114.9B vs ~$141B. Issuer sites are still unreachable.
12. ✅ **Standing repo on Sep 30 2026**: $1.2B (FRED RPONTTLD). Record $74.6B on Dec 31 2025.
13. ✅ **TIC by country, Aug 2026** (ticdata.treasury.gov, Table 5): total $9,331.7B, official $3,755.6B (40.2%). Japan 1,068.3, UK 1,009.5, China 590.7, Belgium 490.5, Canada 464.6, Cayman 463.0.
14. ✅ **Money funds' Treasury holdings**: $3,281.6B (Z.1, Q2 2026). ✅ Z.1 sector breakdown added (section 8).
15. ✅ **History anchors**: ON RRP peak $2,553.7B (Dec 30 2022); Fed assets peak $8,965.5B (Apr 13 2022); reserves peak $4,275.8B (week of Dec 8 2021); SOFR 5.25% (Sep 17 2019). ⬜ BTFP peak (~$168B) still from memory.
16. ✅ **Average-rate low**: 1.424% in Jan 2022. My recalled 1.56% was wrong.
17. ⬜ **Fed holdings, Z.1 vs H.4.1**: Z.1 shows $4,082.7B in Q2 2026, H.4.1 $4,488.1B on Jun 24 2026. Is the gap valuation, inflation compensation, or a sector definition?
18. ⬜ **Stablecoin supply** (~$300B), **Tether reserves**, **ICI money-fund assets** ($7.9T), **hedge-fund repo** (Form PF) and **OFR repo size**: still secondary. On 2026-11-04 the proxy still refused www.ici.org, www.financialresearch.gov, www.newyorkfed.org, www.sec.gov, tether.to and www.circle.com.

### Mechanisms (questions, not claims)
19. When money funds buy bills with cash they would otherwise lend in **private repo** (not the ON RRP), does the drain fall on reserves one for one, or do dealers replace the funding in ways that change the split? The flow map currently treats "private repo" as ultimately backed by bank deposits, so reserves fall.
20. Does the **foreign official repo pool** pay the ON RRP rate, or a rate tied to it? What has kept it at about $325B?
21. Is the Fed's **deferred asset** still shrinking after the Sep 2026 hike? Table 6 shows $232.5B on Oct 28, down from ~$236B in July, so it is shrinking slowly. ✅ partly answered.
22. ✅ **TGA target**: Treasury's Nov 2 2026 borrowing estimates (press release sb0675) assume $850B at end-December 2026 and $1.000T at end-March 2027, with $618B and $800B of net borrowing. The quarter ended Sep 30 with $984B.
23. **GENIUS Act final rules**: did the OCC final rule (Bulletin 2026-50) keep the 93-day limit unchanged, and what is the binding effective date?
24. **Net T-bill demand from stablecoins**: how much is new demand versus displaced demand from money funds and banks? Is there research from the Fed, BIS or TBAC to cite?
25. **eSLR reform details**: is the new buffer exactly 50% of the method-1 G-SIB surcharge?
26. **Standing repo central clearing**: has it started, and on what dates?
27. **Debt-ceiling timing**: headroom was $797.7B on Nov 2 (DTS Table III-C). At ~$8.4B/day of gross growth that runs out in roughly 3 months, though growth is uneven and extraordinary measures add room. Is the NTU/CRFB projection (May to mid-2027) out of date?

### Part I model notes
28. The refinancing simulator rolls about a third of the bill stock each month (calibrated to the Sep 30 schedule: 36% of bills mature in October). It treats FRNs as bills and counts TIPS at their real coupon. Its starting run-rate ($1,054B a year, from MSPD coupons and bill yields) is close to actual FY2026 interest on public issues ($1,068.5B). The MSPD-based average rates (bills 3.76%, notes 3.31%) differ slightly from Treasury's published average interest rates (3.87%, 3.38%), probably because of weighting and method. Which one is the better simulator input?

### Part III notes
29. The term premium shown is the Kim-Wright model estimate (FRED THREEFYTP10). The NY Fed's ACM estimate differs in level. Should the page show both?
30. No free daily series for the cross-currency basis was found, so the global-dollar section describes it without a chart.
31. The refunding policy statement (auction sizes) was due 8:30 a.m. ET Nov 4 2026 and isn't yet reflected. Check whether the coupon sizes in data.issuance.couponMix changed.
32. Still secondary because hosts are unreachable: ICI money-fund assets (ici.org returns 403 to automated clients), OFR repo size (data.financialresearch.gov refused by the proxy), Form PF hedge-fund repo (sec.gov refused), and Tether/Circle reserves (tether.to and circle.com refused).

### Phase 4 notes
33. Verification (2026-11-04): 164/164 automated checks match their primary sources (see docs/verification.md). Two data errors were found and fixed. A TGA value labeled Oct 1 was really the Sep 30 closing balance ($984.0B; Oct 1 closed at $893.7B). Interest through July is $1,170.0B, not $1,170.1B.
34. Downgraded to secondary because their hosts were unreachable: GENIUS Act, eSLR and clearing-mandate dates (congress.gov, federalregister.gov, sec.gov) and CBO projections (cbo.gov). GAO's 33% is replaced by the MSPD-derived 33.4%.
35. On tablets, the map's thin Fed segments have 22px hit areas spaced 30 SVG units apart; that relies on the WCAG 2.2 spacing exception.

### Learning path ("Start here")
36. Eight lessons in the tested engine (LESSONS in index.html): IOUs and reserves → TGA → borrowing with bills → short vs long debt → the Fed's balance sheet (QE/QT) → the ON RRP → repo and leverage → the rate corridor. The toy balance sheets are simplified on purpose: banks' equity, the Treasury's "net position" as the balancing line, no currency. Each lesson says which simplification it makes only where it matters.
37. Built: focus mode on the full map (on by default, with a toggle) fades every bucket a scenario step doesn't touch. Ideas not yet built: (b) a short glossary quiz at the end; (c) the historical slider (2007 → today) as a final "watch it happen" lesson.

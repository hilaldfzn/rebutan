# PRD — Rebutan

**Product:** Rebutan · **Event:** Monad Blitz Jakarta, 8 August 2026 · **Network:** Monad Testnet (10143)
**Status:** approved for build · **Owner:** team of ≤3 · **Freeze:** 17:30 WIB

Companion documents: [IDEAS.md](IDEAS.md) — why this concept and what the rules require · [spec/spec-rebutan.md](spec/spec-rebutan.md) — technical and contract specification.

> ⚠️ **Sections F and H of the spec are now stale** — they describe the pre-depth design. This PRD is authoritative on gameplay; the spec is authoritative on security and deployment until synced.

---

## 1. One-liner

**You get paid for every Monad block you hold the crown — and a block is 400 milliseconds.**

## 2. The problem this product addresses

Two framings, and only the second one goes in the pitch.

**Honest framing.** Nobody needs this on Monday. It is a game. The interesting claim is narrower: *a contested single-holder position is only playable if losing it registers before you can react.* On a 12-second chain you spend twelve seconds not knowing whether you are still king — the mechanic does not degrade, it ceases to exist. Rebutan is a demonstration of an interaction class that a fast chain unlocks.

**Rubric framing.** The official criteria ([IDEAS.md](IDEAS.md) V3) reward *Novelty & Originality*, *Innovative Mechanics*, *Problem-Solving on a real **or interesting** challenge*, and *Learning & Experimentation* — and explicitly disclaim polish and market-readiness. The audience is developers, not VCs. **This product is optimised for "innovative mechanics," not for a business model.**

## 3. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Ship a working, deployed dApp before 17:30 | contract live on testnet, web app live, address in README |
| G2 | Be understood in one sentence | a judge can restate the rule after 10 seconds |
| G3 | Give the room something to *do*, not watch | ≥15 distinct addresses join during the demo session |
| G4 | Make the Monad dependency visible, not asserted | no spinner anywhere; earnings tick ~2.5×/second |
| G5 | Survive the anti-clone rule | the block-denominated mechanic leads the pitch |

## 4. Non-goals

Polish. Completeness. A business model. Mainnet. Real value. Mobile app. Accounts. Anything requiring a backend.

## 5. Users

| Persona | Context | Needs |
|---|---|---|
| **Player** (~30 teams present) | phone, dim hall, already holds a funded testnet wallet | join in one tap, understand instantly, feel the steal |
| **Spectator** | watching the projector | see who holds it and who is winning, without a wallet |
| **Judge / peer voter** | 3 minutes, then votes | grasp the mechanic and why it needs Monad |

## 6. The game

### 6.1 Four verbs

| Verb | Who | Cost | Effect |
|---|---|---|---|
| **JOIN** | anyone, once | 0.1 MON (fixed, never escalates) | enter the session, add to pot |
| **STEAL** | any joined player | gas only | take the crown; your own cooldown grows +3 blocks per steal you make |
| **FORTIFY** | the holder, once per reign | gas only | extend crown protection to +8 blocks, but forfeit 4 blocks of earnings |
| **CLAIM** | any player, after settle | gas only | take your payout |

### 6.2 The core loop

```
JOIN → steal the crown → earn every block you hold it
   → someone is about to take it → FORTIFY (defend, earn less) or ride it out (earn more, stay exposed)
   → lose it → your blocks bank → wait out your cooldown → pick your moment
   → stage multiplier rises → the endgame is worth 3× the opening
   → settle → CLAIM
```

### 6.3 Stages — escalating value

The session runs in three stages by block range, with no intermission:

| Stage | Share of session | Blocks held count |
|---|---|---|
| 1 | first third | **1×** |
| 2 | middle third | **2×** |
| 3 | final third | **3×** |

Stages give the session pacing and make falling behind early recoverable. Stage 3 is a scheduled climax you can time the pitch around.

### 6.4 Two ways to win — the strategic fork

The pot splits:

- **70% — Endurance.** Pro-rata by total stage-weighted blocks held.
- **30% — The Long Reign.** Winner-take-all to the single longest *unbroken* reign, measured in raw blocks.

This is the mechanic that creates strategy rather than reflex. Two incompatible plans exist:

| Plan | How it plays | Weakness |
|---|---|---|
| **Accumulate** | steal often in Stage 1 when it's cheap, bank many short reigns | burns cooldown; wins no Long Reign bonus |
| **Spike** | hoard steals, take the crown in Stage 3, FORTIFY, hold one enormous reign | one steal at the wrong moment and the plan is worthless |
| **Deny** | steal from the leader purely to break their unbroken reign | you gain little yourself; pure spite play |

**Denial is the good part.** It means players act against each other with intent, rather than all grabbing at the same object.

### 6.5 Why FORTIFY is the keystone

It is the fix for the passivity hole. Before it, holding the crown involved no decisions — you took it and waited. FORTIFY makes every reign an ongoing risk trade: *pay 4 blocks of income to buy 8 blocks of safety, or stay exposed and keep earning at full rate.* One verb, one decision, repeated every reign, and it carries PassChick's "bank or push" DNA without copying its mechanic.

### 6.6 Progression

**Reign Record** — cumulative stage-weighted blocks across all sessions, soulbound, with tiers. **Cosmetic status only, no mechanical benefit.** Mechanical progression would unbalance a one-session demo and cannot be shown to a judge who has no history.

## 7. Why this is not a clone

The anti-clone rule ([IDEAS.md](IDEAS.md) V4) is aimed straight at our weakest axis — a contested crown is King of the Ether (2016). Three defences, in the order they should be spoken:

1. **Earnings denominated in blocks, not seconds.** Forced by `block.timestamp`'s one-second resolution against 400 ms blocks — two or three Monad blocks share a timestamp, so seconds cannot express the game. **This design decision cannot exist on a slow chain.** It is a unique Monad-specific twist, near-verbatim what the rule asks for.
2. **Steals rationed by a growing personal cooldown**, not by an escalating price. Turns a payment auction into resource management, and removes the mid-game faucet dependency that would otherwise strand players.
3. **A dual win condition** that makes endurance and spiking incompatible strategies.

## 8. Features and priority

⚠️ **Time is the binding constraint.** Estimates assume a blockchain-light team writing everything from scratch (CON-009 forbids reuse).

| P | Feature | Contract | Client | Est. |
|---|---|---|---|---|
| **P0** | JOIN + pot | payable, `joined` map | connect + join button | 20m |
| **P0** | STEAL + cooldown + MIN_REIGN | core `steal()` | steal button, cooldown state | 30m |
| **P0** | Earn per block, stage-weighted | `_weighted` across 3 stages | live earnings counter | 40m |
| **P0** | Settle + pro-rata CLAIM | pull payment | claim button | 30m |
| **P0** | Live crown + leaderboard | events | `eth_subscribe` | 40m |
| **P1** | **FORTIFY** | `protectedUntil`, `since += 4` | fortify button, protected state | 25m |
| **P1** | **Long Reign bonus (30%)** | track longest unbroken reign | second leaderboard | 25m |
| **P2** | `/wall` projector view | — | route | 30m |
| **P2** | Reign Record tiers | mapping + view | tier badge | 20m |

**P0 is the shippable product.** P1 is where the depth lives — cut it only if 15:00 arrives with no deployed contract. P2 is presentation.

## 9. User journeys

**First-time player (target: under 20 seconds to first steal)**
1. Scans QR → page loads showing the crown already contested
2. Taps JOIN, approves 0.1 MON → pot ticks up on the projector
3. Taps STEAL → **no spinner**, crown is theirs, earnings start climbing
4. Sees "cooling down · 3 blocks" and understands the constraint without being told

**Holder under pressure**
1. Holds the crown, earnings climbing, Stage 3 multiplier active
2. Sees protection expiring in 1 block and rivals off cooldown
3. Decides: FORTIFY (safe, slower) or ride it out (exposed, full rate)

**Endgame**
1. Stage 3 — every block worth triple
2. Longest-reign bonus still unclaimed; leader is 6 blocks from taking it
3. Someone spends their last steal purely to deny it
4. Session closes → CLAIM → a real payout to a real audience wallet, live

## 10. Release criteria

Ship only if all are true:

- [ ] Contract deployed **and verified** on Monad testnet **during event hours**
- [ ] JOIN, STEAL, CLAIM all work end-to-end **from a phone on venue wifi**
- [ ] Contract tests green, including all money tests
- [ ] Repo is a **fork of the organisers' Jakarta repo**, public, README with contract address
- [ ] Submitted at [blitz.devnads.com](https://blitz.devnads.com) before 17:45
- [ ] Fallback video and screenshots recorded

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Scope kills the ship** — P0+P1 is ~4h of contract+client from scratch | **High** | §12 de-scope ladder. P0 alone is a complete product |
| Fork repo doesn't exist yet | **High** | Ask an organiser now; build locally in the meantime |
| Money bugs strand the pot | High | Money tests are never-cut; pull payments; no admin path |
| `_weighted` across stage boundaries is the one tricky function | Medium | Write its tests first; max 3 loop iterations, no unbounded loops |
| Nobody joins during the demo | Medium | Pre-joined team phones seed it; the room is already onboarded |
| Reads as a clone | Medium | Lead the pitch with the block-denomination twist (§7) |
| Players throttled to 1 tx/1.2s under 10 MON | Low | `MIN_REIGN = 3 blocks` matches the throttle — it shapes the game |

## 12. Build order and de-scope ladder

**Build in this order. Each step is shippable on its own.**

1. JOIN + STEAL + cooldown → *a working contested crown*
2. Stage-weighted earnings + settle + CLAIM → *a complete game with money*
3. **FORTIFY** → *the depth fix; the first thing that makes it interesting*
4. **Long Reign bonus** → *the strategic fork*
5. `/wall`, tiers, polish

**Cut from the bottom up.** At 15:00 with no deployed contract, stop at step 2 and deploy.

## 13. Out of scope

Escalating stakes of any kind · NFTs · multiple concurrent sessions · chat · sound · profiles · sponsored gas · Para embedded wallets · indexer · historical sessions · admin functions · mechanical progression from the reign record.

## 14. Open questions

1. **What is the fork target repo?** `monad-developers/monad-blitz-jakarta` does not exist yet — **blocking, ask an organiser.**
2. Session length — how many blocks? Must be timed so Stage 3 lands during the pitch.
3. Demo slot order — early is worth real votes.
4. Team size today, 2 or 3? Changes whether P2 gets built at all.

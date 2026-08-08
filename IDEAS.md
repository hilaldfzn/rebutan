# Monad Blitz Jakarta — Idea Brainstorm

**Event:** Saturday 8 August 2026 · Markas KOMDIGI · hacking 11:30 → freeze 17:30 → submission 17:45 → pitches 18:00 → awards 20:40
**Team:** ≤3 · strong Web2 · limited blockchain experience
**Target:** Monad Testnet (chain id **10143**)

Artifacts A, B, C of the §15 output structure. D–J follow once an idea is committed.

Evidence labels used throughout: **[VERIFIED]** primary source, **[TEAM]** measured by this team on the practice run, **[INFERENCE]** reasoned from evidence, **[SPECULATION]** flagged guess.

---

## A. Hackathon opportunity analysis

### A.1 The finding that reorders everything: winners are chosen by audience vote

> "The event closes with demos in front of the room, with cash prizes for top performers decided by **live audience vote**." — [monad.xyz/blog/home-for-builders](https://www.monad.xyz/blog/home-for-builders) **[VERIFIED]**

The practice-run brainstorm assumed a Monad DevRel panel and optimised for "throughput spectacle that proves the chain." If the vote is the room, the selection function is different in kind:

| | DevRel panel | Room vote |
|---|---|---|
| Voter | 2–4 experts, fresh, incentivised to reward chain fit | ~80 tired builders at 20:30, after ~30 demos, who are also your competitors |
| Rewards | technical depth, "this proves Monad" | what they **felt** and **remember** |
| Beats it | benchmark, architecture | participation, humour, cultural fit |

Four consequences **[INFERENCE]**:

1. **Memory beats merit.** By voting time the room has watched thirty pitches. The winner is whoever they can still picture. Being *in* someone's demo is the strongest memory there is.
2. **The app should be live during the other demos.** The 2.5 hours between 18:00 and the vote is the real campaign window. An app the room is holding while other people pitch is worth more than a perfect three-minute slot.
3. **Local resonance is a live weapon.** A Jakarta room of Indonesian developers responds to an Indonesian word and an Indonesian social ritual in a way a foundation panel would not.
4. **Competitors won't vote for the thing that beat them technically.** They will vote for the thing that was fun. Technical credibility is a tiebreaker, not the driver — but it is a real tiebreaker, because the voters are engineers.

### A.1.1 [CONFIRMED] Jakarta is 50% audience vote, 50% judges

Answered by the team from the organisers: **the split is half room, half panel.** **[VERIFIED — organiser, via team]**

This is the most favourable answer available, and it narrows the strategy rather than reversing it:

- **The room's half still rewards participation and memory.** Everything in A.1 holds at half weight. An app the audience is holding during the other demos still converts directly into votes.
- **The judges' half restores technical credibility as a scoring axis, not a tiebreaker.** Ownerless contract, no `payable` surface, no backend, verified source, and a Monad-specific mechanic are now worth real points rather than politeness.
- **The toy problem gets sharper.** Low user value (scored 5) costs little with the room and costs real points with a panel. It cannot be fixed with features in six hours, so it must be answered with framing: lead the judges' half on *why the mechanic is impossible on a slow chain*, not on utility it does not have.

**Net effect on the shortlist:** no reordering. Rebutan is the balanced pick precisely because it scores 10 on Monad relevance and 8 on technical credibility (judges' half) while owning the participation play (room's half). Ideas optimised purely for spectacle (#8) or purely for utility (#5, #6) each forfeit half the rubric.

### A.2 Previous-winner analysis: PassChick

Placements from the team's earlier research, Yogyakarta 25 April 2026 **[TEAM, unverified by me]** — 1st PassChick, 2nd VISTA, 3rd Last Nads Standing, 5th DuelPic. Only PassChick is documented.

What it is **[VERIFIED — [passchick.xyz](https://passchick.xyz/)]**: a reflex lane-runner. You deposit into a vault, run, and at each checkpoint choose to bank your multiplier or push further. Results settle on-chain; an "Eggpass" credential tiers you Rookie → Oracle from your cashout history.

Its architecture, per its backend dev **[TEAM]**: off-chain Socket.io game loop, server-authoritative; SIWE auth; Postgres; the chain verifies an EIP-712 signature and settles. ~80% Web2 with a thin cryptographic seam.

**Three things worth extracting, and one trap:**

- ✅ The **settlement seam** — keep the fun off-chain, make the chain the notary. Plays to a Web2 team's strengths.
- ✅ **A decision, not a reflex.** The mechanic is "bank or push," which is social and watchable. Pure reaction speed is not.
- ✅ **A credential that persists** gives a toy a reason to exist after the demo.
- ❌ **Do not rebuild it.** Monad DevRel travel between Blitz cities and saw it win three months ago. The practice project already adopted its bank/multiplier mechanic; shipping that again is the derivative option.

⚠️ **Its live site now runs on Celo with USDC vaults, not Monad** **[VERIFIED]**. The pattern is portable and was not, in the end, a Monad-specific design. Cite it as a design pattern, never as proof that Monad was necessary.

### A.3 What Monad actually gives you

From the official skill pack in [.agents/skills/](.agents/skills/) **[VERIFIED]**:

| Property | Number | Does it show up in a 3-minute demo? |
|---|---|---|
| Block time | 400 ms | **Yes — this is the one.** |
| Finality | 800 ms | Yes, if you label irreversibility in the UI |
| Throughput | 10,000 tps | Only with a crowd actually transacting |
| `eth_sendRawTransactionSync` | receipt in the **same** RPC call | **Yes — the strongest visible feature** |
| Contract size limit | 128 kb | No, but it means one monolith contract — no splitting, no cross-contract wiring |
| Gas | charged on `gas_limit`, not gas used | No — but overestimating limits costs users real MON |

**`useSendTransactionSync` is the hero feature.** Send and receipt arrive in one round trip, so the UI has no pending state to render. Every other team will show a spinner and a toast. A demo with *no spinner at all* is a one-second, felt argument for the chain — and it was not available to the practice project's design.

### A.4 Constraints that quietly kill ideas

These are the difference between a plan and a working demo **[VERIFIED unless marked]**:

1. **Reserve balance: an account holding under 10 MON can send only one transaction per ~1.2 s.** Faucet-funded audience wallets are all under 10 MON. **Any idea whose fun depends on rapid tapping is dead on arrival for a crowd.** This alone eliminates reflex duels and spam-clickers.
2. **Async execution: a newly funded account cannot transact until the funding is 3 blocks old (~1.2 s).** Fund your demo phones minutes ahead, never seconds.
3. **The faucet is the bottleneck.** [faucet.monad.xyz](https://faucet.monad.xyz) returned **HTTP 429** to a single automated request today. Eighty devs behind one venue NAT is one IP. Testnet was reset from genesis on 2025-12-16.
4. **Monad implements opcodes only through Shanghai** **[TEAM]**. Foundry defaults `evm_version` to `osaka`, and the optimizer emits `MCOPY` even under `shanghai`. Failure is silent: deploys clean, reverts later. Pin both in `foundry.toml` and keep the practice run's `check-opcodes.sh`.
5. **EIP-7702 delegated EOAs** cannot use `CREATE`/`CREATE2` and are always held to the 10 MON floor.

**The onboarding wall, restated.** Crowd participation requires: wallet → Monad testnet configured → testnet MON → approve. Constraint 3 breaks step 3 for 80 people. Two mitigations now exist that the practice run lacked: **Para embedded wallets** (email/passkey/social login, no extension, no manual RPC — in [.agents/skills/wallet-integration/](.agents/skills/wallet-integration/)) removes steps 1–2, and **EIP-7702 gas sponsorship** removes step 3. Para is a fresh integration under time pressure, so treat it as an upgrade path, not the baseline. **Baseline stays: 5–8 pre-funded phones you control, QR code as upside.**

### A.5 Where the opportunity is

Across 2026 Blitz events, **413 of 742 projects were agentic** **[VERIFIED — same blog]**. AI agents are the saturated mode; an agent idea competes against half the room and against the room's fatigue with agent ideas.

Combining that with A.1: the open seam is **a participatory toy with a local name that the room plays during the other demos, where the chain's speed is the reason it's playable at all.**

---

## B. Idea shortlist

Eight candidates. None repeat the twenty explored on the practice run, and none rebuild PassChick.

Scored 1–10 on the brief's §3.3 rubric — Feasibility 25%, User value 20%, Monad relevance 15%, Novelty 15%, Demo 10%, Tech credibility 10%, Scalability 5%.

**"Room" is scored separately and is not in the weighted total** — it estimates appeal to an audience vote (A.1). The brief's rubric weights user value at 20%, which systematically penalises toys; the actual selection function rewards them. Where the two disagree, that disagreement is the decision, so both are shown.

| # | Idea | One-line pitch | Feas | Value | Monad | Novel | Demo | Cred | Scale | **Total** | Room |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | **Rebutan** | One crown, one room, everyone stealing it — score is seconds held | 9 | 5 | 9 | 6 | 9 | 7 | 5 | **7.35** | **9** |
| 2 | **Blitz Market** | Prediction market on which project wins, played during the demos | 6 | 6 | 8 | 8 | 8 | 7 | 6 | **6.90** | **9** |
| 3 | **Metronad** | Every Monad block is a beat; the room composes a track on-chain | 5 | 4 | 10 | 9 | 9 | 8 | 3 | **6.75** | 8 |
| 4 | **Gas Golf** | Leaderboard for the cheapest transaction that passes a test | 8 | 6 | 7 | 6 | 5 | 8 | 5 | **6.70** | 5 |
| 5 | **Tap-to-Play** | Sponsored-gas onboarding: play first, wallet never mentioned | 5 | 8 | 7 | 7 | 5 | 8 | 9 | **6.70** | 3 |
| 6 | **Patungan** | Group chip-in that settles the instant the last person pays | 8 | 9 | 5 | 4 | 4 | 7 | 8 | **6.65** | 4 |
| 7 | **Antrian** | On-chain queue ticket for the food line — transferable, tradeable | 9 | 5 | 5 | 6 | 5 | 7 | 4 | **6.30** | 6 |
| 8 | **Twitch Plays KOMDIGI** | The room collectively drives one avatar, each input a transaction | 4 | 4 | 9 | 7 | 9 | 6 | 3 | **5.85** | 8 |

**Notes on the ones that lose, and why:**

- **#3 Metronad** has the best "only on Monad" story in the document — the 400 ms block cadence literally *is* the tempo, which no other chain can claim. It loses on feasibility: audio scheduling drift against block arrival is a genuinely hard sync problem, and 6 hours with a Web2-strong/blockchain-light team is not where you want to discover Web Audio clock skew. **Strongest alternative if the team has an audio person.**
- **#2 Blitz Market** would put the entire room on your app for 2.5 hours — the ideal shape per A.1. ⚠️ **But it creates a financial stake in the outcome of the vote you are competing in.** Even on valueless testnet, "the team that built the betting market on the competition won the competition" is a bad headline, and organisers may read it as vote manipulation. Viable **only** if your own project is excluded from the market and you clear it with an organiser first. Not recommended without that conversation.
- **#5 Tap-to-Play** is the most genuinely useful thing here and the best real company. It is infrastructure, so it demos as a config screen. Wrong shape for a room vote.
- **#6 Patungan** is the honest "real product" hedge and lands culturally. Its demo is an accelerated simulation of a multi-day process — the exact weakness that sank Arisan Chain in the practice-run scoring.
- **#8 Twitch Plays** has the best spectacle ceiling and the worst floor: it needs a game engine *and* a crowd, and it does not degrade — with nobody transacting you have a static screen and a story.

---

## C. Recommendation — Rebutan

> **Rebutan** *(Indonesian: a scramble; a thing everyone grabs for at once)*

### One-liner

One crown. One room. Anyone can steal it in under a second — your score is how long you managed to hold it.

### How it works

A single on-chain crown. Anyone can take it at any time by calling `steal()`. When you take it, the previous holder's reign ends and their held-seconds bank. Each steal raises the next steal's cost slightly, so a contested crown gets progressively harder to hold and the scramble intensifies on its own. The session leaderboard ranks by **total seconds held**, not by money.

It runs from 18:00 until the awards. The projector shows the crown, the current holder's name, a live-ticking reign timer, and the leaderboard.

### The design decisions that matter

**Score is time, not money.** No stake, no pot, no payout — which removes tokenomics, financial-security surface, and any "is this gambling" question, all of which the brief tells you to avoid. It also makes the leaderboard a *story* ("Budi held it for four minutes and lost it during his own pitch") rather than a balance sheet.

**Rising steal cost is the whole game.** It converts a flat hot-potato into a real decision: steal now while it's cheap and hold a long boring reign, or wait and pay more for a shorter one near the buzzer. That is a decision worth watching — the property extracted from PassChick in A.2 — reached by a different mechanism.

**The reserve-balance limit is a feature here.** One transaction per 1.2 s per low-balance account (A.4) caps the scramble at a human rhythm instead of a bot war. The constraint that kills reflex games makes this one playable.

### Why blockchain

The crown must have exactly one holder, contested by mutually distrusting people, with a public and unarguable record of who held it and for how long. That is single-writer contested state with an audit trail — the one thing a shared database with an admin cannot credibly offer to a room of competitors, because the admin is one of the competitors.

### Why Monad — the honest version

**Because a steal you cannot feel is not a steal.** The game is a scramble; the scramble only exists if losing the crown registers before your thumb leaves the glass. On a 12-second chain you spend twelve seconds not knowing whether you are king — the mechanic doesn't degrade, it ceases to exist. At 400 ms blocks with `eth_sendRawTransactionSync` returning the receipt in the same call, the crown changes hands visibly faster than the room can react to it.

This is a claim you can demonstrate rather than assert: **no spinner anywhere in the app.** Put a latency readout on the projector — steal-to-confirmed in milliseconds, next to the block height ticking every 400 ms.

### Value proposition

> For **a room of builders who will vote on what they remember**, who struggle with **thirty forgettable demos in a row**, **Rebutan** provides **a fight they are personally inside of** by using **a single contested on-chain crown that changes hands in under a second**, unlike **a pitch they watch passively**, because **the chain is fast enough that stealing feels physical rather than transactional.**

### Differentiation

Not an agent (413 of 742 projects were). Not a token, not a DEX, not a canvas, not a reflex duel. It is the only idea here where **the audience is still playing your app while they decide who to vote for** — and the only one whose core mechanic is *impossible* to demo convincingly on a slow chain, which makes "why Monad" a thing the room sees rather than a slide.

### Honest weaknesses

1. **User value is genuinely low.** It is a toy; nobody needs it Monday. Scored 5 and not defended. Mitigate with narrative, not features.
2. **King of the Ether (2016) is prior art** and this room may know it. The rising-cost-plus-time-scoring twist is real but it is a twist, not a new genre. **[INFERENCE]** Lead the pitch with the room, not the novelty.
3. **Crowd participation still depends on the faucet.** Baseline is pre-funded phones (A.4); treat broad participation as upside.
4. It **rewards whoever is not currently on stage** — teams pitching at 19:00 can't defend their crown. That is either unfair or the funniest part of the game. **[SPECULATION]** Probably the latter, but decide before you demo.

---

## Open questions — need answers before 11:30

1. ~~**Is Jakarta judged by audience vote or a panel?**~~ **✅ ANSWERED: 50% audience vote, 50% judges.** See A.1.1.
2. **What does 17:45 submission actually require** — form, repo link, deployed URL, video?
3. **Is pre-written code allowed?** The practice run recorded "yes" for the previous event **[TEAM]**. Re-confirm — the contract must still be *deployed* during the event regardless.
4. **Team size — 2 or 3 today?** Changes the de-scope ladder.
5. If Idea 2 is ever reconsidered: **clear it with an organiser first** (see B notes).

---

# Rev 2 — post-grilling

> ⚠️ **This section supersedes the mechanic in §C.** The adversarial pass found a contradiction at the centre of the design, a Solidity bug that would have shipped, and one genuinely good piece of news. §C is retained as the decision record. Changes marked **[REV2]**.

## R1. The contradiction: "score is time, not money" and "rising steal cost" cannot both be true

§C claims no stake and no payout, then charges an escalating price to steal. **Priced in what?** Every answer was bad:

| Option | Consequence |
|---|---|
| Pay MON, funds stay in contract | Fund-locking risk, and the brief explicitly says avoid it |
| Pay MON, previous holder receives it | It *is* King of the Ether. Reintroduces the gambling framing §C claimed to remove |
| Pay MON, refunded | Costs a transaction, changes nothing |

Worse, **any MON price doubles the faucet dependency** (A.4). Players would need testnet MON for gas *and* a growing balance to keep playing, from a faucet that returned 429 to one automated request.

### [REV2] The fix: the scarce resource is your own cooldown, not money

Stealing costs **nothing but gas**. Instead:

- Each steal you make increases **your personal cooldown** before you may steal again.
- A **global minimum reign** (3 blocks ≈ 1.2 s) means a freshly taken crown is briefly untouchable.

The decision survives intact and gets sharper: your steals are a rationed resource, so *when* you spend one is the whole game. "Two steals left before the buzzer — burn one now or hold for the endgame?"

This deletes, in one change: fund-locking, reentrancy, arithmetic-overflow-on-price, the gambling framing, and the second faucet dependency. The contract drops to roughly 40 lines with no `payable` function anywhere.

## R2. The bug that would have shipped: `block.timestamp` is second-granular

§C scores in seconds held. **Monad produces a block every 400 ms, so 2–3 consecutive blocks carry the same `block.timestamp`.** Scoring `block.timestamp - since` in a game where the crown changes hands every ~1.2 s yields mostly 0s and 1s, ties everywhere, and a leaderboard that cannot rank its own players.

### [REV2] The fix: score in blocks, and make that the signature

Score = `block.number - since`. Precise at 400 ms granularity, no timestamp dependency, no ties.

It is also a better story than the one it replaces:

> **Your score is measured in Monad blocks.** On Ethereum this scoreboard would tick once every twelve seconds. Here it ticks two and a half times a second — the scoreboard *is* the block time.

The unit of measurement became the pitch. Keep it.

## R3. The news that changes the risk profile: this audience is already onboarded

§C inherited the practice run's onboarding wall and set the baseline at "5–8 pre-funded phones you control" — which for Rebutan is close to fatal, because 8 friends passing a crown is not a spectacle and the concept has no static fallback the way a canvas does.

**[REV2]** But look at who is actually in this room. **Every team present already holds a funded Monad testnet wallet — they needed one to deploy their own contract today.** The participants are not 80 strangers facing a rate-limited faucet; they are ~30 teams who cleared that hurdle before lunch.

Consequences:
- Design for **~30 contested players**, not 80 and not 8.
- Drop the relayer and sponsored-gas work entirely. It was 2–3 hours of critical-path risk solving a problem this audience does not have.
- Keep pre-funded phones as the fallback for the front row only.
- ⚠️ Still true: this works *because* the audience is developers at a Monad event. It does not generalise, and the pitch should not claim it does.

## R4. Sybil churn, and why the cooldown alone is not enough

Per-address cooldown is defeated by one competitor with ten burner wallets. Reserve balance throttles each burner to 1 tx/1.2 s (A.4) and the faucet limits how many they can fund, so the ceiling is low — but the **global minimum reign** from R1 is the actual defence: it caps total crown churn no matter how many addresses attack it. Both rules, not one.

## R5. Dependencies outside your control

1. **Demo slot order.** The "room plays it all evening" thesis needs an early slot. Last slot means nobody plays it before voting. **Ask for an early slot; if refused, seed the game during the afternoon build window instead of at your pitch.**
2. **Distribution.** A QR on the projector for three minutes is the entire acquisition funnel. Have a short URL, and say it out loud.
3. **Nobody steals → dead screen.** With ~30 contested teams this is unlikely, but decide in advance who on your team restarts the scramble if it stalls. **[SPECULATION]** Probably a non-issue.

## R6. Revised contract sketch

```solidity
// No payable functions. No funds. No reentrancy surface.
contract Rebutan {
    address public holder;
    uint64  public since;        // block number the current reign began
    uint64  public endsAt;       // block number the session closes
    uint8   public constant MIN_REIGN = 3;   // ~1.2s, blocks the crown is safe

    mapping(address => uint64) public blocksHeld;
    mapping(address => uint64) public nextStealAllowed;
    mapping(address => uint32) public stealCount;

    event Stolen(address indexed from, address indexed to, uint64 atBlock, uint64 reignBlocks);

    function steal() external {
        require(block.number < endsAt,                    "session over");
        require(block.number >= since + MIN_REIGN,        "crown protected");
        require(block.number >= nextStealAllowed[msg.sender], "cooling down");
        require(msg.sender != holder,                     "already yours");

        uint64 reign = uint64(block.number) - since;
        blocksHeld[holder] += reign;

        emit Stolen(holder, msg.sender, uint64(block.number), reign);

        holder = msg.sender;
        since  = uint64(block.number);
        stealCount[msg.sender] += 1;
        // cooldown grows with each steal: 3, 6, 9, ... blocks
        nextStealAllowed[msg.sender] = uint64(block.number) + 3 * stealCount[msg.sender];
    }

    // settle() at endsAt to credit the final holder's reign before reading the board
}
```

**Still to check before writing tests:** the final holder's reign is only credited by `settle()` — if nobody calls it the leader is understated. Either have the frontend call it at the buzzer or compute the live reign client-side and reconcile after settlement. **Do not let the projector and the contract disagree during the demo.**

## R7. Revised scoring

| Criterion | §C | Rev 2 | Why |
|---|---:|---:|---|
| 6-hour feasibility | 9 | **10** | No `payable`, no funds, no relayer. ~40 lines |
| User value | 5 | 5 | Unchanged. It is a toy and the doc says so |
| Monad relevance | 9 | **10** | Score is denominated in blocks; the unit is the argument |
| Novelty | 6 | **7** | Cooldown-rationed steals + block-denominated score is meaningfully not King of the Ether |
| Demo quality | 9 | 9 | Unchanged |
| Technical credibility | 7 | **8** | Removing money removed the whole security surface |
| Scalability | 5 | 4 | R3's onboarding advantage is specific to this room and does not generalise |
| **Weighted total** | **7.35** | **8.05** | |

**Recommendation stands: Rebutan**, with the R1 and R2 mechanics replacing §C's. The grilling made it simpler, not more elaborate — which is the direction §16 of the brief demands.

---

# Rev 3 — winner-pattern analysis, and the verdict on Rebutan's depth

> Triggered by a direct challenge: *does Rebutan have enough gamification, and does the MVP carry real value?* Answered by going back to what actually won. **Rev 3 supersedes Rev 2's mechanic.** The answer is no — and the fix is specific.

## W1. What every identifiable Blitz winner has in common

| Project | Event | Place | Mechanic | Value at risk | Bounded round | Survives the round | Evidence |
|---|---|---|---|---|---|---|---|
| **PassChick** | Yogyakarta | 1st | reflex lane-runner, bank-or-push at checkpoints | **USDC vault** | yes | **Eggpass tiers, queryable by partner apps** | [VERIFIED — site] |
| **Bonder** | Seoul | 3rd | battle-royale price prediction, 5-second rounds, last survivor takes pool | **MON stake** | yes | no | [VERIFIED — search] |
| **Battle Monads** | Seoul | — | price-based monster battles on **Chainlink feeds** | unclear | real-time | monsters | [VERIFIED — [live site](https://monad-blitz-seoul.vercel.app/)] |
| Last Nads Standing | Yogyakarta | 3rd | name implies elimination/survival | — | — | — | [SPECULATION — name only] |
| Roast Wager | Yogyakarta | BB4 | name implies a wager | — | — | — | [SPECULATION — name only] |
| DuelPic | Yogyakarta | 5th | name implies 1v1 duel | — | — | — | [SPECULATION — name only] |

The [UGM writeup](https://jteti.ugm.ac.id/2026/05/06/mahasiswa-dteti-dominasi-monad-blitz-hackathon-2026-melalui-ugm-blockchain-club/) confirms the Yogyakarta placements but describes projects only in generalities. Treat the bottom three rows as suggestive, not evidence.

### The three essentials

Every **documented** winner has all three:

1. **Value at risk.** Not one is a free toy. A stake is what converts "watching" into "caring," and it is the difference between a demo the room observes and a demo the room *feels*.
2. **A bounded round with a clear resolution.** Short, repeatable, with a moment where it ends and someone won.
3. **Something that survives the round.** PassChick's Eggpass is the strongest version — a credential **other applications can query**. That is what turns a game into a product with a business story.

### The verdict

**Rebutan as specced in Rev 2 has none of the three.** No stake, no resolution beyond "session ends," nothing persists. I removed money deliberately in Rev 2 (R1) and scored the result *higher* for it — that was optimising for shippability and against the evidence. The challenge was correct.

⚠️ **Rev 2's R1 objection was still valid, but narrower than I applied it.** The problem with §C was an **escalating, unbounded** price: it made MON a consumable, so a player who ran dry was out, and the faucet became a hard dependency mid-game. **A fixed entry stake has none of those properties.** Removing the escalation was right; removing stakes entirely was an overcorrection.

## W2. Rebutan v3 — the design that carries value

Same crown, same block-denominated score. Four additions, each earning its complexity.

### The loop

1. **Join** — stake a fixed **0.1 MON**. The pot grows visibly as the room enters. One transaction, affordable on a faucet balance, never repeated.
2. **Hold** — **the crown pays.** Every block you hold it accrues you a share of the pot. Score and earnings are the same number.
3. **Steal** — still costs nothing but gas. Each steal you make extends your own cooldown (3 → 6 → 9 blocks); a freshly taken crown is protected for 3 blocks. Rev 2's anti-spam design survives intact.
4. **Surge** — for the **final 60 blocks (~24 seconds)**, held blocks count **3×**. The game is decided at the end, on purpose.
5. **Claim** — pull payment, `pot × blocksHeld / totalBlocks`.
6. **Reign Record** — cumulative blocks held across all sessions, **soulbound**, tiered. Portable proof you can hold a contested position under pressure.

### Why each addition earns its place

| Addition | What it fixes | Cost |
|---|---|---|
| Fixed 0.1 MON stake | Essential #1. Converts score into earnings — instantly legible value | `payable` + pot accounting |
| Pro-rata payout by blocks held | "You earn per block you hold the crown" is a one-sentence value prop | pull-payment `claim()` |
| Surge endgame | Essential #2, and **a guaranteed climax at a time you know in advance** | ~10 lines, one multiplier |
| Reign Record (soulbound) | Essential #3 — the PassChick lesson. The thing that outlives the session | one mapping + a tier view |

**The surge is the most valuable addition for the pitch.** It manufactures a climax on a schedule: you can time your three minutes so the demo ends exactly as the surge fires and the room fights hardest. Rev 2 had no climax at all — the session merely stopped.

### The product story — what is actually being sold

> **A live-event engagement primitive.** Conference organisers, streamers, and communities all need a way to make a passive audience *act*, in real time, with something at stake. Rebutan is a contested attention object with settlement built in: the audience stakes small, fights over one position, and the pot redistributes to whoever held attention longest. The Reign Record makes that history portable across events.

Buyers: event organisers, streamer overlays, community activations, brand campaigns. **[INFERENCE — this is a plausible market, not a validated one. Say "could be sold to" in the pitch, not "is sold to."]**

### Why Monad, restated with the stake in place

The payout accrues **per block**. On a 12-second chain the money moves once every 12 seconds and a steal takes longer to resolve than the decision to make it. At 400 ms the earnings tick ~30× faster and the contest exists at human reaction speed. **The economics and the mechanic both scale with block time** — that is a stronger claim than Rev 2's, which rested on feel alone.

## W3. What this costs, honestly

Handling funds reinstates a security surface Rev 2 had eliminated:

| ID | Risk | Mitigation |
|---|---|---|
| SEC-010 | Reentrancy on `claim()` | Pull payment, checks-effects-interactions, `claimed[addr] = true` before transfer |
| SEC-011 | Fund locking | No admin withdrawal. `claim()` is permissionless and always callable after settle |
| SEC-012 | Integer division dust | Remainder swept by the final claimer; documented as a known limitation |
| SEC-013 | Griefing `settle()` | Idempotent, callable by anyone after `endsAt` |

**Build cost: roughly +45 minutes** (payable join, pot accounting, `claim()`, 4 more tests). The plan has that slack because there is no backend to build. **[INFERENCE]**

⚠️ **Non-negotiable:** the stake stays **fixed and small**. The moment it escalates, Rev 2's R1 objection returns in full and the faucet becomes a mid-game dependency.

## W4. Revised scoring

| Criterion | Rev 2 | Rev 3 | Why |
|---|---:|---:|---|
| 6-hour feasibility | 10 | **8** | Funds, pull payments, 4 more tests |
| User value | 5 | **7** | Real stake, real payout, a defensible product story |
| Monad relevance | 10 | 10 | Unchanged — now argued economically as well as experientially |
| Novelty | 7 | **8** | Pay-per-block-held is not a mechanic this room will have seen |
| Demo quality | 9 | **10** | The surge is a scheduled climax |
| Technical credibility | 8 | 8 | Funds add surface but the patterns used are standard and testable |
| Scalability | 4 | **6** | The engagement-primitive framing generalises past this one room |
| **Weighted total** | **8.05** | **8.20** | |

**Recommendation: build Rebutan v3.** It keeps everything the grilling got right — block-denominated score, cooldown-rationed steals, no escalating price, no backend — and adds the three things every documented winner had.

---

# Rev 4 — the official rulebook

Source: [Monad Blitz Jakarta Notion](https://monad-foundation.notion.site/Monad-Blitz-Jakarta-3b36367594f28085ab46db0f4ce41858), read in full via the Notion public API (the page is client-rendered and returns an empty shell to normal fetches). **Everything in this section is [VERIFIED] from the organisers.** Where it contradicts earlier revisions, it wins.

## V1. Corrections to facts we had wrong

| | We had | Official |
|---|---|---|
| Venue | Markas KOMDIGI | **Midpoint Place**, Jl. H. Fachrudin No.26, Tanah Abang, Jakarta Pusat |
| Judging | audience vote (blog) | **50% participant votes, 50% jury** — confirmed |
| Repo | standalone public repo | **a fork of the organisers' repo** |
| Pre-written code | allowed (practice-run §0.5) | **forbidden — see V2** |

## V2. ⚠️ The rule that invalidates the practice run's core assumption

> "All projects must be **new and conceived specifically for Monad Blitz**. You cannot submit existing projects, **fork existing codebases** (beyond standard libraries/boilerplates), or continue work on personal projects you've already started."
>
> "All project development (**coding, asset creation, etc.) must begin during the official Monad Blitz event hours**."

The practice run recorded "pre-written code is allowed" as *"the single most consequential answer in the project"* — the finding that made its four-day architecture viable. **For Jakarta that is explicitly false.**

Consequences, non-negotiable:

- **No code from `pixel-wars` may be reused.** Not the contract, not the frontend, not the deploy scripts, not `check-opcodes.sh`. The *knowledge* transfers freely — the opcode trap, the reserve-balance rule, the wagmi wiring. The files do not. Rewrite the opcode guard from scratch; it is a few lines.
- **All coding starts during event hours.** The event runs 09:00–21:00, so work from now on is inside the window. Nothing written before today may enter the repo.
- ✅ **Planning before the event is explicitly encouraged**: *"we highly encourage you to perform research, brainstorm ideas, and formulate a plan for what you intend to build before the event. Come prepared with a concept!"* [IDEAS.md](IDEAS.md) and [spec/](spec/) are sanctioned, not merely tolerated.

## V3. The actual judging criteria — "The Innovation Lens"

> "When voting, we encourage you to consider the following:"
> - **Novelty & Originality** — "a truly new idea, a unique application of technology, or a fresh approach"
> - **Innovative Mechanics** — "clever or novel mechanics, smart contract designs, or user interactions, **especially those that leverage Monad's potential**"
> - **Problem-Solving** — "creatively address a real **or interesting** challenge for consumer applications"
> - **Learning & Experimentation** — "willingness to experiment, push boundaries, and learn, **even if not every aspect is perfectly polished**"
>
> "**The primary goal is not necessarily to identify the most polished or complete application.** Instead, we want to celebrate and reward the new, innovative ideas and unique approaches… Vote for the project that **excited you the most with its ingenuity**."

And from the demo guidance:

> "**You're not presenting to a panel of VCs or non-technical judges.** Your audience is your peers — skilled developers interested in the tech, the idea, and the execution. What would impress you as a developer? What technical aspects or **innovative mechanics** would they find most interesting?"

### ⚠️ This recalibrates Rev 3

Rev 3 was written to answer the challenge *"make sure the MVP has real value that can be sold."* **The official rubric does not reward sellability.** It rewards novel mechanics, and it explicitly disclaims polish and completeness. The jury half is developers, not VCs.

**What survives:** the stake, pay-per-block-held, the surge, and the reign record all score as **Innovative Mechanics** — a novel contract design and a novel user interaction. They earn their place under the real rubric, just for a different reason than Rev 3 gave.

**What must change: the pitch, not the build.** J.6's "engagement primitive you could sell to event organisers" is the wrong register for this audience and will read as hollow to a room of developers. **Lead with the mechanic and the Monad-specific twist. Cut the business framing.**

## V4. ⚠️ The clone rule, aimed straight at our weakest axis

> "**Innovate, Don't Just Replicate:** We strongly discourage building direct clones of existing applications **without introducing significant innovation or a unique Monad-specific twist**."

Rebutan's core — one contested position anyone can take — is King of the Ether (2016), and this room may know it. Rev 2 flagged that as a nitpick; under an explicit rule it is a scoring risk on the highest-weighted criterion.

**The defence is real but must be led with, not buried:**

1. **Earnings denominated in blocks, not time.** Forced by `block.timestamp`'s one-second resolution against 400 ms blocks — a design decision that *only exists on a fast chain*. This is the "unique Monad-specific twist" the rule asks for, almost verbatim.
2. **Steals rationed by a growing personal cooldown**, not by an escalating price. Turns a payment auction into a resource-management game.
3. **The surge** — a scheduled 3× endgame.

Open the pitch with #1. It is the sentence that separates this from a clone.

## V5. Submission mechanics

| | |
|---|---|
| Repo | **Fork the organisers' repo.** `monad-developers/monad-blitz-jakarta` **does not exist yet** — the org's latest is `monad-blitz-kl` (2026-05-12). ⚠️ **Ask an organiser for the fork target before building the repo.** |
| Portal | [blitz.devnads.com](https://blitz.devnads.com) → event page → *Submit Project* tab, clickable once submissions open |
| Fields | project name, one-liner, **GitHub URL (the fork)**, Demo URL (repeat the GitHub URL if none) |
| Edits | allowed until the voting period opens |
| Hosting | Vercel or any host; must be deployed and operational on Monad Testnet or Mainnet |

## V6. Demo format

**3 minutes per team.** Slides optional and discouraged — *"mostly impactful demos are purely live."* Cover, in order: **the live demo on testnet** (the core), how you built it briefly (which Monad features), and key areas of innovation. *"Get to the demo fast. Minimise intro talk."*

Voting opens when presentations begin and closes **15 minutes after the final demo**. Teams cannot vote for themselves.

Organisers' own advice, worth taking: **take screenshots of key functionality and record a short video as a fallback** against demo gremlins.

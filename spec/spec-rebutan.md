# Specification — Rebutan

**Status:** ready to build · **Target:** Monad Testnet (chain id `10143`) · **Window:** 11:30 → 17:30 WIB, 8 August 2026
**Version:** v3 — incorporates [IDEAS.md](../IDEAS.md) Rev 3 (stake, pro-rata payout, surge endgame, reign record).
**Supersedes:** spec v1/v2, which had no stake and no persistence.

Identifier convention: `REQ-` requirement · `CON-` constraint · `SEC-` security · `AC-` acceptance criterion. Requirements are the source of truth; where this document and prose disagree, the identifier wins.

---

## D. Product specification

### D.1 What it is

One crown lives on-chain. Players stake a fixed 0.1 MON to join a session. **Whoever holds the crown earns a share of the pot for every Monad block they hold it.** Anyone may steal it, but each steal you make extends your own cooldown. In the final 60 blocks the crown pays triple. When the session closes, everyone claims their share and their reign is written to a permanent record.

**One sentence for the pitch:** *You get paid per block you hold the crown — and on Monad a block is 400 milliseconds.*

### D.2 User stories

| ID | As a… | I want… | So that… |
|---|---|---|---|
| US-01 | player | to join with one small stake | I have something at risk without thinking about it |
| US-02 | player | to steal the crown in one tap | I can take the lead without reading instructions |
| US-03 | player | to watch my earnings tick up while I hold it | holding feels like winning, continuously |
| US-04 | player | to see my remaining cooldown | I can decide when to spend my next steal |
| US-05 | player | to know the surge is coming | I can save a steal for the endgame |
| US-06 | player | to claim my payout | the stake was real |
| US-07 | player | a permanent record of blocks I've held | playing builds something that outlasts the session |
| US-08 | spectator | to watch the crown and the pot on the projector | the room has something to react to |
| US-09 | judge | to understand the rules in one sentence | I can evaluate it in the ten seconds I have |

### D.3 Core user journey

```
Open URL (QR) → Connect wallet → JOIN (stake 0.1 MON) → see crown + live pot
   → tap STEAL → confirmed in one call → earnings tick up every block
   → someone takes it → your blocks bank
   → SURGE: final 60 blocks pay 3× → scramble
   → session closes → CLAIM → reign record updated
```

### D.4 Functional requirements

| ID | Requirement |
|---|---|
| REQ-001 | The system SHALL maintain exactly one crown holder at any block |
| REQ-002 | A player SHALL join by staking exactly `STAKE` (0.1 MON), once per session |
| REQ-003 | Only joined players SHALL be able to call `steal()` |
| REQ-004 | The system SHALL credit the outgoing holder their surge-weighted blocks on every steal |
| REQ-005 | A steal SHALL revert if fewer than `MIN_REIGN` blocks have elapsed since the crown last changed hands |
| REQ-006 | A steal SHALL revert if the caller is inside their personal cooldown |
| REQ-007 | The caller's cooldown SHALL grow by 3 blocks per steal they have made |
| REQ-008 | The current holder SHALL NOT be able to steal from themselves |
| REQ-009 | Blocks held within the final `SURGE_BLOCKS` SHALL count `SURGE_MULTIPLIER`× |
| REQ-010 | The session SHALL close at a fixed block number set at deployment |
| REQ-011 | `settle()` SHALL credit the final holder's reign exactly once, after session close |
| REQ-012 | `claim()` SHALL pay `pot × blocksHeld / totalBlocks`, once per address, after settle |
| REQ-013 | `claim()` SHALL refund the stake if `totalBlocks` is zero (nobody ever held the crown) |
| REQ-014 | The system SHALL accumulate each player's blocks into a permanent, non-transferable reign record |
| REQ-015 | The UI SHALL display the live reign and live earnings of the current holder, updating every block |
| REQ-016 | The UI SHALL display the pot, the leaderboard by blocks held, and a surge countdown |
| REQ-017 | The UI SHALL display the caller's cooldown and disable STEAL while cooling |
| REQ-018 | The UI SHALL reflect another player's steal within one block of its confirmation |

### D.5 Non-functional requirements

| ID | Requirement |
|---|---|
| REQ-020 | Steal → visible confirmation SHALL NOT render a pending spinner (`useSendTransactionSync`) |
| REQ-021 | The app SHALL be readable from the back of a hall on a projector |
| REQ-022 | The app SHALL be usable one-handed on a phone |
| REQ-023 | The app SHALL function with no backend service running |
| REQ-024 | State SHALL survive a page refresh (read from chain, never from memory) |

### D.6 MVP scope

**In:** contract with stake, pot, surge, claim, reign record; one player screen; wallet connect; join; steal; live crown + earnings; leaderboard; surge countdown; cooldown indicator; projector view.

**Out — do not renegotiate during the build:** escalating stake of any kind (see W3 — this is the one that breaks the faucet); NFTs; multiple concurrent sessions; chat; sound; profiles; sponsored gas / relayer; Para embedded wallets; an indexer; historical session browser; admin panel; any owner-only function.

### D.7 Constraints

| ID | Constraint |
|---|---|
| CON-001 | Contract MUST be deployed during the event (hackathon rule) |
| CON-002 | Testnet only. No mainnet |
| CON-003 | No backend service. Frontend talks to the chain directly |
| CON-004 | `evm_version` pinned to `shanghai` AND optimizer configured so no `MCOPY` reaches runtime bytecode |
| CON-005 | The stake is FIXED at 0.1 MON and never escalates |
| CON-006 | Contract address MUST appear in README before 17:45 |
| CON-007 | No secrets committed. `.env.example` only |
| CON-008 | No owner, no admin key, no privileged withdrawal path |
| CON-009 | **No pre-existing code.** Nothing from `pixel-wars` may be reused — contract, frontend, scripts, or opcode guard. All code written during event hours (IDEAS.md V2) |
| CON-010 | The repo MUST be a **fork of the organisers' Jakarta repo**, not a standalone repo. Fork target must be confirmed with an organiser (IDEAS.md V5) |
| CON-011 | Submission via [blitz.devnads.com](https://blitz.devnads.com) → *Submit Project*; editable until voting opens |

---

## E. Technical specification

### E.1 Architecture

```
Player phone
    ↓  wagmi + viem
Wallet (injected / WalletConnect)
    ↓  eth_sendRawTransactionSync
Rebutan.sol on Monad Testnet  ←  eth_subscribe(logs) → projector view
    ↓
On-chain state (holder, since, pot, blocksHeld, reignRecord)
```

**No backend, no database, no game server.** Everything on screen is read from the chain. This removes the practice run's largest operational risk.

### E.2 Stack

| Layer | Choice | Why |
|---|---|---|
| Contract | Solidity 0.8.28, Foundry | Practice-run pipeline already works |
| Frontend | Next.js + TypeScript + Tailwind | Team's strongest ground |
| Chain access | wagmi v3 + viem | `useSendTransactionSync` lives here |
| Wallet | injected + WalletConnect | Audience already has funded wallets. **Not Para** |
| Live updates | `eth_subscribe` on `logs` | Native, no indexer |
| Hosting | Vercel | `deploy-to-vercel` skill |
| RPC | `https://testnet-rpc.monad.xyz` | Fallback `https://rpc.ankr.com/monad_testnet` |

### E.3 Network

| | |
|---|---|
| Chain id | `10143` |
| RPC | `https://testnet-rpc.monad.xyz` |
| Faucet | `https://faucet.monad.xyz` — rate-limited, claim early |

⚠️ **Every player will be throttled to one transaction per ~1.2 s** by Monad's reserve-balance rule, because faucet balances sit under 10 MON. `MIN_REIGN = 3 blocks` matches that throttle exactly, so the rule shapes the game rather than breaking it. Do not design anything that needs two transactions in quick succession from one address.

---

## F. Smart contract specification

### F.1 Responsibilities

Own the crown, enforce who may take it and when, meter earnings per block held, custody the pot until settlement, pay out pro-rata, and keep a permanent reign record. No admin, no privileged path.

### F.2 Constants and state

| Name | Type | Meaning |
|---|---|---|
| `STAKE` | `uint256` const = 0.1 ether | fixed entry, never escalates (CON-005) |
| `MIN_REIGN` | `uint8` const = 3 | blocks a fresh crown is protected (~1.2 s) |
| `SURGE_BLOCKS` | `uint64` const = 60 | length of the endgame (~24 s) |
| `SURGE_MULTIPLIER` | `uint8` const = 3 | weight applied to surge blocks |
| `holder` | `address` | current holder; `address(0)` before the first steal |
| `since` | `uint64` | block the current reign began |
| `endsAt` | `uint64` | block the session closes |
| `pot` | `uint256` | sum of all stakes |
| `totalBlocks` | `uint64` | sum of all surge-weighted blocks credited |
| `settled` | `bool` | final reign credited |
| `joined` | `mapping(address => bool)` | paid the stake |
| `blocksHeld` | `mapping(address => uint64)` | surge-weighted blocks this session |
| `nextStealAllowed` | `mapping(address => uint64)` | cooldown expiry block |
| `stealCount` | `mapping(address => uint32)` | steals made, drives cooldown growth |
| `claimed` | `mapping(address => bool)` | payout taken |
| `reignRecord` | `mapping(address => uint64)` | cumulative blocks across sessions, soulbound |

### F.3 Functions

| Signature | Access | Behaviour |
|---|---|---|
| `constructor(uint64 sessionBlocks)` | — | `endsAt = block.number + sessionBlocks`; `holder = address(0)`; `since = block.number` |
| `join()` | public payable | REQ-002. Reverts if already joined, wrong value, or session closed |
| `steal()` | public | REQ-003..008. **Not payable** |
| `settle()` | public | REQ-011. Callable by anyone once `block.number >= endsAt`, idempotent |
| `claim()` | public | REQ-012, REQ-013. Pull payment, once per address |
| `_weighted(uint64 from, uint64 to)` | internal pure | surge-weighted block count for a reign |
| `pendingOf(address)` | view | live earnings estimate, display only |
| `tierOf(address)` | view | reign-record tier, display only |

**`_weighted` is the only non-obvious logic:**

```
surgeStart = endsAt - SURGE_BLOCKS
normal     = max(0, min(to, surgeStart) - from)
surge      = max(0, to - max(from, surgeStart))
return normal + surge * SURGE_MULTIPLIER
```

**Crediting rule:** on every steal and on settle, credit the *outgoing* holder `_weighted(since, block.number)`, add it to `totalBlocks` and to `reignRecord`. **Skip entirely when `holder == address(0)`** — otherwise pre-first-steal blocks inflate `totalBlocks` and permanently strand that fraction of the pot.

### F.4 Events

| Event | Purpose |
|---|---|
| `Joined(address indexed player, uint256 pot)` | pot ticker |
| `Stolen(address indexed from, address indexed to, uint64 atBlock, uint64 weightedBlocks)` | every live UI update |
| `Settled(address indexed finalHolder, uint64 totalBlocks)` | session close |
| `Claimed(address indexed player, uint256 amount)` | payout confirmation |

### F.5 Access control

Everything is permissionless. `settle()` and `claim()` are gated by session state, not by identity. **There is no owner and no admin function** (CON-008) — a stronger claim in the pitch than any panic button, and it removes the "who can rug this" question entirely.

### F.6 Security

| ID | Risk | Status |
|---|---|---|
| SEC-001 | Reentrancy on `claim()` | Pull payment; `claimed[msg.sender] = true` **before** the transfer; checks-effects-interactions |
| SEC-002 | Fund locking — nobody claims | `claim()` permissionless and always available after settle; no expiry |
| SEC-003 | Fund locking — `totalBlocks == 0` | REQ-013 refunds stakes in that branch |
| SEC-004 | Fund locking — `address(0)` credit | F.3 crediting rule skips the null holder |
| SEC-005 | Integer division dust | Up to 1 wei per claimer remains. Documented as a known limitation |
| SEC-006 | Arithmetic overflow | Solidity 0.8 checked math; `uint64` block numbers cannot realistically overflow |
| SEC-007 | Sybil churn | `MIN_REIGN` (global) caps churn regardless of address count; per-address cooldown layers on top |
| SEC-008 | Front-running the buzzer | Mitigated by design — surge rewards *sustained* holding, and a last-block steal banks ~0 |
| SEC-009 | Same-block double steal | `MIN_REIGN` makes it revert; no zero-length reigns |
| SEC-010 | `settle()` griefing | Idempotent via `settled`; anyone may call |
| SEC-011 | Timestamp manipulation | **Not applicable** — the contract reads `block.number`, never `block.timestamp` |
| SEC-012 | Forced ether via `selfdestruct` | `pot` is tracked in a variable, never `address(this).balance` |

### F.7 Tests — the bar before deploy

**Core (never cut):**
1. `join()` with correct stake registers the player and grows the pot
2. `join()` twice reverts; wrong value reverts
3. `steal()` by a non-joined address reverts
4. First steal transfers the crown and credits nothing to `address(0)`
5. Steal inside `MIN_REIGN` reverts
6. Steal inside personal cooldown reverts
7. Cooldown grows 3 → 6 → 9 across successive steals
8. Holder cannot steal from themselves
9. `settle()` credits the final holder exactly once; second call is a no-op

**Money (never cut):**
10. `claim()` pays exactly `pot × blocksHeld / totalBlocks`
11. `claim()` twice reverts
12. Sum of all claims ≤ pot, and the remainder is dust only
13. `totalBlocks == 0` refunds every joined player their stake

**Surge and record (cut only under real time pressure):**
14. Blocks inside the surge window count 3×; a reign straddling the boundary splits correctly
15. `reignRecord` accumulates across two sessions

---

## G. UI specification

### G.1 Pages

| Route | Purpose |
|---|---|
| `/` | the game — the only screen a player needs |
| `/wall` | projector view — same state, no controls, huge type |

### G.2 `/` layout, top to bottom

1. **One-line rule.** "Hold the crown. You earn for every Monad block you hold it."
2. **The crown** — current holder, the **live reign counter in blocks**, and **live earnings in MON** ticking beside it. This is the signature; give it the screen.
3. **Pot + player count**, and the **surge countdown** once inside 200 blocks.
4. **STEAL** — full width, thumb-height. States: join / ready / cooling (`n blocks`) / yours / session over.
5. **Leaderboard** — top 10 by blocks held with earnings, caller's row pinned if outside it.
6. **Block height + chain id**, small, always visible.

### G.3 Transaction states

| State | Treatment |
|---|---|
| Not joined | STEAL replaced by **JOIN — 0.1 MON** |
| Submitting | **No spinner.** `useSendTransactionSync` returns the receipt in the same call |
| Yours | crown flips, reign and earnings counters reset and start ticking |
| Cooling | disabled, remaining blocks counting down |
| Surge active | the whole surface shifts — earnings tick 3× faster and it must be *visible* |
| Rejected in wallet | silent return to ready. No error toast |
| Reverted | one line: "Someone beat you to it" / "Cooling down" |
| Session over | crown freezes, **CLAIM** becomes the primary action |
| Wrong network | one button: "Switch to Monad Testnet" |

### G.4 Error and empty states

- **Not connected:** crown, pot, and leaderboard still render. Only JOIN/STEAL is gated — spectators must be able to watch.
- **RPC unreachable:** banner "reconnecting", last known state stays. **Never blank the projector.**
- **Nobody has joined:** pot reads 0 and the crown reads "unclaimed" — this is a legitimate opening state, not an error.

### G.5 Responsive

Phone-first. `/wall` is tuned for 16:9 projection at distance — no interactive affordances, type at least 4× the phone size.

### G.6 Visual direction

Deferred to the polish window and the `frontend-design` / `high-end-visual-design` skills. Three constraints fixed now: **dark ground**; **the earnings counter is the largest element**; **the surge must change the entire surface**, not just a label — it is the climax the demo is built around.

---

## H. Six-hour implementation plan

Two developers. **Dev A = contract, Dev B = client.** With three, C takes `/wall` and the README from 14:00.

| Time | Dev A | Dev B | Deliverable | Fallback |
|---|---|---|---|---|
| 11:30–12:00 | `forge init`, pin `evm_version=shanghai`, port `check-opcodes.sh` | `create-next-app`, **bump tsconfig target to ES2020**, Tailwind, wagmi+viem, Monad chain | Both run locally | — |
| 12:00–13:15 | `Rebutan.sol` complete incl. `_weighted`, `claim()` | Wallet connect + reads (`holder`, `since`, `pot`, `blocksHeld`) | Compiles; UI reads a local anvil deploy | — |
| 13:15–14:00 | Tests 1–13 green | Crown + live reign/earnings counters | `forge test` passes | Cut 14–15 first, never 1–13 |
| 14:00–14:30 | **Deploy to Monad testnet + verify** | JOIN + STEAL via `useSendTransactionSync` | **Live contract address exists** | **Hard gate — must not slip past 15:00** |
| 14:30–15:15 | `eth_subscribe` logs → live updates | Cooldown + disabled states + CLAIM | Two phones see each other's steals | Poll `getBlockNumber` every 400 ms |
| 15:15–16:00 | `/wall` projector view | Leaderboard, pot ticker, **surge treatment** | Projector-ready | `/wall` = `/` at 3× zoom |
| 16:00–16:40 | README: address, setup, architecture, limitations | Visual polish (design skills) | Submission-ready repo | Polish is first to cut |
| 16:40–17:05 | **Deploy web to Vercel; end-to-end test on two real phones** | same | Live URL works on venue wifi | — |
| 17:05–17:30 | Screenshots, final README, buffer | Rehearse the 3-minute demo aloud, twice | Frozen | — |

### H.1 De-scope ladder — cut in this order

1. Visual polish beyond dark + large numbers
2. `reignRecord` tiers UI (keep the mapping — it costs nothing)
3. `/wall` as a distinct route
4. Leaderboard beyond top 3
5. WebSocket live updates → polling
6. Cooldown countdown UI (keep the contract rule)

**Never cut:** deployed contract · JOIN + STEAL working on a phone · live earnings counter · the surge · CLAIM · README with the address.

### H.2 The hard gate

**If the contract is not deployed and verified by 15:00, stop building features and fix that.** Everything else is optional relative to CON-001.

---

## I. Deployment specification

```bash
# 0. Funding — deployer already holds ~9.5 MON. Verify before relying on it:
cast balance $DEPLOYER --rpc-url https://testnet-rpc.monad.xyz --ether

# 1. Compile
cd contracts && forge build

# 2. Opcode guard (CON-004) — BEFORE every deploy
./check-opcodes.sh          # must report no MCOPY in runtime bytecode

# 3. Test
forge test -vvv

# 4. Deploy   (sessionBlocks 9000 ≈ 1 hour at 400ms — size to the demo window)
forge create src/Rebutan.sol:Rebutan \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --constructor-args 9000

# 5. Verify — one call covers all three explorers
forge verify-contract <ADDR> src/Rebutan.sol:Rebutan \
  --chain 10143 --show-standard-json-input > /tmp/standard-input.json
jq '.metadata' out/Rebutan.sol/Rebutan.json > /tmp/metadata.json
# POST to https://agents.devnads.com/v1/verify per .agents/skills/scaffold/SKILL.md
# constructorArgs = $(cast abi-encode "constructor(uint64)" 9000), 0x stripped

# 6. Frontend
cd ../web && echo "NEXT_PUBLIC_CONTRACT_ADDRESS=<ADDR>" >> .env.local
npm run build && npx vercel deploy

# 7. Production test on two real phones, on venue wifi

# 8. README: address, live URL, chain id, screenshots, limitations

# 9. Submit before 17:45
```

⚠️ **Step 2 is not optional.** Monad supports opcodes only through Shanghai; the optimizer emits `MCOPY` even under `evm_version = "shanghai"`. The failure is silent — deploys clean, reverts later, unrecoverable at 17:00.

⚠️ **Session sizing.** `endsAt` must land during your pitch so the room sees the surge. Deploy a fresh session before you present rather than stretching one all evening.

---

## J. Demo plan

### J.1 The 30-second explanation

> There is one crown on Monad, and holding it pays. Every block you hold it, you earn a share of the pot — and on Monad a block is 400 milliseconds, so the money moves about thirty times faster than it would on Ethereum. Anyone in this room can take it from me right now. Scan the code.

### J.2 The 60-second live flow

1. `/wall` on the projector: you hold the crown, earnings ticking visibly.
2. QR up. **"Join for 0.1 MON and take it from me."** Wait. The room joins; the pot climbs on screen.
3. Someone steals. Point at it: crown changed hands, earnings reset — **no loading spinner anywhere.**
4. **The surge fires.** The surface changes, earnings tick triple, and the room fights hardest for 24 seconds. Say nothing during this.
5. Session closes. CLAIM. Somebody in the audience is paid, live.

### J.3 The 2-minute technical explanation

- One contract, no owner, no admin key, no privileged withdrawal. Nothing to rug.
- Every join, steal, and claim is a real transaction. No server, no database, no game loop — **the chain is the backend.**
- `eth_sendRawTransactionSync` returns the receipt in the same RPC call, which is why there is no pending state in the UI.
- Earnings are metered in **blocks, not seconds**: `block.timestamp` has one-second resolution, and at 400 ms two or three blocks share a timestamp. Blocks are the finer clock — so the chain's cadence is literally the unit of account.
- Payout is pull-based with checks-effects-interactions; the contract never calls out before it writes.
- Verified source; address in the README.

### J.4 Strongest visual moment

**The surge.** Earnings triple, the surface changes, and thirty people scramble at once — and you know exactly when it will happen, so you can build the pitch around it. Rehearse so it lands while the room is watching the projector.

### J.5 The Monad answer

> Two things here scale with block time: how fast you find out you've lost the crown, and how fast you get paid for holding it. On a twelve-second chain the contest doesn't get worse — it stops existing, because you'd spend twelve seconds not knowing whether you're still king. This isn't a game that runs on a fast chain. It's a game that is only possible on one.

### J.6 The innovation answer — what the rubric actually scores

⚠️ **Do not pitch this as a sellable product.** The official criteria (IDEAS.md V3) reward *Novelty & Originality* and *Innovative Mechanics*, and explicitly disclaim polish and completeness. The jury is developers, not VCs. A business-model slide reads as hollow to this room.

Lead with the mechanic, and open on the twist that answers the anti-clone rule (V4):

> A contested crown isn't new — King of the Ether did it in 2016. What's new is what happens when you put it on a chain with 400-millisecond blocks. We couldn't meter earnings in seconds, because `block.timestamp` only has one-second resolution and two or three Monad blocks share a timestamp. So the payout is denominated in **blocks** — the chain's own cadence became the unit of account. That decision doesn't exist on Ethereum. Then we rationed steals by a growing cooldown instead of an escalating price, which turns a payment auction into a resource-management game, and added a 3× surge so the last 24 seconds decide it.

Three sentences, three mechanics, each one a thing a developer in that room hasn't seen.

### J.7 Closing

> No token. No admin key. One crown, one contract, and a room getting paid by the block to fight over it. That's what 400-millisecond blocks buy you.

### J.8 Pre-demo checklist

- [ ] Fresh session deployed, `endsAt` timed so the surge fires during your pitch
- [ ] Two phones charged, funded, joined, wallets connected
- [ ] `/wall` on the projector, zoom set, **screen sleep disabled**
- [ ] Short URL + QR tested from a phone on venue wifi
- [ ] Someone assigned to restart the scramble if the room goes quiet
- [ ] CLAIM tested end-to-end — a real payout to a real audience wallet
- [ ] README pushed, repo public, contract address correct
- [ ] Early demo slot requested

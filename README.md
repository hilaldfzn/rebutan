# Rebutan

**One crown. One room. Your score is how many Monad blocks you held it for.**

Built at [Monad Blitz Jakarta](https://luma.com/ksxks0qo) — 8 August 2026, Midpoint Place, Jakarta.

| | |
|---|---|
| **Live app** | **https://rebutan-monad.vercel.app** |
| Contract | [`0x87859caeD22239B6e8E3cB7998AAF7c5Fd4A0596`](https://testnet.monadscan.com/address/0x87859caeD22239B6e8E3cB7998AAF7c5Fd4A0596) |
| Network | Monad Testnet — chain id **10143** |
| Verified | [MonadVision](https://testnet.monadvision.com/address/0x87859caeD22239B6e8E3cB7998AAF7c5Fd4A0596) · [Monadscan](https://testnet.monadscan.com/address/0x87859caeD22239B6e8E3cB7998AAF7c5Fd4A0596) — perfect match |

### Measured on-chain

Not estimates — these are from the live deployment above.

| | |
|---|---|
| `join()` | 126,831 gas |
| `steal()` | 132,416 gas |
| Runtime size | 12,767 bytes (Monad's limit is 128 kb) |
| Contract tests | 27 passing, incl. a 256-run fuzz on payout solvency |
| Full lifecycle | join → steal → settle → claim exercised on live testnet |
| Pot solvency | contract held **exactly 0 MON** after all claims — nothing stranded |

---

## The problem

Nothing here is a problem anyone has on a Monday. Rebutan is a toy, and it is honest about that — what it demonstrates is a class of interaction that does not work on a slow chain.

A contested single-holder resource — a crown, a lock, a lane, a turn — is only playable if losing it registers before you can react. On a twelve-second chain you spend twelve seconds not knowing whether you still hold it. The mechanic doesn't degrade; it stops existing.

## The solution

One crown lives on-chain. Players stake a fixed **0.1 MON** to join, and whoever holds the crown earns a share of the pot for every **Monad block** they hold it — a block is 400 ms, so earnings tick about two and a half times per second.

**Four verbs:**

| Verb | Cost | Effect |
|---|---|---|
| `join` | 0.1 MON, once | enter the session, add to the pot |
| `steal` | gas only | take the crown; **your own** cooldown grows +3 blocks per steal you make |
| `fortify` | gas only | buy 8 blocks of protection by forfeiting 4 blocks of earnings |
| `claim` | gas only | take your payout after settlement |

**Stages.** The session runs in three stages by block range, paying **1× → 2× → 3×**. Falling behind early is recoverable and the final third decides most of it.

**Two ways to win, and they disagree.** The pot splits **70% endurance** (pro-rata by stage-weighted blocks held) and **30% long reign** (winner-take-all to the single longest *unbroken* reign). Accumulating many short reigns and spiking one enormous late reign are incompatible plans — which is why breaking someone else's streak is worth doing even when it earns you nothing.

**Reign Record.** Cumulative weighted blocks across every session, soulbound, tiered Pretender → Tyrant. Cosmetic only: a newcomer and a Tyrant steal on identical terms.

The stake is **fixed and never escalates** — an escalating price would make MON a consumable and strand players behind a rate-limited faucet mid-game.

**No owner. No admin key. No privileged withdrawal path.** Nothing here can be paused, drained, or reconfigured by anyone.

## Why Monad

- **400 ms blocks** — the crown changes hands faster than the room can react.
- **`eth_sendRawTransactionSync`** — the receipt returns in the same RPC call, so the UI has **no pending state to render**. There is no spinner in this app.
- **Score is denominated in blocks, not seconds** — `block.timestamp` only has second resolution, and at 400 ms two or three blocks share a timestamp. Blocks are the finer clock, which makes the chain's cadence the unit of measurement.

## Architecture

```
Player phone
    ↓  wagmi + viem
Wallet (injected / WalletConnect)
    ↓  eth_sendRawTransactionSync
Rebutan.sol on Monad Testnet  ←  eth_subscribe(logs) → projector view
    ↓
On-chain state (holder, since, blocksHeld)
```

**No backend. No database. No game server.** Everything on screen is read from the chain.

## Tech stack

| Layer | Choice |
|---|---|
| Contract | Solidity 0.8.28 · Foundry |
| Frontend | Next.js · TypeScript · Tailwind |
| Chain | wagmi v3 · viem |
| Hosting | Vercel |

## Setup

```bash
git clone <this repo> && cd rebutan

# Contracts
cd contracts
cp ../.env.example .env                          # fill in PRIVATE_KEY
forge install foundry-rs/forge-std --no-git      # lib/ is gitignored, not vendored
forge build
./check-opcodes.sh                               # must pass before any deploy
forge test

# Frontend
cd ../web
npm install
cp ../.env.example .env.local   # fill in NEXT_PUBLIC_CONTRACT_ADDRESS
npm run dev
```

Get testnet MON from [faucet.monad.xyz](https://faucet.monad.xyz) (rate-limited — claim early).

## Deployment

```bash
cd contracts
./check-opcodes.sh    # REQUIRED: Monad supports opcodes only through Shanghai
forge create src/Rebutan.sol:Rebutan \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --constructor-args 9000
```

Full deployment and verification steps: [spec/spec-rebutan.md](spec/spec-rebutan.md) §I.

## Screenshots

_TBD_

## Known limitations

- **Testnet only.** No real value at stake, by design.
- **It is a toy.** Low standalone utility; the point is the interaction class it demonstrates.
- **Assumes an onboarded audience.** It works at a Monad event because everyone present already holds a funded testnet wallet. It would not work cold — a general audience hits the faucet wall.
- **Accounts under 10 MON are throttled** to one transaction per ~1.2 s by Monad's reserve-balance rule. This happens to match the 3-block crown protection, so it shapes the game rather than breaking it.
- **The final holder's reign** is only credited once `settle()` is called after the session closes.

## Docs

- [IDEAS.md](IDEAS.md) — how this concept was chosen, and the adversarial pass that changed it (Rev 2 supersedes §C)
- [spec/spec-rebutan.md](spec/spec-rebutan.md) — requirements, contract spec, build plan, demo script
- [CLAUDE.md](CLAUDE.md) — guidance for AI agents working in this repo

## License

MIT

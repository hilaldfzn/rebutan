# Rebutan

**One crown. One room. Your score is how many Monad blocks you held it for.**

Built at [Monad Blitz Jakarta](https://luma.com/ksxks0qo) — 8 August 2026, Markas KOMDIGI.

> ⚠️ Placeholders below are filled in at deploy time (before 17:45 WIB). See [spec/spec-rebutan.md](spec/spec-rebutan.md) §I.

| | |
|---|---|
| Live app | _TBD_ |
| Contract | `_TBD_` |
| Network | Monad Testnet — chain id **10143** |
| Explorer | _TBD_ |

---

## The problem

Nothing here is a problem anyone has on a Monday. Rebutan is a toy, and it is honest about that — what it demonstrates is a class of interaction that does not work on a slow chain.

A contested single-holder resource — a crown, a lock, a lane, a turn — is only playable if losing it registers before you can react. On a twelve-second chain you spend twelve seconds not knowing whether you still hold it. The mechanic doesn't degrade; it stops existing.

## The solution

One crown lives on-chain. Anyone can steal it. Your score is the number of **Monad blocks** you held it for — a block is 400 ms, so the scoreboard ticks about two and a half times per second.

Stealing costs nothing but gas. The scarce resource is your own **cooldown**, which grows by 3 blocks with every steal you make, so *when* you spend a steal is the whole game. A freshly taken crown is protected for 3 blocks (~1.2 s), which caps churn no matter how many addresses attack it.

No token. No stake. No payout. No owner, no admin key, no `payable` function anywhere.

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

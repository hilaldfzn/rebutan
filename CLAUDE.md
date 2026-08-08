# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status: greenfield

There is **no code in this directory yet** — no `package.json`, no contracts, no build system. It currently holds only:

- [prompt.txt](prompt.txt) — the context-engineering brief: role, constraints, idea-evaluation rubric, six-hour phase plan, submission checklist, required output artifacts (§15 A–J)
- [monad-hackathon.txt](monad-hackathon.txt) — the Monad Blitz Jakarta event description and schedule
- `.agents/skills/`, `.impeccable/` — vendored tooling, not project source

Everything below is what a future instance needs *before* the stack exists. **Once code lands, replace the "When code lands" section with real build/test/deploy commands and the actual architecture.** Do not leave invented commands in this file.

## The task

Ship a deployed, judgeable Monad dApp in ~6 hours for **Monad Blitz Jakarta, Saturday 8 August 2026**. Team of ≤3 with limited blockchain experience.

Non-negotiable deadlines and deliverables (from [prompt.txt](prompt.txt) §1.3 and §10):

| | |
|---|---|
| Code freeze | 17:30 WIB |
| Submission | 17:45 WIB |
| Demo | from 18:00 WIB |
| Chain | Monad testnet or mainnet |
| Contract | must be **deployed during the event**, address in README |
| Web app | must be live and functional — working product, not slides |
| Repo | public GitHub, README covering setup / architecture / live URL / limitations |

The governing filter from §16, worth re-applying before adding anything: *can a small team with limited Monad experience actually ship this reliably in six hours?* If a feature does not move user value, judging score, demo quality, or Monad relevance, it is out of the MVP.

## Toolchain on this machine

Verified present: **Foundry (forge) 1.7.1**, **Node 22.22.0**, **cloudflared 2026.7.3**. `pnpm` is **not** installed — use npm unless you install it.

**git is 2.15.0** — `git switch` and `git restore` do not exist; use `git checkout`. Commits are configured to GPG-sign but there is no TTY for the passphrase, so non-interactive commits need `--no-gpg-sign` and the user re-signs with `git commit --amend -S`.

## Prior art next door: `../monad-blitz`

`../monad-blitz` is a **separate git repository** ([github.com/hilaldfzn/pixel-wars](https://github.com/hilaldfzn/pixel-wars)) — Pixel Wars, a **practice run built before the event**. It is not the submission, and its existing deployment does not count toward one: the contract must be deployed during the event, from the new repo. Read it for the lessons below; do not import its code or point the new frontend at its contract. The parent directory's `.gitignore` excludes it so `git add .` cannot record it as a broken gitlink.

Its `CLAUDE.md`, `README.md`, and `spec/` are worth reading before designing anything here. Two hard-won points that carry over to any Monad project:

- **Monad implements opcodes only through Shanghai.** Foundry defaults `evm_version` to `osaka`, and the optimizer emits `MCOPY` *even under* `evm_version = "shanghai"`. Both must be pinned in `foundry.toml`. The failure is silent: `MCOPY` lands in runtime bytecode, the contract deploys cleanly, and it reverts later. `../monad-blitz/contracts/check-opcodes.sh` is the pre-deploy guard.
- **Hybrid settlement pattern** (as used by PassChick, the Yogyakarta winner): keep the interactive loop off-chain and server-authoritative, have the chain verify an EIP-712 signature over the result. One transaction settles a whole round. If that shape is reused, the signing key must hold no funds and must differ from the deployer.

## Git layout — read before committing

This directory sits inside `/Users/hilaldfzn/Kuliah/Project`, which is a personal git repo holding many unrelated projects, and `monad-hackathon/` is currently **untracked** there.

**A new public GitHub repo is created when the hackathon starts** — that repo is the submission. So `git init` inside this directory, point it at the new remote, and add `monad-hackathon/` to the parent `.gitignore` — the same treatment `monad-blitz/` already gets, and for the same reason. Do not commit this project into the parent repo.

When creating this project's `.gitignore`, exclude `.agents/skills/`, `.impeccable/`, `prompt.txt`, and `monad-hackathon.txt` (personal brief and event notes, not submission material). Track `skills-lock.json` if one is generated — vendored skills are restored from it.

## When code lands

Fill in here, from the actual project rather than from the stack sketched in [prompt.txt](prompt.txt) §5.2:

- install / dev / build commands per workspace
- test command, and how to run a **single** test
- contract compile, test, deploy, and verify commands, plus the network/chain id
- the architecture: what is on-chain vs. off-chain, and why
- the live URLs and the deployed contract address

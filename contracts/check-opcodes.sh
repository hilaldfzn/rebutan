#!/usr/bin/env bash
#
# check-opcodes.sh — refuse to deploy bytecode Monad cannot execute.
#
# Monad implements EVM opcodes only through SHANGHAI. Anything Cancun-era in the
# RUNTIME bytecode is a silent landmine: the deploy succeeds, the explorer looks
# healthy, and the contract reverts the first time that code path is reached.
#
# foundry.toml pins evm_version and disables the optimizer to prevent this. That
# is necessary but not sufficient — this script is the thing that PROVES it, by
# disassembling what the compiler actually produced.
#
# Usage:  ./check-opcodes.sh [ContractName ...]     (default: every built contract)
# Exit:   0 = clean, 1 = forbidden opcode found, 2 = setup problem

set -euo pipefail

cd "$(dirname "$0")"

# Cancun (EIP-1153 / 4844 / 5656) — all post-Shanghai, all unsupported on Monad.
FORBIDDEN="TLOAD|TSTORE|MCOPY|BLOBHASH|BLOBBASEFEE"

command -v cast >/dev/null || { echo "✖ cast not found — install Foundry"; exit 2; }
command -v jq   >/dev/null || { echo "✖ jq not found — brew install jq"; exit 2; }

[ -d out ] || { echo "✖ no out/ directory — run 'forge build' first"; exit 2; }

if [ $# -gt 0 ]; then
    targets=()
    for name in "$@"; do targets+=("out/$name.sol/$name.json"); done
else
    # Only our own sources: skip forge-std, scripts, and test artifacts.
    # (while-read, not mapfile — macOS ships bash 3.2, which has no mapfile.)
    targets=()
    while IFS= read -r line; do
        targets+=("$line")
    done < <(
        find out -name '*.json' \
            ! -path '*forge-std*' ! -name '*.t.json' ! -name '*.s.json' \
            ! -name 'build-info*' 2>/dev/null | sort
    )
fi

[ ${#targets[@]} -gt 0 ] || { echo "✖ no build artifacts found"; exit 2; }

status=0
checked=0

for artifact in "${targets[@]}"; do
    [ -f "$artifact" ] || continue

    # deployedBytecode is the RUNTIME code — what actually executes on chain.
    # Creation bytecode may legitimately differ and is not what Monad runs.
    runtime=$(jq -r '.deployedBytecode.object // empty' "$artifact")
    [ -n "$runtime" ] && [ "$runtime" != "0x" ] || continue

    name=$(basename "$artifact" .json)
    checked=$((checked + 1))

    if found=$(cast disassemble "$runtime" 2>/dev/null | grep -oE "$FORBIDDEN" | sort -u); then
        if [ -n "$found" ]; then
            echo "✖ $name — forbidden opcode(s) in runtime bytecode:"
            echo "$found" | sed 's/^/    /'
            status=1
            continue
        fi
    fi
    echo "✓ $name"
done

[ "$checked" -gt 0 ] || { echo "✖ nothing checked — no runtime bytecode in artifacts"; exit 2; }

if [ "$status" -ne 0 ]; then
    echo
    echo "DO NOT DEPLOY. Confirm foundry.toml has evm_version = \"shanghai\" and"
    echo "optimizer = false, then 'forge clean && forge build' and re-run."
    exit 1
fi

echo
echo "Clean — $checked contract(s) safe for Monad."

"use client";

import {useEffect, useMemo, useState} from "react";
// wagmi v3 renamed useAccount -> useConnection and moved the mutation hooks to
// mutate/mutateAsync; the old names still work but are deprecated aliases.
import {useConnect, useConnection, useConnectors, useSwitchChain, useWriteContractSync} from "wagmi";
import {parseEther} from "viem";
import Link from "next/link";

import {Arena, CrownMark, seatOf} from "@/components/Arena";
import {rebutanAbi} from "@/lib/abi";
import {
    CHAIN_ID,
    FORTIFY_COST_BLOCKS,
    FORTIFY_PROTECT_BLOCKS,
    STAKE_MON,
    addressUrl,
    short,
} from "@/lib/constants";
import {
    ZERO_ADDRESS,
    currentStage,
    estimatedPayout,
    formatMon,
    pendingWeighted,
    rawReign,
    tierOf,
    type Session,
} from "@/lib/game";
import {useSessionPlayers} from "@/lib/usePlayers";
import {useLiveBlock, useRebutan} from "@/lib/useRebutan";

/**
 * The game screen.
 *
 * Structured as a scene with a HUD floating over it, not a page with controls
 * underneath. That inversion is what separates a game screen from a form.
 * Corners carry state, the centre carries the board, and exactly one button is
 * ever the obvious thing to press.
 */
export default function Play() {
    const {address: player, isConnected, chainId} = useConnection();
    const connectors = useConnectors();
    const {mutate: connect} = useConnect();
    const {mutate: switchChain} = useSwitchChain();
    const block = useLiveBlock();
    const g = useRebutan();

    const {mutateAsync: write} = useWriteContractSync();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const s = g.session;
    const roster = useSessionPlayers(g.sessionId, s?.startBlock);

    const isHolder = Boolean(s && player && s.holder.toLowerCase() === player.toLowerCase());
    const stage = s ? currentStage(s, block) : 1;
    const over = Boolean(s && block >= s.endsAt);
    const reign = s ? rawReign(s, block) : 0n;
    const earned = s ? pendingWeighted(s, block) : 0n;
    const payout = s
        ? estimatedPayout(s, player, g.bankedWeighted, block, g.enduranceBps, g.longReignBps)
        : 0n;
    const tier = tierOf(g.reignRecord);

    // Blocks until the multiplier changes — the HUD's countdown timer.
    const toNextZone = useMemo(() => {
        if (!s) return null;
        if (block < s.stage2At) return s.stage2At - block;
        if (block < s.stage3At) return s.stage3At - block;
        if (block < s.endsAt) return s.endsAt - block;
        return null;
    }, [s, block]);

    // Seat the real roster. The holder is always seated even if the log scan
    // missed them — an empty throne over a contested crown would be a lie.
    const {labels, holderSeat} = useMemo(() => {
        const map: Record<number, string> = {};
        const taken = new Set<number>();
        const place = (addr: string) => {
            let seat = seatOf(addr);
            for (let i = 0; i < 6 && taken.has(seat); i++) seat = (seat + 1) % 6;
            taken.add(seat);
            map[seat] = short(addr);
            return seat;
        };
        let hSeat = 0;
        if (s && s.holder !== ZERO_ADDRESS) hSeat = place(s.holder);
        for (const p of roster) {
            if (s && p.toLowerCase() === s.holder.toLowerCase()) continue;
            place(p);
        }
        return {labels: map, holderSeat: hSeat};
    }, [roster, s]);

    useEffect(() => setError(null), [s?.holder]);

    async function send(functionName: string, args: unknown[] = [], value?: bigint) {
        if (!g.address) return;
        setBusy(true);
        setError(null);
        try {
            // Resolves with the RECEIPT, not a pending hash — this is why the
            // screen never shows a spinner.
            await write({
                address: g.address,
                abi: rebutanAbi,
                functionName,
                args,
                value,
                chainId: CHAIN_ID,
            } as never);
            g.refetch();
        } catch (e) {
            setError(readableError(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="relative flex min-h-dvh w-full flex-col overflow-hidden">
            {/* ── SCENE ─────────────────────────────────────────────────── */}
            <div className="absolute inset-0 grid place-items-center px-4">
                <Arena
                    className="w-full max-w-[560px] opacity-95"
                    holderSeat={holderSeat}
                    labels={labels}
                    stage={stage}
                    animate={!over}
                />
            </div>

            {/* ── HUD ───────────────────────────────────────────────────── */}
            <div className="pointer-events-none relative flex min-h-dvh flex-col justify-between p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="hud pointer-events-auto px-3 py-2">
                        <div className="flex gap-5">
                            <Readout label="blocks" value={reign.toString()} />
                            <Readout label="scored" value={earned.toString()} accent />
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-1.5">
                        <div className="hud px-3 py-1.5">
                            <span className="pixel text-[9px] uppercase text-crown">{tier.name}</span>
                        </div>
                        <div className="hud px-4 py-2 text-center">
                            <div className="pixel text-[8px] uppercase text-ink-faint">
                                {stage === 3 ? "final zone" : "next zone"}
                            </div>
                            <div
                                className={`pixel text-base tabular-nums ${
                                    stage === 3 ? "text-danger" : "text-ink"
                                }`}
                            >
                                {toNextZone !== null ? toNextZone.toString() : "—"}
                            </div>
                        </div>
                    </div>

                    <div className="pointer-events-auto flex flex-col items-end gap-1.5">
                        <div className="hud-gold px-3 py-2">
                            <span className="pixel text-[9px]">
                                {player ? short(player) : "NO WALLET"}
                            </span>
                        </div>
                        <div className="hud px-3 py-2">
                            <span className="pixel text-[9px] text-crown">
                                POT {s ? formatMon(s.pot, 2) : "—"}
                            </span>
                        </div>
                        {error ? (
                            <div className="hud-danger shake max-w-[210px] px-3 py-2">
                                <span className="pixel text-[8px] leading-relaxed">{error}</span>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-end justify-between gap-3">
                    <Link href="/" className="emblem pointer-events-auto" aria-label="Back to home">
                        <CrownMark className="h-6 w-6 text-crown" />
                    </Link>

                    <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2">
                        <Actions
                            connected={isConnected}
                            wrongNetwork={isConnected && chainId !== CHAIN_ID}
                            hasConnector={connectors.length > 0}
                            session={s}
                            game={g}
                            isHolder={isHolder}
                            over={over}
                            payout={payout}
                            busy={busy}
                            onConnect={() => connect({connector: connectors[0]})}
                            onSwitch={() => switchChain({chainId: CHAIN_ID})}
                            onSend={send}
                        />
                        <div className="hud px-3 py-1.5 text-center">
                            <span className="pixel text-[8px] text-ink-faint">
                                #{block.toString()} · CUT {formatMon(payout, 3)}
                            </span>
                        </div>
                    </div>

                    <a
                        className="emblem pointer-events-auto"
                        href={g.address ? addressUrl(g.address) : "#"}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View contract on explorer"
                    >
                        <span className="pixel text-[8px] text-cyan">0x</span>
                    </a>
                </div>
            </div>
        </div>
    );
}

function Readout({label, value, accent}: Readonly<{label: string; value: string; accent?: boolean}>) {
    return (
        <div>
            <div className="pixel text-[8px] uppercase text-ink-faint">{label}</div>
            <div className={`pixel text-base tabular-nums ${accent ? "text-cyan" : "text-ink"}`}>
                {value}
            </div>
        </div>
    );
}

/**
 * Eight mutually exclusive states, as flat early returns. They change under time
 * pressure mid-demo, so a reader must be able to check each against the
 * contract's rules at a glance.
 */
function Actions({
    connected,
    wrongNetwork,
    hasConnector,
    session,
    game,
    isHolder,
    over,
    payout,
    busy,
    onConnect,
    onSwitch,
    onSend,
}: Readonly<{
    connected: boolean;
    wrongNetwork: boolean;
    hasConnector: boolean;
    session: Session | null;
    game: ReturnType<typeof useRebutan>;
    isHolder: boolean;
    over: boolean;
    payout: bigint;
    busy: boolean;
    onConnect: () => void;
    onSwitch: () => void;
    onSend: (fn: string, args?: unknown[], value?: bigint) => void;
}>) {
    if (!connected) {
        return (
            <GameButton tone="gold" onClick={onConnect} disabled={!hasConnector}>
                Connect wallet
            </GameButton>
        );
    }

    if (wrongNetwork) {
        return (
            <GameButton tone="blue" onClick={onSwitch}>
                Switch to Monad
            </GameButton>
        );
    }

    if (over) {
        if (!session?.settled) {
            return (
                <GameButton tone="blue" onClick={() => onSend("settle")} disabled={busy}>
                    End the round
                </GameButton>
            );
        }
        return (
            <GameButton
                tone="gold"
                onClick={() => onSend("claim", [game.sessionId])}
                disabled={!game.joined || game.claimed || busy}
            >
                {game.claimed ? "Paid out" : `Cash out ${formatMon(payout, 3)}`}
            </GameButton>
        );
    }

    if (!game.joined) {
        return (
            <GameButton
                tone="gold"
                onClick={() => onSend("join", [], parseEther(STAKE_MON))}
                disabled={busy}
            >
                Join — {STAKE_MON} MON
            </GameButton>
        );
    }

    return (
        <>
            <GameButton
                tone="danger"
                onClick={() => onSend("steal")}
                disabled={
                    isHolder || game.cooldownRemaining > 0n || game.protectionRemaining > 0n || busy
                }
            >
                {stealLabel(isHolder, game.cooldownRemaining, game.protectionRemaining)}
            </GameButton>

            {isHolder ? (
                <GameButton
                    tone="blue"
                    onClick={() => onSend("fortify")}
                    disabled={session?.fortified || busy}
                >
                    {session?.fortified
                        ? "Bolted down"
                        : `Fortify +${FORTIFY_PROTECT_BLOCKS} / −${FORTIFY_COST_BLOCKS}`}
                </GameButton>
            ) : null}
        </>
    );
}

function stealLabel(isHolder: boolean, cooldown: bigint, protection: bigint): string {
    if (isHolder) return "You're wearing it";
    if (cooldown > 0n) return `Cooling down ${cooldown}`;
    // Firing at a protected crown wastes real MON — Monad charges on gas_limit,
    // so a reverted steal still costs full gas. Hard-disabled, never hopeful.
    if (protection > 0n) return `Locked down ${protection}`;
    return "Steal it";
}

function GameButton({
    children,
    onClick,
    disabled,
    tone,
}: Readonly<{
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    tone: "gold" | "blue" | "danger";
}>) {
    const skin = {gold: "hud-gold", blue: "hud-blue", danger: "hud-danger"}[tone];
    return (
        <button
            type="button"
            className={`${skin} hud-press pixel w-full px-4 py-4 text-[11px] uppercase`}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

/**
 * Wallet rejections are not errors worth shouting about — the user knows what
 * they did. Contract reverts are, but only in the game's own language.
 */
function readableError(e: unknown): string | null {
    const msg = e instanceof Error ? e.message : String(e);
    if (/user rejected|denied transaction/i.test(msg)) return null;
    if (/CrownProtected/.test(msg)) return "TOO SLOW — IT'S LOCKED";
    if (/CoolingDown/.test(msg)) return "STILL COOLING DOWN";
    if (/AlreadyYours/.test(msg)) return "YOU ALREADY HAVE IT";
    if (/NotJoined/.test(msg)) return "JOIN FIRST";
    if (/AlreadyClaimed/.test(msg)) return "ALREADY PAID OUT";
    if (/SessionClosed/.test(msg)) return "ROUND IS OVER";
    if (/AlreadyFortified/.test(msg)) return "ALREADY BOLTED DOWN";
    return "TRANSACTION FAILED";
}

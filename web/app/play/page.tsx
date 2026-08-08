"use client";

import {useEffect, useState} from "react";
// wagmi v3 renamed useAccount -> useConnection and moved the mutation hooks to
// mutate/mutateAsync; the old names still work but are deprecated aliases.
import {
    useConnect,
    useConnection,
    useConnectors,
    useSwitchChain,
    useWriteContractSync,
} from "wagmi";
import {parseEther} from "viem";
import Link from "next/link";

import {Arena, CrownMark} from "@/components/Arena";

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
    type Session,
} from "@/lib/game";
import {useLiveBlock, useRebutan} from "@/lib/useRebutan";

export default function Page() {
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
    const isHolder = Boolean(s && player && s.holder.toLowerCase() === player.toLowerCase());
    const stage = s ? currentStage(s, block) : 1;
    const over = Boolean(s && block >= s.endsAt);
    const reign = s ? rawReign(s, block) : 0n;
    const earned = s ? pendingWeighted(s, block) : 0n;
    const payout = s
        ? estimatedPayout(s, player, g.bankedWeighted, block, g.enduranceBps, g.longReignBps)
        : 0n;

    // Drop a stale error the moment the world changes underneath it.
    useEffect(() => setError(null), [s?.holder]);

    async function send(functionName: string, args: unknown[] = [], value?: bigint) {
        if (!g.address) return;
        setBusy(true);
        setError(null);
        try {
            // Resolves with the RECEIPT, not a pending hash — this is why the app
            // has no spinner. By the time this await returns it is already on chain.
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
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-5 py-6">
            <header className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 text-ink-muted hover:text-ink">
                    <CrownMark className="h-5 w-5 text-crown" />
                    <span className="display text-sm uppercase tracking-widest">Rebutan</span>
                </Link>
                <span className="text-xs tabular-nums text-ink-faint">#{block.toString()}</span>
            </header>

            <p className="text-sm leading-snug text-ink-muted">
                Grab it. Hold it. Get paid every block —{" "}
                <span className="text-ink">a block is 400ms.</span>
            </p>

            {!g.address ? (
                <Notice>
                    No contract configured. Append <code>?contract=0x…</code> to the URL.
                </Notice>
            ) : null}

            <Crown
                session={s}
                isHolder={isHolder}
                over={over}
                stage={stage}
                reign={reign}
                earned={earned}
            />

            <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="prize pot" value={s ? formatMon(s.pot, 2) : "—"} unit="MON" />
                <Stat label="fighters" value={s ? String(s.players) : "—"} />
                <Stat label="your cut" value={s ? formatMon(payout, 3) : "—"} unit="MON" hint="est" />
            </div>

            <div className="mt-auto flex flex-col gap-3">
                {error ? <Notice tone="error">{error}</Notice> : null}

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

                <p className="text-center text-[11px] text-ink-faint">
                    Monad Testnet · chain {CHAIN_ID}
                    {g.reignRecord > 0n ? ` · career ${g.reignRecord} blocks` : ""}
                </p>
            </div>
        </main>
    );
}

/**
 * The action area, as a flat sequence of early returns rather than nested
 * ternaries. There are eight mutually exclusive states here and they change
 * under time pressure mid-demo; a reader has to be able to check each one
 * against the contract's rules at a glance.
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
            <Button onClick={onConnect} disabled={!hasConnector}>
                Connect wallet
            </Button>
        );
    }

    if (wrongNetwork) {
        return <Button onClick={onSwitch}>Switch to Monad Testnet</Button>;
    }

    if (over) {
        if (!session?.settled) {
            return (
                <Button onClick={() => onSend("settle")} disabled={busy}>
                    End the round
                </Button>
            );
        }
        return (
            <Button
                onClick={() => onSend("claim", [game.sessionId])}
                disabled={!game.joined || game.claimed || busy}
            >
                {game.claimed ? "Paid out" : `Cash out ${formatMon(payout, 3)} MON`}
            </Button>
        );
    }

    if (!game.joined) {
        return (
            <Button onClick={() => onSend("join", [], parseEther(STAKE_MON))} disabled={busy}>
                Join the fight — {STAKE_MON} MON
            </Button>
        );
    }

    return (
        <>
            <Button
                onClick={() => onSend("steal")}
                disabled={isHolder || game.cooldownRemaining > 0n || game.protectionRemaining > 0n || busy}
            >
                {stealLabel(isHolder, game.cooldownRemaining, game.protectionRemaining)}
            </Button>

            {isHolder ? (
                <Button variant="ghost" onClick={() => onSend("fortify")} disabled={session?.fortified || busy}>
                    {session?.fortified
                        ? "Bolted down already"
                        : `Fortify · +${FORTIFY_PROTECT_BLOCKS} safe / −${FORTIFY_COST_BLOCKS} paid`}
                </Button>
            ) : null}
        </>
    );
}

function stealLabel(isHolder: boolean, cooldown: bigint, protection: bigint): string {
    if (isHolder) return "You're wearing it";
    if (cooldown > 0n) return `Cooling down · ${cooldown}`;
    // Firing into a protected crown wastes real MON: Monad charges on gas_limit,
    // so a reverted steal still costs full gas. The button stays hard-disabled.
    if (protection > 0n) return `Locked down · ${protection}`;
    return "Steal it";
}

function Crown({
    session,
    isHolder,
    over,
    stage,
    reign,
    earned,
}: Readonly<{
    session: Session | null;
    isHolder: boolean;
    over: boolean;
    stage: 0 | 1 | 2 | 3;
    reign: bigint;
    earned: bigint;
}>) {
    let heading = "The crown";
    if (over) heading = "Round over";
    else if (isHolder) heading = "It's yours — hold on";

    return (
        <section className={`slab-lg bg-arena ${isHolder ? "bg-crown/15" : ""}`}>
            <div
                className={`display flex items-center justify-between px-4 py-2 text-[11px] uppercase tracking-widest text-outline ${
                    isHolder ? "bg-crown" : "bg-violet"
                }`}
            >
                <span>{heading}</span>
                <StageBadge stage={stage} holding={isHolder} />
            </div>

            {/* The arena doubles as a live indicator: the crowned seat lights up
                when the connected player is the one holding it. */}
            <div className="flex items-center gap-4 px-5 pt-5">
                <Arena className="h-24 w-24 shrink-0" holderSeat={isHolder ? 3 : 0} animate={!over} />
                <div className="min-w-0">
                    <div
                        className={`display stroked text-6xl tabular-nums ${
                            isHolder ? "text-crown" : "text-ink"
                        }`}
                    >
                        {reign.toString()}
                    </div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                        blocks held · {earned.toString()} scored
                    </div>
                </div>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t-[3px] border-outline px-5 py-3 text-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    on the throne
                </span>
                {session && session.holder !== ZERO_ADDRESS ? (
                    <a
                        className="font-bold underline underline-offset-4 hover:text-crown"
                        href={addressUrl(session.holder)}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {short(session.holder)}
                    </a>
                ) : (
                    <span className="font-bold text-ink-muted">nobody yet</span>
                )}
            </div>
        </section>
    );
}

function StageBadge({stage, holding}: Readonly<{stage: 0 | 1 | 2 | 3; holding: boolean}>) {
    if (stage === 0) return <span className="opacity-70">ended</span>;
    // Stage 3 shouts, because it is worth triple and the round is nearly gone.
    if (stage === 3) {
        return (
            <span className="slab-sm bg-danger px-2 py-0.5 text-outline">surge · 3×</span>
        );
    }
    return (
        <span className={holding ? "opacity-80" : "opacity-90"}>
            zone {stage} · {stage}×
        </span>
    );
}

function Stat({
    label,
    value,
    unit,
    hint,
}: Readonly<{label: string; value: string; unit?: string; hint?: string}>) {
    return (
        <div className="slab-sm bg-arena px-2 py-3">
            <div className="display text-lg tabular-nums text-ink">
                {value}
                {unit ? <span className="ml-1 text-[10px] text-ink-faint">{unit}</span> : null}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                {label}
                {hint ? <span className="normal-case"> ({hint})</span> : null}
            </div>
        </div>
    );
}

function Button({
    children,
    onClick,
    disabled,
    variant = "solid",
}: Readonly<{
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: "solid" | "ghost";
}>) {
    const base =
        "slab pressable display w-full px-4 py-5 text-lg uppercase disabled:cursor-not-allowed disabled:shadow-[3px_3px_0_var(--outline)]";
    // The disabled state is not decorative: it carries the live reason you cannot
    // act ("cooling down · 3 blocks"), read mid-scramble. Dimming it to the usual
    // near-invisible grey would hide the one thing the player needs.
    const style =
        variant === "solid"
            ? "bg-magenta text-outline disabled:bg-surface disabled:text-ink-muted"
            : "bg-cyan text-outline disabled:bg-surface disabled:text-ink-muted";

    return (
        <button type="button" className={`${base} ${style}`} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    );
}

function Notice({
    children,
    tone = "info",
}: Readonly<{children: React.ReactNode; tone?: "info" | "error"}>) {
    return (
        <div
            className={`slab-sm px-3 py-2 text-xs font-bold ${
                tone === "error" ? "shake bg-danger text-outline" : "bg-surface text-ink-muted"
            }`}
        >
            {children}
        </div>
    );
}

/**
 * Wallet rejections are not errors worth shouting about — the user knows what
 * they did. Contract reverts are, but only in the game's own language.
 */
function readableError(e: unknown): string | null {
    const msg = e instanceof Error ? e.message : String(e);
    if (/user rejected|denied transaction/i.test(msg)) return null;
    if (/CrownProtected/.test(msg)) return "Someone beat you to it — the crown is protected.";
    if (/CoolingDown/.test(msg)) return "You are still cooling down.";
    if (/AlreadyYours/.test(msg)) return "You already hold the crown.";
    if (/NotJoined/.test(msg)) return "Join the session first.";
    if (/AlreadyClaimed/.test(msg)) return "Already claimed.";
    if (/SessionClosed/.test(msg)) return "This session has closed.";
    if (/AlreadyFortified/.test(msg)) return "You have already fortified this reign.";
    return "Transaction failed.";
}

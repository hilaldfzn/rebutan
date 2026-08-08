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

// Aliased: this file already has a local `Crown` for the on-screen panel.
import {Crown as CrownMark} from "@/components/Crown";

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
                    <span className="text-sm font-bold uppercase tracking-[0.2em]">Rebutan</span>
                </Link>
                <span className="text-xs tabular-nums text-ink-faint">#{block.toString()}</span>
            </header>

            <p className="text-sm leading-snug text-ink-muted">
                Hold the crown. You earn for every Monad block you hold it —{" "}
                <span className="text-ink">a block is 400&nbsp;milliseconds.</span>
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
                <Stat label="pot" value={s ? formatMon(s.pot, 2) : "—"} unit="MON" />
                <Stat label="players" value={s ? String(s.players) : "—"} />
                <Stat label="your take" value={s ? formatMon(payout, 3) : "—"} unit="MON" hint="est" />
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
                    Settle session
                </Button>
            );
        }
        return (
            <Button
                onClick={() => onSend("claim", [game.sessionId])}
                disabled={!game.joined || game.claimed || busy}
            >
                {game.claimed ? "Claimed" : `Claim ${formatMon(payout, 3)} MON`}
            </Button>
        );
    }

    if (!game.joined) {
        return (
            <Button onClick={() => onSend("join", [], parseEther(STAKE_MON))} disabled={busy}>
                Join — {STAKE_MON} MON
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
                        ? "Already fortified this reign"
                        : `Fortify · +${FORTIFY_PROTECT_BLOCKS} protected, −${FORTIFY_COST_BLOCKS} earned`}
                </Button>
            ) : null}
        </>
    );
}

function stealLabel(isHolder: boolean, cooldown: bigint, protection: bigint): string {
    if (isHolder) return "The crown is yours";
    if (cooldown > 0n) return `Cooling down · ${cooldown} blocks`;
    // Firing into a protected crown wastes real MON: Monad charges on gas_limit,
    // so a reverted steal still costs full gas. The button stays hard-disabled.
    if (protection > 0n) return `Protected · ${protection} blocks`;
    return "Steal the crown";
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
    // Secondary text takes an amber tint when the panel is amber: neutral gray
    // goes muddy on a colored ground and loses legibility at projector distance.
    const quiet = isHolder ? "text-crown/85" : "text-ink-faint";

    let heading = "Crown";
    if (over) heading = "Session closed";
    else if (isHolder) heading = "You hold it";

    return (
        <section
            className={`rounded-2xl border p-6 transition-colors ${
                isHolder ? "border-crown/60 bg-crown/10" : "border-line bg-surface"
            }`}
        >
            <div className={`flex items-center justify-between text-xs uppercase tracking-widest ${quiet}`}>
                <span>{heading}</span>
                <StageBadge stage={stage} holding={isHolder} />
            </div>

            <div
                className={`mt-3 text-6xl font-extrabold tabular-nums leading-none ${
                    isHolder ? "text-crown" : "text-ink"
                }`}
            >
                {reign.toString()}
            </div>
            <div className={`mt-1 text-xs ${quiet}`}>
                blocks held · {earned.toString()} weighted
            </div>

            <div
                className={`mt-4 border-t pt-3 text-sm ${
                    isHolder ? "border-crown/25" : "border-line"
                }`}
            >
                <span className={quiet}>holder </span>
                {session && session.holder !== ZERO_ADDRESS ? (
                    <a
                        className="underline decoration-line underline-offset-4"
                        href={addressUrl(session.holder)}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {short(session.holder)}
                    </a>
                ) : (
                    <span className="text-ink-muted">unclaimed</span>
                )}
            </div>
        </section>
    );
}

function StageBadge({stage, holding}: Readonly<{stage: 0 | 1 | 2 | 3; holding: boolean}>) {
    const quiet = holding ? "text-crown/85" : "text-ink-faint";
    if (stage === 0) return <span className={quiet}>ended</span>;

    let tone = quiet;
    if (stage === 3) tone = "text-danger";
    else if (stage === 2) tone = "text-crown";

    return (
        <span className={tone}>
            stage {stage} · {stage}×
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
        <div className="rounded-xl border border-line bg-surface px-2 py-3">
            <div className="text-lg tabular-nums">
                {value}
                {unit ? <span className="ml-1 text-[10px] text-ink-faint">{unit}</span> : null}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                {label}
                {hint ? <span className="normal-case text-ink-faint"> ({hint})</span> : null}
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
        "w-full rounded-xl px-4 py-4 text-base font-bold transition-colors disabled:cursor-not-allowed";
    // The disabled state is not decorative: it carries the live reason you cannot
    // act ("Cooling down · 3 blocks"), read mid-scramble. Dimming it to the usual
    // near-invisible gray would hide the one thing the player needs.
    const style =
        variant === "solid"
            ? "bg-crown text-ground hover:bg-[#ffc257] disabled:bg-line disabled:text-ink-muted"
            : "border border-line text-ink-muted hover:border-violet-dim disabled:text-ink-faint";

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
            className={`rounded-lg border px-3 py-2 text-xs ${
                tone === "error"
                    ? "border-danger/40 bg-danger/10 text-ink"
                    : "border-line bg-surface text-ink-muted"
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

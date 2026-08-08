"use client";

import {useEffect, useMemo, useRef, useState} from "react";
// wagmi v3 renamed useAccount -> useConnection and moved the mutation hooks to
// mutate/mutateAsync; the old names still work but are deprecated aliases.
import {useConnect, useConnection, useConnectors, useSwitchChain, useWriteContractSync} from "wagmi";
import {parseEther} from "viem";
import Link from "next/link";

import dynamic from "next/dynamic";

import {Arena, CrownMark, seatOf} from "@/components/Arena";

/**
 * The 3D scene is client-only and code-split.
 *
 * three.js is ~600kb, which is a real cost on a shared venue access point, so it
 * must never block first paint or the SSR pass. While it loads — or if WebGL is
 * unavailable on someone's phone — the flat SVG arena stands in. The game is
 * fully playable either way; the HUD and every contract call are independent of
 * which renderer is on screen.
 */
const VoxelArena = dynamic(() => import("@/components/VoxelArena"), {
    ssr: false,
    loading: () => null,
});
import {rebutanAbi} from "@/lib/abi";
import {SEAT_COUNT, fighterAt} from "@/lib/fighters";
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
    //
    // Allocation is by SORTED ADDRESS, never by who currently holds the crown.
    // The previous order placed the holder first, which meant a steal could
    // reshuffle every other fighter's seat in the same frame the crown moved —
    // and a handover animation is unreadable if the arena rearranges underneath
    // it. Seats must be the fixed thing; the crown is the only thing that moves.
    const {labels, seatByAddress, holderSeat, playerSeat} = useMemo(() => {
        const addrs = new Set<string>();
        if (s && s.holder !== ZERO_ADDRESS) addrs.add(s.holder.toLowerCase());
        for (const p of roster) addrs.add(p.toLowerCase());
        // Your own seat, whether or not the log scan has caught up with you.
        if (player) addrs.add(player.toLowerCase());

        const map: Record<number, string> = {};
        const byAddress: Record<string, number> = {};
        const taken = new Set<number>();

        for (const addr of [...addrs].sort()) {
            let seat = seatOf(addr, SEAT_COUNT);
            for (let i = 0; i < SEAT_COUNT && taken.has(seat); i++) seat = (seat + 1) % SEAT_COUNT;
            taken.add(seat);
            byAddress[addr] = seat;
            map[seat] = short(addr);
        }

        return {
            labels: map,
            seatByAddress: byAddress,
            holderSeat: s && s.holder !== ZERO_ADDRESS ? byAddress[s.holder.toLowerCase()] ?? -1 : -1,
            playerSeat: player ? byAddress[player.toLowerCase()] ?? 0 : 0,
        };
    }, [roster, s, player]);

    const occupiedSeats = useMemo(() => Object.keys(labels).map(Number), [labels]);

    /** A fighter's name, or where the crown was before anyone had taken it. */
    const nameOf = (addr: string) => {
        if (addr.toLowerCase() === ZERO_ADDRESS) return "THE THRONE";
        const seat = seatByAddress[addr.toLowerCase()];
        return seat === undefined ? short(addr) : fighterAt(seat).name;
    };

    /**
     * The handover announcement.
     *
     * Fires off the on-chain holder, not off the click — so it is equally
     * correct when someone else steals it from you, which is the case that
     * actually needs announcing. Nothing here initiates anything; it reports.
     */
    const [takeover, setTakeover] = useState<{
        id: number;
        from: string;
        to: string;
        mine: boolean;
    } | null>(null);
    const lastHolder = useRef<string | null>(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the
        // external system here is the chain, and wagmi surfaces it as a value
        // rather than a subscription we could set state from. Reacting to the
        // changed holder in an effect is the only hook we are given.
        const holder = s?.holder;
        if (!holder) return;
        const previous = lastHolder.current;
        lastHolder.current = holder;
        // The first read of the session is not a handover.
        if (previous === null || previous.toLowerCase() === holder.toLowerCase()) return;
        setTakeover({
            id: Date.now(),
            from: previous,
            to: holder,
            mine: Boolean(player && holder.toLowerCase() === player.toLowerCase()),
        });
    }, [s?.holder, player]);

    useEffect(() => {
        if (!takeover) return;
        const id = setTimeout(() => setTakeover(null), 2200);
        return () => clearTimeout(id);
    }, [takeover]);

    // Exactly the same gate as the STEAL button. Walking into range must never
    // let you fire a transaction the contract would reject — a reverted steal
    // still costs full gas on Monad, which charges on gas_limit.
    const canGrab =
        g.joined &&
        !isHolder &&
        !over &&
        !busy &&
        g.cooldownRemaining === 0n &&
        g.protectionRemaining === 0n;

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
            {/* ── SCENE ─────────────────────────────────────────────────────
                Flat arena underneath as the always-available floor, voxel scene
                layered over it once three.js arrives. The 2D layer is not
                wasted: it is what the player sees during the download and if
                WebGL is unavailable. */}
            <div className="absolute inset-0 grid place-items-center px-4">
                <Arena
                    className="w-full max-w-[420px] opacity-40"
                    holderSeat={holderSeat}
                    labels={labels}
                    stage={stage}
                    animate={false}
                />
            </div>
            <VoxelArena
                className="absolute inset-0 h-full w-full"
                holderSeat={holderSeat}
                playerSeat={playerSeat}
                occupiedSeats={occupiedSeats}
                stage={stage}
                isHolder={isHolder}
                interactive={isConnected && g.joined && !over}
                canGrab={canGrab}
                onGrab={() => send("steal")}
            />

            {/* ── HANDOVER ──────────────────────────────────────────────────
                Announced only when the chain says the holder changed, so it
                cannot fire on an optimistic click that later reverts. The
                fighter names are what carry it: "CREST → SPARK" is legible from
                the back of a room in a way two truncated addresses are not. */}
            {takeover ? (
                <>
                    <div className="crown-flash pointer-events-none absolute inset-0 z-10" />
                    <div
                        key={takeover.id}
                        className="crown-slam pointer-events-none absolute inset-x-0 top-[38%] z-20 flex justify-center px-4"
                    >
                        <div className="hud-gold px-6 py-4 text-center">
                            <div className="pixel text-[12px] uppercase leading-none">
                                {takeover.mine ? "the crown is yours" : "crown taken"}
                            </div>
                            <div className="pixel mt-2 text-[9px] uppercase opacity-75">
                                {nameOf(takeover.from)} → {nameOf(takeover.to)}
                            </div>
                        </div>
                    </div>
                </>
            ) : null}

            {/* Seat labels ride above the 3D layer: text in a WebGL scene needs a
                font atlas and extra weight, and HTML is sharper anyway. The
                colour swatch is the link back to the fighter in the arena —
                names and hues both, because one of them survives a projector
                and the other survives colour blindness. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-wrap justify-center gap-2 px-4">
                {Object.entries(labels).map(([seat, label]) => {
                    const fighter = fighterAt(Number(seat));
                    const crowned = Number(seat) === holderSeat;
                    return (
                        <span
                            key={seat}
                            className={`hud flex items-center gap-1.5 px-2 py-1 ${
                                crowned ? "outline outline-2 outline-crown" : ""
                            }`}
                        >
                            <span
                                className="h-2.5 w-2.5 rounded-[2px]"
                                style={{background: fighter.color}}
                            />
                            <span
                                className={`pixel text-[8px] ${
                                    crowned ? "text-crown" : "text-ink-muted"
                                }`}
                            >
                                {crowned ? "♛ " : ""}
                                {fighter.name}
                            </span>
                            <span className="pixel text-[8px] text-ink-faint">{label}</span>
                        </span>
                    );
                })}
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
                        {/* Controls hint. Without this a judge stares at a scene
                            they do not know they can drive. */}
                        {isConnected && g.joined && !over ? (
                            <div className="hud flex items-center justify-center gap-2 px-3 py-2">
                                <Key>W</Key>
                                <Key>A</Key>
                                <Key>S</Key>
                                <Key>D</Key>
                                <span className="pixel text-[8px] text-ink-faint">move</span>
                                <Key wide>SPACE</Key>
                                {/* "at the crown", not just "grab": range is
                                    measured to wherever the crown actually is,
                                    which after the first steal is somebody's
                                    head rather than the middle of the arena. */}
                                <span
                                    className={`pixel text-[8px] ${
                                        canGrab ? "text-crown" : "text-ink-faint"
                                    }`}
                                >
                                    take at ♛
                                </span>
                            </div>
                        ) : null}

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

function Key({children, wide}: Readonly<{children: React.ReactNode; wide?: boolean}>) {
    return (
        <kbd
            className={`pixel inline-grid place-items-center rounded border-2 border-[#4a4270] bg-[#221c3d] text-[7px] text-ink ${
                wide ? "h-5 px-2" : "h-5 w-5"
            }`}
        >
            {children}
        </kbd>
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

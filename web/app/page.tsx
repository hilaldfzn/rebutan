import Link from "next/link";

import {Arena, CrownMark} from "@/components/Arena";
import {LiveBlockTicker} from "@/components/LiveBlockTicker";
import {LiveStats} from "@/components/LiveStats";
import {TIERS} from "@/lib/game";
import {
    CHAIN_ID,
    FORTIFY_COST_BLOCKS,
    FORTIFY_PROTECT_BLOCKS,
    MIN_REIGN_BLOCKS,
    STAKE_MON,
    addressUrl,
    envContractAddress,
    short,
} from "@/lib/constants";

const REPO = "https://github.com/hilaldfzn/rebutan";

export default function Landing() {
    const contract = envContractAddress();

    return (
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-20 px-5 py-10 sm:gap-28 sm:py-16">
            {/* ── HERO ─────────────────────────────────────────────────────
                Asymmetric on purpose: copy left, arena right, the arena
                bleeding slightly larger than its column. A centred hero with a
                screenshot underneath is the SaaS default and reads as a product
                page; this should read as a cabinet. */}
            <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-3">
                        <CrownMark className="h-8 w-8 text-crown" />
                        <span className="display text-sm uppercase tracking-widest text-crown">
                            Rebutan
                        </span>
                    </div>

                    <h1 className="display stroked text-5xl uppercase text-ink sm:text-6xl">
                        Grab the
                        <br />
                        <span className="text-crown">crown.</span>
                        <br />
                        Hold it.
                    </h1>

                    <p className="max-w-md text-lg leading-relaxed text-ink-muted">
                        A whole room is coming for one crown. Every block you keep it, you get
                        paid. Blink and it&rsquo;s gone.
                    </p>

                    <div className="flex flex-wrap items-center gap-4">
                        <Link
                            href="/play"
                            className="slab pressable display rounded-none bg-crown px-8 py-4 text-lg uppercase text-outline"
                        >
                            Play now
                        </Link>
                        <span className="slab-sm bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                            {STAKE_MON} MON · testnet
                        </span>
                    </div>
                </div>

                <div className="relative">
                    <Arena className="w-full drop-shadow-[8px_8px_0_var(--outline)]" holderSeat={3} />
                    <div className="slab-sm absolute -bottom-2 left-1/2 -translate-x-1/2 bg-magenta px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-outline">
                        5 hunting · 1 holding
                    </div>
                </div>
            </section>

            {/* ── LIVE SCOREBOARD ──────────────────────────────────────── */}
            <section className="flex flex-col gap-5">
                <Banner color="bg-violet">Live on chain right now</Banner>
                <LiveStats />
            </section>

            {/* ── MOVES ────────────────────────────────────────────────────
                Colour-coded to match the arena: magenta attacks, cyan defends,
                crown is what you are fighting over. */}
            <section className="flex flex-col gap-6">
                <Banner color="bg-magenta">Three moves</Banner>

                <div className="grid gap-6 sm:grid-cols-3">
                    <Move
                        index="01"
                        title="Steal"
                        tag="attack"
                        color="bg-magenta"
                        rotate="-rotate-1"
                        body="Rip the crown off whoever has it. Free — but every steal you make grows your OWN cooldown. Running out of MON can never knock you out. Running out of patience can."
                    />
                    <Move
                        index="02"
                        title="Fortify"
                        tag="defend"
                        color="bg-cyan"
                        rotate="rotate-1"
                        body={`Bolt the crown down for ${FORTIFY_PROTECT_BLOCKS} blocks — and pay ${FORTIFY_COST_BLOCKS} blocks of earnings for the privilege. Turtle up, or stay greedy and stay exposed.`}
                    />
                    <Move
                        index="03"
                        title="Surge"
                        tag="1× → 2× → 3×"
                        color="bg-crown"
                        rotate="-rotate-1"
                        body="Three zones, and the last one pays triple. Whatever happened in the opening barely matters. The endgame is where the crown gets expensive."
                    />
                </div>

                <p className="slab-sm bg-surface px-4 py-3 text-sm text-ink-muted">
                    A fresh crown is untouchable for {MIN_REIGN_BLOCKS} blocks — the same beat
                    Monad already throttles small accounts at. The scramble stays human, not a bot
                    war.
                </p>
            </section>

            {/* ── WIN CONDITIONS ─────────────────────────────────────────── */}
            <section className="flex flex-col gap-6">
                <Banner color="bg-crown">Two ways to win. Pick a side.</Banner>

                <div className="grid items-stretch gap-6 sm:grid-cols-[1fr_auto_1fr]">
                    <Split
                        share="70%"
                        title="The Grinder"
                        body="Split across everyone by total blocks held. Steal constantly. Bank a hundred short reigns and let them add up."
                        color="text-crown"
                        rotate="-rotate-1"
                    />
                    <div className="flex items-center justify-center">
                        <span className="display stroked text-3xl text-magenta">VS</span>
                    </div>
                    <Split
                        share="30%"
                        title="The Tyrant"
                        body="Winner takes all, to the single longest unbroken reign. Sit on your steals. Take it late. Refuse to let go."
                        color="text-cyan"
                        rotate="rotate-1"
                    />
                </div>

                <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
                    You can&rsquo;t chase both. And since one player&rsquo;s streak is worth 30% of
                    the pot, smashing someone else&rsquo;s reign pays off even when you gain
                    nothing yourself — which is the moment this stops being a scramble and turns
                    into a grudge.
                </p>
            </section>

            {/* ── RANKS ────────────────────────────────────────────────────── */}
            <section className="flex flex-col gap-6">
                <Banner color="bg-cyan">Ranks — they never reset</Banner>

                <div className="grid gap-3 sm:grid-cols-5">
                    {TIERS.map((t, i) => (
                        <div
                            key={t.name}
                            className={`slab-sm flex flex-col gap-1 px-3 py-4 text-center ${
                                i === TIERS.length - 1 ? "bg-crown text-outline" : "bg-surface"
                            }`}
                        >
                            <span className="display text-xs uppercase">{t.name}</span>
                            <span
                                className={`tabular-nums text-[11px] ${
                                    i === TIERS.length - 1 ? "text-outline/70" : "text-ink-faint"
                                }`}
                            >
                                {t.at === 0n ? "start" : `${t.at.toLocaleString("en-US")}+`}
                            </span>
                        </div>
                    ))}
                </div>

                <p className="text-sm text-ink-muted">
                    Every block you have ever held stacks against your address forever. Can&rsquo;t
                    be bought, traded, or reset. Pure bragging rights — a Tyrant and a first-timer
                    steal on exactly the same terms.
                </p>
            </section>

            {/* ── THE CHAIN BIT ───────────────────────────────────────────
                Deliberately last and deliberately quiet. The gameplay has to
                land first; this is the receipt, not the pitch. */}
            <section className="slab flex flex-col gap-4 bg-surface p-7">
                <span className="display text-xs uppercase tracking-widest text-violet">
                    The technical bit, briefly
                </span>

                <p className="text-lg leading-relaxed text-ink">
                    We couldn&rsquo;t measure this game in seconds.
                </p>
                <p className="max-w-2xl leading-relaxed text-ink-muted">
                    Monad makes a block every ~400ms, but{" "}
                    <code className="bg-ground px-1.5 py-0.5 text-sm text-cyan">block.timestamp</code>{" "}
                    only resolves to whole seconds — two or three blocks share one. Scoring in
                    seconds would flatten most reigns to zero. So the payout counts{" "}
                    <strong className="text-crown">blocks</strong>, and the chain&rsquo;s own pulse
                    became the unit of account. On a twelve-second chain this game doesn&rsquo;t get
                    worse; it stops existing.
                </p>
                <LiveBlockTicker />
            </section>

        </main>
    );
}

function Banner({children, color}: Readonly<{children: React.ReactNode; color: string}>) {
    return (
        <h2 className={`slab display inline-block w-fit -rotate-1 px-4 py-2 text-xl uppercase text-outline sm:text-2xl ${color}`}>
            {children}
        </h2>
    );
}

function Move({
    index,
    title,
    tag,
    body,
    color,
    rotate,
}: Readonly<{index: string; title: string; tag: string; body: string; color: string; rotate: string}>) {
    return (
        <div className={`slab flex flex-col gap-3 bg-arena p-5 ${rotate}`}>
            <div className="flex items-center justify-between">
                <span className="display text-2xl tabular-nums text-ink-faint">{index}</span>
                <span className={`slab-sm px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-outline ${color}`}>
                    {tag}
                </span>
            </div>
            <h3 className="display text-2xl uppercase text-ink">{title}</h3>
            <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
        </div>
    );
}

function Split({
    share,
    title,
    body,
    color,
    rotate,
}: Readonly<{share: string; title: string; body: string; color: string; rotate: string}>) {
    return (
        <div className={`slab flex flex-col gap-2 bg-arena p-6 ${rotate}`}>
            <span className={`display stroked text-5xl tabular-nums ${color}`}>{share}</span>
            <h3 className="display text-lg uppercase text-ink">{title}</h3>
            <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
        </div>
    );
}

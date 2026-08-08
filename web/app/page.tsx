import Link from "next/link";

import {Crown, TickField} from "@/components/Crown";
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
        <div className="relative overflow-hidden">
            {/* Texture, not decoration: large dark areas go dead flat on a projector. */}
            <TickField className="pointer-events-none absolute inset-0 h-full w-full text-violet opacity-[0.07]" />

            <main className="relative mx-auto flex w-full max-w-3xl flex-col gap-24 px-6 py-16 sm:py-24">
                {/* ── Hero ─────────────────────────────────────────────────── */}
                <section className="flex flex-col gap-8">
                    <div className="flex items-center gap-3">
                        <Crown className="h-7 w-7 text-crown" />
                        <span className="text-sm font-bold uppercase tracking-[0.32em] text-ink-muted">
                            Rebutan
                        </span>
                    </div>

                    <h1 className="display text-5xl text-ink sm:text-7xl">
                        One crown.
                        <br />
                        <span className="text-crown">You are paid</span>
                        <br />
                        by the block.
                    </h1>

                    <p className="max-w-xl text-lg leading-relaxed text-ink-muted">
                        Everyone in the room is fighting over a single position on Monad. Every
                        block you keep it, you earn a share of the pot. Lose it and your blocks
                        bank — then you wait for your moment.
                    </p>

                    {/* The claim, verifying itself while you read the sentence under it. */}
                    <div className="flex flex-col gap-2 border-l-2 border-crown-dim pl-5">
                        <LiveBlockTicker />
                        <p className="text-sm text-ink-muted">
                            Monad testnet, climbing every <strong className="text-ink">400ms</strong>.
                            That number is not a decoration — it is the unit this game pays in.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-2">
                        <Link
                            href="/play"
                            className="rounded-xl bg-crown px-7 py-4 text-base font-bold text-ground transition-colors hover:bg-[#ffc257]"
                        >
                            Enter the scramble
                        </Link>
                        <span className="text-sm text-ink-faint">
                            {STAKE_MON} MON to join · testnet only
                        </span>
                    </div>
                </section>

                {/* ── Live session ─────────────────────────────────────────── */}
                <section className="flex flex-col gap-5">
                    <SectionLabel eyebrow="right now">The session on chain</SectionLabel>
                    <LiveStats />
                </section>

                {/* ── The rule ─────────────────────────────────────────────── */}
                <section className="flex flex-col gap-8">
                    <SectionLabel eyebrow="how it plays">Three moves</SectionLabel>

                    <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
                        <Mechanic
                            index="01"
                            title="Steal"
                            cost="gas only"
                            body={`Take the crown from whoever has it. Free — but every steal you make lengthens your own cooldown by three blocks. Steals are rationed by time, never by money, so running low on MON can't eliminate you.`}
                        />
                        <Mechanic
                            index="02"
                            title="Fortify"
                            cost={`+${FORTIFY_PROTECT_BLOCKS} / −${FORTIFY_COST_BLOCKS}`}
                            body={`Holding used to be passive. Now you can buy ${FORTIFY_PROTECT_BLOCKS} blocks of protection by forfeiting ${FORTIFY_COST_BLOCKS} blocks of earnings. Defend a lead, or stay exposed and keep earning at full rate.`}
                        />
                        <Mechanic
                            index="03"
                            title="Stages"
                            cost="1× → 2× → 3×"
                            body="The session runs in three stages and each one pays more than the last. Falling behind early is recoverable, and the final third decides almost everything."
                        />
                    </div>

                    <p className="text-sm text-ink-faint">
                        A freshly taken crown is protected for {MIN_REIGN_BLOCKS} blocks — the same
                        cadence Monad already throttles low-balance accounts at, so the scramble
                        stays at human speed instead of becoming a bot war.
                    </p>
                </section>

                {/* ── Two ways to win ──────────────────────────────────────── */}
                <section className="flex flex-col gap-8">
                    <SectionLabel>Two ways to win, and they disagree</SectionLabel>

                    <div className="grid gap-6 sm:grid-cols-2">
                        <Split
                            share="70%"
                            title="Endurance"
                            body="Split pro-rata across everyone, by total stage-weighted blocks held. Steal often, bank many short reigns."
                            accent="text-crown"
                        />
                        <Split
                            share="30%"
                            title="The Long Reign"
                            body="Winner takes all, to the single longest unbroken reign. Hoard your steals, take it late, and hold on."
                            accent="text-violet"
                        />
                    </div>

                    <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
                        You cannot chase both. And because one player&rsquo;s streak is worth 30% of
                        the pot, breaking someone else&rsquo;s reign is worth doing even when it
                        earns you nothing — which is where the game stops being a scramble and
                        starts being an argument.
                    </p>
                </section>

                {/* ── Why Monad ────────────────────────────────────────────── */}
                <section className="flex flex-col gap-6 rounded-2xl border border-violet-dim/50 bg-surface p-8">
                    <SectionLabel>Why this only works here</SectionLabel>

                    <p className="text-lg leading-relaxed text-ink">
                        We could not measure this game in seconds.
                    </p>
                    <p className="max-w-2xl leading-relaxed text-ink-muted">
                        Monad produces a block roughly every 400&nbsp;milliseconds, and{" "}
                        <code className="rounded bg-ground px-1.5 py-0.5 text-sm text-violet">
                            block.timestamp
                        </code>{" "}
                        only has one-second resolution — so two or three consecutive blocks carry
                        the same timestamp. Scoring in seconds would collapse most reigns to zero
                        and tie the rest. So the payout is denominated in <strong className="text-ink">blocks</strong>,
                        and the chain&rsquo;s own cadence became the unit of account.
                    </p>
                    <p className="max-w-2xl leading-relaxed text-ink-muted">
                        That decision does not exist on a twelve-second chain. Neither does the
                        game: you would spend twelve seconds not knowing whether you were still
                        king. It would not degrade — it would stop being playable.
                    </p>
                </section>

                {/* ── Progression ──────────────────────────────────────────── */}
                <section className="flex flex-col gap-6">
                    <SectionLabel eyebrow="what survives the session">The Reign Record</SectionLabel>

                    <p className="max-w-2xl leading-relaxed text-ink-muted">
                        Sessions end and pots are paid out, but every block you have ever held
                        accumulates against your address permanently. It cannot be transferred,
                        bought, or reset — the only way to move up is to have actually held the
                        crown while people were trying to take it from you.
                    </p>

                    <div className="rounded-2xl border border-line bg-surface px-6 py-2">
                        {TIERS.map((t, i) => (
                            <TierRow
                                key={t.name}
                                name={t.name}
                                at={t.at}
                                isLast={i === TIERS.length - 1}
                            />
                        ))}
                    </div>

                    <p className="text-sm text-ink-faint">
                        Status only. A tier never grants a mechanical advantage — a newcomer and a
                        Tyrant steal on exactly the same terms.
                    </p>
                </section>

                {/* ── Footer ───────────────────────────────────────────────── */}
                <footer className="flex flex-col gap-4 border-t border-line pt-8 text-sm">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-ink-faint">
                        <span>Monad Testnet · chain {CHAIN_ID}</span>
                        {contract ? (
                            <a
                                className="text-ink-muted underline decoration-line underline-offset-4 hover:text-ink"
                                href={addressUrl(contract)}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {short(contract)}
                            </a>
                        ) : null}
                        <a
                            className="text-ink-muted underline decoration-line underline-offset-4 hover:text-ink"
                            href={REPO}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Source
                        </a>
                    </div>
                    <p className="text-ink-faint">
                        No token. No admin key. No privileged withdrawal. Built at Monad Blitz
                        Jakarta.
                    </p>
                </footer>
            </main>
        </div>
    );
}

/**
 * Section headings carry weight rather than whispering.
 *
 * The earlier treatment was a small tracked-out label — tasteful and forgettable.
 * A room reading this on a phone between demos needs the structure to be
 * scannable at a glance, so headings are set large and uppercase with the eyebrow
 * demoted to a supporting line.
 */
function SectionLabel({
    children,
    eyebrow,
}: Readonly<{children: React.ReactNode; eyebrow?: string}>) {
    return (
        <div className="flex flex-col gap-2">
            {eyebrow ? (
                <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-violet">
                    {eyebrow}
                </span>
            ) : null}
            <h2 className="display text-3xl uppercase text-ink sm:text-4xl">{children}</h2>
        </div>
    );
}

function Mechanic({
    index,
    title,
    cost,
    body,
}: Readonly<{index: string; title: string; cost: string; body: string}>) {
    return (
        <div className="flex flex-col gap-3 bg-ground p-6">
            {/* Numbered steps: the reader should be able to tell how many ideas
                they have to hold before committing to reading any of them. */}
            <span className="display text-2xl tabular-nums text-violet-dim">{index}</span>
            <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xl font-bold text-ink">{title}</h3>
                <span className="text-[11px] uppercase tracking-wider text-ink-faint">{cost}</span>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
        </div>
    );
}

function TierRow({
    name,
    at,
    isLast,
}: Readonly<{name: string; at: bigint; isLast: boolean}>) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-3">
            <span className={`text-base font-bold ${isLast ? "text-crown" : "text-ink"}`}>
                {name}
            </span>
            <span className="flex-1 border-b border-dashed border-line" />
            <span className="tabular-nums text-sm text-ink-muted">
                {at === 0n ? "from the first block" : `${at.toLocaleString("en-US")} blocks`}
            </span>
        </div>
    );
}

function Split({
    share,
    title,
    body,
    accent,
}: Readonly<{share: string; title: string; body: string; accent: string}>) {
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-7">
            <span className={`display text-5xl tabular-nums ${accent}`}>{share}</span>
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
        </div>
    );
}

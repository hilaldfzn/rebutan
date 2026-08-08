"use client";

import {ZERO_ADDRESS, currentStage, formatMon} from "@/lib/game";
import {short} from "@/lib/constants";
import {useLiveBlock, useRebutan} from "@/lib/useRebutan";

/**
 * A live band of real session state on the landing page.
 *
 * Borrowed device: PassChick puts real-time counts on its marketing page, and it
 * works — a static explainer asks you to believe a game exists, whereas a pot
 * that is climbing while you read proves it. The numbers here come from the
 * contract, not a CMS, so an empty session reads honestly as empty rather than
 * being dressed up with placeholder figures.
 */
export function LiveStats() {
    const block = useLiveBlock();
    const g = useRebutan();
    const s = g.session;

    const stage = s ? currentStage(s, block) : 0;
    const over = Boolean(s && block >= s.endsAt);
    const contested = Boolean(s && s.holder !== ZERO_ADDRESS);

    let status = "no session";
    if (s && over) status = "session closed";
    else if (s && contested) status = `stage ${stage} · ${stage}×`;
    else if (s) status = "unclaimed";

    return (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Cell label="prize pot" value={s ? formatMon(s.pot, 2) : "—"} unit="MON" accent="bg-crown" />
            <Cell label="fighters" value={s ? String(s.players) : "—"} accent="bg-magenta" />
            <Cell
                label="wearing it"
                value={s && contested ? short(s.holder) : "nobody"}
                accent="bg-cyan"
                small
            />
            <Cell label="zone" value={status} accent="bg-violet" small />
        </dl>
    );
}

function Cell({
    label,
    value,
    unit,
    accent,
    small,
}: Readonly<{label: string; value: string; unit?: string; accent: string; small?: boolean}>) {
    return (
        <div className="slab flex flex-col bg-arena">
            <dt
                className={`display px-3 py-1.5 text-[10px] uppercase tracking-widest text-outline ${accent}`}
            >
                {label}
            </dt>
            <dd
                className={`px-3 py-4 tabular-nums text-ink ${
                    small ? "text-base font-bold" : "display text-2xl"
                }`}
            >
                {value}
                {unit ? <span className="ml-1 text-[11px] text-ink-faint">{unit}</span> : null}
            </dd>
        </div>
    );
}

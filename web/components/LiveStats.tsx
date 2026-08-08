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
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            <Cell label="pot" value={s ? formatMon(s.pot, 2) : "—"} unit="MON" />
            <Cell label="players" value={s ? String(s.players) : "—"} />
            <Cell
                label="holder"
                value={s && contested ? short(s.holder) : "—"}
                tone={contested && !over ? "text-crown" : undefined}
            />
            <Cell label="status" value={status} small />
        </dl>
    );
}

function Cell({
    label,
    value,
    unit,
    tone,
    small,
}: Readonly<{label: string; value: string; unit?: string; tone?: string; small?: boolean}>) {
    return (
        <div className="bg-ground px-5 py-4">
            <dd className={`tabular-nums ${small ? "text-base" : "text-2xl"} ${tone ?? "text-ink"}`}>
                {value}
                {unit ? <span className="ml-1 text-[11px] text-ink-faint">{unit}</span> : null}
            </dd>
            <dt className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">
                {label}
            </dt>
        </div>
    );
}

"use client";

import {useLiveBlock} from "@/lib/useRebutan";

/**
 * The hero's whole argument, running live.
 *
 * The page could assert "Monad produces a block every 400ms". Instead it shows
 * the height climbing while you read the sentence — the claim verifies itself in
 * front of the reader, which is the one thing a landing page can do that a slide
 * cannot. It is also the smallest possible client island: everything else on the
 * page stays a server component.
 */
export function LiveBlockTicker() {
    const block = useLiveBlock();
    const ready = block > 0n;

    return (
        <div className="flex items-baseline gap-3">
            <span
                className={`display tabular-nums text-5xl sm:text-6xl ${
                    ready ? "text-crown" : "text-ink-faint"
                }`}
            >
                {ready ? block.toString() : "———————"}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-ink-faint">
                {ready ? "live block" : "connecting"}
            </span>
        </div>
    );
}

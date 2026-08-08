/**
 * Client-side mirror of the contract's scoring maths.
 *
 * The crown's earnings must tick every ~400ms. Asking the chain for that on
 * every block would be both slow and pointless: the inputs (`since`, the stage
 * boundaries) only change when someone acts, so the value between actions is
 * pure arithmetic on the current block height. We read the session once, then
 * compute locally and re-read on events.
 *
 * These functions MUST agree with `_weightedBlocks` in Rebutan.sol. If you
 * change one, change both — a mismatch shows the room a number the chain will
 * not honour, which is worse than showing nothing.
 */

export type Session = {
    startBlock: bigint;
    stage2At: bigint;
    stage3At: bigint;
    endsAt: bigint;
    holder: `0x${string}`;
    since: bigint;
    reignStart: bigint;
    protectedUntil: bigint;
    fortified: boolean;
    settled: boolean;
    pot: bigint;
    totalWeighted: bigint;
    bestReign: bigint;
    bestReignHolder: `0x${string}`;
    players: number;
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const overlap = (a0: bigint, a1: bigint, b0: bigint, b1: bigint): bigint => {
    const lo = a0 > b0 ? a0 : b0;
    const hi = a1 < b1 ? a1 : b1;
    return hi > lo ? hi - lo : 0n;
};

/** Blocks in [from, to) weighted 1x / 2x / 3x by stage. Mirrors the contract. */
export function weightedBlocks(s: Session, from: bigint, to: bigint): bigint {
    if (to <= from) return 0n; // inverted range after FORTIFY earns nothing
    return (
        overlap(from, to, s.startBlock, s.stage2At) +
        overlap(from, to, s.stage2At, s.stage3At) * 2n +
        overlap(from, to, s.stage3At, s.endsAt) * 3n
    );
}

/** Weighted blocks the current holder would bank if dethroned at `block`. */
export function pendingWeighted(s: Session, block: bigint): bigint {
    if (s.holder === ZERO_ADDRESS) return 0n;
    const upTo = block < s.endsAt ? block : s.endsAt;
    return weightedBlocks(s, s.since, upTo);
}

/** Raw, unweighted blocks the holder has held without interruption. */
export function rawReign(s: Session, block: bigint): bigint {
    if (s.holder === ZERO_ADDRESS) return 0n;
    const upTo = block < s.endsAt ? block : s.endsAt;
    return upTo > s.reignStart ? upTo - s.reignStart : 0n;
}

export function currentStage(s: Session, block: bigint): 0 | 1 | 2 | 3 {
    if (block >= s.endsAt) return 0;
    if (block >= s.stage3At) return 3;
    if (block >= s.stage2At) return 2;
    return 1;
}

/** Blocks until the next stage begins. Null when already in the final stage. */
export function blocksToNextStage(s: Session, block: bigint): bigint | null {
    if (block < s.stage2At) return s.stage2At - block;
    if (block < s.stage3At) return s.stage3At - block;
    return null;
}

/**
 * Live estimate of a player's endurance share, in wei.
 *
 * Deliberately an ESTIMATE: it counts the holder's in-flight reign, which the
 * contract has not banked yet. Label it as such in the UI — presenting a
 * provisional number as settled is how a demo ends up arguing with its own
 * block explorer.
 */
export function estimatedPayout(
    s: Session,
    player: `0x${string}` | undefined,
    bankedWeighted: bigint,
    block: bigint,
    enduranceBps: bigint,
    longReignBps: bigint,
): bigint {
    if (!player) return 0n;

    const inFlight = s.holder.toLowerCase() === player.toLowerCase() ? pendingWeighted(s, block) : 0n;
    const mine = bankedWeighted + inFlight;
    const total = s.totalWeighted + pendingWeighted(s, block);
    if (total === 0n || mine === 0n) return 0n;

    let amount = (s.pot * enduranceBps * mine) / (10_000n * total);

    // The long-reign bonus is only meaningful once settled; before that it is a
    // projection of who is currently ahead.
    const raw = rawReign(s, block);
    const leadsLongReign =
        s.bestReignHolder.toLowerCase() === player.toLowerCase() ||
        (s.holder.toLowerCase() === player.toLowerCase() && raw > s.bestReign);
    if (leadsLongReign) amount += (s.pot * longReignBps) / 10_000n;

    return amount;
}

/** MON, trimmed to a fixed number of decimals without scientific notation. */
export function formatMon(wei: bigint, decimals = 4): string {
    const whole = wei / 10n ** 18n;
    const frac = wei % 10n ** 18n;
    const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
    return `${whole}.${fracStr}`;
}

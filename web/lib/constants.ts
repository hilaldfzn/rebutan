/**
 * Single source of truth for every network value, protocol constant, and game
 * parameter the UI needs. No bare literals for these anywhere else in the app —
 * a magic `10143` or `0.1` scattered through components is how a demo ends up
 * pointing at the wrong chain at 17:00.
 *
 * Game constants MIRROR the contract. If you change one in Rebutan.sol, change
 * it here in the same commit.
 */

// ── Network ──────────────────────────────────────────────────────────────────
export const CHAIN_ID = 10143;
export const RPC_URL = "https://testnet-rpc.monad.xyz";
export const RPC_FALLBACK = "https://rpc.ankr.com/monad_testnet";
export const EXPLORER_URL = "https://testnet.monadscan.com";

/** Monad's nominal block time. The UI's whole rhythm is derived from this. */
export const BLOCK_MS = 400;

// ── Game constants (mirror Rebutan.sol) ──────────────────────────────────────
/** Fixed entry stake, in MON. Never escalates (CON-005). */
export const STAKE_MON = "0.1";
/** Blocks a freshly taken crown cannot be stolen. Matches the ~1.2s reserve-balance throttle. */
export const MIN_REIGN_BLOCKS = 3;
/** Each steal you make adds this many blocks to your own cooldown. */
export const COOLDOWN_STEP_BLOCKS = 3;
/** FORTIFY: blocks of protection bought... */
export const FORTIFY_PROTECT_BLOCKS = 8;
/** ...and blocks of earnings forfeited to buy them. */
export const FORTIFY_COST_BLOCKS = 4;
/** Stage multipliers applied to blocks held, by third of the session. */
export const STAGE_MULTIPLIERS = [1, 2, 3] as const;
/** Pot split, in basis points: endurance (pro-rata) vs single longest reign. */
export const ENDURANCE_SHARE_BPS = 7000;
export const LONG_REIGN_SHARE_BPS = 3000;

// ── Contract address resolution ──────────────────────────────────────────────
/**
 * Resolves in two tiers so a mid-event redeploy never requires a Vercel rebuild:
 *   1. `?contract=0x...`  — instant override, survives a bad deploy
 *   2. NEXT_PUBLIC_CONTRACT_ADDRESS — build-time inlined, the normal path
 *
 * Returns null rather than throwing: the app must still render the rules and an
 * explanatory empty state when no contract is configured yet.
 */
const isAddress = (v: string | null | undefined): v is `0x${string}` =>
  Boolean(v) && /^0x[0-9a-fA-F]{40}$/.test(v as string);

/**
 * Tier 2 only, safe to call during SSR.
 *
 * The server render must already know the address, or the first paint shows the
 * "no contract configured" empty state and then flips — which looks like a
 * broken app on the projector for the length of a hydration.
 */
export function envContractAddress(): `0x${string}` | null {
  const v = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  return isAddress(v) ? v : null;
}

export function resolveContractAddress(search?: string): `0x${string}` | null {
  const fromQuery =
    typeof window !== "undefined"
      ? new URLSearchParams(search ?? window.location.search).get("contract")
      : null;

  return isAddress(fromQuery) ? fromQuery : envContractAddress();
}

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER_URL}/address/${addr}`;

/** Truncate an address for display: 0x5B0d…0784 */
export const short = (addr?: string) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";

"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {useBlockNumber, useConnection, useReadContracts} from "wagmi";

import {rebutanAbi} from "./abi";
import {BLOCK_MS, envContractAddress, resolveContractAddress} from "./constants";
import type {Session} from "./game";

/**
 * The contract address, resolved once on mount.
 *
 * Deliberately stateful rather than computed at module scope: `?contract=` is
 * only readable in the browser, and reading it during SSR would bake the wrong
 * value into the prerendered HTML.
 */
export function useContractAddress() {
    // Seeded from the build-time env so the server render already has it, then
    // upgraded on mount if `?contract=` overrides it. Starting from null instead
    // would flash the "no contract configured" empty state on every load.
    const [address, setAddress] = useState<`0x${string}` | null>(envContractAddress);
    useEffect(() => setAddress(resolveContractAddress()), []);
    return address;
}

/**
 * A block height that advances smoothly at Monad's cadence.
 *
 * Polling the RPC every 400ms would be the obvious approach and the wrong one:
 * the public endpoint allows 50 req/s, and thirty phones in a room polling that
 * fast would exhaust it during the demo. Instead we poll once a second and
 * interpolate between samples, because block production is a metronome — the
 * estimate is right far more often than it is wrong, and every sample snaps it
 * back to truth.
 */
export function useLiveBlock() {
    const {data: fetched} = useBlockNumber({
        watch: true,
        query: {refetchInterval: 1000},
    });

    const [display, setDisplay] = useState<bigint>(0n);
    const lastSample = useRef<{block: bigint; at: number} | null>(null);

    useEffect(() => {
        if (fetched === undefined) return;
        lastSample.current = {block: fetched, at: Date.now()};
        // Snap forward only. Going backwards would make the counter stutter, and
        // a counter that jitters reads as broken from the back of a room.
        setDisplay((prev) => (fetched > prev ? fetched : prev));
    }, [fetched]);

    useEffect(() => {
        const id = setInterval(() => {
            const sample = lastSample.current;
            if (!sample) return;
            const elapsed = BigInt(Math.floor((Date.now() - sample.at) / BLOCK_MS));
            const estimate = sample.block + elapsed;
            setDisplay((prev) => (estimate > prev ? estimate : prev));
        }, BLOCK_MS);
        return () => clearInterval(id);
    }, []);

    return display;
}

export type RebutanState = {
    address: `0x${string}` | null;
    sessionId: number;
    session: Session | null;
    joined: boolean;
    bankedWeighted: bigint;
    claimed: boolean;
    cooldownRemaining: bigint;
    protectionRemaining: bigint;
    reignRecord: bigint;
    stake: bigint;
    enduranceBps: bigint;
    longReignBps: bigint;
    isLoading: boolean;
    refetch: () => void;
};

/** Every read the UI needs, batched into one multicall and refreshed per block. */
export function useRebutan(): RebutanState {
    const contract = useContractAddress();
    const {address: player} = useConnection();
    const block = useLiveBlock();

    const base = useMemo(
        () => ({address: contract ?? undefined, abi: rebutanAbi} as const),
        [contract],
    );

    const session = useReadContracts({
        contracts: [
            {...base, functionName: "current"},
            {...base, functionName: "sessionId"},
            {...base, functionName: "STAKE"},
            {...base, functionName: "ENDURANCE_BPS"},
            {...base, functionName: "LONG_REIGN_BPS"},
            {...base, functionName: "protectionRemaining"},
        ],
        query: {enabled: Boolean(contract), refetchInterval: 2000},
    });

    const sid = session.data?.[1]?.result as number | undefined;

    const personal = useReadContracts({
        contracts: [
            {...base, functionName: "joined", args: [sid ?? 0, player ?? "0x0"]},
            {...base, functionName: "weightedHeld", args: [sid ?? 0, player ?? "0x0"]},
            {...base, functionName: "claimed", args: [sid ?? 0, player ?? "0x0"]},
            {...base, functionName: "cooldownRemaining", args: [player ?? "0x0"]},
            {...base, functionName: "reignRecord", args: [player ?? "0x0"]},
        ],
        query: {enabled: Boolean(contract && player && sid !== undefined), refetchInterval: 2000},
    });

    const refetch = () => {
        void session.refetch();
        void personal.refetch();
    };

    // Re-read on every new block so another player's steal lands within ~1 block
    // (REQ-018) without waiting for the slower refetchInterval.
    const lastBlock = useRef(0n);
    useEffect(() => {
        if (block > lastBlock.current) {
            lastBlock.current = block;
            void session.refetch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [block]);

    return {
        address: contract,
        sessionId: sid ?? 0,
        session: (session.data?.[0]?.result as Session | undefined) ?? null,
        joined: Boolean(personal.data?.[0]?.result),
        bankedWeighted: (personal.data?.[1]?.result as bigint | undefined) ?? 0n,
        claimed: Boolean(personal.data?.[2]?.result),
        cooldownRemaining: (personal.data?.[3]?.result as bigint | undefined) ?? 0n,
        protectionRemaining: (session.data?.[5]?.result as bigint | undefined) ?? 0n,
        reignRecord: (personal.data?.[4]?.result as bigint | undefined) ?? 0n,
        stake: (session.data?.[2]?.result as bigint | undefined) ?? 0n,
        enduranceBps: (session.data?.[3]?.result as bigint | undefined) ?? 7000n,
        longReignBps: (session.data?.[4]?.result as bigint | undefined) ?? 3000n,
        isLoading: session.isLoading,
        refetch,
    };
}

"use client";

import {useEffect, useState} from "react";
import {parseAbiItem} from "viem";
import {usePublicClient} from "wagmi";

import {useContractAddress} from "./useRebutan";

const JOINED = parseAbiItem(
    "event Joined(uint32 indexed session, address indexed player, uint256 pot, uint32 players)",
);

/**
 * Everyone who has joined the current session, so the arena can seat real
 * addresses instead of six decorative blobs.
 *
 * Read from `Joined` logs rather than an indexer — the contract emits the roster
 * and one `getLogs` call reconstructs it, which keeps the "no backend" property
 * intact. If the RPC refuses the range (providers cap how far back you may scan)
 * the arena falls back to seating whoever we do know about; an empty roster is a
 * degraded visual, never a broken page.
 */
export function useSessionPlayers(sessionId: number, fromBlock: bigint | undefined) {
    const client = usePublicClient();
    const contract = useContractAddress();
    const [players, setPlayers] = useState<`0x${string}`[]>([]);

    useEffect(() => {
        if (!client || !contract || !sessionId || fromBlock === undefined) return;
        let cancelled = false;

        (async () => {
            try {
                const logs = await client.getLogs({
                    address: contract,
                    event: JOINED,
                    args: {session: sessionId},
                    fromBlock,
                    toBlock: "latest",
                });
                if (cancelled) return;
                const seen = new Set<string>();
                const list: `0x${string}`[] = [];
                for (const log of logs) {
                    const p = log.args.player;
                    if (p && !seen.has(p.toLowerCase())) {
                        seen.add(p.toLowerCase());
                        list.push(p);
                    }
                }
                setPlayers(list);
            } catch {
                // Range rejected or RPC hiccup — keep whatever we had.
            }
        })();

        return () => {
            cancelled = true;
        };
        // Re-scan on a slow cadence: joins are rare compared to steals, and this
        // is the most expensive call the client makes.
    }, [client, contract, sessionId, fromBlock]);

    return players;
}

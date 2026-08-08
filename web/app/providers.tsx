"use client";

import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useState, type ReactNode} from "react";
import {WagmiProvider} from "wagmi";

import {wagmiConfig} from "@/lib/wagmi";
import {BLOCK_MS} from "@/lib/constants";

export function Providers({children}: {children: ReactNode}) {
    // One client per mount, created lazily — a module-level QueryClient would be
    // shared across requests during SSR and leak one user's state into another's.
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // The chain moves every 400ms. Anything cached longer than a
                        // block is stale on arrival, and this app's whole claim is
                        // that the UI keeps up with the chain.
                        staleTime: BLOCK_MS,
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                },
            }),
    );

    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    );
}

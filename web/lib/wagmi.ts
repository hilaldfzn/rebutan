import {createConfig, http} from "wagmi";
import {monadTestnet} from "wagmi/chains";
import {injected} from "wagmi/connectors";

import {RPC_URL} from "./constants";

/**
 * Monad testnet only. No chain switcher, no multi-chain abstraction — the app
 * has exactly one home and anything else is a wrong-network error state.
 *
 * `injected()` alone is deliberate: every player in the room is a developer who
 * already has a wallet and a funded testnet account (that is why we skipped
 * embedded-wallet onboarding entirely). Adding WalletConnect later is a
 * one-line change if a phone without an injected wallet shows up.
 */
export const wagmiConfig = createConfig({
    chains: [monadTestnet],
    connectors: [injected()],
    transports: {
        [monadTestnet.id]: http(RPC_URL),
    },
    ssr: true,
});

declare module "wagmi" {
    interface Register {
        config: typeof wagmiConfig;
    }
}

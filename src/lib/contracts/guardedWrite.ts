"use client";

import type { useAccount, useWriteContract } from "wagmi";

// Some wallet bridges (notably Farcaster's, which hands off to whichever
// wallet is behind it) can silently fail to complete a chain switch and then
// never surface a signature prompt at all — see feedback_farcaster_chain_switch.
// Without a timeout, writeContractAsync just hangs forever with no error.
const WALLET_REQUEST_TIMEOUT_MS = 20_000;
const WALLET_TIMEOUT_MESSAGE =
  "Wallet didn't respond in time. This can happen when a wallet bridge (e.g. Farcaster's) loses sync with the connected network — try reconnecting your wallet or reopening the app.";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Wraps writeContractAsync with two safety nets proven necessary by real
 * Farcaster wallet-bridge failures: re-checks the connector's own live chain
 * ID right before sending (wagmi's reactive chainId can go stale if a bridge
 * silently fails to actually switch), then races the request against a hard
 * timeout instead of letting it hang forever.
 */
export function createGuardedWrite(
  account: ReturnType<typeof useAccount>,
  chainId: number,
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"]
) {
  return async (params: Parameters<typeof writeContractAsync>[0]) => {
    if (account.connector?.getChainId) {
      const liveChainId = await account.connector.getChainId().catch(() => chainId);
      if (liveChainId !== chainId) {
        throw new Error(
          `Wallet reports it's on chain ${liveChainId}, but this needs chain ${chainId}. Try reconnecting your wallet.`
        );
      }
    }
    return withTimeout(
      writeContractAsync(params),
      WALLET_REQUEST_TIMEOUT_MS,
      WALLET_TIMEOUT_MESSAGE
    );
  };
}

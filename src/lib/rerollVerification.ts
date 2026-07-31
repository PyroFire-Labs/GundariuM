/**
 * Verifies a claimed reroll payment before /api/generate-kitbash spends
 * money calling Gemini. Three checks, in order — cheapest and hardest to
 * fake first:
 *   1. Signature: does walletAddress actually control the signing key? A tx
 *      hash alone is publicly observable the moment it's broadcast (visible
 *      in the mempool before confirmation), so without this check anyone
 *      could submit someone else's pending reroll tx as their own.
 *   2. Already used: has this exact tx hash already paid for a generation?
 *   3. On-chain: is this really a successful call to RerollBurner that
 *      emitted a Rerolled event for this wallet?
 */

import {
  createPublicClient,
  http,
  parseEventLogs,
  TransactionReceiptNotFoundError,
} from "viem";
import { baseSepolia } from "viem/chains";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { REROLL_BURNER_ABI } from "@/lib/contracts/abis/RerollBurner";
import { buildRerollMessage } from "@/lib/rerollMessage";
import { REROLL_REASON } from "@/lib/rerollReasons";
import { isRerollStoreConfigured, isRerollTxConsumed } from "@/lib/rerollStore";
import { TARGET_CHAIN, TARGET_CHAIN_ID } from "@/lib/targetChain";

// Chain-aware (not hardcoded to mainnet): NEXT_PUBLIC_CHAIN_ID lets the exact
// same verification path run against Base Sepolia during manual dry-run
// testing (see Task 6) and against Base mainnet in production, without two
// copies of this logic. Resolved via the shared helper so this agrees with
// every client-side consumer on what "target chain" means — including the
// unset-env default.
const chain = TARGET_CHAIN;
const rpcUrl =
  TARGET_CHAIN_ID === baseSepolia.id
    ? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org"
    : process.env.BASE_RPC_URL || "https://mainnet.base.org";

const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

export async function verifyRerollPayment(params: {
  walletAddress: string;
  rerollTxHash: string;
  signature: string;
}): Promise<{ valid: boolean; reason?: string }> {
  const { walletAddress, rerollTxHash, signature } = params;

  let signatureValid = false;
  try {
    signatureValid = await publicClient.verifyMessage({
      address: walletAddress as `0x${string}`,
      message: buildRerollMessage(rerollTxHash),
      signature: signature as `0x${string}`,
    });
  } catch (err) {
    console.error(`Reroll signature verification threw for ${walletAddress}:`, err);
    return { valid: false, reason: REROLL_REASON.SIGNATURE_CHECK_FAILED };
  }
  if (!signatureValid) {
    return { valid: false, reason: REROLL_REASON.SIGNATURE_MISMATCH };
  }

  // Checked before isRerollTxConsumed, not merged into it. With Redis
  // unconfigured that helper fails CLOSED (returns "consumed"), which is the
  // right verdict but the wrong *reason*: "already used" is one of the
  // terminal reasons the client reacts to by forgetting the burn tx, so a
  // misconfigured deploy would make every payer discard a live 60,000 GNRM
  // burn and immediately pay again. This reason is deliberately non-terminal.
  if (!isRerollStoreConfigured()) {
    return { valid: false, reason: REROLL_REASON.STORE_UNAVAILABLE };
  }

  if (await isRerollTxConsumed(rerollTxHash)) {
    return { valid: false, reason: REROLL_REASON.ALREADY_USED };
  }

  const contracts = getContracts(chain.id);
  if (isPlaceholder(contracts.rerollBurner)) {
    return { valid: false, reason: REROLL_REASON.NOT_LIVE };
  }

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({
      hash: rerollTxHash as `0x${string}`,
    });
  } catch (err) {
    console.error(`Reroll tx receipt lookup failed for ${rerollTxHash}:`, err);
    // Split the two cases the old single reason conflated. viem throws
    // TransactionReceiptNotFoundError only when the RPC actually answered and
    // had no receipt — a verdict on the hash, and terminal client-side.
    // Anything else (transport error, provider outage) means we simply don't
    // know, so it must stay retryable: the client keeps the burn and tries
    // again rather than forfeiting a payment over a network blip.
    if (err instanceof TransactionReceiptNotFoundError) {
      return { valid: false, reason: REROLL_REASON.TX_NOT_FOUND };
    }
    return { valid: false, reason: REROLL_REASON.TX_LOOKUP_FAILED };
  }

  if (receipt.status !== "success") {
    return { valid: false, reason: REROLL_REASON.TX_FAILED };
  }

  const events = parseEventLogs({
    abi: REROLL_BURNER_ABI,
    logs: receipt.logs,
    eventName: "Rerolled",
  });
  // Match on the log's own emitting address rather than the top-level tx
  // `to` — for smart-contract-wallet callers, `to` is the user's account
  // contract or an ERC-4337 EntryPoint, with RerollBurner only called
  // internally, so the event's `address` field is the only reliable way to
  // confirm this was really a RerollBurner emission.
  const matchingEvent = events.find(
    (e) =>
      e.address.toLowerCase() === contracts.rerollBurner.toLowerCase() &&
      e.args.user.toLowerCase() === walletAddress.toLowerCase()
  );
  if (!matchingEvent) {
    return { valid: false, reason: REROLL_REASON.NO_MATCHING_EVENT };
  }

  return { valid: true };
}

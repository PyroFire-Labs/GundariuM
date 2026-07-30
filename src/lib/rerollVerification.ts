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

import { createPublicClient, http, parseEventLogs, verifyMessage } from "viem";
import { base, baseSepolia } from "viem/chains";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { REROLL_BURNER_ABI } from "@/lib/contracts/abis/RerollBurner";
import { buildRerollMessage } from "@/lib/rerollMessage";
import { isRerollTxConsumed } from "@/lib/rerollStore";

// Chain-aware (not hardcoded to mainnet): NEXT_PUBLIC_CHAIN_ID lets the exact
// same verification path run against Base Sepolia during manual dry-run
// testing (see Task 6) and against Base mainnet in production, without two
// copies of this logic.
const chain = Number(process.env.NEXT_PUBLIC_CHAIN_ID) === baseSepolia.id ? baseSepolia : base;
const rpcUrl =
  chain.id === baseSepolia.id
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
    signatureValid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message: buildRerollMessage(rerollTxHash),
      signature: signature as `0x${string}`,
    });
  } catch (err) {
    console.error(`Reroll signature verification threw for ${walletAddress}:`, err);
    return { valid: false, reason: "Signature verification failed" };
  }
  if (!signatureValid) {
    return { valid: false, reason: "Signature doesn't match wallet" };
  }

  if (await isRerollTxConsumed(rerollTxHash)) {
    return { valid: false, reason: "This payment has already been used" };
  }

  const contracts = getContracts(chain.id);
  if (isPlaceholder(contracts.rerollBurner)) {
    return { valid: false, reason: "Reroll isn't live yet" };
  }

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({
      hash: rerollTxHash as `0x${string}`,
    });
  } catch (err) {
    console.error(`Reroll tx receipt lookup failed for ${rerollTxHash}:`, err);
    return { valid: false, reason: "Reroll transaction not found" };
  }

  if (receipt.status !== "success") {
    return { valid: false, reason: "Reroll transaction did not succeed" };
  }
  if (receipt.to?.toLowerCase() !== contracts.rerollBurner.toLowerCase()) {
    return { valid: false, reason: "Transaction was not a call to RerollBurner" };
  }

  const events = parseEventLogs({
    abi: REROLL_BURNER_ABI,
    logs: receipt.logs,
    eventName: "Rerolled",
  });
  const matchingEvent = events.find(
    (e) => e.args.user.toLowerCase() === walletAddress.toLowerCase()
  );
  if (!matchingEvent) {
    return { valid: false, reason: "No matching Rerolled event for this wallet" };
  }

  return { valid: true };
}

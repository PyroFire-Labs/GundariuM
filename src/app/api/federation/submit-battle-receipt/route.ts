import { replayBattle } from "@/lib/battle/deterministicSim";
import { computeProofHash } from "@/lib/federation/proofHash";
import { submitBattleReceipt } from "@/lib/federation/warperKeeperClient";
import { handleBattleReceiptRequest } from "@/lib/federation/battleReceiptHandler";

export const maxDuration = 10;

/**
 * Best-effort paper-only artifact construction, never gateway submission.
 * Arena fires this request after battle completion and ignores its response.
 * The handler derives the result with the unchanged simulator and proof hash.
 */
export async function POST(req: Request): Promise<Response> {
  return handleBattleReceiptRequest(req, {
    replayBattle,
    computeProofHash,
    submitBattleReceipt,
    // Do not initialize Redis when the worker configuration gate is closed.
    checkRateLimit: async (key, limit, windowMs) => {
      const { checkRateLimit } = await import("@/lib/rateLimit");
      return checkRateLimit(key, limit, windowMs);
    },
  });
}

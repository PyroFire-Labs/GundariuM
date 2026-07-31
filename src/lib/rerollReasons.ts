/**
 * The exact failure reasons `verifyRerollPayment` can return, plus which of
 * them mean a remembered burn tx hash is permanently dead.
 *
 * Deliberately isomorphic (no server-only imports), for the same reason
 * `buildRerollMessage` is: the server returns these strings verbatim as the
 * API's error message and the client matches on them to decide whether to
 * forget a confirmed-but-unredeemed burn. Two copies of the literals would
 * drift, and the failure mode of drift here is money — either the client
 * retries a dead hash forever, or it throws away a live one.
 */

export const REROLL_REASON = {
  /** verifyMessage itself threw (RPC blip, ERC-1271 call failure). */
  SIGNATURE_CHECK_FAILED: "Signature verification failed",
  /** The signature is valid but wasn't produced by the claimed wallet. */
  SIGNATURE_MISMATCH: "Signature doesn't match wallet",
  /** This exact tx hash already paid for a generation. */
  ALREADY_USED: "This payment has already been used",
  /** Replay protection is unavailable, so no payment can be safely accepted. */
  STORE_UNAVAILABLE:
    "Reroll verification is temporarily unavailable. Please try again shortly.",
  /** RerollBurner is still a placeholder address on this chain. */
  NOT_LIVE: "Reroll isn't live yet",
  /** The RPC answered, and it has no receipt for this hash. */
  TX_NOT_FOUND: "Reroll transaction not found",
  /** The receipt lookup itself failed — we don't know if the tx exists. */
  TX_LOOKUP_FAILED:
    "Couldn't reach the network to check your reroll transaction. Please try again.",
  /** The receipt exists and the transaction reverted. */
  TX_FAILED: "Reroll transaction did not succeed",
  /** The receipt exists but carries no RerollBurner payment for this wallet. */
  NO_MATCHING_EVENT: "No matching Rerolled event for this wallet",
} as const;

/**
 * Reasons that prove the tx hash can NEVER buy a generation, so the client
 * should forget it and start a fresh approve+burn on the next click.
 *
 * Everything NOT listed here is treated as retryable and the remembered hash
 * is preserved — a confirmed burn is real money and forgetting it costs the
 * user 60,000 GNRM. In particular:
 *
 *   - Both signature reasons are excluded on purpose. A signature failure is
 *     a wallet/session problem, not a payment problem: the hash is still
 *     redeemable, and clearing it would send the user into a *fresh* burn
 *     that fails at the identical signing step — turning a stuck-but-
 *     recoverable state into a money-burning loop.
 *   - STORE_UNAVAILABLE / TX_LOOKUP_FAILED are "we couldn't check", not
 *     "it's invalid". They resolve on their own (or with an ops fix).
 *   - NOT_LIVE is a deployment state, not a verdict on the payment.
 *   - TX_NOT_FOUND is excluded on purpose too, even though it sounds
 *     definitive: the client confirms the burn via its own RPC provider
 *     before ever signing, while the server looks the same hash up on a
 *     separately configured provider — a real, already-confirmed
 *     transaction can still come back "not found" there from ordinary node
 *     lag or a provider that hasn't indexed it yet. Treating that as
 *     terminal would throw away a genuine payment on nothing more than a
 *     propagation delay; safer to let the user retry with the same hash
 *     until the lookup actually succeeds one way or the other.
 */
const TERMINAL_REASONS: ReadonlySet<string> = new Set<string>([
  REROLL_REASON.ALREADY_USED,
  REROLL_REASON.TX_FAILED,
  REROLL_REASON.NO_MATCHING_EVENT,
]);

export function isTerminalRerollReason(
  reason: string | null | undefined
): boolean {
  return typeof reason === "string" && TERMINAL_REASONS.has(reason.trim());
}

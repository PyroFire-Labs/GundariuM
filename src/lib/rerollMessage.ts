/**
 * The exact message a wallet signs to prove it controls the address that
 * submitted a reroll payment. Deliberately isomorphic (no server-only
 * imports) — both the signing code (client) and the verifying code (server)
 * import this same function so the message string can never drift out of
 * sync between the two.
 */
export function buildRerollMessage(txHash: string): string {
  return `Reroll with tx ${txHash}`;
}

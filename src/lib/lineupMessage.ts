/**
 * Shared (client + server) message format for lineup-save signatures.
 * Split out from lineupStore.ts because that file pulls in @upstash/redis,
 * which must never end up in a client bundle.
 */
export function buildLineupMessage(
  address: string,
  hero: number,
  support: number[],
  ts: number
): string {
  return `Save GundariuM starting lineup\naddress: ${address.toLowerCase()}\nhero: ${hero}\nsupport: ${support.join(",")}\nts: ${ts}`;
}

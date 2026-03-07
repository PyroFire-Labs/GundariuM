const GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "ipfs.io";

export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    const cid = uri.slice(7);
    return `https://${GATEWAY}/ipfs/${cid}`;
  }
  return uri;
}

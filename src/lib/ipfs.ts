const GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "ipfs.io";

const PUBLIC_GATEWAYS = ["ipfs.io", "dweb.link"];

function gatewayHost(gateway: string): string {
  return gateway.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function ipfsPath(uri: string): string | null {
  if (uri.startsWith("ipfs://")) {
    return uri.slice(7).replace(/^ipfs\//, "").replace(/^\//, "");
  }

  try {
    const url = new URL(uri);
    const match = url.pathname.match(/\/ipfs\/(.+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Return the configured gateway first, followed by public fallback gateways. */
export function ipfsGatewayCandidates(uri: string): string[] {
  if (!uri) return [];

  const path = ipfsPath(uri);
  if (!path) return [uri];

  const gateways = [gatewayHost(GATEWAY), ...PUBLIC_GATEWAYS];
  const candidates = gateways.map((gateway) => `https://${gateway}/ipfs/${path}`);
  if (uri.startsWith("https://") || uri.startsWith("http://")) {
    candidates.unshift(uri);
  }

  return [...new Set(candidates)];
}

export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  return ipfsGatewayCandidates(uri)[0] ?? uri;
}

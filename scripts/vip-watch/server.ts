/**
 * Local dashboard: finds wallets currently eligible for GunplaCard's
 * Auto-VIP mint tier (owns a card AND holds a nonzero stGNRM balance —
 * same two conditions mintCardAutoVip checks on-chain), resolves each to a
 * Farcaster identity, and highlights ones not seen on a previous run so
 * they can be manually added to the Frame-Runners Guild Chat.
 *
 * Usage:
 *   doppler run --project gundarium --config dev -- npx tsx scripts/vip-watch/server.ts
 *   open http://localhost:4411   (override port with PORT env var)
 *
 * Needs BASE_RPC_URL and NEYNAR_API_KEY (both already in Doppler).
 * "Seen" state persists to scripts/vip-watch/.seen.json (gitignored) as a
 * list of Farcaster FIDs, not wallet addresses — so someone who unstakes and
 * restakes stGNRM (dropping out of and back into the eligible set) isn't
 * re-flagged as new. Click "Mark shown as added" once you've actually added
 * them to the chat.
 */

import { createPublicClient, http as httpTransport, parseAbi } from "viem";
import { base } from "viem/chains";
import * as fs from "node:fs";
import * as path from "node:path";
import * as nodeHttp from "node:http";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEN_PATH = path.join(__dirname, ".seen.json");
const PORT = Number(process.env.PORT) || 4411;
const CACHE_TTL_MS = 5 * 60 * 1000;

const GUNPLA_CARD_ADDRESS = "0xA7bc3d31A4863b33854F2d73C77BAf31c4f27a6C" as const;
// Streme's stGNRM receipt token (Base mainnet) — mirrors GunplaCard.sol's STGNRM constant.
const STGNRM_ADDRESS = "0x7EFDd2724910eD0e0614FA0c084eABD30c644C1D" as const;

const gunplaCardAbi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
]);
const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

const client = createPublicClient({
  chain: base,
  transport: httpTransport(process.env.BASE_RPC_URL),
});

interface Vip {
  address: string;
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
}

// ─── On-chain: wallets meeting both mintCardAutoVip conditions ────────────

async function getAutoVipWallets(): Promise<string[]> {
  const totalSupply = await client.readContract({
    address: GUNPLA_CARD_ADDRESS,
    abi: gunplaCardAbi,
    functionName: "totalSupply",
  });

  const tokenIds = Array.from({ length: Number(totalSupply) }, (_, i) => BigInt(i + 1));
  const ownerResults = await client.multicall({
    contracts: tokenIds.map((tokenId) => ({
      address: GUNPLA_CARD_ADDRESS,
      abi: gunplaCardAbi,
      functionName: "ownerOf",
      args: [tokenId],
    })),
  });

  const owners = new Set<string>();
  for (const r of ownerResults) {
    if (r.status === "success") owners.add((r.result as unknown as string).toLowerCase());
  }

  const ownerList = [...owners];
  const stakeResults = await client.multicall({
    contracts: ownerList.map((owner) => ({
      address: STGNRM_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner as `0x${string}`],
    })),
  });

  return ownerList.filter((_, i) => {
    const r = stakeResults[i];
    return r.status === "success" && (r.result as bigint) > 0n;
  });
}

// ─── Farcaster identity lookup (same endpoint/batching as src/lib/neynar.ts) ─

async function lookupFarcasterIdentities(addresses: string[]): Promise<Map<string, Vip>> {
  const apiKey = process.env.NEYNAR_API_KEY;
  const result = new Map<string, Vip>();
  if (!apiKey || addresses.length === 0) return result;

  const BATCH_SIZE = 100;
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${batch.join(",")}`;
    const res = await fetch(url, { headers: { accept: "application/json", api_key: apiKey } });
    if (!res.ok) {
      if (res.status !== 404) console.error(`Neynar bulk lookup failed: ${res.status} ${res.statusText}`);
      continue;
    }
    const data = (await res.json()) as Record<
      string,
      Array<{ fid: number; username: string; display_name: string; pfp_url: string }>
    >;
    for (const addr of batch) {
      const users = data[addr];
      if (users?.length) {
        const u = users[0];
        result.set(addr, {
          address: addr,
          fid: u.fid,
          username: u.username,
          displayName: u.display_name,
          pfpUrl: u.pfp_url,
        });
      }
    }
  }
  return result;
}

// ─── Seen-state persistence ────────────────────────────────────────────────

function loadSeen(): Set<number> {
  try {
    return new Set(JSON.parse(fs.readFileSync(SEEN_PATH, "utf8")));
  } catch {
    return new Set();
  }
}

function saveSeen(fids: Iterable<number>) {
  fs.writeFileSync(SEEN_PATH, JSON.stringify([...fids], null, 2));
}

// ─── Compute (cached — Neynar free tier is 500 req/day, don't hammer it) ──

let cache: { computedAt: number; vips: Vip[] } | null = null;

async function computeVips(forceRefresh: boolean): Promise<Vip[]> {
  if (!forceRefresh && cache && Date.now() - cache.computedAt < CACHE_TTL_MS) {
    return cache.vips;
  }
  const wallets = await getAutoVipWallets();
  const identities = await lookupFarcasterIdentities(wallets);
  const vips = [...identities.values()].sort((a, b) => a.username.localeCompare(b.username));
  cache = { computedAt: Date.now(), vips };
  return vips;
}

// ─── HTML rendering ─────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderVipCard(v: Vip, isNew: boolean): string {
  return `
    <div class="card${isNew ? " new" : ""}">
      ${isNew ? '<span class="badge">NEW</span>' : ""}
      <img src="${escapeHtml(v.pfpUrl || "")}" alt="" width="40" height="40" />
      <div class="meta">
        <a href="https://farcaster.xyz/${escapeHtml(v.username)}" target="_blank">@${escapeHtml(v.username)}</a>
        <span class="name">${escapeHtml(v.displayName)}</span>
        <span class="addr">${escapeHtml(v.address)}</span>
      </div>
    </div>`;
}

function renderPage(vips: Vip[], seen: Set<number>, computedAt: number): string {
  const newOnes = vips.filter((v) => !seen.has(v.fid));
  const known = vips.filter((v) => seen.has(v.fid));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>GundariuM — Auto-VIP Watch</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #0b0d12; color: #e8e8ec; max-width: 720px; margin: 40px auto; padding: 0 16px; }
  h1 { font-size: 1.3rem; }
  .sub { color: #9a9aa5; font-size: 0.85rem; margin-bottom: 24px; }
  .card { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; background: #14161d; margin-bottom: 8px; position: relative; }
  .card.new { outline: 1px solid #ffcc4d; background: #201d10; }
  .badge { position: absolute; top: -8px; right: -8px; background: #ffcc4d; color: #000; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
  img { border-radius: 50%; background: #333; }
  .meta { display: flex; flex-direction: column; }
  .meta a { color: #7ab8ff; text-decoration: none; font-weight: 600; }
  .name { color: #b5b5c0; font-size: 0.85rem; }
  .addr { color: #666a75; font-size: 0.7rem; font-family: monospace; }
  section { margin-bottom: 32px; }
  .empty { color: #666a75; font-style: italic; }
  a.action { display: inline-block; margin-right: 12px; color: #ffcc4d; text-decoration: none; font-size: 0.85rem; }
  form { display: inline; }
  button { background: #ffcc4d; border: none; color: #000; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
</style>
</head>
<body>
  <h1>Auto-VIP Watch</h1>
  <div class="sub">
    Wallets that own a card + hold stGNRM, resolved to Farcaster. Computed ${new Date(computedAt).toLocaleString()}.
    <br />
    <a class="action" href="/?refresh=1">Force refresh</a>
    ${newOnes.length > 0 ? '<form method="POST" action="/mark-seen"><button type="submit">Mark shown as added (' + newOnes.length + ")</button></form>" : ""}
  </div>

  <section>
    <h2>New (${newOnes.length})</h2>
    ${newOnes.length ? newOnes.map((v) => renderVipCard(v, true)).join("") : '<div class="empty">Nothing new since last check.</div>'}
  </section>

  <section>
    <h2>Already added (${known.length})</h2>
    ${known.length ? known.map((v) => renderVipCard(v, false)).join("") : '<div class="empty">None yet.</div>'}
  </section>
</body>
</html>`;
}

// ─── Server ─────────────────────────────────────────────────────────────────

const server = nodeHttp.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (req.method === "POST" && url.pathname === "/mark-seen") {
      const vips = await computeVips(false);
      saveSeen(vips.map((v) => v.fid));
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      const forceRefresh = url.searchParams.get("refresh") === "1";
      const vips = await computeVips(forceRefresh);
      const seen = loadSeen();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderPage(vips, seen, cache!.computedAt));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
});

server.listen(PORT, () => {
  console.log(`Auto-VIP Watch running at http://localhost:${PORT}`);
});

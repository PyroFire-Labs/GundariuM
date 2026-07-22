/**
 * Neynar API client for Farcaster identity lookups.
 *
 * Server-side only — uses NEYNAR_API_KEY from env. Never import this from
 * a client component; profile data is fetched via /api/runner-profile/[address]
 * so the key stays on the server.
 *
 * Free tier: 500 requests/day, generous for our scale. Cache aggressively.
 *
 * Docs: https://docs.neynar.com/reference/fetch-bulk-users-by-eth-or-sol-address
 */

import type { RunnerProfile, RunnerSocial } from "@/types/runner";

const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster";

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  profile?: {
    bio?: { text?: string };
    location?: {
      address?: {
        city?: string;
        state?: string;
        country?: string;
      };
    };
    url?: string;
  };
  verifications?: string[];
  verified_addresses?: {
    eth_addresses?: string[];
  };
}

/**
 * Look up Farcaster identity for an Ethereum address. Returns null if the
 * address isn't verified to any FID, or if the lookup fails (rate limit,
 * network, etc. — caller should treat null as "no identity available" not
 * as a hard error).
 */
export async function lookupFarcasterByAddress(
  address: string
): Promise<RunnerProfile | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    console.error("NEYNAR_API_KEY missing — Farcaster lookups disabled");
    return null;
  }

  const normalized = address.toLowerCase();
  const url = `${NEYNAR_BASE}/user/bulk-by-address?addresses=${normalized}`;

  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        api_key: apiKey,
      },
      // Cache at the edge for 30 minutes — Farcaster profiles don't change often
      // and we want to stay well under the 500/day free-tier budget.
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      // 404 = no user found, treat as no identity. Other codes = real failures.
      if (res.status === 404) return null;
      console.error(
        `Neynar lookup failed for ${normalized}: ${res.status} ${res.statusText}`
      );
      return null;
    }

    const data: Record<string, NeynarUser[]> = await res.json();
    const users = data[normalized];
    if (!users || users.length === 0) return null;

    return neynarUserToProfile(users[0], normalized);
  } catch (err) {
    console.error(`Neynar fetch error for ${normalized}:`, err);
    return null;
  }
}

const BULK_BATCH_SIZE = 100; // conservative — Neynar's bulk-by-address endpoint accepts more, but this keeps individual requests light

/**
 * Bulk Farcaster identity lookup for many addresses at once — used by the
 * leaderboard refresh job so ranking N wallets costs a handful of requests
 * instead of N individual ones (Neynar's free tier is 500 requests/day).
 * Returns a map of lowercased address -> RunnerProfile for every address
 * that resolved to a Farcaster identity; addresses with no identity are
 * simply absent from the map (caller falls back to truncated address).
 */
export async function lookupFarcasterByAddresses(
  addresses: string[]
): Promise<Map<string, RunnerProfile>> {
  const result = new Map<string, RunnerProfile>();
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey || addresses.length === 0) return result;

  const normalized = [...new Set(addresses.map((a) => a.toLowerCase()))];

  for (let i = 0; i < normalized.length; i += BULK_BATCH_SIZE) {
    const batch = normalized.slice(i, i + BULK_BATCH_SIZE);
    const url = `${NEYNAR_BASE}/user/bulk-by-address?addresses=${batch.join(",")}`;

    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", api_key: apiKey },
        next: { revalidate: 1800 },
      });
      if (!res.ok) {
        if (res.status !== 404) {
          console.error(`Neynar bulk lookup failed: ${res.status} ${res.statusText}`);
        }
        continue;
      }
      const data: Record<string, NeynarUser[]> = await res.json();
      for (const address of batch) {
        const users = data[address];
        if (users && users.length > 0) {
          result.set(address, neynarUserToProfile(users[0], address));
        }
      }
    } catch (err) {
      console.error(`Neynar bulk fetch error:`, err);
    }
  }

  return result;
}

function neynarUserToProfile(
  user: NeynarUser,
  address: string
): RunnerProfile {
  const socials: RunnerSocial[] = [];

  // Farcaster usernames are themselves a social — include as the canonical
  // identity link.
  if (user.username) {
    socials.push({
      platform: "other",
      label: `@${user.username} on Farcaster`,
      url: `https://farcaster.xyz/${user.username}`,
    });
  }

  // Some FC profiles expose a custom URL. We treat that as the website
  // unless we can detect it's a known social platform.
  const profileUrl = user.profile?.url;
  let website: string | null = null;
  if (profileUrl) {
    if (/twitter\.com|x\.com/i.test(profileUrl)) {
      socials.push({
        platform: "x",
        label: extractHandleFromUrl(profileUrl, "x"),
        url: profileUrl,
      });
    } else if (/github\.com/i.test(profileUrl)) {
      socials.push({
        platform: "github",
        label: extractHandleFromUrl(profileUrl, "github"),
        url: profileUrl,
      });
    } else {
      website = profileUrl;
    }
  }

  const metroParts = [
    user.profile?.location?.address?.city,
    user.profile?.location?.address?.state,
    user.profile?.location?.address?.country,
  ].filter(Boolean);
  const metro = metroParts.length > 0 ? metroParts.join(", ") : null;

  return {
    address,
    source: "farcaster",
    runnerName: user.display_name || user.username || null,
    pfpUrl: user.pfp_url || null,
    bio: user.profile?.bio?.text || null,
    metro,
    website,
    socials,
    fid: user.fid,
    farcasterUsername: user.username,
    verifiedAddresses: user.verified_addresses?.eth_addresses || user.verifications,
  };
}

function extractHandleFromUrl(url: string, platform: string): string {
  try {
    const u = new URL(url);
    const handle = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return handle ? `@${handle}` : platform;
  } catch {
    return platform;
  }
}

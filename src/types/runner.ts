/**
 * Runner Profile — the dossier-side identity of a wallet on GundariuM.
 *
 * Phase 1 of the Runner Dossier feature populates this from Farcaster
 * (via Neynar). Later phases will allow custom override for wallets
 * without Farcaster accounts, stored in Vercel KV / Upstash.
 *
 * Field naming intentionally uses "runner" prefix on the public-facing
 * concepts — see project_pyrofire_labs.md memory for the brand glossary
 * (Pilots are now Runners).
 */

export interface RunnerSocial {
  platform: "x" | "github" | "discord" | "telegram" | "website" | "other";
  label: string; // display string ("@gundariumgame")
  url?: string; // optional canonical URL
}

export interface RunnerProfile {
  /** The wallet this profile belongs to (lowercased). */
  address: string;

  /** Source of the data. "farcaster" = pulled from Neynar; "custom" = stored in KV (Phase 2). */
  source: "farcaster" | "custom" | "none";

  /** Display name for the Runner. Falls back to truncated address if absent. */
  runnerName: string | null;

  /** Profile picture URL. */
  pfpUrl: string | null;

  /** Short biography. */
  bio: string | null;

  /** Closest big city (region-level only, never specific). */
  metro: string | null;

  /** Optional personal website URL. */
  website: string | null;

  /** External social handles the user wants associated with their Runner identity. */
  socials: RunnerSocial[];

  /** Farcaster ID, if this profile is sourced from Farcaster. */
  fid?: number;

  /** Farcaster username, if applicable. */
  farcasterUsername?: string;

  /** Other verified addresses for this Farcaster account (cross-reference for badges, etc.). */
  verifiedAddresses?: string[];
}

/**
 * A profile lookup that resolved to no identity at all (no Farcaster, no
 * custom profile yet). The frontend should fall back to displaying a
 * truncated address.
 */
export function emptyRunnerProfile(address: string): RunnerProfile {
  return {
    address: address.toLowerCase(),
    source: "none",
    runnerName: null,
    pfpUrl: null,
    bio: null,
    metro: null,
    website: null,
    socials: [],
  };
}

/**
 * Backfill 3D model generation jobs for the Sepolia NPC roster (Arena PVE
 * opponents — see useNpcRoster.ts). These 19 cards (tokenIds 1-19,
 * NEXT_PUBLIC_NPC_ROSTER_ADDRESS) were minted before the 3D pipeline
 * existed, so they never got a generate-model job enqueued at mint time.
 *
 * Weapon names (primary/secondary/tertiary) come straight from
 * GunplaCard.getTraits() on-chain — those are real and must match what
 * battle animations key off of. Cosmetic geometry inputs (frameType, head,
 * backpack, colorway, special) were never stored anywhere (only
 * KitbashTraits at reveal time had them, and that's long gone) — the
 * placeholder-geometry pipeline (worker/blender/lib/components.py) doesn't
 * need them to match the original reveal, only to be stable, so they're
 * re-derived here with a seeded PRNG (seed = chainId+tokenId) instead of
 * Math.random(), making this script idempotent: re-running it reproduces
 * the exact same GLB inputs rather than rolling new geometry each time.
 *
 * Usage: doppler run --project gundarium --config prd -- npx tsx scripts/backfill-npc-models.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { GUNPLA_CARD_ABI } from "../src/lib/contracts/abis/GunplaCard";
import { TRAIT_TABLES } from "../src/lib/kitbash/traits";
import { FACTION_BIAS } from "../src/lib/kitbash/factionBias";
import type { FactionKey } from "../src/lib/constants/factions";
import { enqueueModelJob } from "../src/lib/modelStore";

const CHAIN_ID = baseSepolia.id;
const GUNPLA_CARD_ADDRESS = "0x7475CeA2680ddaF22B914F45290e22a75e29fF4c" as const;
const NPC_ROSTER_ADDRESS = (process.env.NEXT_PUBLIC_NPC_ROSTER_ADDRESS ?? "").toLowerCase();
const TOKEN_IDS = Array.from({ length: 19 }, (_, i) => i + 1);

if (!NPC_ROSTER_ADDRESS) {
  console.error("Missing NEXT_PUBLIC_NPC_ROSTER_ADDRESS in env.");
  process.exit(1);
}

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// Small, fast, deterministic PRNG (same algorithm as
// src/lib/battle/deterministicSim.ts's mulberry32) — reimplemented locally
// rather than imported so this script has no dependency on battle code.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a: turns "chainId:tokenId" into a stable 32-bit seed.
function seedFrom(chainId: number, tokenId: number): number {
  const str = `${chainId}:${tokenId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

interface WeightedTrait {
  name: string;
  weight: number;
}

function seededWeightedRandom(rng: () => number, items: WeightedTrait[]): string {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.name;
  }
  return items[items.length - 1].name;
}

function seededPickFromAllowList(
  rng: () => number,
  table: WeightedTrait[],
  allowed: readonly string[] | undefined
): string {
  if (!allowed || allowed.length === 0) return seededWeightedRandom(rng, table);
  const filtered = table.filter((t) => allowed.includes(t.name));
  if (filtered.length === 0) return seededWeightedRandom(rng, table);
  return seededWeightedRandom(rng, filtered);
}

function isFactionKey(value: string): value is FactionKey {
  return value in FACTION_BIAS || value === "UNKNOWN";
}

async function main() {
  console.log(`Backfilling ${TOKEN_IDS.length} NPC roster models on chain ${CHAIN_ID}...`);

  for (const tokenId of TOKEN_IDS) {
    try {
      const owner = await publicClient.readContract({
        address: GUNPLA_CARD_ADDRESS,
        abi: GUNPLA_CARD_ABI,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      });
      if ((owner as string).toLowerCase() !== NPC_ROSTER_ADDRESS) {
        console.warn(`  #${tokenId}: owned by ${owner}, not the NPC roster wallet — skipping`);
        continue;
      }

      const traits = (await publicClient.readContract({
        address: GUNPLA_CARD_ADDRESS,
        abi: GUNPLA_CARD_ABI,
        functionName: "getTraits",
        args: [BigInt(tokenId)],
      })) as {
        faction: string;
        primaryWeapon: string;
        secondaryWeapon: string;
        tertiaryWeapon: string;
      };

      const faction = isFactionKey(traits.faction) ? traits.faction : "UNKNOWN";
      const bias = faction !== "UNKNOWN" ? FACTION_BIAS[faction] : null;
      const rng = mulberry32(seedFrom(CHAIN_ID, tokenId));

      const frameType = seededPickFromAllowList(rng, TRAIT_TABLES.frameType, bias?.allowedFrames);
      const head = seededPickFromAllowList(rng, TRAIT_TABLES.head, bias?.allowedHeads);
      const backpack = seededPickFromAllowList(rng, TRAIT_TABLES.backpack, bias?.allowedBackpacks);
      const colorway = seededPickFromAllowList(rng, TRAIT_TABLES.colorway, bias?.colorways);
      const special = seededPickFromAllowList(rng, TRAIT_TABLES.special, bias?.allowedSpecial);

      await enqueueModelJob({
        chainId: CHAIN_ID,
        tokenId: String(tokenId),
        traits: {
          frameType,
          head,
          primaryWeapon: traits.primaryWeapon,
          secondaryWeapon: traits.secondaryWeapon,
          tertiaryWeapon: traits.tertiaryWeapon,
          backpack,
          colorway,
          special,
        },
        enqueuedAt: Date.now(),
      });

      console.log(
        `  #${tokenId}: queued — faction=${traits.faction} weapon=${traits.primaryWeapon} frame=${frameType} head=${head}`
      );
    } catch (err) {
      console.error(`  #${tokenId}: FAILED —`, err instanceof Error ? err.message : err);
    }
  }

  console.log("Done. Worker will pick these up from the Redis queue on its next poll.");
}

main().then(() => process.exit(0));

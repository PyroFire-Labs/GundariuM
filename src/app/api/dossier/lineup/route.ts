/**
 * POST /api/dossier/lineup
 *
 * Save a wallet's starting lineup (hero + up to 4 support cards). Gated by
 * an EIP-191 signature (only the wallet itself can set its own lineup) and
 * an on-chain ownership check (can't feature a card you don't hold).
 */

import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { GUNPLA_CARD_ABI } from "@/lib/contracts/abis/GunplaCard";
import { getContracts } from "@/lib/contracts/addresses";
import { verifyLineupSignature, setLineup } from "@/lib/lineupStore";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, hero, support, ts, signature } = body as {
    address?: unknown;
    hero?: unknown;
    support?: unknown;
    ts?: unknown;
    signature?: unknown;
  };

  if (!isValidAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (typeof hero !== "number" || !Number.isInteger(hero) || hero <= 0) {
    return NextResponse.json({ error: "Invalid hero token ID" }, { status: 400 });
  }
  if (
    !Array.isArray(support) ||
    support.length > 4 ||
    !support.every((id) => typeof id === "number" && Number.isInteger(id) && id > 0)
  ) {
    return NextResponse.json({ error: "Invalid support token IDs" }, { status: 400 });
  }
  if (typeof ts !== "number" || typeof signature !== "string" || !signature.startsWith("0x")) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const verification = await verifyLineupSignature({
    address,
    hero,
    support,
    ts,
    signature: signature as `0x${string}`,
  });
  if (!verification.valid) {
    return NextResponse.json({ error: verification.reason }, { status: 401 });
  }

  // Confirm the wallet actually owns every card it's featuring — a valid
  // signature only proves it's their wallet, not that these are their cards.
  const contracts = getContracts(base.id);
  const allTokenIds = [hero, ...support];
  try {
    const owners = await Promise.all(
      allTokenIds.map((tokenId) =>
        publicClient.readContract({
          address: contracts.gunplaCard,
          abi: GUNPLA_CARD_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        })
      )
    );
    const notOwned = allTokenIds.filter(
      (_, i) => (owners[i] as string).toLowerCase() !== address.toLowerCase()
    );
    if (notOwned.length > 0) {
      return NextResponse.json(
        { error: `You don't own card${notOwned.length > 1 ? "s" : ""} #${notOwned.join(", #")}` },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Couldn't verify card ownership on-chain — try again" },
      { status: 502 }
    );
  }

  await setLineup(address, { hero, support });

  return NextResponse.json({ success: true, lineup: { hero, support } });
}

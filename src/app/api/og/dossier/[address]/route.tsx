import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { DAILY_CHECKIN_ABI } from "@/lib/contracts/abis/DailyCheckIn";
import { GUNPLA_CARD_ABI } from "@/lib/contracts/abis/GunplaCard";
import { getContracts, isPlaceholder } from "@/lib/contracts/addresses";
import { getLineup } from "@/lib/lineupStore";
import { lookupFarcasterByAddress } from "@/lib/neynar";
import { ipfsToHttp } from "@/lib/ipfs";
import type { GunplaCardMetadata } from "@/types/nft";

export const runtime = "nodejs";
export const contentType = "image/png";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

interface RouteContext {
  params: Promise<{ address: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { address } = await params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return new Response("Invalid address", { status: 400 });
  }

  const contracts = getContracts(base.id);

  let current = 0;
  let longest = 0;
  let total = 0;
  let weekCount = 0;

  if (!isPlaceholder(contracts.dailyCheckIn)) {
    try {
      const result = await publicClient.readContract({
        address: contracts.dailyCheckIn,
        abi: DAILY_CHECKIN_ABI,
        functionName: "getStreak",
        args: [address as `0x${string}`],
      });
      current = Number(result[0]);
      longest = Number(result[1]);
      total = Number(result[2]);
      weekCount = Number(result[4]);
    } catch {
      // fall through with zeros
    }
  }

  const [farcasterProfile, lineup, balance] = await Promise.all([
    lookupFarcasterByAddress(address).catch(() => null),
    getLineup(address).catch(() => null),
    publicClient
      .readContract({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })
      .catch(() => 0n),
  ]);

  const mintedCount = Number(balance);

  // Full squad (hero + support, left to right in deploy order) if a lineup
  // is set; otherwise fall back to the most recently minted card so the
  // profile isn't blank art before anyone's picked a lineup.
  const squadTokenIds: bigint[] = [];
  if (lineup?.hero) {
    squadTokenIds.push(BigInt(lineup.hero));
    for (const id of lineup.support) squadTokenIds.push(BigInt(id));
  } else if (mintedCount > 0) {
    try {
      const fallbackId = (await publicClient.readContract({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [address as `0x${string}`, BigInt(mintedCount - 1)],
      })) as bigint;
      squadTokenIds.push(fallbackId);
    } catch {
      // no fallback card — render without art
    }
  }

  const squadCardsRaw = await Promise.all(
    squadTokenIds.map(async (tokenId, i) => {
      try {
        const tokenUri = (await publicClient.readContract({
          address: contracts.gunplaCard,
          abi: GUNPLA_CARD_ABI,
          functionName: "tokenURI",
          args: [tokenId],
        })) as string;
        const res = await fetch(ipfsToHttp(tokenUri), { next: { revalidate: 3600 } });
        if (!res.ok) return null;
        const metadata = (await res.json()) as GunplaCardMetadata;
        return {
          imageUrl: ipfsToHttp(metadata.image),
          name: metadata.name,
          isHero: i === 0,
        };
      } catch {
        return null;
      }
    })
  );
  const squadCards = squadCardsRaw.filter(
    (c): c is { imageUrl: string; name: string; isHero: boolean } => c !== null
  );
  const cardName = squadCards.find((c) => c.isHero)?.name ?? null;

  const displayName =
    farcasterProfile?.runnerName ||
    (farcasterProfile?.farcasterUsername ? `@${farcasterProfile.farcasterUsername}` : null) ||
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const perfectWeek = weekCount >= 7;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#080c14",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily: "sans-serif",
          overflow: "hidden",
          padding: "48px 56px",
        }}
      >
        {/* Background grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(37,99,235,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.06) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Corner brackets */}
        <div style={{ position: "absolute", top: 24, left: 24, width: 40, height: 40, borderTop: "3px solid #3b82f6", borderLeft: "3px solid #3b82f6" }} />
        <div style={{ position: "absolute", top: 24, right: 24, width: 40, height: 40, borderTop: "3px solid #3b82f6", borderRight: "3px solid #3b82f6" }} />
        <div style={{ position: "absolute", bottom: 24, left: 24, width: 40, height: 40, borderBottom: "3px solid #3b82f6", borderLeft: "3px solid #3b82f6" }} />
        <div style={{ position: "absolute", bottom: 24, right: 24, width: 40, height: 40, borderBottom: "3px solid #3b82f6", borderRight: "3px solid #3b82f6" }} />

        {/* Header */}
        <div style={{ display: "flex", fontSize: "13px", letterSpacing: "0.3em", color: "#60a5fa", fontWeight: 700, marginBottom: "10px" }}>
          FRAME-RUNNER DOSSIER
        </div>
        <div style={{ display: "flex", fontSize: "44px", fontWeight: 900, color: "#ffffff", marginBottom: "6px", lineHeight: 1.1 }}>
          {displayName}
        </div>
        {cardName && (
          <div style={{ display: "flex", fontSize: "16px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginBottom: "24px" }}>
            PILOTING {cardName.toUpperCase()}
          </div>
        )}

        {/* Squad row — hero first, support cards left to right in deploy order */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "28px" }}>
          {squadCards.length > 0 ? (
            squadCards.map((card, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  position: "relative",
                  width: 190,
                  height: 190,
                  borderRadius: "14px",
                  overflow: "hidden",
                  border: card.isHero
                    ? "3px solid rgba(255,193,7,0.7)"
                    : "2px solid rgba(96,165,250,0.5)",
                  boxShadow: card.isHero ? "0 0 60px rgba(255,193,7,0.2)" : "none",
                  backgroundColor: "#0f1420",
                  flexShrink: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.imageUrl} width={190} height={190} alt="" style={{ objectFit: "cover" }} />
                {card.isHero && (
                  <div
                    style={{
                      display: "flex",
                      position: "absolute",
                      top: 8,
                      left: 8,
                      border: "1px solid rgba(255,193,7,0.7)",
                      borderRadius: "4px",
                      padding: "2px 7px",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      color: "#ffc107",
                      backgroundColor: "rgba(8,12,20,0.75)",
                    }}
                  >
                    HERO
                  </div>
                )}
              </div>
            ))
          ) : (
            <div
              style={{
                display: "flex",
                width: 190,
                height: 190,
                borderRadius: "14px",
                border: "3px solid rgba(255,193,7,0.4)",
                backgroundColor: "#0f1420",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.2)",
                fontSize: 14,
                letterSpacing: "0.2em",
              }}
            >
              NO CARD YET
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "36px", marginBottom: perfectWeek ? "16px" : "0" }}>
          <Stat label="DAILY STREAK" value={`${current}`} />
          <Stat label="LONGEST" value={`${longest}`} />
          <Stat label="CHECK-INS" value={`${total}`} />
          <Stat label="CARDS" value={`${mintedCount}`} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "20px" }}>
          <div style={{ display: "flex", fontSize: "13px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.15em" }}>
            THIS WEEK {Math.min(weekCount, 7)}/7
          </div>
          {perfectWeek && (
            <div
              style={{
                display: "flex",
                border: "1px solid rgba(255,193,7,0.6)",
                borderRadius: "6px",
                padding: "3px 10px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "#ffc107",
              }}
            >
              PERFECT WEEK +200
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "24px",
            border: "1px solid rgba(96,165,250,0.5)",
            padding: "10px 20px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: "#60a5fa",
            borderRadius: "8px",
            alignSelf: "flex-start",
          }}
        >
          GUNDARIUM.XYZ/DOSSIER
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: "11px", letterSpacing: "0.2em", color: "#60a5fa", fontWeight: 700, marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ display: "flex", fontSize: "36px", fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

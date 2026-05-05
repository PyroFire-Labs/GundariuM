import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { GUNPLA_CARD_ABI } from "@/lib/contracts/abis/GunplaCard";
import { getContracts } from "@/lib/contracts/addresses";
import { ipfsToHttp } from "@/lib/ipfs";
import type { GunplaCardMetadata } from "@/types/nft";

export const runtime = "nodejs";
export const revalidate = 3600;
export const contentType = "image/png";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

interface RouteContext {
  params: Promise<{ tokenId: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { tokenId } = await params;

  let id: bigint;
  try {
    id = BigInt(tokenId);
  } catch {
    return new Response("Invalid token ID", { status: 400 });
  }
  if (id <= 0n) return new Response("Invalid token ID", { status: 400 });

  let metadata: GunplaCardMetadata | null = null;
  let imageUrl: string | null = null;

  try {
    const tokenUri = (await publicClient.readContract({
      address: getContracts(8453).gunplaCard,
      abi: GUNPLA_CARD_ABI,
      functionName: "tokenURI",
      args: [id],
    })) as string;

    const res = await fetch(ipfsToHttp(tokenUri), { next: { revalidate: 3600 } });
    if (res.ok) {
      metadata = (await res.json()) as GunplaCardMetadata;
      imageUrl = ipfsToHttp(metadata.image);
    }
  } catch {
    // fall through to 404
  }

  if (!metadata || !imageUrl) {
    return new Response("Not found", { status: 404 });
  }

  const rarity =
    metadata.attributes.find((a) => a.trait_type === "Rarity")?.value ?? "";
  const faction =
    metadata.attributes.find((a) => a.trait_type === "Faction")?.value ?? "";
  const hp =
    metadata.attributes.find((a) => a.trait_type === "HP")?.value ?? "";
  const series =
    metadata.attributes.find((a) => a.trait_type === "Series")?.value ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "800px",
          background: "#080c14",
          display: "flex",
          position: "relative",
          fontFamily: "sans-serif",
          overflow: "hidden",
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
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            width: 48,
            height: 48,
            borderTop: "3px solid #3b82f6",
            borderLeft: "3px solid #3b82f6",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            width: 48,
            height: 48,
            borderTop: "3px solid #3b82f6",
            borderRight: "3px solid #3b82f6",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 24,
            width: 48,
            height: 48,
            borderBottom: "3px solid #3b82f6",
            borderLeft: "3px solid #3b82f6",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            width: 48,
            height: 48,
            borderBottom: "3px solid #3b82f6",
            borderRight: "3px solid #3b82f6",
          }}
        />

        {/* Image (left) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "70px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              border: "3px solid rgba(255,193,7,0.7)",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 0 80px rgba(255,193,7,0.25)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              width={620}
              height={620}
              alt=""
              style={{ objectFit: "cover", display: "block" }}
            />
          </div>
        </div>

        {/* Text column (right) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingRight: "70px",
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "14px",
              letterSpacing: "0.3em",
              color: "#60a5fa",
              fontWeight: 700,
              marginBottom: "16px",
            }}
          >
            GUNDARIUM · BASE NETWORK
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "64px",
              fontWeight: 900,
              color: "#ffc107",
              letterSpacing: "0.01em",
              lineHeight: 1.05,
              marginBottom: "20px",
            }}
          >
            {metadata.name}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "16px",
              letterSpacing: "0.25em",
              color: "rgba(255,255,255,0.65)",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            #{tokenId} · {String(rarity).toUpperCase()} ·{" "}
            {String(faction).toUpperCase()}
          </div>

          {series && (
            <div
              style={{
                display: "flex",
                fontSize: "14px",
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 700,
                marginBottom: "36px",
              }}
            >
              {String(series).toUpperCase()}
            </div>
          )}

          {hp !== "" && (
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "40px" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: "12px",
                  letterSpacing: "0.3em",
                  color: "#60a5fa",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                HP
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "44px",
                  fontWeight: 900,
                  color: "#ffffff",
                  lineHeight: 1,
                }}
              >
                {String(hp)}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              border: "1px solid rgba(255,193,7,0.5)",
              padding: "12px 22px",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.3em",
              color: "#ffc107",
              borderRadius: "8px",
              alignSelf: "flex-start",
            }}
          >
            GUNDARIUM.XYZ/MINT
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 800 },
  );
}

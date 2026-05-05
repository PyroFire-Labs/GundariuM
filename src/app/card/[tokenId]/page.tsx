import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { GUNPLA_CARD_ABI } from "@/lib/contracts/abis/GunplaCard";
import { getContracts } from "@/lib/contracts/addresses";
import { ipfsToHttp } from "@/lib/ipfs";
import type { GunplaCardMetadata } from "@/types/nft";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ tokenId: string }>;
}

const SITE_URL = "https://gundarium.xyz";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

const fetchCard = cache(
  async (
    tokenId: string,
  ): Promise<{ metadata: GunplaCardMetadata; imageUrl: string } | null> => {
    let id: bigint;
    try {
      id = BigInt(tokenId);
    } catch {
      return null;
    }
    if (id <= 0n) return null;

    try {
      const tokenUri = (await publicClient.readContract({
        address: getContracts(8453).gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "tokenURI",
        args: [id],
      })) as string;

      const metadataUrl = ipfsToHttp(tokenUri);
      const res = await fetch(metadataUrl, { next: { revalidate: 3600 } });
      if (!res.ok) return null;

      const metadata = (await res.json()) as GunplaCardMetadata;
      const imageUrl = ipfsToHttp(metadata.image);
      return { metadata, imageUrl };
    } catch {
      return null;
    }
  },
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tokenId } = await params;
  const card = await fetchCard(tokenId);

  if (!card) {
    return { title: "GundariuM — Card not found" };
  }

  const { metadata } = card;
  const title = `${metadata.name} — GundariuM`;
  const ogImageUrl = `${SITE_URL}/api/og/card/${tokenId}`;

  const miniAppEmbed = {
    version: "1",
    imageUrl: ogImageUrl,
    button: {
      title: "View on GundariuM",
      action: {
        type: "launch_frame",
        name: "GundariuM",
        url: `${SITE_URL}/card/${tokenId}`,
        splashImageUrl: `${SITE_URL}/icon.png`,
        splashBackgroundColor: "#080c14",
      },
    },
  };

  return {
    title,
    description: metadata.description,
    openGraph: {
      title,
      description: metadata.description,
      images: [ogImageUrl],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metadata.description,
      images: [ogImageUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify(miniAppEmbed),
    },
  };
}

function attr(metadata: GunplaCardMetadata, name: string): string | number | undefined {
  return metadata.attributes.find((a) => a.trait_type === name)?.value;
}

export default async function CardPage({ params }: PageProps) {
  const { tokenId } = await params;
  const card = await fetchCard(tokenId);
  if (!card) notFound();

  const { metadata, imageUrl } = card;
  const rarity = attr(metadata, "Rarity");
  const faction = attr(metadata, "Faction");
  const series = attr(metadata, "Series");
  const hp = attr(metadata, "HP");

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-12 gap-6 text-center">
      <div className="rounded-xl overflow-hidden border-2 border-[var(--accent)]/40 max-w-sm shadow-[0_0_40px_rgba(255,193,7,0.15)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={metadata.name} className="w-full block" />
      </div>

      <div className="space-y-1">
        <h1 className="font-[family-name:var(--font-orbitron)] text-3xl font-bold text-[var(--accent)] leading-tight">
          {metadata.name}
        </h1>
        <p className="text-[10px] font-[family-name:var(--font-orbitron)] tracking-[0.3em] text-[var(--foreground)]/50 uppercase">
          #{tokenId}
          {rarity ? ` · ${rarity}` : ""}
          {faction ? ` · ${faction}` : ""}
        </p>
      </div>

      {(series || hp !== undefined) && (
        <div className="flex gap-6 text-xs text-[var(--foreground)]/60 font-[family-name:var(--font-orbitron)]">
          {series && <span>SERIES · {series}</span>}
          {hp !== undefined && <span>HP · {hp}</span>}
        </div>
      )}

      <p className="max-w-md text-sm text-[var(--foreground)]/60">
        {metadata.description}
      </p>

      <div className="flex gap-3 flex-wrap justify-center pt-2">
        <a
          href="/mint"
          className="px-6 py-2.5 bg-[var(--accent)] text-black font-bold font-[family-name:var(--font-orbitron)] text-sm rounded-lg hover:brightness-110 transition-all"
        >
          MINT YOUR OWN
        </a>
        <a
          href="/collection"
          className="px-6 py-2.5 border border-[var(--border)] text-[var(--foreground)]/60 text-sm rounded-lg hover:border-[var(--accent)]/60 hover:text-[var(--foreground)] transition-all"
        >
          View Collection
        </a>
      </div>
    </div>
  );
}

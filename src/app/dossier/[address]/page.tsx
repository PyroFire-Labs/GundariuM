import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DossierClient } from "./DossierClient";

interface PageProps {
  params: Promise<{ address: string }>;
}

const SITE_URL = "https://gundarium.xyz";

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  if (!isValidAddress(address)) {
    return { title: "GundariuM — Dossier not found" };
  }

  const title = "Frame-Runner Dossier — GundariuM";
  const description = "Daily streak, check-ins, and starting lineup on GundariuM.";
  const ogImageUrl = `${SITE_URL}/api/og/dossier/${address}`;

  const miniAppEmbed = {
    version: "1",
    imageUrl: ogImageUrl,
    button: {
      title: "View Dossier",
      action: {
        type: "launch_frame",
        name: "GundariuM",
        url: `${SITE_URL}/dossier/${address}`,
        splashImageUrl: `${SITE_URL}/icon.png`,
        splashBackgroundColor: "#080c14",
      },
    },
  };

  return {
    title,
    description,
    openGraph: { title, description, images: [ogImageUrl], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [ogImageUrl] },
    other: { "fc:miniapp": JSON.stringify(miniAppEmbed) },
  };
}

export default async function DossierPage({ params }: PageProps) {
  const { address } = await params;
  if (!isValidAddress(address)) notFound();

  return <DossierClient address={address as `0x${string}`} />;
}

import { NextResponse } from "next/server";

const manifest = {
  frame: {
    name: "GundariuM",
    tags: ["nft", "tcg", "gundam", "gndm", "arena"],
    homeUrl: "https://gundarium.vercel.app",
    iconUrl: "https://gundarium.vercel.app/icon.png",
    ogTitle: "GundariuM - NFT TCG",
    tagline: "Mint, Battle, Trade",
    version: "1",
    imageUrl: "https://gundarium.vercel.app/image.png",
    subtitle: "NFT trading card game",
    webhookUrl: "https://gundarium.vercel.app/api/webhook",
    buttonTitle: "Play Gundarium",
    description: "photograph and mint your Gundam action figure models into unique NFT's and then battle them!",
    castShareUrl: "https://gundarium.vercel.app/",
    ogDescription: "mint your Gundam's into NFT's and FIGHT",
    splashImageUrl: "https://gundarium.vercel.app/splash.png",
    primaryCategory: "games",
    splashBackgroundColor: "#080c14",
  },
  accountAssociation: {
    header: process.env.FARCASTER_HEADER!,
    payload: process.env.FARCASTER_PAYLOAD!,
    signature: process.env.FARCASTER_SIGNATURE!,
  },
};

export async function GET() {
  return NextResponse.json(manifest);
}

import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { Navbar } from "@/components/nav/Navbar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const miniAppEmbed = {
  version: "1",
  imageUrl: "https://gundarium.vercel.app/og-image.png",
  button: {
    title: "Play GundariuM",
    action: {
      type: "launch_frame",
      name: "GundariuM",
      url: "https://gundarium.vercel.app",
      splashImageUrl: "https://gundarium.vercel.app/icon.png",
      splashBackgroundColor: "#080c14",
    },
  },
};

export const metadata: Metadata = {
  title: "GundariuM — Gunpla NFT Battle Game",
  description: "Mint your Gunpla. Battle on Base. Launching May 10, 2026.",
  metadataBase: new URL("https://gundarium.xyz"),
  openGraph: {
    title: "GundariuM — Gunpla NFT Battle Game",
    description: "Mint your Gunpla. Battle on Base. Launching May 10, 2026.",
    url: "https://gundarium.xyz",
    siteName: "GundariuM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GundariuM — Gunpla NFT Battle Game",
    description: "Mint your Gunpla. Battle on Base. Launching May 10, 2026.",
  },
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} antialiased`}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import { LaunchPlaceholder } from "@/components/ui/LaunchPlaceholder";
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
  imageUrl: "https://gundarium.xyz/og-image.png",
  button: {
    title: "Play GundariuM",
    action: {
      type: "launch_frame",
      name: "GundariuM",
      url: "https://gundarium.xyz/mint",
      splashImageUrl: "https://gundarium.xyz/icon.png",
      splashBackgroundColor: "#080c14",
    },
  },
};

export const metadata: Metadata = {
  title: "GundariuM — Launching Before January 1, 2027",
  description: "Jim 2.0, GundariuM's integrated 3-D world environment, is in development.",
  metadataBase: new URL("https://gundarium.xyz"),
  openGraph: {
    title: "GundariuM — Launching Before January 1, 2027",
    description: "Jim 2.0, GundariuM's integrated 3-D world environment, is in development.",
    url: "https://gundarium.xyz",
    siteName: "GundariuM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GundariuM — Launching Before January 1, 2027",
    description: "Jim 2.0, GundariuM's integrated 3-D world environment, is in development.",
  },
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
    "base:app_id": "6a481ec05328c442ea76e81c",
  },
};

export default function RootLayout({
  children: _children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} antialiased`}>
        <LaunchPlaceholder />
      </body>
    </html>
  );
}

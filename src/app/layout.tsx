import type { Metadata } from "next";
import { Orbitron } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { Navbar } from "@/components/nav/Navbar";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "GundariuM — Gunpla NFT Battle Game",
  description: "Stake GNDM. Battle with Gunpla NFTs. Earn on Base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} antialiased`}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}

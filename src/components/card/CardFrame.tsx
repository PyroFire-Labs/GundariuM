"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Rarity } from "@/types/nft";

interface CardFrameProps {
  imageUrl: string;
  suitName: string;
  rarity: Rarity;
  pilotName: string;
  hp: number;
}

const RARITY_COLOR: Record<Rarity, string> = {
  Common: "#9ca3af",
  Uncommon: "#22c55e",
  Rare: "#3b82f6",
  "Ultra Rare": "#a855f7",
  Legendary: "#f59e0b",
};

const RARITY_CLASS: Record<Rarity, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  "Ultra Rare": "rarity-ultra",
  Legendary: "rarity-legendary",
};

function hexGridSvg(color: string): string {
  // Hex tile pattern via inline SVG data URI
  const hex = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='100'>
    <polygon points='28,2 54,17 54,47 28,62 2,47 2,17' fill='none' stroke='${color}' stroke-width='1' opacity='0.12'/>
    <polygon points='28,52 54,67 54,97 28,112 2,97 2,67' fill='none' stroke='${color}' stroke-width='1' opacity='0.12'/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(hex)}")`;
}

export function CardFrame({ imageUrl, suitName, rarity, pilotName, hp }: CardFrameProps) {
  const color = RARITY_COLOR[rarity];
  const rarityClass = RARITY_CLASS[rarity];

  return (
    <div
      className={cn(
        "relative w-full max-w-[300px] aspect-[2/3] border-2 rounded-sm overflow-hidden select-none",
        rarityClass
      )}
      style={{ background: "rgba(8,12,20,0.98)" }}
    >
      {/* Hex grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: hexGridSvg(color),
          backgroundSize: "56px 100px",
        }}
      />

      {/* Header bar — top ~8% */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2"
        style={{
          height: "8%",
          background: "rgba(15,25,41,0.95)",
          borderBottom: `1px solid ${color}`,
        }}
      >
        <span
          className="font-[family-name:var(--font-orbitron)] text-[8px] font-bold tracking-widest uppercase"
          style={{ color }}
        >
          GundariuM
        </span>
        <span
          className="font-mono text-[7px] tracking-wider"
          style={{ color, opacity: 0.7 }}
        >
          NFT CARD
        </span>
      </div>

      {/* Photo area — from 8% to 73% */}
      <div
        className="absolute left-0 right-0 overflow-hidden"
        style={{ top: "8%", height: "65%" }}
      >
        {/* Photo */}
        <Image
          src={imageUrl}
          alt={suitName}
          fill
          className="object-cover"
          sizes="300px"
          unoptimized
        />

        {/* Scan line */}
        <div
          className="absolute left-0 right-0 h-[3%] pointer-events-none z-10"
          style={{
            background: `linear-gradient(to bottom, transparent, ${color}22, ${color}44, ${color}22, transparent)`,
            animation: "scan 3s ease-in-out infinite",
          }}
        />

        {/* Targeting reticle */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          style={{ opacity: 0.15 }}
        >
          {/* Circle */}
          <div
            className="absolute rounded-full"
            style={{
              width: "40%",
              height: "60%",
              border: `1px solid ${color}`,
            }}
          />
          {/* Horizontal line */}
          <div
            className="absolute"
            style={{
              width: "70%",
              height: "1px",
              background: color,
            }}
          />
          {/* Vertical line */}
          <div
            className="absolute"
            style={{
              width: "1px",
              height: "70%",
              background: color,
            }}
          />
        </div>

        {/* HUD readouts */}
        <div
          className="absolute inset-0 pointer-events-none z-20 font-mono"
          style={{ fontSize: "7px", color, lineHeight: 1.4 }}
        >
          {/* Top-left */}
          <div className="absolute top-1 left-1 flex flex-col gap-0">
            <span style={{ opacity: 0.6 }}>SYS ONLINE</span>
            <span style={{ opacity: 0.6 }}>TGT LOCK</span>
          </div>
          {/* Top-right */}
          <div className="absolute top-1 right-1 flex flex-col items-end gap-0">
            <span style={{ opacity: 0.6 }}>FRAME 00</span>
            <span style={{ opacity: 0.6 }}>SCAN OK</span>
          </div>
        </div>

        {/* Corner brackets */}
        {/* Top-left */}
        <div
          className="absolute top-1 left-1 w-4 h-4 pointer-events-none z-20"
          style={{
            borderTop: `2px solid ${color}`,
            borderLeft: `2px solid ${color}`,
            opacity: 0.7,
          }}
        />
        {/* Top-right */}
        <div
          className="absolute top-1 right-1 w-4 h-4 pointer-events-none z-20"
          style={{
            borderTop: `2px solid ${color}`,
            borderRight: `2px solid ${color}`,
            opacity: 0.7,
          }}
        />
        {/* Bottom-left */}
        <div
          className="absolute bottom-1 left-1 w-4 h-4 pointer-events-none z-20"
          style={{
            borderBottom: `2px solid ${color}`,
            borderLeft: `2px solid ${color}`,
            opacity: 0.7,
          }}
        />
        {/* Bottom-right */}
        <div
          className="absolute bottom-1 right-1 w-4 h-4 pointer-events-none z-20"
          style={{
            borderBottom: `2px solid ${color}`,
            borderRight: `2px solid ${color}`,
            opacity: 0.7,
          }}
        />
      </div>

      {/* Nameplate — bottom 27%, from 73% to 100% */}
      <div
        className="absolute left-0 right-0 bottom-0 flex flex-col justify-between px-3 py-2 z-10"
        style={{
          top: "73%",
          background: "rgba(15,25,41,0.97)",
          borderTop: `1px solid ${color}`,
        }}
      >
        {/* Suit name */}
        <p
          className="font-[family-name:var(--font-orbitron)] font-bold leading-tight truncate"
          style={{ color: "#ffffff", fontSize: "11px" }}
        >
          {suitName}
        </p>

        {/* Pilot name */}
        <p
          className="font-mono truncate"
          style={{ color: "#94a3b8", fontSize: "8px" }}
        >
          PILOT: {pilotName.toUpperCase()}
        </p>

        {/* Rarity badge + HP */}
        <div className="flex items-center justify-between mt-1">
          <span
            className="font-[family-name:var(--font-orbitron)] font-bold uppercase tracking-wider"
            style={{ color, fontSize: "8px" }}
          >
            {rarity}
          </span>
          <span
            className="font-mono font-bold"
            style={{ color: "#ffffff", fontSize: "9px" }}
          >
            HP {hp}
          </span>
        </div>

        {/* GundariuM seal */}
        <div className="flex justify-center mt-1">
          <span
            className="font-[family-name:var(--font-orbitron)] tracking-widest"
            style={{ color, fontSize: "6px", opacity: 0.5 }}
          >
            &#x25C6; GUNDARIUM &#x25C6;
          </span>
        </div>
      </div>
    </div>
  );
}

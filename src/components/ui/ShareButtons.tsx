"use client";

import { useCallback, useEffect, useState } from "react";

const SITE_URL = "https://gundarium.xyz";
const SHARE_TEXT = "GundariuM — Photograph your Gunpla, mint NFT battle cards, and fight on-chain. Your shelf is your deck.";

export function ShareButtons() {
  const [isFarcaster, setIsFarcaster] = useState(false);

  useEffect(() => {
    import("@farcaster/miniapp-sdk").then(async ({ sdk }) => {
      const context = await sdk.context;
      setIsFarcaster(!!context?.user?.fid);
    }).catch(() => {});
  }, []);

  const shareOnFarcaster = useCallback(async () => {
    if (isFarcaster) {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      await sdk.actions.composeCast({
        text: `${SHARE_TEXT}\n\n`,
        embeds: [SITE_URL],
      });
    } else {
      window.open(
        `https://warpcast.com/~/compose?text=${encodeURIComponent(SHARE_TEXT)}&embeds[]=${encodeURIComponent(SITE_URL)}`,
        "_blank"
      );
    }
  }, [isFarcaster]);

  const shareOnX = useCallback(() => {
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SITE_URL)}`,
      "_blank"
    );
  }, []);

  const shareOnFacebook = useCallback(() => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}`,
      "_blank"
    );
  }, []);

  const shareGeneric = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "GundariuM", text: SHARE_TEXT, url: SITE_URL });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SITE_URL}`);
    }
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={shareOnFarcaster}
        className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-400 transition-all hover:bg-purple-500/20 hover:border-purple-500/50"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.24 1.2H5.76A4.56 4.56 0 001.2 5.76v12.48a4.56 4.56 0 004.56 4.56h12.48a4.56 4.56 0 004.56-4.56V5.76a4.56 4.56 0 00-4.56-4.56zm.72 16.08h-.96l-.24-3.36h-.01c-.48 1.92-1.68 3.6-3.84 3.6-2.04 0-3.36-1.56-3.36-3.84 0-3.24 2.16-6.48 5.52-6.48.84 0 1.56.12 2.04.36l-.6 2.64c-.36-.12-.72-.24-1.2-.24-1.8 0-3.12 2.04-3.12 3.96 0 1.08.48 1.8 1.32 1.8 1.08 0 2.04-1.32 2.28-2.76l.48-2.52h-1.8l.36-1.68h4.68l-1.44 8.52z" /></svg>
        Farcaster
      </button>
      <button
        onClick={shareOnX}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--foreground)]/20 bg-[var(--foreground)]/5 px-3 py-2 text-xs font-bold text-[var(--foreground)]/70 transition-all hover:bg-[var(--foreground)]/10 hover:border-[var(--foreground)]/30"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
        X
      </button>
      <button
        onClick={shareOnFacebook}
        className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-400 transition-all hover:bg-blue-500/20 hover:border-blue-500/50"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
        Facebook
      </button>
      <button
        onClick={shareGeneric}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--foreground)]/50 transition-all hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" /></svg>
        Share
      </button>
    </div>
  );
}

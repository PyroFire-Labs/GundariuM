"use client";

import { useEffect, useState } from "react";
import { useModelStatus } from "@/lib/hooks/useModelStatus";

interface Model3DViewerProps {
  tokenId: bigint | string | null;
  chainId: number | null;
  imageUrl: string;
  name: string;
  className?: string;
}

/**
 * Every mint gets a 3D model generated in the background (see worker/ at
 * the repo root) alongside the 2D card art. This shows the 2D image by
 * default — always available immediately — and offers a "3D" toggle once
 * the model finishes rendering.
 */
export function Model3DViewer({ tokenId, chainId, imageUrl, name, className }: Model3DViewerProps) {
  const { status, modelUrl } = useModelStatus(tokenId, chainId);
  const [showModel, setShowModel] = useState(false);

  useEffect(() => {
    if (status === "ready") {
      import("@google/model-viewer");
    }
  }, [status]);

  return (
    <div className={className}>
      <div className="relative rounded-xl overflow-hidden border-2 border-[var(--accent)]/40 shadow-[0_0_40px_rgba(255,193,7,0.15)]">
        {showModel && modelUrl ? (
          <model-viewer
            src={modelUrl}
            alt={name}
            camera-controls
            auto-rotate
            shadow-intensity="0.8"
            exposure="1"
            style={{ width: "100%", aspectRatio: "1 / 1", backgroundColor: "var(--surface)" }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="w-full block" />
        )}

        {status === "ready" && modelUrl && (
          <button
            onClick={() => setShowModel((v) => !v)}
            className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/70 border border-[var(--accent)]/50 text-[var(--accent)] text-xs font-[family-name:var(--font-orbitron)] hover:bg-black/85 transition-colors"
          >
            {showModel ? "2D CARD" : "VIEW IN 3D"}
          </button>
        )}

        {(status === "pending" || status === "processing") && (
          <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/70 border border-[var(--border)] text-[var(--foreground)]/60 text-xs font-[family-name:var(--font-orbitron)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            FORGING 3D MODEL…
          </div>
        )}
      </div>
    </div>
  );
}

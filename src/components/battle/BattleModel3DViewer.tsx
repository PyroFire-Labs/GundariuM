"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useModelStatus, type ModelStatusValue } from "@/lib/hooks/useModelStatus";

export type BattleMoveClip = "primary_attack" | "secondary_attack" | "tertiary_attack" | "special_attack";

export interface BattleModel3DHandle {
  /** Plays the named clip once and resolves when model-viewer reports "finished". No-op if the model isn't ready yet. */
  playMove: (clip: BattleMoveClip) => Promise<void>;
}

interface BattleModel3DViewerProps {
  tokenId: bigint | string | null;
  chainId: number | null;
  name: string;
  className?: string;
  onStatusChange?: (status: ModelStatusValue) => void;
}

// model-viewer is a Custom Element, not a React component — its props
// (camera-controls, shadow-intensity, etc.) are plain HTML attributes.
// Dynamically imported below so this file has no hard dependency on it at
// module-eval time (same pattern as the existing Model3DViewer).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        "camera-controls"?: boolean;
        "shadow-intensity"?: string;
        exposure?: string;
      };
    }
  }
}

/**
 * Battle-specific 3D viewer: unlike the card-page Model3DViewer, this one
 * has no 2D/3D toggle — the Arena only ever mounts this once a fighter's
 * model is confirmed "ready" (see the wait-gate in arena/page.tsx), and
 * exposes an imperative playMove() so the battle loop can trigger the exact
 * animation clip baked into the GLB for whichever weapon slot was picked
 * (see worker/blender/lib/animation.py).
 */
export const BattleModel3DViewer = forwardRef<BattleModel3DHandle, BattleModel3DViewerProps>(
  function BattleModel3DViewer({ tokenId, chainId, name, className, onStatusChange }, ref) {
    const { status, modelUrl } = useModelStatus(tokenId, chainId);
    const elRef = useRef<HTMLElement & { animationName?: string; play?: (opts?: { repetitions?: number }) => void }>(null);
    const [libReady, setLibReady] = useState(false);

    useEffect(() => {
      import("@google/model-viewer").then(() => setLibReady(true));
    }, []);

    useEffect(() => {
      onStatusChange?.(status);
    }, [status, onStatusChange]);

    useImperativeHandle(ref, () => ({
      playMove: (clip) =>
        new Promise((resolve) => {
          const el = elRef.current;
          if (!el || status !== "ready") {
            resolve();
            return;
          }
          el.animationName = clip;
          const onFinished = () => {
            el.removeEventListener("finished", onFinished);
            resolve();
          };
          el.addEventListener("finished", onFinished);
          el.play?.({ repetitions: 1 });
          // Safety timeout — every archetype clip is ~1s at 24fps (see
          // bake_move_animations), so if "finished" never fires for any
          // reason, don't leave the battle loop hung waiting on it forever.
          setTimeout(() => {
            el.removeEventListener("finished", onFinished);
            resolve();
          }, 2000);
        }),
    }));

    if (status !== "ready" || !modelUrl || !libReady) {
      return (
        <div className={className}>
          <div className="flex items-center justify-center w-full aspect-square rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div className={className}>
        <model-viewer
          ref={elRef}
          src={modelUrl}
          alt={name}
          camera-controls
          shadow-intensity="0.6"
          exposure="1"
          style={{ width: "100%", aspectRatio: "1 / 1", backgroundColor: "var(--surface)", display: "block" }}
        />
      </div>
    );
  }
);

"use client";

import { useEffect, useState } from "react";
import { ipfsGatewayCandidates } from "@/lib/ipfs";

interface OwnedNftArtworkProps {
  tokenUri: string;
  alt: string;
  className?: string;
  imageClassName?: string;
}

export function OwnedNftArtwork({ tokenUri, alt, className = "", imageClassName = "" }: OwnedNftArtworkProps) {
  return <OwnedNftArtworkContent key={tokenUri} tokenUri={tokenUri} alt={alt} className={className} imageClassName={imageClassName} />;
}

function OwnedNftArtworkContent({ tokenUri, alt, className = "", imageClassName = "" }: OwnedNftArtworkProps) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [loadedImageIndex, setLoadedImageIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadArtwork() {
      for (const metadataUrl of ipfsGatewayCandidates(tokenUri)) {
        const requestController = new AbortController();
        const timeoutId = window.setTimeout(() => requestController.abort(), 7000);
        const abortRequest = () => requestController.abort();
        controller.signal.addEventListener("abort", abortRequest, { once: true });
        try {
          const response = await fetch(metadataUrl, {
            signal: requestController.signal,
            headers: { Accept: "application/json" },
          });
          if (!response.ok) continue;

          const metadata = await response.json();
          const imageUri = metadata?.image ?? metadata?.image_url;
          if (typeof imageUri !== "string" || !imageUri) continue;

          if (!cancelled) {
            setImageUrls(ipfsGatewayCandidates(imageUri));
            setStatus("ready");
          }
          return;
        } catch {
          if (controller.signal.aborted) return;
        } finally {
          window.clearTimeout(timeoutId);
          controller.signal.removeEventListener("abort", abortRequest);
        }
      }

      if (!cancelled) setStatus("error");
    }

    void loadArtwork();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tokenUri]);

  useEffect(() => {
    if (status !== "ready" || loadedImageIndex === imageIndex) return;

    const timeoutId = window.setTimeout(() => {
      if (imageIndex + 1 < imageUrls.length) setImageIndex((index) => index + 1);
      else setStatus("error");
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [imageIndex, imageUrls.length, loadedImageIndex, status]);

  return (
    <div className={`owned-nft-artwork ${className}`}>
      {status === "loading" && <span className="owned-nft-artwork-state">LOADING NFT ART…</span>}
      {status === "error" && <span className="owned-nft-artwork-state">NFT ART UNAVAILABLE</span>}
      {status === "ready" && imageUrls[imageIndex] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={alt}
          className={imageClassName}
          onLoad={() => setLoadedImageIndex(imageIndex)}
          onError={() => {
            if (imageIndex + 1 < imageUrls.length) setImageIndex((index) => index + 1);
            else setStatus("error");
          }}
          src={imageUrls[imageIndex]}
        />
      )}
    </div>
  );
}

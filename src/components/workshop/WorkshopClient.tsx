"use client";

import { useState } from "react";
import type { WorkshopFrame } from "@/lib/workshop/catalog";
import { FrameGallery } from "./FrameGallery";
import { WorkshopHeader } from "./WorkshopHeader";
import "./workshop.css";

interface WorkshopClientProps {
  frames: readonly WorkshopFrame[];
}

export function WorkshopClient({ frames }: WorkshopClientProps) {
  const [selectedFrameId, setSelectedFrameId] = useState(frames[0]?.id ?? 0);
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? frames[0];

  if (!selectedFrame) return null;

  return (
    <main className="workshop-page">
      <WorkshopHeader />
      <div className="workshop-layout">
        <FrameGallery frames={frames} onSelectFrame={setSelectedFrameId} selectedFrameId={selectedFrame.id} />
        <section aria-labelledby="viewport-heading" className="workshop-viewport">
          <div className="workshop-section-heading">
            <div>
              <p className="workshop-eyebrow">Assembly deck / simulated</p>
              <h2 id="viewport-heading">{selectedFrame.name}</h2>
            </div>
            <span>PUBLIC CATALOG</span>
          </div>
          <div className="workshop-image-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${selectedFrame.name} selected catalog frame`} src={selectedFrame.image} />
          </div>
          <p className="workshop-disclosure">Virtual concept view. This screen makes no wallet, on-chain, server, or model-generation request.</p>
        </section>
        <aside aria-label="Selected frame simulated specifications" className="workshop-inspector">
          <p className="workshop-eyebrow">Simulated specs</p>
          <h2>{selectedFrame.name}</h2>
          <dl className="workshop-stats">
            {selectedFrame.stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
          </dl>
          <div className="workshop-provisional-deck">
            <h3>Assemblies</h3>
            <p>{selectedFrame.assemblies.length} virtual assembly records are ready for inspection.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

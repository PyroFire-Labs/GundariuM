"use client";

import { useState } from "react";
import { toggleSavedFrame, type WorkshopAssemblyId, type WorkshopFrame } from "@/lib/workshop/catalog";
import { AssemblyDeck } from "./AssemblyDeck";
import { FrameGallery } from "./FrameGallery";
import { FrameInspector } from "./FrameInspector";
import { WorkshopHeader } from "./WorkshopHeader";
import "./workshop.css";

interface WorkshopClientProps {
  frames: readonly WorkshopFrame[];
}

export function WorkshopClient({ frames }: WorkshopClientProps) {
  const [selectedFrameId, setSelectedFrameId] = useState(frames[0]?.id ?? 0);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<WorkshopAssemblyId>("head-optics");
  const [savedFrameIds, setSavedFrameIds] = useState<Set<number>>(new Set());
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
        <AssemblyDeck assemblies={selectedFrame.assemblies} onSelectAssembly={setSelectedAssemblyId} selectedAssemblyId={selectedAssemblyId} />
        <FrameInspector frame={selectedFrame} isSaved={savedFrameIds.has(selectedFrame.id)} onToggleSaved={() => setSavedFrameIds((saved) => toggleSavedFrame(saved, selectedFrame.id))} savedCount={savedFrameIds.size} selectedAssembly={selectedFrame.assemblies.find((assembly) => assembly.id === selectedAssemblyId) ?? selectedFrame.assemblies[0]} />
      </div>
    </main>
  );
}

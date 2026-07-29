"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";

interface FlippableCardProps {
  front: ReactNode;
  back: ReactNode;
  /** Sizes the outer wrapper. Defaults to the collection card's width. */
  className?: string;
}

/**
 * Generic 3D flip wrapper — click anywhere to toggle between front and back.
 * Extracted from the mint-success screen so the flip mechanics (and, via
 * CardBack, the back-face content) are shared instead of duplicated.
 */
export function FlippableCard({ front, back, className }: FlippableCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`cursor-pointer ${className ?? "w-full max-w-[300px]"}`}
      style={{ perspective: 1200 }}
      onClick={() => setFlipped(!flipped)}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 80 }}
        style={{ transformStyle: "preserve-3d" }}
        className="relative"
      >
        <div style={{ backfaceVisibility: "hidden" }}>{front}</div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Fuse, { type IFuseOptions } from "fuse.js";
import type { SuitData } from "@/types/nft";
import { useMintStore } from "@/store/useMintStore";

const FUSE_OPTIONS: IFuseOptions<SuitData> = {
  keys: [
    { name: "name", weight: 0.4 },
    { name: "model_number", weight: 0.35 },
    { name: "series", weight: 0.15 },
    { name: "pilot", weight: 0.1 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
};

export function SuitSearch() {
  const { setSelectedSuit, goTo } = useMintStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SuitData[]>([]);
  const [fuse, setFuse] = useState<Fuse<SuitData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/data/suits.json")
      .then((r) => r.json())
      .then((data: SuitData[]) => {
        setFuse(new Fuse(data, FUSE_OPTIONS));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!fuse || query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const hits = fuse.search(query, { limit: 8 }).map((r) => r.item);
    setResults(hits);
    setHighlightIndex(0);
    setOpen(hits.length > 0);
  }, [query, fuse]);

  const selectSuit = useCallback(
    (suit: SuitData) => {
      setSelectedSuit(suit);
      setQuery(suit.name);
      setOpen(false);
      goTo("grade_select");
    },
    [setSelectedSuit, goTo]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[highlightIndex]) {
      e.preventDefault();
      selectSuit(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Card container */}
      <div className="relative border border-[var(--border)] rounded-lg bg-[var(--card)] p-6 space-y-5">
        {/* Corner brackets — Bandai box art style */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#1a3a6b] rounded-tl" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#1a3a6b] rounded-tr" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#1a3a6b] rounded-bl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#1a3a6b] rounded-br" />

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-[10px] tracking-[0.3em] text-[#1a3a6b] uppercase font-[family-name:var(--font-orbitron)]">
            MS UNIT IDENTIFICATION
          </p>
          <h2 className="font-[family-name:var(--font-orbitron)] text-lg font-bold text-[var(--foreground)]">
            SELECT YOUR SUIT
          </h2>
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder={loading ? "Loading database..." : "Search by name, model number, or pilot..."}
            disabled={loading}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded text-[var(--foreground)] text-sm placeholder:text-[var(--foreground)]/40 focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Dropdown results */}
        {open && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 mx-6 z-50 mt-1 border border-[var(--border)] rounded bg-[var(--card)] shadow-lg max-h-80 overflow-y-auto"
          >
            {results.map((suit, i) => (
              <button
                key={suit.id}
                type="button"
                onClick={() => selectSuit(suit)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`w-full text-left px-4 py-3 flex flex-col gap-0.5 transition-colors border-b border-[var(--border)] last:border-b-0 ${
                  i === highlightIndex
                    ? "bg-[var(--accent)]/10"
                    : "hover:bg-[var(--accent)]/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-orbitron)] text-sm font-bold text-[var(--foreground)]">
                    {suit.name}
                  </span>
                  <span className="text-[10px] tracking-wider text-[#1a3a6b] font-mono">
                    {suit.model_number}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--foreground)]/50">
                  <span>{suit.series}</span>
                  <span className="text-[var(--border)]">/</span>
                  <span>{suit.timeline}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Helper text */}
        <p className="text-center text-xs text-[var(--foreground)]/40">
          148 mobile suits across all major Gundam timelines
        </p>
      </div>
    </div>
  );
}

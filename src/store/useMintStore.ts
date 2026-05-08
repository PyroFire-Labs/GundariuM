import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TraitSet, KitbashTraits, TraitRarity } from "@/types/nft";

export type MintStep =
  | "idle"
  | "generating"
  | "reveal"
  | "confirming"
  | "success";

interface MintState {
  step: MintStep;
  faction: string | null;
  kitbashTraits: KitbashTraits | null;
  traitRarities: Record<string, TraitRarity> | null;
  traits: TraitSet | null;
  fallbackName: string | null;
  customName: string;
  generatedImageBase64: string | null;
  generatedImageMimeType: string | null;
  imageIpfsHash: string | null;
  metadataUri: string | null;
  mintedTokenId: bigint | null;
  error: string | null;

  // Actions
  setFaction: (faction: string | null) => void;
  setGenerationResult: (result: {
    traits: TraitSet;
    kitbashTraits: KitbashTraits;
    traitRarities: Record<string, TraitRarity>;
    imageBase64: string;
    imageMimeType: string;
  }) => void;
  setTraits: (traits: TraitSet) => void;
  setCustomName: (name: string) => void;
  setImageIpfsHash: (hash: string) => void;
  setMetadataUri: (uri: string) => void;
  setMintedTokenId: (id: bigint) => void;
  setError: (error: string | null) => void;
  goTo: (step: MintStep) => void;
  reset: () => void;
}

const initialState = {
  step: "idle" as MintStep,
  faction: null,
  kitbashTraits: null,
  traitRarities: null,
  traits: null,
  fallbackName: null,
  customName: "",
  generatedImageBase64: null,
  generatedImageMimeType: null,
  imageIpfsHash: null,
  metadataUri: null,
  mintedTokenId: null,
  error: null,
};

// Some mobile-wallet flows (Farcaster mini-app, deep-linking wallet apps)
// reload the parent page when the wallet UI dismisses after a transaction
// approval. Without persistence the in-memory Zustand store reset to
// `initialState` after the reload, dropping the user back onto the faction
// picker mid-transaction. Persisting to localStorage lets the mint flow
// resume on reload. Heavy fields (`generatedImageBase64`,
// `generatedImageMimeType`) are deliberately *not* persisted — a single
// 1–2 MB base64 PNG would chew through localStorage's ~5 MB origin cap.
// Components that need to display the image after rehydration fall back
// to the IPFS gateway via `imageIpfsHash`.
export const useMintStore = create<MintState>()(
  persist(
    (set) => ({
      ...initialState,
      setFaction: (faction) => set({ faction }),
      setGenerationResult: (result) =>
        set({
          traits: result.traits,
          fallbackName: result.traits.name,
          customName: "",
          kitbashTraits: result.kitbashTraits,
          traitRarities: result.traitRarities,
          generatedImageBase64: result.imageBase64,
          generatedImageMimeType: result.imageMimeType,
          step: "reveal",
          error: null,
        }),
      setTraits: (traits) => set({ traits }),
      setCustomName: (name) =>
        set((state) => {
          if (!state.traits || !state.fallbackName) return { customName: name };
          const effective = name.trim() || state.fallbackName;
          return {
            customName: name,
            traits: { ...state.traits, name: effective },
          };
        }),
      setImageIpfsHash: (hash) => set({ imageIpfsHash: hash }),
      setMetadataUri: (uri) => set({ metadataUri: uri }),
      setMintedTokenId: (id) => set({ mintedTokenId: id }),
      setError: (error) => set({ error }),
      goTo: (step) => set({ step, error: null }),
      reset: () => set(initialState),
    }),
    {
      name: "gundarium-mint-state",
      version: 1,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          // SSR fallback — no-op storage that always returns null.
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      // Cast through `unknown` because we serialize `mintedTokenId` (bigint)
      // as a string for JSON-safety; `merge` below converts it back.
      partialize: (state) =>
        ({
          step: state.step,
          faction: state.faction,
          kitbashTraits: state.kitbashTraits,
          traitRarities: state.traitRarities,
          traits: state.traits,
          fallbackName: state.fallbackName,
          customName: state.customName,
          imageIpfsHash: state.imageIpfsHash,
          metadataUri: state.metadataUri,
          mintedTokenId:
            state.mintedTokenId !== null
              ? state.mintedTokenId.toString()
              : null,
        }) as unknown as MintState,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<MintState> & {
          mintedTokenId?: string | null;
        };
        return {
          ...currentState,
          ...persisted,
          mintedTokenId:
            persisted.mintedTokenId != null && persisted.mintedTokenId !== ""
              ? BigInt(persisted.mintedTokenId)
              : null,
        };
      },
    }
  )
);

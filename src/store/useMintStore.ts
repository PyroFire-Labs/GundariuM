import { create } from "zustand";
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

export const useMintStore = create<MintState>((set) => ({
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
}));

import { create } from "zustand";
import type { TraitSet, SuitData } from "@/types/nft";
import type { KitGrade } from "@/types/nft";

export type MintStep =
  | "suit_search"
  | "grade_select"
  | "idle"
  | "uploading"
  | "analyzing"
  | "reviewing"
  | "card_preview"
  | "cosmetics_select"
  | "confirming"
  | "success";

interface MintState {
  step: MintStep;
  selectedSuit: SuitData | null;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  imageIpfsHash: string | null;
  grade: KitGrade | null;
  traits: TraitSet | null;
  metadataUri: string | null;
  mintedTokenId: bigint | null;
  error: string | null;

  setSelectedSuit: (suit: SuitData) => void;
  setImage: (file: File, previewUrl: string) => void;
  setGrade: (grade: KitGrade) => void;
  setTraits: (traits: TraitSet) => void;
  setImageIpfsHash: (hash: string) => void;
  setMetadataUri: (uri: string) => void;
  setMintedTokenId: (id: bigint) => void;
  setError: (error: string | null) => void;
  goTo: (step: MintStep) => void;
  reset: () => void;
}

const initialState = {
  step: "suit_search" as MintStep,
  selectedSuit: null,
  imageFile: null,
  imagePreviewUrl: null,
  imageIpfsHash: null,
  grade: null,
  traits: null,
  metadataUri: null,
  mintedTokenId: null,
  error: null,
};

export const useMintStore = create<MintState>((set) => ({
  ...initialState,

  setSelectedSuit: (suit) => set({ selectedSuit: suit }),
  setImage: (file, previewUrl) =>
    set({ imageFile: file, imagePreviewUrl: previewUrl }),
  setGrade: (grade) => set({ grade }),
  setTraits: (traits) => set({ traits }),
  setImageIpfsHash: (hash) => set({ imageIpfsHash: hash }),
  setMetadataUri: (uri) => set({ metadataUri: uri }),
  setMintedTokenId: (id) => set({ mintedTokenId: id }),
  setError: (error) => set({ error }),
  goTo: (step) => set({ step, error: null }),
  reset: () => set(initialState),
}));

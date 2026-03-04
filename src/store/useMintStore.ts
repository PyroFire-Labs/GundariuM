import { create } from "zustand";
import type { TraitSet } from "@/types/nft";

export type MintStep =
  | "idle"
  | "uploading"
  | "analyzing"
  | "reviewing"
  | "confirming"
  | "success";

interface MintState {
  step: MintStep;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  imageIpfsHash: string | null;
  traits: TraitSet | null;
  metadataUri: string | null;
  mintedTokenId: bigint | null;
  error: string | null;

  setImage: (file: File, previewUrl: string) => void;
  setTraits: (traits: TraitSet) => void;
  setImageIpfsHash: (hash: string) => void;
  setMetadataUri: (uri: string) => void;
  setMintedTokenId: (id: bigint) => void;
  setError: (error: string | null) => void;
  goTo: (step: MintStep) => void;
  reset: () => void;
}

const initialState = {
  step: "idle" as MintStep,
  imageFile: null,
  imagePreviewUrl: null,
  imageIpfsHash: null,
  traits: null,
  metadataUri: null,
  mintedTokenId: null,
  error: null,
};

export const useMintStore = create<MintState>((set) => ({
  ...initialState,

  setImage: (file, previewUrl) =>
    set({ imageFile: file, imagePreviewUrl: previewUrl }),
  setTraits: (traits) => set({ traits }),
  setImageIpfsHash: (hash) => set({ imageIpfsHash: hash }),
  setMetadataUri: (uri) => set({ metadataUri: uri }),
  setMintedTokenId: (id) => set({ mintedTokenId: id }),
  setError: (error) => set({ error }),
  goTo: (step) => set({ step, error: null }),
  reset: () => set(initialState),
}));

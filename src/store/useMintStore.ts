import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TraitSet, KitbashTraits, TraitRarity } from "@/types/nft";

export type MintStep =
  | "idle"
  | "generating"
  | "reveal"
  | "confirming"
  | "success";

/**
 * A confirmed reroll() burn awaiting a successful generation.
 *
 * The wallet and chain are stored alongside the hash because the burn is only
 * redeemable by the wallet that paid it, on the chain it was paid on — the
 * backend matches the `Rerolled` event's `user` against the caller and looks
 * the tx up on one configured chain. Without them, connecting a second wallet
 * in the same browser made that wallet resume (and re-resume, forever) a burn
 * it can never redeem.
 */
export interface PendingReroll {
  hash: `0x${string}`;
  walletAddress: string;
  chainId: number;
}

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
  // A reroll() burn that is confirmed on-chain but whose generation hasn't
  // succeeded yet. Lives here rather than in useReroll's local state because
  // this store is persisted: a rate-limit rejection (or any other post-burn
  // failure) followed by a reload would otherwise strand a real 60,000 GNRM
  // burn with no way to redeem it.
  pendingReroll: PendingReroll | null;

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
  setPendingReroll: (pending: PendingReroll | null) => void;
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
  pendingReroll: null as PendingReroll | null,
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
      setPendingReroll: (pending) => set({ pendingReroll: pending }),
      goTo: (step) => set({ step, error: null }),
      // Deliberately preserves `pendingReroll`. An unredeemed burn is real
      // money the user has already spent; restarting the mint flow must not
      // forfeit it. useReroll clears it in exactly two places, both of which
      // mean the burn is provably gone: a generation POST the server answered
      // 200 to (the payment is spent), and a verification failure whose reason
      // proves the hash can never be redeemed (see isTerminalRerollReason).
      reset: () =>
        set((state) => ({
          ...initialState,
          pendingReroll: state.pendingReroll,
        })),
    }),
    {
      name: "gundarium-mint-state",
      version: 2,
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
          // Persisted deliberately — surviving a reload is the entire point.
          pendingReroll: state.pendingReroll,
          mintedTokenId:
            state.mintedTokenId !== null
              ? state.mintedTokenId.toString()
              : null,
        }) as unknown as MintState,
      // v1 persisted a bare `pendingRerollTxHash` string with no wallet or
      // chain attached — precisely the ambiguity v2 exists to remove, since
      // there is no way to tell whose burn it was. Drop the key instead of
      // resurrecting it as an entry that could never be matched. Safe to
      // discard: RerollBurner is still a placeholder address on both chains,
      // so no v1 state can contain a real burn. Everything else is carried
      // through untouched — bumping the version without a migrate would make
      // zustand throw away a live mint flow mid-transaction.
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Record<string, unknown>;
        if (version < 2) {
          delete state.pendingRerollTxHash;
        }
        return state;
      },
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

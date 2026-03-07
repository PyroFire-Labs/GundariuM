import type { TraitSet } from "./nft";

export interface AnalyzeGunplaRequest {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface AnalyzeGunplaResponse {
  traits: TraitSet;
  promptVersion: string;
}

export interface MintMetadataRequest {
  traits: TraitSet;
  // image is sent as FormData file field
}

export interface MintMetadataResponse {
  tokenUri: string; // ipfs://CID of metadata JSON
  imageUrl: string; // ipfs://CID of image
  imageCid: string;
  metadataCid: string;
}

export interface ApiError {
  error: string;
  details?: string;
}

import { PinataSDK } from "pinata";
import type { TraitSet, GunplaCardMetadata } from "@/types/nft";
import { buildOpenSeaAttributes } from "@/types/nft";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

export async function uploadImage(file: File): Promise<string> {
  const result = await pinata.upload.public.file(file);
  return result.cid;
}

export async function uploadMetadata(
  traits: TraitSet,
  imageIpfsHash: string
): Promise<string> {
  const metadata: GunplaCardMetadata = {
    name: traits.name,
    description: `${traits.name} — ${traits.series}. Piloted by ${traits.pilotName}.`,
    image: `ipfs://${imageIpfsHash}`,
    attributes: buildOpenSeaAttributes(traits),
  };

  const result = await pinata.upload.public.json(metadata);
  return `ipfs://${result.cid}`;
}

import { readFile } from "node:fs/promises";
import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

export async function uploadGlb(filePath: string, fileName: string): Promise<string> {
  const bytes = await readFile(filePath);
  // Node 20+ has global File (via undici); the Pinata SDK's upload.public.file
  // takes the same File type a browser would hand it.
  const file = new File([bytes], fileName, { type: "model/gltf-binary" });
  const result = await pinata.upload.public.file(file);
  return `ipfs://${result.cid}`;
}

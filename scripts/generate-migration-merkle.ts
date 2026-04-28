/**
 * Generate Merkle tree for GNDM→GUNR migration whitelist.
 *
 * Usage: npx tsx scripts/generate-migration-merkle.ts
 *
 * Input:  scripts/migration-whitelist.json — [{ address, cap }]
 * Output: scripts/migration-proofs.json — { root, proofs: { [address]: { cap, proof } } }
 *
 * IMPORTANT — leaf format must match GNDMtoGUNR.sol's verify code:
 *   bytes32 leaf = keccak256(abi.encodePacked(msg.sender, cap));
 *
 * That's `address (20 bytes) || uint256 (32 bytes)` then a single keccak256.
 * We use SimpleMerkleTree (which takes pre-hashed bytes32 leaves) so OZ's
 * MerkleProof.verify can verify proofs against the resulting root with no
 * extra hashing — same pattern as scripts/generate-merkle.ts for GunplaCard.
 *
 * NOTE: do NOT use StandardMerkleTree.of() here — that produces double-hashed
 * leaves over abi.encode (NOT abi.encodePacked), which is incompatible with
 * the contract's single-hash packed verify. Mismatch makes every proof fail.
 */

import { SimpleMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak256, encodePacked, getAddress, parseUnits } from "viem";
import * as fs from "fs";
import * as path from "path";

interface WhitelistEntry {
  address: string;
  cap: number;
}

const inputPath = path.resolve(__dirname, "migration-whitelist.json");
const outputPath = path.resolve(__dirname, "migration-proofs.json");

const entries: WhitelistEntry[] = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

console.log(`\nBuilding migration Merkle tree for ${entries.length} addresses...`);

// Pre-compute leaves matching the contract's packed-single-hash format.
const leafFor = (addr: string, capWei: bigint): `0x${string}` =>
  keccak256(encodePacked(["address", "uint256"], [getAddress(addr), capWei]));

const capsWei: bigint[] = entries.map((e) =>
  parseUnits(e.cap.toString(), 18),
);

const leaves = entries.map((e, i) => leafFor(e.address, capsWei[i]));

const tree = SimpleMerkleTree.of(leaves);

console.log(`\nMerkle Root: ${tree.root}`);

// Build per-address proof map keyed by lowercased address (frontend lookup
// normalizes wallet addresses to lowercase before reading the file).
const proofs: Record<string, { cap: string; proof: string[] }> = {};

for (const [i, e] of entries.entries()) {
  const leaf = leafFor(e.address, capsWei[i]);
  proofs[e.address.toLowerCase()] = {
    cap: capsWei[i].toString(),
    proof: tree.getProof(leaf),
  };
}

const output = {
  root: tree.root,
  totalAddresses: entries.length,
  generatedAt: new Date().toISOString(),
  proofs,
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nWritten to: ${outputPath}`);
console.log(`Use root in deploy: ${tree.root}`);

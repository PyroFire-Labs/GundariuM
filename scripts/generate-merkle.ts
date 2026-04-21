/**
 * Generate Merkle tree for GunplaCard whitelist.
 *
 * Usage: npx tsx scripts/generate-merkle.ts
 *
 * Input:  scripts/whitelist.json — [{ address, tier }]
 * Output: scripts/whitelist-proofs.json — { root, proofs: { [address]: { tier, proof } } }
 *
 * IMPORTANT — leaf format must match the GunplaCard contract:
 *   bytes32 leaf = keccak256(abi.encodePacked(msg.sender, tier));
 *
 * That's `address (20 bytes) || uint8 (1 byte)` then a single keccak256.
 * We use SimpleMerkleTree (which takes pre-hashed bytes32 leaves) so the
 * tree is built around our packed leaves, and OZ MerkleProof.verify can
 * verify proofs against the resulting root with no extra hashing.
 */

import { SimpleMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak256, encodePacked, getAddress } from "viem";
import * as fs from "fs";
import * as path from "path";

interface WhitelistEntry {
  address: string;
  tier: number;
}

const inputPath = path.resolve(__dirname, "whitelist.json");
const outputPath = path.resolve(__dirname, "whitelist-proofs.json");

const entries: WhitelistEntry[] = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

console.log(`\nBuilding Merkle tree for ${entries.length} addresses...`);
console.log(`   VIP (tier 1): ${entries.filter((e) => e.tier === 1).length}`);
console.log(`   WL  (tier 2): ${entries.filter((e) => e.tier === 2).length}`);

// Pre-compute leaves using the SAME packed encoding the contract uses.
// keccak256(abi.encodePacked(address, uint8))
const leafFor = (addr: string, tier: number): `0x${string}` =>
  keccak256(encodePacked(["address", "uint8"], [getAddress(addr), tier]));

const leaves = entries.map((e) => leafFor(e.address, e.tier));

const tree = SimpleMerkleTree.of(leaves);

console.log(`\nMerkle Root: ${tree.root}`);

// Build per-address proof map keyed by lowercased address (frontend lookup
// normalizes wallet addresses to lowercase before reading the file)
const proofs: Record<string, { tier: number; proof: string[] }> = {};

for (const entry of entries) {
  const leaf = leafFor(entry.address, entry.tier);
  proofs[entry.address.toLowerCase()] = {
    tier: entry.tier,
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
console.log(`   Use root in contract: card.setMerkleRoot("${tree.root}")`);

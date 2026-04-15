/**
 * Generate Merkle tree for GNDM→GUNR migration whitelist.
 *
 * Usage: npx tsx scripts/generate-migration-merkle.ts
 *
 * Input:  scripts/migration-whitelist.json — [{ address, cap }]
 * Output: scripts/migration-proofs.json — { root, proofs: { [address]: { cap, proof } } }
 */

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { parseUnits } from "viem";
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

// Build tree — leaves are [address, cap in wei]
const values = entries.map((e) => [
  e.address,
  parseUnits(e.cap.toString(), 18).toString(),
] as [string, string]);

const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

console.log(`\nMerkle Root: ${tree.root}`);

// Build per-address proof map
const proofs: Record<string, { cap: string; proof: string[] }> = {};

for (const [i, v] of tree.entries()) {
  const addr = v[0] as string;
  const cap = v[1] as string;
  proofs[addr.toLowerCase()] = {
    cap,
    proof: tree.getProof(i),
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

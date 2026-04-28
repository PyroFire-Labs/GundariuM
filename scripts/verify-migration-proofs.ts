/**
 * Sanity-check the migration proofs file against the EXACT verify logic
 * the GNDMtoGUNR contract uses (`MerkleProof.verify` over a leaf computed
 * as `keccak256(abi.encodePacked(addr, cap))`).
 *
 * Walks the proof for every entry and confirms it hashes up to the root.
 * Non-zero exit code if any entry fails.
 *
 * Run: npx tsx scripts/verify-migration-proofs.ts
 */

import { keccak256, encodePacked, getAddress, concat, toHex } from "viem";
import * as fs from "fs";
import * as path from "path";

const proofsPath = path.resolve(__dirname, "migration-proofs.json");
const data = JSON.parse(fs.readFileSync(proofsPath, "utf-8"));

const root: `0x${string}` = data.root;
const proofs: Record<string, { cap: string; proof: string[] }> = data.proofs;

// Replicate OpenZeppelin MerkleProof.verify (sorted-pair hashing).
function processProof(leaf: `0x${string}`, proof: `0x${string}`[]): `0x${string}` {
  let computed = leaf;
  for (const sibling of proof) {
    const [a, b] = computed < sibling ? [computed, sibling] : [sibling, computed];
    computed = keccak256(concat([a, b]));
  }
  return computed;
}

let ok = 0;
let fail = 0;
const failures: string[] = [];

for (const [addr, rec] of Object.entries(proofs)) {
  const leaf = keccak256(
    encodePacked(["address", "uint256"], [getAddress(addr), BigInt(rec.cap)]),
  );
  const computedRoot = processProof(leaf, rec.proof as `0x${string}`[]);
  if (computedRoot === root) {
    ok++;
  } else {
    fail++;
    failures.push(`${addr}: got ${computedRoot}`);
  }
}

console.log(`\nverified: ${ok} / ${Object.keys(proofs).length}`);
console.log(`expected root: ${root}`);
if (fail > 0) {
  console.log(`\nFAILURES (${fail}):`);
  for (const f of failures.slice(0, 5)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("all proofs verify against the on-chain verify logic");

/**
 * Scan on-chain GNDM holders and generate migration whitelist.
 *
 * Usage: npx tsx scripts/scan-gndm-holders.ts
 *
 * Queries Transfer events from the MintClub airdrop contract to find claimers,
 * then checks current GNDM balance for each. Combines with known large holders.
 * Outputs scripts/migration-whitelist.json.
 */

import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { base } from "viem/chains";
import * as fs from "fs";
import * as path from "path";

const GNDM_ADDRESS = "0xfc7008f9157257a17a9fb3c602b1cd56c27a4ba3" as const;
const MINTCLUB_CONTRACT = "0x1349A9DdEe26Fe16D0D44E35B3CB9B0CA18213a4" as const;

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

// Known large holders with manual caps (in whole tokens, no decimals)
const KNOWN_HOLDERS: { address: string; cap: number }[] = [
  { address: "0xdff4c57a8d0e025931a725197c9412920b385bbc", cap: 33_000_000 },
  { address: "0xa036225142c4f464Ac1c1E04cA663809B4CFc1BC", cap: 10_000_000 },
  { address: "0x4ed1db2e021a1807c329cd069151309f43fc39c2", cap: 2_000_000 },
  { address: "0x6e92a772b1bd702209434190d71c276a57311109", cap: 200_000 },
];

const AIRDROP_CAP = 200_000; // cap for airdrop claimers

// Addresses to exclude (LPs, dead wallets, contracts)
const EXCLUDE = new Set([
  "0x0000000000000000000000000000000000000000",
  MINTCLUB_CONTRACT.toLowerCase(),
]);

// GNDM token first appeared around block 42303224; start scanning from 42300000
const START_BLOCK = 42_300_000n;
const CHUNK_SIZE = 10_000n; // public RPC limits getLogs to 10k block range

const transferEvent = {
  type: "event" as const,
  name: "Transfer" as const,
  inputs: [
    { type: "address" as const, indexed: true, name: "from" as const },
    { type: "address" as const, indexed: true, name: "to" as const },
    { type: "uint256" as const, indexed: false, name: "value" as const },
  ],
};

async function main() {
  const client = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  const latestBlock = await client.getBlockNumber();
  console.log(`\nCurrent block: ${latestBlock}`);
  console.log("Scanning GNDM Transfer events from MintClub...");

  // Paginate through blocks in CHUNK_SIZE increments (public RPC limit)
  type TransferLog = Awaited<ReturnType<typeof client.getLogs<typeof transferEvent>>>[number];
  const logs: TransferLog[] = [];
  for (let from = START_BLOCK; from <= latestBlock; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE - 1n > latestBlock ? latestBlock : from + CHUNK_SIZE - 1n;
    const chunk = await client.getLogs({
      address: GNDM_ADDRESS,
      event: transferEvent,
      args: { from: MINTCLUB_CONTRACT },
      fromBlock: from,
      toBlock: to,
    });
    if (chunk.length > 0) {
      logs.push(...chunk);
    }
    const pct = Number((from - START_BLOCK) * 100n / (latestBlock - START_BLOCK));
    process.stdout.write(`  Scanning blocks... ${pct}% (${logs.length} transfers found)\r`);
  }

  console.log(`\nFound ${logs.length} airdrop transfers`);

  // Collect unique recipient addresses
  const airdropAddresses = new Set<string>();
  for (const log of logs) {
    const to = (log.args.to as string).toLowerCase();
    if (!EXCLUDE.has(to)) {
      airdropAddresses.add(to);
    }
  }

  console.log(`Unique airdrop recipients: ${airdropAddresses.size}`);

  // Check current balances for all airdrop recipients (with rate limit handling)
  const holdersWithBalance: { address: string; balance: number }[] = [];
  const addrs = Array.from(airdropAddresses);
  const BATCH_SIZE = 10;
  const DELAY_MS = 500; // delay between batches to avoid rate limits

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function fetchBalanceWithRetry(addr: string, retries = 3): Promise<bigint> {
    for (let i = 0; i < retries; i++) {
      try {
        return await client.readContract({
          address: GNDM_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [addr as `0x${string}`],
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("rate limit") || msg.includes("429")) {
          await sleep(2000 * (i + 1)); // exponential backoff
          continue;
        }
        throw e;
      }
    }
    return 0n; // fallback after retries exhausted
  }

  for (let i = 0; i < addrs.length; i += BATCH_SIZE) {
    const batch = addrs.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((a) => fetchBalanceWithRetry(a)));

    for (let j = 0; j < batch.length; j++) {
      const balNum = parseFloat(formatUnits(results[j], 18));
      if (balNum > 0) {
        holdersWithBalance.push({ address: batch[j], balance: balNum });
      }
    }

    process.stdout.write(`  Checked ${Math.min(i + BATCH_SIZE, addrs.length)}/${addrs.length}...\r`);
    if (i + BATCH_SIZE < addrs.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nAirdrop holders with balance > 0: ${holdersWithBalance.length}`);

  // Build whitelist: known holders + airdrop holders
  const knownSet = new Set(KNOWN_HOLDERS.map((h) => h.address.toLowerCase()));
  const whitelist: { address: string; cap: number }[] = [...KNOWN_HOLDERS];

  for (const h of holdersWithBalance) {
    if (!knownSet.has(h.address.toLowerCase())) {
      whitelist.push({
        address: h.address,
        cap: AIRDROP_CAP,
      });
    }
  }

  // Sort by cap descending
  whitelist.sort((a, b) => b.cap - a.cap);

  const outputPath = path.resolve(__dirname, "migration-whitelist.json");
  fs.writeFileSync(outputPath, JSON.stringify(whitelist, null, 2));

  const totalCap = whitelist.reduce((sum, w) => sum + w.cap, 0);
  console.log(`\nWhitelist generated:`);
  console.log(`  Known holders: ${KNOWN_HOLDERS.length}`);
  console.log(`  Airdrop holders: ${whitelist.length - KNOWN_HOLDERS.length}`);
  console.log(`  Total addresses: ${whitelist.length}`);
  console.log(`  Total cap: ${totalCap.toLocaleString()} GNDM`);
  console.log(`\nWritten to: ${outputPath}`);
}

main().catch(console.error);

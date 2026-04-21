/**
 * Re-run Neynar lookups on the 54 handles that didn't resolve the first time.
 * Usage: NEYNAR_API_KEY=<key> npx tsx scripts/recheck-missing.ts
 */
import * as fs from "fs";
import * as path from "path";

const API_KEY = process.env.NEYNAR_API_KEY || "NEYNAR_API_DOCS";
const BASE_URL = "https://api.neynar.com/v2/farcaster";

const MISSING = [
  "bfg", "jalleo", "alitiknazoglu", "sashelka", "claireujma",
  "edurubio", "super-al", "vortac", "bixbysnyder.eth", "todemashi",
  "thepapercrane", "tonyminh", "odysseyheart", "t0ma", "ismaile007.eth",
  "victoresteves.eth", "kraken8.eth", "h2osodowa", "speakingtomato", "bizarrebeast",
  "ryanhube.eth", "zosphotos", "nico-n", "push-", "karsaorlongdong",
  "jeroenv78", "negar-sepehr", "rosekeyes", "drmat", "phos3",
  "hankmoody", "catfacts.eth", "niloofarmd", "madaxc", "nothing11",
  "nn0613.eth", "smhsince91", "metasalary", "emirate", "mj41fantastican.eth",
  "atenajafari", "hdvrod.base.eth", "merin", "kayonfire", "s-p",
  "pharoahcrypto", "0xmadmax007", "nikkiwordsmith", "0xwabo", "bitcoinbroke",
  "dareek", "ghostcode0x", "pearlsandlace", "capchr",
];

interface NeynarUser {
  fid: number;
  username: string;
  verified_addresses?: { eth_addresses?: string[] };
  custody_address?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchUser(username: string): Promise<
  | { status: "resolved"; user: NeynarUser; addr: string; source: "verified" | "custody" }
  | { status: "no_address"; user: NeynarUser }
  | { status: "not_found" }
  | { status: "error"; code: number }
> {
  const url = `${BASE_URL}/user/by_username?username=${encodeURIComponent(username)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "x-api-key": API_KEY } });
    if (res.ok) {
      const data = await res.json();
      const user: NeynarUser | undefined = data.user;
      if (!user) return { status: "not_found" };
      const verified = user.verified_addresses?.eth_addresses?.[0];
      if (verified) return { status: "resolved", user, addr: verified, source: "verified" };
      if (user.custody_address)
        return { status: "resolved", user, addr: user.custody_address, source: "custody" };
      return { status: "no_address", user };
    }
    if (res.status === 404) return { status: "not_found" };
    if (res.status === 429) {
      await sleep(Math.pow(2, attempt + 1) * 1000);
      continue;
    }
    return { status: "error", code: res.status };
  }
  return { status: "error", code: 429 };
}

async function main() {
  console.log(`\nRe-checking ${MISSING.length} handles via Neynar...\n`);

  const resolved: { username: string; addr: string; source: string; fid: number }[] = [];
  const stillMissing: { username: string; reason: string }[] = [];

  for (let i = 0; i < MISSING.length; i++) {
    const username = MISSING[i];
    const result = await fetchUser(username);
    const prefix = `  [${(i + 1).toString().padStart(2)}/${MISSING.length}] ${username.padEnd(22)}`;
    if (result.status === "resolved") {
      console.log(`${prefix} -> ${result.addr} (${result.source})`);
      resolved.push({
        username,
        addr: result.addr.toLowerCase(),
        source: result.source,
        fid: result.user.fid,
      });
    } else if (result.status === "no_address") {
      console.log(`${prefix} -> FID ${result.user.fid}, no address`);
      stillMissing.push({ username, reason: `FID ${result.user.fid}, no verified/custody addr` });
    } else if (result.status === "not_found") {
      console.log(`${prefix} -> NOT FOUND`);
      stillMissing.push({ username, reason: "handle not found" });
    } else {
      console.log(`${prefix} -> ERROR ${result.code}`);
      stillMissing.push({ username, reason: `HTTP ${result.code}` });
    }
    await sleep(1500);
  }

  const outPath = path.resolve(__dirname, "recheck-result.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ resolved, stillMissing }, null, 2)
  );

  console.log(`\n=== Recheck summary ===`);
  console.log(`Resolved this time: ${resolved.length}`);
  console.log(`Still missing:      ${stillMissing.length}`);
  console.log(`Output: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Resolve Farcaster usernames to verified Ethereum addresses via Neynar API.
 *
 * Usage: NEYNAR_API_KEY=<key> npx tsx scripts/resolve-whitelist.ts
 *
 * Output: scripts/whitelist.json
 */

import * as fs from "fs";
import * as path from "path";

const API_KEY = process.env.NEYNAR_API_KEY || "NEYNAR_API_DOCS"; // free tier key
const BASE_URL = "https://api.neynar.com/v2/farcaster";

// VIP usernames (tier 1) — top 5
const VIP_USERNAMES = [
  "nomadicframe",
  "thec1",
  "ildiko",
  "milibooo",
  "buckyball",
];

// All usernames from the group chat
const ALL_USERNAMES = [
  "nomadicframe", "ildiko", "milibooo", "buckyball", "wgmeets",
  "aqueous", "bfg", "jalleo", "alitiknazoglu", "fercaggiano",
  "best", "patrion", "paydar", "girl", "ricardotakamura",
  "sashelka", "claireujma", "edurubio", "uf", "toobimoobi",
  "joanbp", "jimbocity", "stemo.eth", "leovido.eth", "super-al",
  "vortac", "bixbysnyder.eth", "duckfacts.eth", "tuangg", "viha",
  "mvr", "treeskulltown.eth", "ventra", "todemashi", "thepapercrane",
  "tonyminh", "femmie", "hustletrees", "joely.eth", "airdrop20.base.eth",
  "jt-longo", "asha", "odysseyheart", "t0ma", "ismaile007.eth",
  "rosstintexas", "mrfuego.eth", "ronwest", "sarahc", "mikerichardson.eth",
  "kaill13492", "victoresteves.eth", "kraken8.eth", "h2osodowa", "lutik",
  "mightymoss", "coinsage", "alleytac", "maie", "elcryptocabra",
  "speakingtomato", "bizarrebeast", "ryanhube.eth", "mferones", "svetlana",
  "sharas.eth", "cryp2romz.eth", "cryptoweb13", "mudge", "zosphotos",
  "nico-n", "push-", "dexwhale", "jawarpe", "ciskodisco",
  "bitsizzle", "haniz.eth", "msmeghna", "karsaorlongdong", "jeroenv78",
  "negar-sepehr", "gresha.eth", "onbloaded", "opstudios", "cryptorabbits",
  "nutscity13", "hamedns", "rosekeyes", "drmat", "phos3",
  "majidjeelani", "homaamini", "shivala1370", "maryamm13", "kzl27.eth",
  "abeg007.eth", "hankmoody", "catfacts.eth", "niloofarmd", "janicka",
  "chronist", "evee", "vocsel", "rashedur", "itsamanullah",
  "madaxc", "nothing11", "nn0613.eth", "zuny", "crazyeight",
  "noedmb", "minooart", "namrufretep", "riff-raff", "smhsince91",
  "metasalary", "emirate", "hellia.eth", "drai", "ozlemcnr77",
  "braza1", "pranta1000", "naruto007.eth", "mj41fantastican.eth", "atenajafari",
  "hdvrod.base.eth", "heyztb.eth", "serenussage", "mrbrick", "otcplug",
  "missgwen", "zakie4u", "merin", "kayonfire", "s-p",
  "thec1", "heisboydrey", "papusiek1111", "coconutrinds", "teedosh",
  "jeyloo.eth", "pharoahcrypto", "0xmadmax007", "nikkiwordsmith", "shining1",
  "mr-r0b0t", "fabfour", "bubu.base.eth", "vaibhavmule", "danny005",
  "0xwabo", "bitcoinbroke", "dareek", "indicawolf", "vservo",
  "bsibeth", "pare", "darganmage35", "budinmyhat", "ghostcode0x",
  "pearlsandlace", "capchr", "badadan",
];

interface NeynarUser {
  fid: number;
  username: string;
  verified_addresses: {
    eth_addresses: string[];
  };
  custody_address: string;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<NeynarUser | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, {
      headers: { "x-api-key": API_KEY },
    });

    if (res.ok) {
      const data = await res.json();
      return data.user || null;
    }

    if (res.status === 429) {
      const wait = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      process.stdout.write(`  [rate limited, waiting ${wait / 1000}s...]\r`);
      await sleep(wait);
      continue;
    }

    return null; // non-retryable error
  }
  return null;
}

async function lookupUsers(usernames: string[]): Promise<NeynarUser[]> {
  const results: NeynarUser[] = [];

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i];
    const url = `${BASE_URL}/user/by_username?username=${username}`;

    const user = await fetchWithRetry(url);
    if (user) {
      results.push(user);
      process.stdout.write(`  [${i + 1}/${usernames.length}] ${username} -> ${user.verified_addresses?.eth_addresses?.[0] || user.custody_address}\n`);
    } else {
      process.stdout.write(`  [${i + 1}/${usernames.length}] ${username} -> NOT FOUND\n`);
    }

    // 1.5s between requests to stay under free tier limits
    await sleep(1500);
  }

  return results;
}

async function main() {
  // Deduplicate usernames
  const unique = [...new Set(ALL_USERNAMES.map((u) => u.toLowerCase()))];
  console.log(`\nResolving ${unique.length} Farcaster usernames...\n`);

  const users = await lookupUsers(unique);
  console.log(`Found ${users.length}/${unique.length} users\n`);

  const whitelist: { address: string; tier: number; username: string }[] = [];
  const noAddress: string[] = [];
  const notFound: string[] = [];

  // Track which usernames we found
  const foundUsernames = new Set(users.map((u) => u.username.toLowerCase()));
  for (const username of unique) {
    if (!foundUsernames.has(username)) {
      notFound.push(username);
    }
  }

  for (const user of users) {
    const addresses = user.verified_addresses?.eth_addresses || [];
    const addr = addresses[0] || user.custody_address;

    if (!addr) {
      noAddress.push(user.username);
      continue;
    }

    const isVIP = VIP_USERNAMES.some(
      (v) => v.toLowerCase() === user.username.toLowerCase()
    );

    // Add primary verified address
    whitelist.push({
      address: addr.toLowerCase(),
      tier: isVIP ? 1 : 2,
      username: user.username,
    });

    // Add additional verified addresses for the same tier
    for (let i = 1; i < addresses.length; i++) {
      whitelist.push({
        address: addresses[i].toLowerCase(),
        tier: isVIP ? 1 : 2,
        username: `${user.username} (alt ${i})`,
      });
    }
  }

  // Write whitelist.json (without username field — contract doesn't need it)
  const output = whitelist.map(({ address, tier }) => ({ address, tier }));
  const outputPath = path.resolve(__dirname, "whitelist.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  // Write a human-readable mapping for reference
  const mapPath = path.resolve(__dirname, "whitelist-map.json");
  fs.writeFileSync(mapPath, JSON.stringify(whitelist, null, 2));

  console.log(`VIP (tier 1): ${whitelist.filter((w) => w.tier === 1).length} addresses`);
  console.log(`WL  (tier 2): ${whitelist.filter((w) => w.tier === 2).length} addresses`);
  console.log(`Total: ${whitelist.length} addresses`);
  console.log(`\nWritten to: ${outputPath}`);
  console.log(`Mapping: ${mapPath}`);

  if (notFound.length > 0) {
    console.log(`\nNot found (${notFound.length}): ${notFound.join(", ")}`);
  }
  if (noAddress.length > 0) {
    console.log(`\nNo verified address (${noAddress.length}): ${noAddress.join(", ")}`);
  }
}

main().catch(console.error);

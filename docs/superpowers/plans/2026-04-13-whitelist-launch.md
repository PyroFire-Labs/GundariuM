# Whitelist Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a tiered Merkle whitelist mint with anti-abuse protection, balanced traits, updated site copy, and mainnet GunplaCard deploy — whitelist live April 27 at 12:00 PM CST, public mint May 10.

**Architecture:** GunplaCard.sol gets a UUPS upgrade adding MintPhase enum, Merkle proof verification, tiered pricing, and per-wallet mint caps. Frontend gets Cloudflare Turnstile bot protection, whitelist-aware mint flow, and copy cleanup. Trait HP ranges are rebalanced for future battle viability.

**Tech Stack:** Solidity ^0.8.24, OpenZeppelin v5 (MerkleProof, UUPS), Foundry, Next.js 16, Cloudflare Turnstile, `@openzeppelin/merkle-tree`

---

## File Map

### Contracts (create/modify)

| File | Action | Responsibility |
|------|--------|----------------|
| `contracts/src/GunplaCard.sol` | Modify | Add MintPhase, Merkle whitelist, tiered pricing, mint cap |
| `contracts/test/GunplaCard.t.sol` | Modify | Add whitelist/phase/tier tests |
| `contracts/script/Deploy.s.sol` | Modify | Update mint price constant, add Merkle root + tier price setup |

### Frontend (create/modify)

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/kitbash/traits.ts` | Modify | Rebalance HP_RANGES |
| `src/lib/contracts/hooks/useMint.ts` | Modify | Add whitelist mint path, phase detection, mint count |
| `src/lib/contracts/abis/GunplaCard.ts` | Modify | Update ABI with new functions |
| `src/components/mint/MintConfirm.tsx` | Modify | Whitelist-aware pricing, Merkle proof, mint count display |
| `src/components/mint/MintLanding.tsx` | Modify | Add Turnstile widget, phase gating |
| `src/app/api/generate-kitbash/route.ts` | Modify | Add Turnstile verification + rate limiting |
| `src/app/api/mint-metadata/route.ts` | Modify | Add Turnstile verification |
| `src/app/page.tsx` | Modify | Update hero copy for generative direction |
| `src/lib/turnstile.ts` | Create | Turnstile server-side verification helper |
| `src/lib/rateLimit.ts` | Create | In-memory rate limiter |

### Tooling (create)

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/generate-merkle.ts` | Create | Build Merkle tree from whitelist JSON, output root + proofs |
| `scripts/whitelist.json` | Create | Whitelist address + tier data (placeholder, Joshua fills in) |

---

## Task 1: Rebalance HP Ranges in traits.ts

**Files:**
- Modify: `src/lib/kitbash/traits.ts:192-198`

- [ ] **Step 1: Update HP_RANGES constant**

In `src/lib/kitbash/traits.ts`, replace lines 192-198:

```typescript
const HP_RANGES: Record<Rarity, [number, number]> = {
  Common: [400, 550],
  Uncommon: [500, 700],
  Rare: [650, 850],
  "Ultra Rare": [800, 1050],
  Legendary: [1000, 1300],
};
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: Compiles without errors. HP ranges are only consumed by `deriveStats()` which uses them as `[number, number]` tuples — no type changes needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/kitbash/traits.ts
git commit -m "balance: compress HP ranges to 2.5x max gap for battle viability"
```

---

## Task 2: Add Whitelist Logic to GunplaCard.sol

**Files:**
- Modify: `contracts/src/GunplaCard.sol`

- [ ] **Step 1: Add MerkleProof import**

After the existing OpenZeppelin imports (around line 8), add:

```solidity
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
```

- [ ] **Step 2: Add MintPhase enum and new state variables**

After the existing state variables (after line 56, `mapping(uint256 => CardTraits) _traits`), add:

```solidity
    // ─── Whitelist ─────────────────────────────────────────────────
    enum MintPhase { PAUSED, WHITELIST, PUBLIC }

    MintPhase public mintPhase;
    bytes32 public merkleRoot;
    mapping(address => uint256) public whitelistMintCount;
    mapping(uint8 => uint256) public tierPrice;
    uint256 public whitelistMintCap;
```

- [ ] **Step 3: Add owner-only configuration functions**

After the existing `setCosmeticPrice` function (after line 156), add:

```solidity
    // ─── Whitelist Admin ───────────────────────────────────────────

    function setMintPhase(MintPhase phase_) external onlyOwner {
        mintPhase = phase_;
    }

    function setMerkleRoot(bytes32 root_) external onlyOwner {
        merkleRoot = root_;
    }

    function setTierPrice(uint8 tier_, uint256 price_) external onlyOwner {
        tierPrice[tier_] = price_;
    }

    function setWhitelistMintCap(uint256 cap_) external onlyOwner {
        whitelistMintCap = cap_;
    }
```

- [ ] **Step 4: Add phase gate to existing mintCard function**

In the existing `mintCard` function (line 98), add a phase check as the first line inside the function body:

```solidity
    function mintCard(
        address to,
        string calldata tokenUri,
        CardTraits calldata traits
    ) external returns (uint256) {
        require(mintPhase == MintPhase.PUBLIC, "GunplaCard: not in public phase");
        require(
            usdc.transferFrom(msg.sender, address(this), mintPriceUsdc),
            "GunplaCard: USDC transfer failed"
        );
```

- [ ] **Step 5: Add mintCardWhitelist function**

After the `mintCard` function (after line 114), add:

```solidity
    /// @notice Mint during whitelist phase with Merkle proof
    function mintCardWhitelist(
        address to,
        string calldata tokenUri,
        CardTraits calldata traits,
        uint8 tier,
        bytes32[] calldata proof
    ) external returns (uint256) {
        require(mintPhase == MintPhase.WHITELIST, "GunplaCard: not in whitelist phase");
        require(whitelistMintCap == 0 || whitelistMintCount[msg.sender] < whitelistMintCap, "GunplaCard: mint cap reached");
        require(tierPrice[tier] > 0, "GunplaCard: invalid tier");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, tier));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "GunplaCard: invalid proof");

        require(
            usdc.transferFrom(msg.sender, address(this), tierPrice[tier]),
            "GunplaCard: USDC transfer failed"
        );

        whitelistMintCount[msg.sender]++;

        uint256 tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
        _traits[tokenId] = traits;

        emit CardMinted(tokenId, to, traits.rarity);
        return tokenId;
    }
```

- [ ] **Step 6: Compile contracts**

Run from `contracts/`:
```bash
forge build
```
Expected: Compiles without errors.

- [ ] **Step 7: Commit**

```bash
cd contracts
git add src/GunplaCard.sol
git commit -m "feat: add tiered Merkle whitelist, mint phases, and per-wallet cap to GunplaCard"
```

---

## Task 3: Write GunplaCard Whitelist Tests

**Files:**
- Modify: `contracts/test/GunplaCard.t.sol`

- [ ] **Step 1: Add MerkleProof import and test state**

After the existing imports (line 8), add:

```solidity
import {Merkle} from "murky/Merkle.sol";
```

Wait — the project doesn't have murky. Instead, we'll compute Merkle proofs manually in the test using a simple 2-leaf tree. Add these state variables inside the test contract (after line 19):

```solidity
    // Whitelist test state
    address charlie = address(4);
    bytes32 merkleRoot;
    bytes32[] aliceProof;
    bytes32[] bobProof;
```

- [ ] **Step 2: Add Merkle tree helper to setUp**

After the existing `setUp()` content (after line 45), add a helper function and update setUp to configure whitelist:

```solidity
    function _buildMerkleTree() internal {
        // Tier 1 = VIP ($1), Tier 2 = WL ($1.50)
        // Leaves: keccak256(abi.encodePacked(address, uint8))
        bytes32 leafAlice = keccak256(abi.encodePacked(alice, uint8(1)));   // VIP
        bytes32 leafBob   = keccak256(abi.encodePacked(bob, uint8(2)));     // WL

        // Simple 2-leaf Merkle tree
        if (leafAlice <= leafBob) {
            merkleRoot = keccak256(abi.encodePacked(leafAlice, leafBob));
        } else {
            merkleRoot = keccak256(abi.encodePacked(leafBob, leafAlice));
        }

        // Proofs — each is sibling hash
        aliceProof = new bytes32[](1);
        aliceProof[0] = leafBob;

        bobProof = new bytes32[](1);
        bobProof[0] = leafAlice;
    }
```

Then at the end of `setUp()`, add:

```solidity
        // Configure whitelist
        _buildMerkleTree();
        vm.startPrank(owner);
        card.setMerkleRoot(merkleRoot);
        card.setTierPrice(1, 1_000_000);    // VIP: $1
        card.setTierPrice(2, 1_500_000);    // WL: $1.50
        card.setWhitelistMintCap(5);
        card.setMintPhase(GunplaCard.MintPhase.PAUSED);
        vm.stopPrank();
```

- [ ] **Step 3: Write test — paused phase blocks all mints**

```solidity
    function test_pausedPhaseBlocksMint() public {
        vm.prank(alice);
        vm.expectRevert("GunplaCard: not in public phase");
        card.mintCard(alice, "ipfs://test", _defaultTraits());
    }

    function test_pausedPhaseBlocksWhitelistMint() public {
        vm.prank(alice);
        vm.expectRevert("GunplaCard: not in whitelist phase");
        card.mintCardWhitelist(alice, "ipfs://test", _defaultTraits(), 1, aliceProof);
    }
```

- [ ] **Step 4: Write test — whitelist phase allows WL mint, blocks public**

```solidity
    function test_whitelistPhaseAllowsWLMint() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        vm.prank(alice);
        uint256 tokenId = card.mintCardWhitelist(alice, "ipfs://vip", _defaultTraits(), 1, aliceProof);
        assertEq(card.ownerOf(tokenId), alice);
        assertEq(card.whitelistMintCount(alice), 1);
    }

    function test_whitelistPhaseBlocksPublicMint() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        vm.prank(alice);
        vm.expectRevert("GunplaCard: not in public phase");
        card.mintCard(alice, "ipfs://test", _defaultTraits());
    }
```

- [ ] **Step 5: Write test — VIP pays $1, WL pays $1.50**

```solidity
    function test_vipPaysCorrectPrice() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        uint256 balanceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        card.mintCardWhitelist(alice, "ipfs://vip", _defaultTraits(), 1, aliceProof);
        assertEq(usdc.balanceOf(alice), balanceBefore - 1_000_000); // $1
    }

    function test_wlPaysCorrectPrice() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        uint256 balanceBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        card.mintCardWhitelist(bob, "ipfs://wl", _defaultTraits(), 2, bobProof);
        assertEq(usdc.balanceOf(bob), balanceBefore - 1_500_000); // $1.50
    }
```

- [ ] **Step 6: Write test — invalid proof rejected**

```solidity
    function test_invalidProofRejected() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        // Charlie is not in the whitelist
        bytes32[] memory fakeProof = new bytes32[](1);
        fakeProof[0] = bytes32(uint256(0xdead));

        vm.prank(charlie);
        vm.expectRevert("GunplaCard: invalid proof");
        card.mintCardWhitelist(charlie, "ipfs://fake", _defaultTraits(), 2, fakeProof);
    }
```

- [ ] **Step 7: Write test — mint cap enforced**

```solidity
    function test_mintCapEnforced() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.WHITELIST);

        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            card.mintCardWhitelist(alice, "ipfs://test", _defaultTraits(), 1, aliceProof);
        }
        // 6th mint should fail
        vm.expectRevert("GunplaCard: mint cap reached");
        card.mintCardWhitelist(alice, "ipfs://test", _defaultTraits(), 1, aliceProof);
        vm.stopPrank();
    }
```

- [ ] **Step 8: Write test — public phase works normally**

```solidity
    function test_publicPhaseAllowsAnyMint() public {
        vm.prank(owner);
        card.setMintPhase(GunplaCard.MintPhase.PUBLIC);

        // Fund charlie
        vm.prank(owner);
        usdc.transfer(charlie, 10_000_000);
        vm.prank(charlie);
        usdc.approve(address(card), type(uint256).max);

        vm.prank(charlie);
        uint256 tokenId = card.mintCard(charlie, "ipfs://public", _defaultTraits());
        assertEq(card.ownerOf(tokenId), charlie);
    }
```

- [ ] **Step 9: Run all tests**

```bash
cd contracts && forge test -vv
```
Expected: All tests pass including both old and new tests.

- [ ] **Step 10: Commit**

```bash
git add test/GunplaCard.t.sol
git commit -m "test: add whitelist phase, tiered pricing, and mint cap tests"
```

---

## Task 4: Merkle Tree Generation Script

**Files:**
- Create: `scripts/generate-merkle.ts`
- Create: `scripts/whitelist.json`

- [ ] **Step 1: Install @openzeppelin/merkle-tree**

```bash
npm install @openzeppelin/merkle-tree
```

- [ ] **Step 2: Create placeholder whitelist.json**

Create `scripts/whitelist.json`:

```json
[
  { "address": "0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7", "tier": 1 },
  { "address": "0xB98F0c9B8522f9295BB26bda0f5490E1872e7fa5", "tier": 1 }
]
```

Note: Joshua fills in the real 164 addresses + tiers before launch. Tier 1 = VIP (top 5), Tier 2 = whitelist (rest).

- [ ] **Step 3: Create generate-merkle.ts**

Create `scripts/generate-merkle.ts`:

```typescript
/**
 * Generate Merkle tree for GunplaCard whitelist.
 *
 * Usage: npx tsx scripts/generate-merkle.ts
 *
 * Input:  scripts/whitelist.json — [{ address, tier }]
 * Output: scripts/whitelist-proofs.json — { root, proofs: { [address]: { tier, proof } } }
 */

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import * as fs from "fs";
import * as path from "path";

interface WhitelistEntry {
  address: string;
  tier: number;
}

const inputPath = path.resolve(__dirname, "whitelist.json");
const outputPath = path.resolve(__dirname, "whitelist-proofs.json");

const entries: WhitelistEntry[] = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

console.log(`\n📋 Building Merkle tree for ${entries.length} addresses...`);
console.log(`   VIP (tier 1): ${entries.filter((e) => e.tier === 1).length}`);
console.log(`   WL  (tier 2): ${entries.filter((e) => e.tier === 2).length}`);

// Build tree — leaves are [address, tier]
const values = entries.map((e) => [e.address, e.tier] as [string, number]);
const tree = StandardMerkleTree.of(values, ["address", "uint8"]);

console.log(`\n🌳 Merkle Root: ${tree.root}`);

// Build per-address proof map
const proofs: Record<string, { tier: number; proof: string[] }> = {};

for (const [i, v] of tree.entries()) {
  const addr = v[0] as string;
  const tier = v[1] as number;
  proofs[addr.toLowerCase()] = {
    tier,
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
console.log(`\n✅ Written to: ${outputPath}`);
console.log(`   Use root in contract: card.setMerkleRoot("${tree.root}")`);
```

- [ ] **Step 4: Test the script**

```bash
npx tsx scripts/generate-merkle.ts
```
Expected: Outputs `scripts/whitelist-proofs.json` with root and per-address proofs.

- [ ] **Step 5: Add whitelist-proofs.json to .gitignore**

Append to `.gitignore`:
```
scripts/whitelist-proofs.json
```

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-merkle.ts scripts/whitelist.json .gitignore
git commit -m "feat: add Merkle tree generation for tiered whitelist"
```

---

## Task 5: Turnstile Server-Side Helper

**Files:**
- Create: `src/lib/turnstile.ts`

- [ ] **Step 1: Create turnstile.ts**

Create `src/lib/turnstile.ts`:

```typescript
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) {
    // If not configured, allow through (dev mode)
    console.error("TURNSTILE_SECRET_KEY not set — skipping verification");
    return true;
  }

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token }),
  });

  const data = await res.json();
  return data.success === true;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/turnstile.ts
git commit -m "feat: add Cloudflare Turnstile server-side verification helper"
```

---

## Task 6: Rate Limiter

**Files:**
- Create: `src/lib/rateLimit.ts`

- [ ] **Step 1: Create rateLimit.ts**

Create `src/lib/rateLimit.ts`:

```typescript
const store = new Map<string, { count: number; resetAt: number }>();

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store) {
    if (val.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/rateLimit.ts
git commit -m "feat: add in-memory rate limiter for API routes"
```

---

## Task 7: Add Anti-Abuse to API Routes

**Files:**
- Modify: `src/app/api/generate-kitbash/route.ts`
- Modify: `src/app/api/mint-metadata/route.ts`

- [ ] **Step 1: Add Turnstile + rate limiting to generate-kitbash**

At the top of `src/app/api/generate-kitbash/route.ts`, add imports:

```typescript
import { verifyTurnstile } from "@/lib/turnstile";
import { checkRateLimit } from "@/lib/rateLimit";
```

At the beginning of the `POST` handler (after parsing the request body), add:

```typescript
  const { faction, turnstileToken } = await req.json();

  // Anti-abuse: verify Turnstile
  if (turnstileToken) {
    const valid = await verifyTurnstile(turnstileToken);
    if (!valid) {
      return NextResponse.json({ error: "Bot detected" }, { status: 403 });
    }
  }

  // Rate limit: 10 generations per hour per IP
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limit = checkRateLimit(`gen:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }
```

Note: The existing code parses `faction` from `await req.json()` — this changes it to also destructure `turnstileToken`. Update the existing destructuring accordingly.

- [ ] **Step 2: Add Turnstile verification to mint-metadata**

At the top of `src/app/api/mint-metadata/route.ts`, add:

```typescript
import { verifyTurnstile } from "@/lib/turnstile";
```

In the JSON flow branch (around line 12), after parsing the body, add:

```typescript
  const { imageBase64, imageMimeType, traits, turnstileToken } = body;

  if (turnstileToken) {
    const valid = await verifyTurnstile(turnstileToken);
    if (!valid) {
      return NextResponse.json({ error: "Bot detected" }, { status: 403 });
    }
  }
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: Compiles. Turnstile token is optional (checked via `if (turnstileToken)`), so existing flow still works without it.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/generate-kitbash/route.ts src/app/api/mint-metadata/route.ts
git commit -m "feat: add Turnstile verification and rate limiting to mint API routes"
```

---

## Task 8: Update useMint Hook for Whitelist

**Files:**
- Modify: `src/lib/contracts/hooks/useMint.ts`

- [ ] **Step 1: Add whitelist-related reads and state**

After the existing `useReadContract` for `mintPriceUsdc` (around line 89), add:

```typescript
  const { data: currentPhase } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "mintPhase",
  });

  const { data: wlMintCount } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "whitelistMintCount",
    args: account.address ? [account.address] : undefined,
  });

  const { data: mintCap } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "whitelistMintCap",
  });

  const { data: vipPrice } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "tierPrice",
    args: [1],
  });

  const { data: wlPrice } = useReadContract({
    address: contracts?.gunplaCard,
    abi: GUNPLA_CARD_ABI,
    functionName: "tierPrice",
    args: [2],
  });
```

- [ ] **Step 2: Add executeWhitelistMint function**

After the existing `executeMint` function, add:

```typescript
  async function executeWhitelistMint(
    tokenUri: string,
    traits: TraitSet,
    tier: number,
    proof: `0x${string}`[]
  ): Promise<bigint | null> {
    if (!contracts || !publicClient) return null;
    setPhase("minting");
    setError(null);
    try {
      const onchainTraits = traitsToOnchain(traits);
      const hash = await writeContractAsync({
        address: contracts.gunplaCard,
        abi: GUNPLA_CARD_ABI,
        functionName: "mintCardWhitelist",
        args: [account.address!, tokenUri, onchainTraits, tier, proof],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const transferLog = receipt.logs.find((l) => l.topics[0] === TRANSFER_SIG);
      const tokenId = transferLog ? BigInt(transferLog.topics[3]!) : null;
      setPhase("done");
      return tokenId;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Mint failed";
      setError(msg);
      setPhase("error");
      return null;
    }
  }
```

- [ ] **Step 3: Update the approveMint to use correct price for tier**

Update `approveMint` to accept an optional price override:

```typescript
  async function approveMint(priceOverride?: bigint) {
    if (!contracts) return;
    setPhase("approving");
    setError(null);
    try {
      const price = priceOverride ?? mintPrice;
      const hash = await writeContractAsync({
        address: contracts.gndmToken as `0x${string}`, // USDC address — update to actual USDC
        abi: erc20Abi,
        functionName: "approve",
        args: [contracts.gunplaCard, price],
      });
      // ... rest unchanged
```

Wait — check the existing code. The approve call targets the USDC token, not gndmToken. Let me look at the existing code more carefully. The existing hook reads `mintPriceUsdc` from the contract and uses it for approval. The whitelist version needs to approve with the tier-specific price instead.

The simplest approach: add the price parameter to `approveMint`:

In the existing `approveMint` function signature, change it to:
```typescript
  async function approveMint(priceOverride?: bigint) {
```
And where it references `mintPrice` for the approve amount, use `priceOverride ?? mintPrice`.

- [ ] **Step 4: Update the return object**

Add the new values to the return object:

```typescript
  return {
    phase,
    error,
    mintPrice,
    contracts: contracts ?? null,
    approveMint,
    executeMint,
    executeWhitelistMint,
    currentPhase: currentPhase as number | undefined,
    whitelistMintCount: wlMintCount as bigint | undefined,
    whitelistMintCap: mintCap as bigint | undefined,
    vipPrice: vipPrice as bigint | undefined,
    wlPrice: wlPrice as bigint | undefined,
  };
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/hooks/useMint.ts
git commit -m "feat: add whitelist mint path, phase detection, and tier pricing to useMint hook"
```

---

## Task 9: Update GunplaCard ABI

**Files:**
- Modify: `src/lib/contracts/abis/GunplaCard.ts`

- [ ] **Step 1: Regenerate ABI after contract build**

After Task 2's `forge build`, copy the new ABI from the build output:

```bash
cat contracts/out/GunplaCard.sol/GunplaCard.json | npx tsx -e "
  const fs = require('fs');
  const json = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));
  console.log('export const GUNPLA_CARD_ABI = ' + JSON.stringify(json.abi, null, 2) + ' as const;');
" > src/lib/contracts/abis/GunplaCard.ts
```

Alternatively, manually add these new ABI entries to the existing file:

```typescript
// Add to GUNPLA_CARD_ABI array:
{
  "inputs": [{ "internalType": "enum GunplaCard.MintPhase", "name": "phase_", "type": "uint8" }],
  "name": "setMintPhase",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
},
{
  "inputs": [{ "internalType": "bytes32", "name": "root_", "type": "bytes32" }],
  "name": "setMerkleRoot",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
},
{
  "inputs": [],
  "name": "mintPhase",
  "outputs": [{ "internalType": "enum GunplaCard.MintPhase", "name": "", "type": "uint8" }],
  "stateMutability": "view",
  "type": "function"
},
{
  "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
  "name": "whitelistMintCount",
  "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
  "stateMutability": "view",
  "type": "function"
},
{
  "inputs": [],
  "name": "whitelistMintCap",
  "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
  "stateMutability": "view",
  "type": "function"
},
{
  "inputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
  "name": "tierPrice",
  "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
  "stateMutability": "view",
  "type": "function"
},
{
  "inputs": [
    { "internalType": "address", "name": "to", "type": "address" },
    { "internalType": "string", "name": "tokenUri", "type": "string" },
    { "components": [...CardTraits struct...], "internalType": "struct GunplaCard.CardTraits", "name": "traits", "type": "tuple" },
    { "internalType": "uint8", "name": "tier", "type": "uint8" },
    { "internalType": "bytes32[]", "name": "proof", "type": "bytes32[]" }
  ],
  "name": "mintCardWhitelist",
  "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

The recommended approach is the `forge build` + copy method — it guarantees ABI accuracy.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/contracts/abis/GunplaCard.ts
git commit -m "chore: update GunplaCard ABI with whitelist functions"
```

---

## Task 10: Add Turnstile to MintLanding + Phase Gating

**Files:**
- Modify: `src/components/mint/MintLanding.tsx`

- [ ] **Step 1: Install Turnstile React component**

```bash
npm install @marsidev/react-turnstile
```

- [ ] **Step 2: Add Turnstile widget and phase gating**

Update imports at the top of `MintLanding.tsx`:

```typescript
"use client";
import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { useMintStore } from "@/store/useMintStore";
import { FACTIONS, FACTION_KEYS } from "@/lib/constants/factions";
import type { FactionKey } from "@/lib/constants/factions";
```

Add Turnstile state after existing state declarations (around line 11):

```typescript
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
```

Update `handleMint` to pass the Turnstile token (around line 13):

```typescript
  async function handleMint() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-kitbash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faction: selectedFaction,
          turnstileToken,
        }),
      });
```

Add the Turnstile widget in the JSX, before the mint button (around line 85):

```tsx
        {/* Turnstile bot protection */}
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            onSuccess={setTurnstileToken}
            options={{ theme: "dark", size: "invisible" }}
          />
        )}
```

Update the mint button disabled state to require Turnstile token when configured:

```tsx
        <button
          onClick={handleMint}
          disabled={
            generating ||
            (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken)
          }
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/mint/MintLanding.tsx package.json package-lock.json
git commit -m "feat: add Cloudflare Turnstile to mint landing page"
```

---

## Task 11: Update MintConfirm for Whitelist Pricing

**Files:**
- Modify: `src/components/mint/MintConfirm.tsx`

- [ ] **Step 1: Import whitelist proof data and update hook usage**

Update the hook destructuring to include whitelist fields:

```typescript
  const {
    phase, error: mintError, mintPrice, approveMint, executeMint,
    executeWhitelistMint, currentPhase, whitelistMintCount,
    whitelistMintCap, vipPrice, wlPrice,
  } = useMint();
```

- [ ] **Step 2: Add whitelist proof lookup**

After the hook calls, add proof lookup logic:

```typescript
  const [proofData, setProofData] = useState<{ tier: number; proof: string[] } | null>(null);

  useEffect(() => {
    if (!account.address || currentPhase !== 1) return; // Only during WHITELIST phase
    fetch("/whitelist-proofs.json")
      .then((r) => r.json())
      .then((data) => {
        const entry = data.proofs?.[account.address!.toLowerCase()];
        if (entry) setProofData(entry);
      })
      .catch(() => {}); // Not on whitelist — no-op
  }, [account.address, currentPhase]);
```

Note: `whitelist-proofs.json` gets copied to `public/` before launch.

- [ ] **Step 3: Update price display**

Replace the existing cost display (around line 87-104) with dynamic tier pricing:

```typescript
  const effectivePrice = currentPhase === 1 && proofData
    ? (proofData.tier === 1 ? vipPrice : wlPrice) ?? mintPrice
    : mintPrice;

  const tierLabel = currentPhase === 1 && proofData
    ? proofData.tier === 1 ? "VIP (50% off)" : "Whitelist (25% off)"
    : "Public";
```

Then in the JSX cost section:

```tsx
        <div className="text-sm opacity-70">
          <p>Tier: {tierLabel}</p>
          <p>Cost: {Number(effectivePrice) / 1_000_000} USDC</p>
          {currentPhase === 1 && whitelistMintCap && whitelistMintCount !== undefined && (
            <p>Mints: {Number(whitelistMintCount)}/{Number(whitelistMintCap)} used</p>
          )}
        </div>
```

- [ ] **Step 4: Update handleMint to use correct mint function**

Update the mint execution logic:

```typescript
  async function handleMint() {
    if (!traits || !metadataUri) return;
    try {
      let tokenId: bigint | null;
      if (currentPhase === 1 && proofData) {
        await approveMint(effectivePrice);
        tokenId = await executeWhitelistMint(
          metadataUri,
          traits,
          proofData.tier,
          proofData.proof as `0x${string}`[]
        );
      } else {
        await approveMint();
        tokenId = await executeMint(metadataUri, traits);
      }
      if (tokenId) setMintedTokenId(tokenId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mint failed";
      setError(msg);
    }
  }
```

- [ ] **Step 5: Add "not on whitelist" message**

If in WHITELIST phase and no proof found, show a message instead of the mint button:

```tsx
        {currentPhase === 1 && !proofData && (
          <p className="text-center text-red-400 font-[family-name:var(--font-orbitron)]">
            Your wallet is not on the whitelist.
          </p>
        )}
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/components/mint/MintConfirm.tsx
git commit -m "feat: whitelist-aware pricing, proof lookup, and mint count in MintConfirm"
```

---

## Task 12: Update Landing Page Copy

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update hero section copy**

In `src/app/page.tsx`, find the "HOW IT WORKS" section (around lines 71-98). The current 3-step flow shows "PHOTOGRAPH → AI MINTS → BATTLE". Update to:

```tsx
            {/* Step 1 */}
            <div className="text-center">
              <div className="text-4xl mb-3">🎲</div>
              <h3 className="font-[family-name:var(--font-orbitron)] text-[var(--accent)] text-sm mb-2">
                ROLL YOUR TRAITS
              </h3>
              <p className="text-xs opacity-70">
                Pick a faction and roll unique kitbash traits — frame, weapons, colorway, and more
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="text-4xl mb-3">🤖</div>
              <h3 className="font-[family-name:var(--font-orbitron)] text-[var(--accent)] text-sm mb-2">
                AI GENERATES
              </h3>
              <p className="text-xs opacity-70">
                Gemini AI renders a unique Mobile Suit from your traits — no two cards are the same
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="text-4xl mb-3">⚔️</div>
              <h3 className="font-[family-name:var(--font-orbitron)] text-[var(--accent)] text-sm mb-2">
                MINT & BATTLE
              </h3>
              <p className="text-xs opacity-70">
                Mint your card as an NFT on Base and build your battle team
              </p>
            </div>
```

- [ ] **Step 2: Update the feature cards section**

Find the "Photo → NFT" feature card (around line 102-115) and update to:

```tsx
              <h3 className="font-[family-name:var(--font-orbitron)] text-[var(--accent)] mb-2">
                AI-Generated Cards
              </h3>
              <p className="text-sm opacity-70">
                Every card is a unique kitbashed Mobile Suit generated by AI from your trait roll. ~69 million possible combinations.
              </p>
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix: update landing page copy for generative mint direction"
```

---

## Task 13: Update Deploy Script for Mainnet

**Files:**
- Modify: `contracts/script/Deploy.s.sol`

- [ ] **Step 1: Update mint price constant**

In `contracts/script/Deploy.s.sol`, update line 42:

```solidity
    // Mint price: $2 USDC (6 decimals)
    uint256 constant MINT_PRICE_USDC     = 2_000_000;
```

- [ ] **Step 2: Add post-deploy whitelist configuration**

After the GunplaCard proxy deployment (around line 109), add whitelist setup:

```solidity
        // ─── Whitelist Configuration ───────────────────────────────
        GunplaCard cardInstance = GunplaCard(address(cardProxy));
        cardInstance.setTierPrice(1, 1_000_000);    // VIP: $1
        cardInstance.setTierPrice(2, 1_500_000);    // WL: $1.50
        cardInstance.setWhitelistMintCap(5);
        // Merkle root set separately after tree generation
        // Phase starts as PAUSED (default 0)
        console.log("Whitelist configured: VIP=$1, WL=$1.50, cap=5");
```

- [ ] **Step 3: Compile**

```bash
cd contracts && forge build
```

- [ ] **Step 4: Commit**

```bash
git add script/Deploy.s.sol
git commit -m "chore: update deploy script with $2 mint price and whitelist config"
```

---

## Task 14: Whitepaper v2 Updates

**Files:**
- Modify: `docs/whitepaper.md`

- [ ] **Step 1: Update Core Loop section**

Replace "photograph your real Gunpla" language with the generative flow:
- Users select a faction (optional) and roll random traits
- Gemini 2.5 Flash generates a unique kitbashed Mobile Suit image
- 8 trait categories with weighted rarity tables (~69M+ combinations)
- Card minted as ERC-721 on Base with full on-chain traits

- [ ] **Step 2: Update Card System section**

Replace the photo analysis pipeline description with:
- 8 trait categories: Frame Type, Head, Primary Weapon, Backpack, Colorway, Stance, Background, Special
- Rarity derived from trait weights (Common → Legendary)
- Balanced HP ranges: Common 400-550, Uncommon 500-700, Rare 650-850, Ultra Rare 800-1050, Legendary 1000-1300
- Damage values scale as percentages of HP

- [ ] **Step 3: Update $GNDM Tokenomics section**

Add note that GNDM v2 will be deployed via Clanker SDK with:
- 100B total supply (1:1 migration from v1)
- 20% vaulted (30-day cliff, 90-day vest)
- Dynamic 1-3% trading fees
- Token address TBD (Joshua deploying separately)

- [ ] **Step 4: Update Smart Contracts section**

Add whitelist system details:
- Three mint phases: PAUSED → WHITELIST → PUBLIC
- Tiered Merkle proof verification (VIP $1, WL $1.50, Public $2)
- 5 mints per wallet during whitelist

- [ ] **Step 5: Update Roadmap section**

- Whitelist mint: April 27, 2026 at 12:00 PM CST
- Public mint: May 10, 2026
- Battle system: post-launch
- AI Cosmetics: post-launch

- [ ] **Step 6: Update Technology section**

Add Gemini 2.5 Flash with `responseModalities: ["TEXT", "IMAGE"]` for card generation.

- [ ] **Step 7: Regenerate PDF**

```bash
python3 docs/generate-whitepaper-pdf.py
```

- [ ] **Step 8: Commit**

```bash
git add docs/whitepaper.md docs/GundariuMwhitepaper.pdf
git commit -m "docs: update whitepaper v2 — generative pivot, whitelist, rebalanced stats"
```

---

## Task 15: Pre-Launch Smoke Test (Sepolia)

**Files:** No new files — verification only

- [ ] **Step 1: Upgrade GunplaCard on Sepolia**

Create an upgrade script or use the existing `UpgradeGunplaCard.s.sol` pattern:

```bash
cd contracts
forge script script/UpgradeGunplaCard.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --account deployer \
  --broadcast
```

- [ ] **Step 2: Set whitelist state on Sepolia**

Using `cast`:

```bash
# Set Merkle root (from generate-merkle.ts output)
cast send $GUNPLA_CARD_SEPOLIA "setMerkleRoot(bytes32)" $MERKLE_ROOT \
  --account deployer --rpc-url $BASE_SEPOLIA_RPC_URL

# Set tier prices
cast send $GUNPLA_CARD_SEPOLIA "setTierPrice(uint8,uint256)" 1 1000000 \
  --account deployer --rpc-url $BASE_SEPOLIA_RPC_URL
cast send $GUNPLA_CARD_SEPOLIA "setTierPrice(uint8,uint256)" 2 1500000 \
  --account deployer --rpc-url $BASE_SEPOLIA_RPC_URL

# Set mint cap
cast send $GUNPLA_CARD_SEPOLIA "setWhitelistMintCap(uint256)" 5 \
  --account deployer --rpc-url $BASE_SEPOLIA_RPC_URL

# Enable whitelist phase
cast send $GUNPLA_CARD_SEPOLIA "setMintPhase(uint8)" 1 \
  --account deployer --rpc-url $BASE_SEPOLIA_RPC_URL
```

- [ ] **Step 3: Test whitelist mint on Sepolia**

Run the full flow:
1. Start dev server: `npm run dev`
2. Connect wallet that's in the whitelist
3. Generate a kitbash card
4. Confirm mint — should use whitelist price
5. Verify token appears on Sepolia BaseScan

- [ ] **Step 4: Test public phase**

```bash
cast send $GUNPLA_CARD_SEPOLIA "setMintPhase(uint8)" 2 \
  --account deployer --rpc-url $BASE_SEPOLIA_RPC_URL
```

Mint with a wallet NOT on the whitelist. Should pay full $2 price.

- [ ] **Step 5: Test phase gating**

```bash
cast send $GUNPLA_CARD_SEPOLIA "setMintPhase(uint8)" 0 \
  --account deployer --rpc-url $BASE_SEPOLIA_RPC_URL
```

Attempt to mint — should be rejected with "not in public/whitelist phase".

---

## Task 16: Mainnet Deploy

**Files:**
- Modify: `src/lib/contracts/addresses.ts`

- [ ] **Step 1: Deploy GunplaCard to Base mainnet**

```bash
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url $BASE_RPC_URL \
  --account deployer \
  --broadcast \
  --verify
```

- [ ] **Step 2: Verify owner on-chain**

```bash
cast call $NEW_GUNPLA_CARD "owner()(address)" --rpc-url $BASE_RPC_URL
```

Expected: `0x9d6277e24efe034de2f44dd9adfe0f24b8b08bb7` (Joshua's deployer wallet)

- [ ] **Step 3: Set Merkle root on mainnet**

```bash
cast send $NEW_GUNPLA_CARD "setMerkleRoot(bytes32)" $MERKLE_ROOT \
  --account deployer --rpc-url $BASE_RPC_URL
```

- [ ] **Step 4: Update addresses.ts**

Replace the placeholder `0x000...` for `gunplaCard` on chain 8453:

```typescript
  8453: {
    gunplaCard: "0x_NEW_MAINNET_ADDRESS_HERE",
    // ... rest unchanged
  },
```

- [ ] **Step 5: Set mint phase to WHITELIST on April 27**

```bash
cast send $NEW_GUNPLA_CARD "setMintPhase(uint8)" 1 \
  --account deployer --rpc-url $BASE_RPC_URL
```

- [ ] **Step 6: Set mint phase to PUBLIC on May 10**

```bash
cast send $NEW_GUNPLA_CARD "setMintPhase(uint8)" 2 \
  --account deployer --rpc-url $BASE_RPC_URL
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/contracts/addresses.ts
git commit -m "deploy: GunplaCard live on Base mainnet with whitelist"
```

---

## Execution Order & Dependencies

```
Task 1  (traits rebalance)         — independent
Task 2  (contract whitelist)       — independent
Task 3  (contract tests)           — depends on Task 2
Task 4  (Merkle tooling)           — independent
Task 5  (Turnstile helper)         — independent
Task 6  (rate limiter)             — independent
Task 7  (API anti-abuse)           — depends on Tasks 5, 6
Task 8  (useMint hook)             — depends on Task 9
Task 9  (ABI update)               — depends on Task 2
Task 10 (MintLanding Turnstile)    — depends on Task 5
Task 11 (MintConfirm whitelist)    — depends on Tasks 8, 9
Task 12 (landing page copy)        — independent
Task 13 (deploy script)            — depends on Task 2
Task 14 (whitepaper)               — independent
Task 15 (Sepolia smoke test)       — depends on Tasks 2, 3, 8, 9, 10, 11, 13
Task 16 (mainnet deploy)           — depends on Task 15
```

**Parallelizable groups:**
- Group A (independent): Tasks 1, 2, 4, 5, 6, 12, 14
- Group B (after Task 2): Tasks 3, 9, 13
- Group C (after Tasks 5, 6): Task 7
- Group D (after Task 9): Tasks 8, 10
- Group E (after Task 8): Task 11
- Group F (after all): Tasks 15, 16

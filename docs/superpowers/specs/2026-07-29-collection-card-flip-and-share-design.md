# Collection Card Flip & Per-Card Share — Design

## Problem

The `/collection` grid renders each Gundar-Frame with `CardFrame`, a dense single-face
"HUD" card that already shows the art, runner, armor, rarity, HP, and all four weapons
on one face. Joshua wants two additions:

1. The same flip interaction already built for the mint-success screen
   (`MintSuccess.tsx`), so collection cards can flip to a back face.
2. An individual share action per card in the collection.

## Scope

In scope: `/collection`'s cards (`CollectionCard.tsx`), plus a refactor of
`MintSuccess.tsx` to eliminate duplicated flip/back-face code.

Out of scope: `GenerationReveal.tsx` and `MintConfirm.tsx` — both also render
`CardFrame` during earlier mint-flow steps, but neither gets a flip or share
action added. Only `/collection` and the existing mint-success flip change.

## Why extract shared components instead of building a second flip implementation

This exact class of duplication has already caused two real bugs this session:

- `MintSuccess.tsx` carries a code comment noting a past bug where its local
  rarity-glow map had Legendary and another tier swapped on the back face.
- The card share OG image (`/api/og/card/[tokenId]/route.tsx`) had its frame
  color hardcoded to gold regardless of actual rarity, because it was built
  independently of the canonical `RARITY_PALETTES` in `frame-config.ts`.

A second, collection-only flip/back-face implementation would be a third copy
of the same rarity-color logic. Instead, the flip mechanism and back face are
extracted into shared components used by both the collection and the (refactored)
mint-success screen.

## Architecture

```
CollectionCard.tsx                    MintSuccess.tsx
  ├─ FlippableCard                      ├─ FlippableCard
  │   ├─ front: CardFrame (unchanged)   │   ├─ front: existing simple front (unchanged)
  │   └─ back: CardBack (new)           │   └─ back: CardBack (new, replaces inline JSX)
  └─ ShareButtons (compact, new prop)   └─ ShareButtons (unchanged, full)
```

- **`FlippableCard`** (`src/components/card/FlippableCard.tsx`) — new. Extracted
  from `MintSuccess.tsx`'s current flip markup (perspective, `rotateY` animation
  via framer-motion, click-to-toggle local state, `backfaceVisibility` on both
  faces). Generalized to accept `front: ReactNode` and `back: ReactNode` instead
  of hardcoded JSX, so both call sites share one implementation.

- **`CardBack`** (`src/components/card/CardBack.tsx`) — new. Extracted from
  `MintSuccess.tsx`'s current back-face JSX (name, series, token ID, faction,
  armor, rarity, HP bar, weapon list, "TAP TO FLIP BACK" hint). Takes
  `traits: TraitSet` and `tokenId: bigint | null`. Uses `RARITY_PALETTES` from
  `src/lib/card/frame-config.ts` for its color (`.primary`) instead of a local
  map, consolidating all three prior rarity-color sources (CardFrame's
  `RARITY_COLOR`, MintSuccess's `RARITY_GLOW`, frame-config's
  `RARITY_PALETTES`) down to one canonical source for this component onward.
  (`CardFrame.tsx`'s own local `RARITY_COLOR` map is left as-is — out of scope
  for this change, since `CardFrame` itself isn't being touched.)

- **`CollectionCard.tsx`** — modified. Wraps its existing `CardFrame` (front,
  completely unchanged) and the new `CardBack` (back) in `FlippableCard`.
  `card.traits` and `card.tokenId` (from `useCollection`'s `OwnedCard`) already
  carry everything `CardBack` needs — no new data fetching.

- **`MintSuccess.tsx`** — modified. Its current inline flip wrapper and
  back-face JSX (roughly lines 68–203) are replaced with `FlippableCard` +
  `CardBack`. Its front content (image, name, rarity, token #, "TAP TO FLIP"
  hint) is preserved exactly as-is, just passed as the `front` prop instead of
  being inline. No visual or behavioral change intended for the mint flow.

- **`ShareButtons`** (`src/components/ui/ShareButtons.tsx`) — modified. New
  optional `compact?: boolean` prop. When set, the Farcaster/X/Facebook/Share
  buttons render icon-only (no text labels), with tighter padding and gap, for
  placement under each card in a dense grid. All existing behavior (share
  text, embed URL, click handlers, the `verified` flow) is unaffected —
  `compact` only changes rendering, not logic.

## Placement

- **Flip:** tapping anywhere on a collection card flips it between front
  (`CardFrame`, unchanged today) and back (`CardBack`, new). Each card's
  flipped state is independent local state — flipping one card in the grid
  does not affect any other card.
- **Share:** a compact `ShareButtons` row renders below each card, next to its
  token ID caption, independent of flip state (visible whether the card is
  showing its front or back). Uses the existing `card` prop path
  (`name`/`rarity`/`tokenId`), which already builds the correct
  `/card/{tokenId}` embed URL and (as of an earlier fix this session) the
  correctly rarity-colored OG share image.

## Data flow

No new data fetching anywhere in this feature:

- Collection: `useCollection()` already returns full `TraitSet` + `tokenId`
  per owned card (via `getTraits`/`tokenOfOwnerByIndex` on-chain reads) —
  already passed into `CollectionCard` today.
- Mint success: `useMintStore()` already provides `traits` + `mintedTokenId`.
- Share: `ShareButtons`'s existing `card` prop path is unchanged; `compact`
  only changes button rendering.

## Error handling

- `CardBack`'s `tokenId: bigint | null` accommodates `MintSuccess`'s existing
  rare edge case (mint succeeded but the tokenId read-back failed) — renders
  without the `#tokenId` line when null, matching `MintSuccess`'s current
  `mintedTokenId !== null` guard. Collection always has a real `tokenId`.
- No new network calls means no new loading/error states beyond what each
  page already handles (`useCollection`'s existing `isLoading` gates when
  `CollectionCard` renders at all).
- `ShareButtons`'s existing per-method error handling (native share cancel,
  clipboard fallback) is untouched by the `compact` prop.

## Testing

This project has no frontend test framework (per `CLAUDE.md`); this feature
follows that convention. Manual verification via the dev server:

1. `/collection` with a connected wallet holding cards of at least two
   different rarities: front renders unchanged (regression check), tapping
   flips to a back face showing stats that match the on-chain traits
   (faction, armor, rarity, HP, all four weapons), tapping again flips back.
2. Confirm flip state is independent per card in the grid.
3. Confirm the compact share row renders under every card regardless of flip
   state, and that Farcaster/X/Facebook/Share each open with the correct
   `/card/{tokenId}` embed and correctly rarity-colored OG image.
4. Re-run the full mint flow to `/mint`'s success screen: front, back, and
   flip behavior all look and behave identically to before the refactor.
5. `npx tsc --noEmit` and `npx eslint` clean.

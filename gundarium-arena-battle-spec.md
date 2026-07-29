# GundariuM — Live PvP Arena Battle System
### Technical Spec v1 — for CLI Larry handoff

**Goal:** Turn-based, Pokémon-style battle screen in the Arena page. User's connected-wallet Gundar-Frame NFT fights the current top-ranked leaderboard frame. Live 3D visuals assembled from real NFT traits, both sides' actual mecha rendered — no auto-play, player chooses moves each turn.

**Stack fit:** Next.js (existing) + Three.js / React Three Fiber for the 3D scene. No new backend framework needed — this is frontend rendering + existing chain/metadata reads.

---

## 1. Data Layer (build first — unblocks everything else)

Every NFT's OpenSea metadata already contains full combat stats as traits:

| Trait | Combat Role |
|---|---|
| HP | Max health bar value |
| Primary/Secondary/Tertiary Weapon | Move names (3 moves per frame) |
| Primary/Secondary/Tertiary Damage | Move power |
| Special Attack / Special Damage | 4th move, likely higher cost/cooldown |
| Armor Type | Defense modifier / part visual selector |
| Grade, Rarity | Stat scaling or visual tier (e.g. glow/finish) |
| Faction, Series, Pilot, Runner | Flavor / may drive palette or part style |

**Tasks:**
- [ ] Write `getFrameStats(tokenId)` — fetch metadata (contract call or metadata URI), parse traits into a typed `FrameStats` object
- [ ] Write `getRankedOpponent()` — pull current #1 leaderboard entry's token ID, run through same parser
- [ ] Define `Move` type: `{ name, power, type: 'primary'|'secondary'|'tertiary'|'special' }`
- [ ] Combat resolution function: given attacker move + defender armor/HP, compute damage, update HP state
- [ ] Turn state machine: player move select → resolve → opponent move (server logic or simple AI/highest-power-move for now) → resolve → check win condition

This layer has zero 3D dependency — buildable and testable standalone before any Blender/Three.js work exists.

---

## 2. Blender Modular Part Kit

**Do NOT model each of the 14 (growing) NFTs individually.** Model reusable parts keyed to trait values, assembled at runtime.

**Confirmed trait categories needing visual variants:**
- Armor Type (4 known values) → torso/frame silhouette variants
- Primary/Secondary/Tertiary Weapon (9/7/8 known values) → weapon models, attachable to hand/back/shoulder mount points
- Grade / Rarity (visual tier) → material finish (matte, metallic, chrome, glow/emissive for top rarity)
- Faction (10 values) → color palette per faction, NOT relied on alone (see accessibility section)

**Kit build order:**
1. One base humanoid mech frame (shared skeleton/proportions across all armor types)
2. 4 armor-type torso/limb variants, same attach points
3. Weapon models per weapon trait value — start with the ones actually present across your 14 minted pieces, expand later
4. Rig: simple mech-appropriate skeleton (fewer bones than human — most joints are hinge/pivot, not organic deformation). Since these are turn-based idle/attack poses, not real-time locomotion, you don't need a full animation rig — a handful of pose states is enough (idle, attack windup, attack impact, hit-reaction, defeat)
5. Export as glTF (.glb) — the standard format Three.js/R3F consumes directly, avoids any TOTK-style proprietary format problem entirely

**This is a genuinely smaller scope than modeling 14+ unique mechs** — a few weapon models and 4 armor variants covers the current collection and scales cleanly as new pieces mint.

---

## 3. Battle Scene (React Three Fiber)

- Scene: player frame back-left, opponent frame front-right (or mirrored, whichever reads clearer)
- Load assembled `.glb` per frame based on trait → part mapping from Data Layer
- Camera: fixed angle, slight 3/4 view (classic JRPG battle framing, not full 3D free-cam — keeps this achievable)
- Lighting: simple 3-point setup, consistent regardless of frame so materials read correctly
- Attack animation: swap between idle/windup/impact poses on move resolution, not full skeletal animation — much cheaper to build and still reads as "battle happening"

---

## 4. Combat UI (2D overlay on top of 3D scene)

- **HP bars:** top of screen, one per frame. Use blue → yellow → red gradient (NOT green → red) for colorblind safety. Always show numeric HP alongside the bar — color is never the only signal.
- **Move menu:** 4 buttons (Primary/Secondary/Tertiary/Special), labeled with weapon name + power number, not color-coded alone
- **Text box:** bottom of screen, turn narration ("Gundar-1 uses DeathScythe! 42 damage!"), reveal character-by-character for game feel
- **Status/effect icons (if/when added):** icon + text label, never color-only

---

## 5. Live Wiring

- On Arena load: read connected wallet's owned Gundar-Frame token(s) → if multiple, let user pick which one fights
- Read current leaderboard #1 → that's the opponent, refreshed each challenge (not cached indefinitely, since rank changes)
- Battle result → write outcome to leaderboard/stats (win/loss record), likely via existing backend the leaderboard already reads from

---

## 6. Accessibility (protan/deuteran-safe, applies site-wide not just battle)

- Never encode meaning in red/green hue alone — anywhere in the UI
- HP/health: blue-yellow-red gradient, not green-yellow-red
- Rank/tier indicators: pair color with icon or numeral, always
- Recommend running the full battle UI mockup through a colorblind simulator (Coolors or Adobe Color) before considering any screen "done"

---

## Suggested build order for CLI Larry

1. Data layer (trait parsing, stats, turn logic) — no 3D dependency, fastest to get working end-to-end
2. Blender part kit (can happen in parallel — different skillset/tool)
3. R3F scene wired to static/mock data first, then swapped to live data layer
4. Combat UI overlay
5. Live wallet + leaderboard wiring last, once battle-of-two-known-frames works end-to-end

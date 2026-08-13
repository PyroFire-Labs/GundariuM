# Sample output — for review, not for shipping

Four GLBs generated locally with the current `assemble.py` + placeholder
`components.py`, one per file pair (`traitsN.json` = input traits,
`traitsN.glb` = output model):

| File | Traits |
|---|---|
| `traits1` | Heavy Armor / Twin Horn / Beam Rifle / Flight Unit / Federation White & Blue / Trans-Am burst |
| `traits2` | Stealth / Mono-Eye / Gerbera Straight Katana / GN Drive Tau / Shadow Black & Gold / no special |
| `traits3` | Berserker / Antenna Array / Gatling Gun / Heavy Arms Rack / Neo Zeon Crimson / battle damage |
| `traits4` | Full Armor / Crown Crest / Twin Buster Rifle / Psychoframe Emitter / Psychoframe Aurora / psychoframe glow |

## How to look at them

macOS has no built-in GLB viewer (Quick Look only handles USDZ). Easiest
option — no install, nothing leaves your machine except the file you choose
to drag in:

1. Open **https://sandbox.babylonjs.com** in Safari
2. Drag one of the `.glb` files from this folder into the browser window

That's it — it renders client-side.

## What you're actually judging here

This is placeholder geometry (see `worker/README.md` for why) — primitive
boxes/cylinders/cones assembled by trait, not real Gunpla art. What's worth
checking:
- Does each trait combo produce a visibly distinct shape/color? (they should)
- Is the rig proportion/pose reasonable as a stand-in silhouette?
- Any per-category geometry that looks broken (inverted normals, floating
  parts, etc.) rather than just "blocky by design"?

If the answer is "the pipeline works and produces sane, distinct output" —
the code is ready; only the art is a stand-in. If something looks structurally
wrong (not just "blocky"), that's a `components.py` bug worth flagging before
this goes anywhere near a real host.

## Regenerating / trying your own trait combo

```bash
cd worker/blender
cat > /tmp/mytraits.json <<'EOF'
{
  "tokenId": "test",
  "frameType": "Sniper",
  "head": "Visor Type",
  "primaryWeapon": "GN Sniper Rifle",
  "backpack": "Wing Binders",
  "colorway": "OZ Royal Purple",
  "special": "None"
}
EOF
blender --background --python assemble.py -- /tmp/mytraits.json /tmp/mytraits.glb
```

Valid values for each field are the trait names in
`src/lib/kitbash/traits.ts`'s `TRAIT_TABLES`.

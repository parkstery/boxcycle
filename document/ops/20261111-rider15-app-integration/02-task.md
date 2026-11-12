# Task S4 — rider15 colour kits (self / peer / pacer), near model and far model

Work in `C:\20.HDev\boxcycle\apps\web`. Write only inside this folder. This continues S2 (see `rider15Rig.ts`, `preservedRiderHandle.ts`, `riderModelProfile.ts`, and the rider15 branch in `src/lib/map/riderPreservedLayer.ts`, all already in the working tree).

## Why

The app must show at a glance who is who: the user's own rider (`self`), companions (`peer`) and the pacer (`pacer`). rider14 does this by repainting two cells of its palette texture (`riderPaletteKit.ts`, `riderVisualKit.ts`: `paintPaletteKit`, kit colours `RIDER_VISUAL_KIT_*`), reading the cell positions from the material's `userData.palette`. rider15's materials carry no such data, so after S2 every rider15 looks the same. The decision is to keep the slot table for rider15 in app code, not in the GLB.

## Measured facts about the rider15 assets (I measured these; rely on them)

Near model `rider.glb`:

- One base-colour image, 64 × 1024 px, used by both materials. Every row is identical: it is 64 colour columns. Sampler is nearest, wrap repeat.
- Material `P67 shared palette` (bike) uses it as `map`. Material `P75 rider · 7.5% soft shading` (rider) uses the same texture as both `map` and `emissiveMap` (base colour factor 0.075, emissive factor 0.925) — so a repaint must replace both, or the rider barely changes.
- Jersey = column 0 (`#ff8000`): used by `P51_Body` (368 verts), `P74_Jersey_Collar` (96), `P79_Skinned` (60). Nothing on the bike uses column 0; the orange bike frame uses column 20, so repainting column 0 leaves the frame alone.
- Helmet shell = the near-white columns 1 (`#eaf0f2`) and 2 (`#eaedf0`), used only by `P78_Head`. Column 8 (`#fcfcfc`, 24 verts) is not the shell; leave it.
- So the slot table is: `jersey = { x: 0, y: 0, w: 1, h: 1024 }`, `helmet = { x: 1, y: 0, w: 2, h: 1024 }`. This fits the existing `PaletteSlots` type as is.
- One thing I could not settle: two probes disagreed on whether ~250 helmet-shell vertices of `P78_Head` land in column 2 or wrap to column 63 (u at or just below 0). Your test below must settle it; if they really sample column 63, tell me rather than widening the slot (column 63 is a dark colour also used elsewhere).

Far model `rider-lod2.glb`:

- One mesh `P79_LOD2`, 5,503 verts, `MeshBasicMaterial` with `vertexColors`, attribute `color` = 4 × Uint8 normalized. No texture. The node has scale 0.8335 and a translation, so positions must go through the node's world matrix before any height test.
- Colours are stored linear: jersey and bike frame are both `#ff3700` (1,474 verts together); helmet shell is `#d2d8de` (78 verts, the only use of that colour).
- Jersey and frame cannot be told apart by colour, but they can by height in rider space: the orange vertices have none between y = 0.90 m and 1.00 m; frame is below, jersey above (about 280 verts). Use y ≥ 0.95 m as the split.
- The kit colours in `riderVisualKit.ts` are linear 0–1, so for vertex colours write `round(c * 255)` directly (no sRGB conversion); for the texture the existing `paintPaletteKit` already converts.

## What to build

1. **Near model.** Give rider15 a real visual kit so `Rider15Rig.setVisualKind(kind)` repaints jersey and helmet shell with the existing kit colours, using the slot table above held in app code (the rider15 profile is the natural home). `self` shows the original texture untouched (white helmet, orange jersey). Reuse `RiderPaletteKit` / `paintPaletteKit` rather than writing a second painter: extend the kit so slots can be supplied by the caller instead of read from `userData`, and so it also swaps `emissiveMap` on any material whose `emissiveMap` is the original palette texture. rider14 behaviour through the existing entry points must not change. Kit textures are built once per kind and then only swapped, as today; `dispose` must restore originals and free what the kit created.
2. **Far model.** Register `rider-lod2.glb` for rider15 (config `lod2` entry; remove the rider15 early-return in `loadLod2`) and make the static far rider (`preservedRiderStatic.ts`) work for it. Its kit recolours by vertex colour: build one colour array per kind once (jersey = `#ff3700` verts with world y ≥ 0.95; helmet = `#d2d8de` verts), then swap the geometry's colour attribute on `apply`. `self` uses the original array. Check how the layer shares one LOD2 instance across riders of different kinds and keep that working.
3. **Tests** in `scripts/rider-preserve/` (new file `rider15-colour-kit.test.ts`; follow `rider-palette-kit.test.ts` and `rider-lod2.test.ts` for how textures are stubbed under node — there is no canvas, see `attachPaletteStubMap` and `injectKitTextureForTests`). Cover:
   - UV evidence for the slot table: count the vertices of `P51_Body` + `P74_Jersey_Collar` + `P79_Skinned` that sample the jersey slot (expect 524) and of `P78_Head` that sample the helmet slot; assert no bike mesh (`P67_*`, `P78_CleatsAndPedals`) samples either slot. Log the per-column counts for `P78_Head`.
   - `paintPaletteKit` with the rider15 slots on a synthetic 64 × 1024 buffer changes exactly columns 0–2 and nothing else, for peer and pacer.
   - On the rig: after `setVisualKind("peer")` both `map` and `emissiveMap` of the rider material point at the kit texture and the bike material's `map` does too (same shared texture is fine) ; back to `"self"` restores the originals; `dispose` leaves no kit texture alive.
   - Far model: jersey count is in the 250–320 range, helmet count is 78, the frame's orange vertices are byte-identical after `apply("peer")`, jersey/helmet vertices equal the kit colours, and `self` restores the original bytes.
   - rider14's existing kit tests still pass unchanged.

## Constraints

- Do not change rider14 behaviour, `PRESERVED_RIDER_ACTIVE_MODEL`, files under `public/`, `package.json`, lockfiles. No new dependencies.
- No state-changing git commands; the tree holds other people's uncommitted work and the uncommitted S2 work.
- No dev servers or browsers.
- Comments short, Korean, matching the surrounding files.
- Your shell probably cannot run commands in this folder (last time every command failed with `SetNamedSecurityInfoW failed … grantWrite`). Try once; if it fails, do not fight it — write the code and tests carefully and I will run them and come back to you in this session with any failures.

## Checks I will run

```
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rider-preserve/rider15-colour-kit.test.ts scripts/rider-preserve/rider15-rig.test.ts
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rider-preserve/rider-palette-kit.test.ts scripts/rider-preserve/rider-visual-kit.test.ts scripts/rider-preserve/rider-lod2.test.ts scripts/rider-preserve/rider-model-profile.test.ts scripts/rider-preserve/rider14-equivalence.test.ts
node --test scripts/rider-preserve/preserved-layer-contract.test.mjs
npx tsc -b --noEmit
```

## Report

Files changed with one line each; what you could and could not run; how the layer shares the far model across kinds and what you did about it; anything you were unsure of.

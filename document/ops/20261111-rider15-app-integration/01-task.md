# Task S2 — register rider15 and drive it with a dedicated rig (DEV only)

You are working in `C:\20.HDev\boxcycle\apps\web` (a Vite + TypeScript + Three.js 0.186 web app). Write only inside this folder.

## Background

The app draws a 3D cyclist on a Mapbox map through a Three.js custom layer:

- `src/lib/map/riderPreservedLayer.ts` loads the model and renders it per rider.
- `src/lib/riderPrototype/preservedRiderRig.ts` is the rig for the current model `rider14`. That model has no skin and no animation; the rig computes leg motion itself from mesh-name prefixes, `pedalBind` extras and a `guide-weights.json` file.
- `src/lib/riderPrototype/config.ts` registers models (`PRESERVED_RIDER_MODELS`, `PreservedRiderModelId`, `resolvePreservedRiderModel`, `preservedRiderAssetUrl`).
- `src/lib/riderPrototype/riderModelProfile.ts` holds per-model profiles.

A new model `rider15` is already copied to `public/rider/preserved/candidates/20261111-025600-ad1d669d/` (`rider.glb`, `rider-lod2.glb`, `base-layout.json`, `candidate.json`). It is a different kind of asset: a standard glTF skinned model (1 skin, 33 joints, 11 primitives, 2 materials, meshopt-compressed, morph targets) with one animation clip `Ride_Hoods` (59 tracks) that contains one full pedal revolution. The wheels are separate nodes named `P67_FrontWheel` and `P67_RearWheel`. It has none of the rider14 conventions (no `crank__`/`legR__` prefixes, no `pedalBind`, no guide weights), so `PreservedRiderRig` cannot drive it.

The model author's Babylon.js reference code is at `C:\Users\kdrea\OneDrive\Documents\img\rider15_model_work\release\V3.0_rider15\runtime-reference\` (read-only, outside your write scope; read it if you can, otherwise inspect the GLB directly). It shows how pedal phase maps to clip time (`base.goToFrame`).

## Goal

In a DEV build, opening the app with `?riderModel=rider15` shows rider15 on the map, pedalling in sync with the same phase value rider14 uses, with wheels turning. Without that query, and in every production build, behaviour is exactly as today (rider14).

## What to build

1. **Registration** (`config.ts`): add `rider15` to `PreservedRiderModelId` and `PRESERVED_RIDER_MODELS` with candidate id `20261111-025600-ad1d669d`. Accept `riderModel=rider15` in `resolvePreservedRiderModel` (DEV only, as the existing code already gates). Keep `PRESERVED_RIDER_ACTIVE_MODEL = "rider14"`. Do not give rider15 a `lod2` entry yet — far-distance rendering is a later step.
2. **Profile** (`riderModelProfile.ts`): add whatever a rider15 profile needs so `getRiderModelProfile("rider15")` works. If the profile type is built around rider14-only fields, prefer a small discriminated shape over stuffing fake values in.
3. **Rig** — new file `src/lib/riderPrototype/rider15Rig.ts`: a class built on `THREE.AnimationMixer` that
   - takes the loaded `gltf` (scene + animations),
   - exposes the same members the layer calls on the rider14 rig (find them by reading how `riderPreservedLayer.ts` uses `this.rig`; at minimum `object`, `setPhase(phaseRev)`, `setSway(...)`, `supportsSway`, `crankPhaseR`, `dispose()`, plus whatever the colour-kit path calls),
   - `setPhase(phaseRev)` sets the `Ride_Hoods` clip time from the phase (one revolution = one clip duration; wrap negative and >1 values) and updates the mixer without advancing wall-clock time,
   - turns the two wheel nodes. Work out the wheel-to-crank ratio or wheel angle source from how the rider14 rig turns its wheels and keep the same visual speed,
   - reports `supportsSway = false` for now and makes `setSway` a no-op (the model's own roll is a later step),
   - makes colour-kit calls safe no-ops for now, with a one-line comment that colour slots come in step S4.
4. **Shared type**: the layer currently types its rig field as `PreservedRiderRig`. Introduce the narrowest common interface both rigs satisfy and use it in the layer, instead of casts.
5. **Layer branch** (`riderPreservedLayer.ts`, `loadApprovedCandidate`): for rider15, load only `rider.glb` (no `guide-weights.json` fetch) and build `Rider15Rig`. The rider14 path must stay byte-for-byte equivalent in behaviour.
6. **Orientation and scale**: check the model's forward axis, up axis, units and ground height against rider14 (compare bounding boxes and where the wheels touch y=0 / the ground plane in the rig's local space). If rider15 needs a fixed correction so it faces the same way, has the same real-world size and has its tyres on the ground, apply it inside `Rider15Rig` (on a wrapper group), and state the measured numbers in your report. Do not change the layer's shared transform.
7. **Tests** — new file `scripts/rider-preserve/rider15-rig.test.ts`, in the style of the neighbouring tests (see `rider-standard-skin-spike.test.ts` and `rider-glb-test-loader.ts` for how GLBs are loaded under node). Cover at least: the GLB loads and the rig builds; `setPhase(0)` and `setPhase(0.5)` give clearly different foot/crank positions; `setPhase(0)` and `setPhase(1)` give the same pose; `setPhase(0.25)` then `setPhase(0.25)` again is stable (no time drift); wheel nodes rotate with phase; `resolvePreservedRiderModel` / registration still default to rider14.

## Constraints

- Do not change rider14 behaviour, `PRESERVED_RIDER_ACTIVE_MODEL`, any file under `public/`, `package.json`, or lockfiles. Do not add dependencies.
- Do not run git commands that change state (no commit, restore, checkout, clean, stash, worktree). The repository has other people's uncommitted work.
- Do not start dev servers or browsers.
- `src/lib` has a dependency-layer gate (`scripts/check-dep-direction` reading `dep-layers.json` at the repo root or under `apps/web`). If a new file under `src/lib` must be registered there and the file is inside your write scope, register it; if it is outside, say so in the report and I will do it.
- Code comments in the same language and tone as the surrounding file (Korean, short).

## Checks to run (from `C:\20.HDev\boxcycle\apps\web`)

```
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rider-preserve/rider15-rig.test.ts
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/rider-preserve/rider-model-profile.test.ts scripts/rider-preserve/rider14-equivalence.test.ts scripts/rider-preserve/rider-lod2.test.ts scripts/rider-preserve/rider-palette-kit.test.ts
node scripts/rider-preserve/preserved-layer-contract.test.mjs
npx tsc -b --noEmit
```

If `preserved-layer-contract.test.mjs` is run differently (check `package.json` scripts and `scripts/rider-preserve/HARNESS.md`), use the project's way. The type check must be `tsc -b --noEmit`; `tsc --noEmit -p .` checks nothing here.

## Report (your final message)

- Files created and changed, one line each on what changed.
- Each check: exact command, pass/fail counts, and for anything failing or not run, why.
- Measured numbers: clip duration and frame count, how phase maps to time, wheel ratio, the orientation/scale/ground correction you applied (or that none was needed) with the bounding-box figures behind it.
- Anything in the rider14 interface you could not satisfy cleanly, and anything you were unsure about. Say plainly if something is unverified.

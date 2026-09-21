import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");
const candidateId = "20260921-041426-cd81398e";
const candidateDir = path.join(webRoot, "public", "rider", "preserved", "candidates", candidateId);
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read = (file) => fs.readFileSync(file, "utf8");

test("approved candidate assets are staged byte-for-byte", () => {
  const candidate = JSON.parse(read(path.join(candidateDir, "candidate.json")));
  assert.equal(candidate.candidateId, candidateId);
  assert.equal(candidate.status, "APP_APPROVED_PRODUCT_ACTIVE");
  assert.equal(sha256(path.join(candidateDir, "rider.glb")), candidate.sourceGlbSha256);
  assert.equal(candidate.stagedGlbSha256, candidate.sourceGlbSha256);
  assert.equal(sha256(path.join(candidateDir, "guide-weights.json")), candidate.guideRuntimeSha256);
  assert.match(candidate.pedalReportSha256, /^[a-f0-9]{64}$/);
});

test("preserved mode stays isolated from the product GLB", () => {
  const config = read(path.join(webRoot, "src", "lib", "riderPrototype", "config.ts"));
  assert.match(config, /raw === "preserved"/);
  assert.match(config, /return "preserved"/);
  assert.match(config, /rider\/preserved\/candidates/);
  assert.match(config, /rider\/prototype\/rider-lowpoly\.glb/);
  assert.equal(
    sha256(path.join(webRoot, "public", "rider", "prototype", "rider-lowpoly.glb")),
    "a9d0d6716c09a1edcd02bb968a07d16e0cf1f625ced7c33b19a5ef499f5268b8",
  );
});

test("MapView forwards the live phase and keeps the legacy GLB path", () => {
  const source = read(path.join(webRoot, "src", "components", "map", "MapView.tsx"));
  assert.match(source, /ensureRiderPreservedLayer\(map\)/);
  assert.match(source, /syncRiderPreservedModels\(map, specs\)/);
  assert.match(source, /phaseRev: liveCrankPhaseRevRef\.current/);
  assert.match(source, /syncRiderGlbModels\(map, specs\)/);
});

test("custom layer renders every rider with terrain, phase, bearing and lean", () => {
  const source = read(path.join(webRoot, "src", "lib", "riderPrototype", "preservedRiderLayer.ts"));
  assert.match(source, /for \(const spec of this\.specs\)/);
  assert.match(source, /this\.rig\.setPhase\(spec\.phaseRev \?\? 0\)/);
  assert.match(source, /queryTerrainElevation/);
  assert.match(source, /90 - spec\.bearingDeg/);
  assert.match(source, /spec\.leanDeg/);
});

test("preserved peers use the 3D nametag path without duplicate DOM sprites", () => {
  const source = read(path.join(webRoot, "src", "components", "map", "MapView.tsx"));
  assert.match(source, /RIDER_PROTOTYPE_MODE === "preserved" && ensureRiderPreservedLayer\(map\)/);
  assert.match(source, /if \(rider3dLayerReady\) \{\s*syncGlbPeerNametagMarkers/);
});

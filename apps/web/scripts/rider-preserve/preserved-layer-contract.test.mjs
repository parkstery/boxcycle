import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");
const S5_CANDIDATE_ID = "20260921-041426-cd81398e";
const S5_GLB_SHA256 = "1108aa3e37615eef037984a0cdf80018b840a043c6e62f6750f828646b6b1ffb";
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read = (file) => fs.readFileSync(file, "utf8");

function readActivePreservedModel(configText) {
  const active = configText.match(
    /export const PRESERVED_RIDER_ACTIVE_MODEL:\s*PreservedRiderModelId\s*=\s*"([^"]+)"/,
  );
  assert.ok(active, "PRESERVED_RIDER_ACTIVE_MODEL literal");
  const modelId = active[1];
  const models = configText.match(/export const PRESERVED_RIDER_MODELS = \{([\s\S]*?)\}\s*as const;/);
  assert.ok(models, "PRESERVED_RIDER_MODELS block");
  const entry = models[1].match(
    new RegExp(`(?:^|\\n)\\s*${modelId}:\\s*\\{[^}]*candidateId:\\s*"([^"]+)"`),
  );
  assert.ok(entry, `candidateId for active model ${modelId}`);
  return { modelId, candidateId: entry[1] };
}

test("approved rider15 V3 candidate assets are staged byte-for-byte", () => {
  const config = read(path.join(webRoot, "src", "lib", "riderPrototype", "config.ts"));
  const active = readActivePreservedModel(config);
  assert.deepEqual(active, { modelId: "rider15", candidateId: "20261127-160608-8767e93a" });
  const candidateDir = path.join(webRoot, "public", "rider", "preserved", "candidates", active.candidateId);
  const candidate = JSON.parse(read(path.join(candidateDir, "candidate.json")));
  assert.equal(candidate.candidateId, active.candidateId);
  assert.equal(candidate.status, "APP_APPROVED_PRODUCT_ACTIVE");
  assert.equal(candidate.schemaVersion, 3);
  for (const [key, hash] of Object.entries({
    glb: "8767e93afb64f2b5440b34a3c9a4c71f3535da91c561a6889c1539094e32f98a",
    lod2: "82d16a2b04ba44483b3ca384cd0d4eae1ffdb7d4b77571b928bde773bd04373c",
    gestures: "266f971a4868915ec603c4f8e422d8e6239c3d16a771280905f0c97cc709ed5a",
  })) {
    assert.equal(candidate.sha256[key], hash);
    assert.equal(sha256(path.join(candidateDir, candidate.files[key])), hash);
  }
});

test("rider14 rollback candidate stays byte-stable", () => {
  const dir = path.join(webRoot, "public", "rider", "preserved", "candidates", "20261015-212136-df8de090");
  const candidate = JSON.parse(read(path.join(dir, "candidate.json")));
  assert.equal(sha256(path.join(dir, "rider.glb")), candidate.sourceGlbSha256);
  assert.equal(sha256(path.join(dir, "rider-lod2.glb")), candidate.lod2SourceSha256);
  assert.equal(sha256(path.join(dir, "guide-weights.json")), candidate.guideRuntimeSha256);
  assert.match(read(path.join(webRoot, "src", "lib", "riderPrototype", "config.ts")), /rider14:\s*\{\s*candidateId:\s*"20261015-212136-df8de090"/);
});

test("s5 rollback candidate stays byte-stable", () => {
  const candidateDir = path.join(
    webRoot,
    "public",
    "rider",
    "preserved",
    "candidates",
    S5_CANDIDATE_ID,
  );
  assert.equal(fs.existsSync(candidateDir), true);
  for (const name of ["rider.glb", "guide-weights.json", "candidate.json"]) {
    assert.equal(fs.existsSync(path.join(candidateDir, name)), true, name);
  }
  assert.equal(sha256(path.join(candidateDir, "rider.glb")), S5_GLB_SHA256);
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
  assert.match(source, /id: "live-self"[\s\S]*?kind: "self"/);
  assert.match(source, /id: f\.properties\.id[\s\S]*?kind: "peer"/);
});

test("custom layer renders every rider with terrain, phase, bearing and lean", () => {
  const source = read(path.join(webRoot, "src", "lib", "map", "riderPreservedLayer.ts"));
  assert.match(source, /for \(const spec of this\.specs\)/);
  assert.match(source, /rig\.setPhase\(spec\.phaseRev \?\? 0\)/);
  assert.match(source, /rig\.setVisualKind\(spec\.kind \?\? "self"\)/);
  assert.match(source, /queryTerrainElevation/);
  assert.match(source, /90 - spec\.bearingDeg/);
  assert.match(source, /spec\.leanDeg/);
});

test("preserved peers use the 3D nametag path without duplicate DOM sprites", () => {
  // 2026-09-28 (구조 정비 A-2) — 마커 코드가 MapView 에서 riderDomMarkers 로 옮겨갔다.
  // 계약은 코드를 따라간다. 옮긴 자리에서 계속 겨누지 않으면 이 시험은 조용히 아무것도 막지 않는다.
  const source = read(path.join(webRoot, "src", "components", "map", "riderDomMarkers.ts"));
  assert.match(source, /RIDER_PROTOTYPE_MODE === "preserved" && ensureRiderPreservedLayer\(map\)/);
  assert.match(source, /if \(rider3dLayerReady\) \{\s*syncGlbPeerNametagMarkers/);
});

#!/usr/bin/env node
/** Stage the rider14 LOD0 candidate by byte copy (P1). Node builtins only. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_GLB_SHA256 = "df8de090b068f1a8734482ae5698bd578140b387fd3eb1947fd9839d5e4fe54d";
const EXPECTED_GUIDE_SHA256 = "136895c8d9b8bd29e47b0a53ac10a0f8443e93240eb2578330da0581ee840dca";
const EXPECTED_UPSTREAM_SHA256 = "aeefb4d246b815a2391cbf80c0778bfb80cc8f66fa09f7385684bba8d2c8bc70";
const GLB_PREFIX = EXPECTED_GLB_SHA256.slice(0, 8);

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
};
const sourceRoot = valueOf("--source");
if (!sourceRoot) {
  throw new Error('usage: node stage-rider14.mjs --source "<R>" [--id <candidateId>]');
}
const idArg = valueOf("--id");

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const glbSource = path.join(sourceRoot, "out", "rider_s6_LOD0_meshopt.glb");
const guideSource = path.join(sourceRoot, "source", "guide-weights.json");
const upstreamSource = path.join(sourceRoot, "source", "roadcyclist_s6_wheelfix_merged.glb");

let glbSha;
let guideSha;
let upstreamSha;
try {
  glbSha = sha256(glbSource);
  guideSha = sha256(guideSource);
  upstreamSha = sha256(upstreamSource);
} catch (err) {
  throw new Error(`source read failed: ${err.message}`);
}
if (glbSha !== EXPECTED_GLB_SHA256) {
  throw new Error(`GLB hash mismatch: got ${glbSha}`);
}
if (guideSha !== EXPECTED_GUIDE_SHA256) {
  throw new Error(`guide-weights hash mismatch: got ${guideSha}`);
}
if (upstreamSha !== EXPECTED_UPSTREAM_SHA256) {
  throw new Error(`upstream source hash mismatch: got ${upstreamSha}`);
}

const pad2 = (n) => String(n).padStart(2, "0");
const kst = new Date(Date.now() + 9 * 3600 * 1000);
const stamp = `${kst.getUTCFullYear()}${pad2(kst.getUTCMonth() + 1)}${pad2(kst.getUTCDate())}-${pad2(kst.getUTCHours())}${pad2(kst.getUTCMinutes())}${pad2(kst.getUTCSeconds())}`;
const stagedAtKst = `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(kst.getUTCDate())}T${pad2(kst.getUTCHours())}:${pad2(kst.getUTCMinutes())}:${pad2(kst.getUTCSeconds())}+09:00`;

let candidateId = `${stamp}-${GLB_PREFIX}`;
if (idArg !== undefined) {
  if (!new RegExp(`^\\d{8}-\\d{6}-${GLB_PREFIX}$`).test(idArg)) {
    throw new Error(`--id format mismatch: ${idArg}`);
  }
  candidateId = idArg;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");
const targetDir = path.join(webRoot, "public", "rider", "preserved", "candidates", candidateId);
if (fs.existsSync(targetDir)) {
  throw new Error(`target exists, refusing to overwrite: ${targetDir}`);
}

fs.mkdirSync(targetDir, { recursive: true });
const failClean = (err) => {
  fs.rmSync(targetDir, { recursive: true, force: true });
  throw err;
};
const targetGlb = path.join(targetDir, "rider.glb");
const targetGuide = path.join(targetDir, "guide-weights.json");
try {
  fs.copyFileSync(glbSource, targetGlb);
  fs.copyFileSync(guideSource, targetGuide);
} catch (err) {
  failClean(new Error(`copy failed: ${err.message}`));
}

const stagedGlbSha = sha256(targetGlb);
const stagedGuideSha = sha256(targetGuide);
if (stagedGlbSha !== glbSha || stagedGuideSha !== guideSha) {
  failClean(new Error(`staged copy hash mismatch: glb=${stagedGlbSha} guide=${stagedGuideSha}`));
}

const candidate = {
  schemaVersion: 2,
  candidateId,
  nickname: "rider14",
  modelProfile: "rider14",
  stage: "APP_CUSTOM_LAYER_CANDIDATE",
  status: "APP_CANDIDATE_UNDER_REVIEW",
  stagedAtKst,
  sourceGlbPath: `${sourceRoot}\\out\\rider_s6_LOD0_meshopt.glb`,
  sourceGlbSha256: glbSha,
  stagedGlbSha256: stagedGlbSha,
  upstreamSourceSha256: upstreamSha,
  geometryEquivalentTo: "20260921-041426-cd81398e",
  guideRuntimeSha256: stagedGuideSha,
  compression: "EXT_meshopt_compression+KHR_mesh_quantization",
  files: { glb: "rider.glb", guideWeights: "guide-weights.json" },
};
fs.writeFileSync(path.join(targetDir, "candidate.json"), `${JSON.stringify(candidate, null, 2)}\n`);

console.log(`candidateId: ${candidateId}`);
console.log(`sourceGlbSha256: ${glbSha}`);
console.log(`guideRuntimeSha256: ${stagedGuideSha}`);
console.log(`upstreamSourceSha256: ${upstreamSha}`);

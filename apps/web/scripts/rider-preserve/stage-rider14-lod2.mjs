#!/usr/bin/env node
/** Stage rider14 LOD2 into the existing candidate by byte copy. Node builtins only. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_SHA256 = "14c5956eb3a461e87c1e86df095be877e9e2645cbd3216ea55a0e8d3f5c10668";
const CANDIDATE_ID = "20261015-212136-df8de090";
const LOD2_FILE = "rider-lod2.glb";

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
};
const source = valueOf("--source");
if (!source) {
  throw new Error('usage: node stage-rider14-lod2.mjs --source "<rider_s6_LOD2_meshopt.glb>"');
}

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

let sourceSha;
try {
  sourceSha = sha256(source);
} catch (err) {
  throw new Error(`source read failed: ${err.message}`);
}
if (sourceSha !== EXPECTED_SHA256) {
  throw new Error(`LOD2 hash mismatch: got ${sourceSha}`);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");
const targetDir = path.join(webRoot, "public", "rider", "preserved", "candidates", CANDIDATE_ID);
const targetGlb = path.join(targetDir, LOD2_FILE);
const candidateJsonPath = path.join(targetDir, "candidate.json");

if (!fs.existsSync(candidateJsonPath)) {
  throw new Error(`candidate.json missing: ${candidateJsonPath}`);
}
if (fs.existsSync(targetGlb)) {
  throw new Error(`target exists, refusing to overwrite: ${targetGlb}`);
}

const originalJson = fs.readFileSync(candidateJsonPath, "utf8");
if (
  originalJson.includes('"lod2"') ||
  originalJson.includes("lod2SourceSha256") ||
  originalJson.includes("lod2StagedSha256")
) {
  throw new Error("candidate.json already has lod2 fields");
}

const nl = originalJson.includes("\r\n") ? "\r\n" : "\n";
const guideLine = '"guideWeights": "guide-weights.json"';
if (!originalJson.includes(guideLine)) {
  throw new Error("files.guideWeights line missing");
}

function insertLod2(original, sourceHash, stagedHash) {
  const withFile = original.replace(
    guideLine,
    `${guideLine},${nl}    "lod2": "${LOD2_FILE}"`,
  );
  const next = withFile.replace(
    new RegExp(`\\}${nl}\\}\\s*$`),
    `},${nl}  "lod2SourceSha256": "${sourceHash}",${nl}  "lod2StagedSha256": "${stagedHash}"${nl}}${nl}`,
  );
  if (next === withFile) throw new Error("failed to insert lod2 hashes");
  return next;
}

function assertUnchanged(beforeText, afterText, sourceHash, stagedHash) {
  const before = JSON.parse(beforeText);
  const after = JSON.parse(afterText);
  for (const key of Object.keys(before)) {
    if (key === "files") continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      throw new Error(`candidate.json field changed: ${key}`);
    }
  }
  if (before.files?.glb !== after.files?.glb || before.files?.guideWeights !== after.files?.guideWeights) {
    throw new Error("candidate.json files fields changed");
  }
  if (after.files?.lod2 !== LOD2_FILE) throw new Error("files.lod2 missing after insert");
  if (after.lod2SourceSha256 !== sourceHash || after.lod2StagedSha256 !== stagedHash) {
    throw new Error("lod2 hashes missing after insert");
  }
}

let createdGlb = false;
try {
  fs.copyFileSync(source, targetGlb);
  createdGlb = true;
  const stagedSha = sha256(targetGlb);
  if (stagedSha !== sourceSha) {
    throw new Error(`staged copy hash mismatch: ${stagedSha}`);
  }
  const next = insertLod2(originalJson, sourceSha, stagedSha);
  assertUnchanged(originalJson, next, sourceSha, stagedSha);
  fs.writeFileSync(candidateJsonPath, next);
  const written = fs.readFileSync(candidateJsonPath, "utf8");
  assertUnchanged(originalJson, written, sourceSha, stagedSha);
  console.log(`candidateId: ${CANDIDATE_ID}`);
  console.log(`lod2SourceSha256: ${sourceSha}`);
  console.log(`lod2StagedSha256: ${stagedSha}`);
} catch (err) {
  if (createdGlb) fs.rmSync(targetGlb, { force: true });
  if (fs.existsSync(candidateJsonPath) && fs.readFileSync(candidateJsonPath, "utf8") !== originalJson) {
    fs.writeFileSync(candidateJsonPath, originalJson);
  }
  throw err;
}

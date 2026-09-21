#!/usr/bin/env node
/** Stage an approved shape-preserving candidate for app integration testing. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");
const candidateDir = path.resolve(process.argv[2] ?? "");
if (!candidateDir || !fs.existsSync(candidateDir)) {
  throw new Error("usage: node stage-app-candidate.mjs <candidate-dir>");
}

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(candidateDir, name), "utf8"));
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const manifest = readJson("manifest.json");
const staticApproval = readJson("static-approval.json");
const pedalApproval = readJson("pedal-approval.json");
const pedalReportPath = path.join(candidateDir, "pedal-8phase-report.json");
const pedalReport = readJson("pedal-8phase-report.json");

if (!staticApproval.approved || staticApproval.candidateId !== manifest.candidateId) {
  throw new Error("static approval missing or candidate mismatch");
}
if (!pedalApproval.approved || pedalApproval.candidateId !== manifest.candidateId) {
  throw new Error("pedal approval missing or candidate mismatch");
}
if (pedalApproval.reportSha256 !== sha256(pedalReportPath)) {
  throw new Error("approved pedal report changed");
}
if (pedalReport.overall !== "REVIEW" || Object.values(pedalReport.hardVerdict).some((v) => v !== "PASS")) {
  throw new Error("pedal hard checks did not pass");
}
const sourceGlb = manifest.outputs.sourceGlb;
if (sha256(sourceGlb) !== manifest.glbHash) throw new Error("candidate GLB hash mismatch");

const targetDir = path.join(webRoot, "public", "rider", "preserved", "candidates", manifest.candidateId);
fs.mkdirSync(targetDir, { recursive: true });
const targetGlb = path.join(targetDir, "rider.glb");
fs.copyFileSync(sourceGlb, targetGlb);

const guideSource = manifest.inputs.guideData.path;
if (sha256(guideSource) !== manifest.inputs.guideData.sha256) throw new Error("guide data hash mismatch");
const guides = JSON.parse(fs.readFileSync(guideSource, "utf8"));
const runtimeGuides = {
  "Right continuous knee skin": guides["Right continuous knee skin"],
  "Left continuous knee skin": guides["Left continuous knee skin"],
};
const guideTarget = path.join(targetDir, "guide-weights.json");
fs.writeFileSync(guideTarget, JSON.stringify(runtimeGuides));

const staged = {
  schemaVersion: 1,
  candidateId: manifest.candidateId,
  stage: "APP_CUSTOM_LAYER_CANDIDATE",
  status: "PEDAL_APPROVED_APP_UNAPPROVED",
  sourceGlbSha256: manifest.glbHash,
  stagedGlbSha256: sha256(targetGlb),
  pedalReportSha256: sha256(pedalReportPath),
  staticApprovedAt: staticApproval.approvedAt,
  pedalApprovedAt: pedalApproval.approvedAt,
  guideSourceSha256: manifest.inputs.guideData.sha256,
  guideRuntimeSha256: sha256(guideTarget),
  sourceCandidateDir: candidateDir,
  files: { glb: "rider.glb", guideWeights: "guide-weights.json" },
};
if (staged.sourceGlbSha256 !== staged.stagedGlbSha256) throw new Error("staged GLB is not byte-identical");
const stagedPath = path.join(targetDir, "candidate.json");
fs.writeFileSync(stagedPath, JSON.stringify(staged, null, 2));
console.log(JSON.stringify({ targetDir, stagedPath, ...staged }, null, 2));

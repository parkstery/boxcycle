import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../../../..");
const web = path.join(root, "apps/web");
const harness = path.join(web, "scripts/rider-cycle-fit");
const inputsRoot = path.join(harness, ".out/stage2-inputs");
const candidatesRoot = path.join(harness, ".out/candidates");
const blender = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";
const baseline = path.join(candidatesRoot, "20260730-070000-final");
const external = "C:/Users/kdrea/OneDrive/Documents/img/v2_4_cyclefit";
const exporter = path.join(web, "scripts/rider-preview/export-ik-joints-v2.mjs");
const register = path.join(harness, "register-inputs.mjs");
const render = path.join(harness, "render-all.py");
const contact = path.join(harness, "make-contact-sheet.py");
const compare = path.join(harness, "make-before-after.py");
const verify = path.join(harness, "verify-renders.mjs");
const scales = ["0.88", "0.84", "0.82"];

const run = (exe, args, opts = {}) =>
  execFileSync(exe, args, { cwd: root, encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "pipe"], ...opts });
const kst = () => {
  const d = new Date(Date.now() + 9 * 3600e3);
  return d.toISOString().replace(/\D/g, "").slice(0, 8) + "-" +
    d.toISOString().replace(/\D/g, "").slice(8, 14);
};
const sleepSecond = () => {
  const end = Date.now() + 1100;
  while (Date.now() < end) { /* candidateId 초 단위 충돌 방지 */ }
};

fs.mkdirSync(inputsRoot, { recursive: true });
fs.mkdirSync(candidatesRoot, { recursive: true });
const results = [];
for (const scale of scales) {
  const tag = scale.replace(".", "");
  const inputDir = path.join(inputsRoot, `scale-${tag}`);
  fs.mkdirSync(inputDir, { recursive: true });
  const joints = path.join(inputDir, "ik-joints-v2.json");
  fs.writeFileSync(joints, run("node", [exporter, scale, "65", "15", "350"]));

  const regOut = run("node", [register,
    "--rider", "C:/Users/kdrea/OneDrive/Documents/img/output_v2_optimized/lod0/stylized_cyclist_v2_lod0.glb",
    "--cycle", path.join(external, "cycle-only.glb"),
    "--fitik", path.join(external, "fit_ik.py"),
    "--joints", joints,
    "--geometry", path.join(web, "src/lib/riderPrototype/geometry.json"),
    "--exporter", exporter,
    "--blender", "5.2.0",
    "--blenderExe", blender,
  ]);
  const hash = regOut.match(/inputHash=([0-9a-f]{8})/)?.[1];
  if (!hash) throw new Error(`inputHash parse 실패:\n${regOut}`);
  const candidateId = `${kst()}-${hash}`;
  const outDir = path.join(candidatesRoot, candidateId);
  if (fs.existsSync(outDir)) throw new Error(`후보 경로가 이미 존재함: ${outDir}`);
  fs.mkdirSync(outDir);
  fs.copyFileSync(joints, path.join(outDir, "input-ik-joints-v2.json"));
  fs.copyFileSync(path.join(harness, `.out/inputs/manifest-${hash}.json`),
    path.join(outDir, `input-manifest-${hash}.json`));
  fs.writeFileSync(path.join(outDir, "register-inputs.log"), regOut);

  const renderOut = run(blender, ["--background", "--python", render, "--",
    scale, "78", "hip", candidateId, outDir, hash, joints]);
  fs.writeFileSync(path.join(outDir, "render.log"), renderOut);
  fs.writeFileSync(path.join(outDir, "contact-sheet.log"),
    run(blender, ["--background", "--python", contact, "--", outDir]));
  fs.writeFileSync(path.join(outDir, "before-after.log"),
    run(blender, ["--background", "--python", compare, "--", baseline, outDir]));
  const verifyOut = run("node", [verify, outDir]);
  fs.writeFileSync(path.join(outDir, "verify.log"), verifyOut);
  results.push({ scale, inputHash: hash, candidateId, outDir });
  sleepSecond();
}
const summary = path.join(harness, ".out", "stage2-scale-results.json");
fs.writeFileSync(summary, JSON.stringify({
  generatedAtKst: new Date(Date.now() + 9 * 3600e3).toISOString(),
  baseline: {
    candidateId: "20260730-070000-final",
    registeredInputHash: "not recorded in candidate manifest",
    nearestPriorRegisteredInputHash: "98297e0b",
    comparisonLimited: true,
    reason: "기준 후보 manifest에 inputHash가 없고 이후 세 입력 drift가 확인됨. 비교 이미지는 PASS 근거가 아니다.",
  },
  locks: {
    pelvisReference: "HIP_MID, same derivation",
    worldCoordinates: "Blender metres; +x forward, +y lateral, +z up",
    saddleFrameHandlebarCrankIkFineTune: "unchanged",
    commonAssumptionsUnconfirmed: { ANKLE_BACK_mm: 149.4, ANKLE_UP_mm: 81, hipDrop_mm: 65 },
  },
  candidates: results,
}, null, 2));
console.log(summary);

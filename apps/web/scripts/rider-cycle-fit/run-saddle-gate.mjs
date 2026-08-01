import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../../../..");
const web = path.join(root, "apps/web");
const harness = path.join(web, "scripts/rider-cycle-fit");
const blender = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";
const external = "C:/Users/kdrea/OneDrive/Documents/img/v2_4_cyclefit";
const inputsDir = path.join(harness, ".out/saddle-gate-inputs");
const candidates = path.join(harness, ".out/candidates");
const joints = path.join(inputsDir, "ik-joints-v2-scale088.json");
const exporter = path.join(web, "scripts/rider-preview/export-ik-joints-v2.mjs");
const run = (exe, args) => execFileSync(exe, args, {
  cwd: root, encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "pipe"],
});
const runLogged = (exe, args, log) => {
  const r = spawnSync(exe, args, { cwd: root, encoding: "utf8", maxBuffer: 256 << 20 });
  fs.writeFileSync(log, `command=${exe} ${args.join(" ")}\nexit=${r.status}\n\n${r.stdout}${r.stderr}`);
  if (r.status !== 0) throw new Error(`실행 실패 exit=${r.status}: ${exe} ${args.join(" ")}`);
};
const kstId = (hash) => {
  const s = new Date(Date.now() + 9 * 3600e3).toISOString().replace(/\D/g, "").slice(0, 14);
  return `${s.slice(0, 8)}-${s.slice(8)}-${hash}`;
};

fs.mkdirSync(inputsDir, { recursive: true });
fs.mkdirSync(candidates, { recursive: true });
fs.writeFileSync(joints, run("node", [exporter, "0.88", "65", "15", "350"]));
const reg = run("node", [path.join(harness, "register-inputs.mjs"),
  "--rider", "C:/Users/kdrea/OneDrive/Documents/img/output_v2_optimized/lod0/stylized_cyclist_v2_lod0.glb",
  "--cycle", path.join(external, "cycle-only.glb"),
  "--fitik", path.join(external, "fit_ik.py"),
  "--joints", joints,
  "--geometry", path.join(web, "src/lib/riderPrototype/geometry.json"),
  "--exporter", exporter,
  "--blender", "5.2.0", "--blenderExe", blender,
]);
const hash = reg.match(/inputHash=([0-9a-f]{8})/)?.[1];
if (!hash) throw new Error("inputHash parse 실패");

const renderOne = (role) => {
  const id = kstId(hash);
  const dir = path.join(candidates, id);
  if (fs.existsSync(dir)) throw new Error(`candidate 충돌 ${dir}`);
  fs.mkdirSync(dir);
  fs.copyFileSync(joints, path.join(dir, "input-ik-joints-v2.json"));
  fs.copyFileSync(path.join(harness, `.out/inputs/manifest-${hash}.json`),
    path.join(dir, `input-manifest-${hash}.json`));
  fs.writeFileSync(path.join(dir, "register-inputs.log"), reg);
  runLogged(blender, ["--background", "--python", path.join(harness, "render-all.py"), "--",
    "0.88", "78", "hip", id, dir, hash, joints], path.join(dir, "01-render.log"));
  runLogged(blender, ["--background", "--python", path.join(harness, "make-contact-sheet.py"), "--", dir],
    path.join(dir, "02-contact-sheet.log"));
  fs.writeFileSync(path.join(dir, "candidate-role.json"), JSON.stringify({ role, candidateId: id, inputHash: hash }, null, 2));
  return { id, dir };
};

const before = renderOne("same-input-before");
const after = renderOne("saddle-evidence-after");
runLogged(blender, ["--background", "--python", path.join(harness, "render-saddle-evidence.py"), "--",
  "0.88", after.id, after.dir, hash, joints], path.join(after.dir, "03-saddle-evidence.log"));
runLogged(blender, ["--background", "--python", path.join(harness, "make-saddle-contact-sheet.py"), "--", after.dir],
  path.join(after.dir, "04-saddle-contact-sheet.log"));
runLogged(blender, ["--background", "--python", path.join(harness, "make-before-after.py"), "--", before.dir, after.dir],
  path.join(after.dir, "05-before-after.log"));
runLogged("node", [path.join(harness, "verify-renders.mjs"), after.dir, "--before", before.dir, "--require-before"],
  path.join(after.dir, "06-verify-renders-require-before.log"));
runLogged("node", [path.join(harness, "verify-saddle-evidence.mjs"), after.dir],
  path.join(after.dir, "07-verify-saddle-evidence.log"));
runLogged("node", [path.join(harness, "verify-fit.mjs"), "--joints", joints],
  path.join(after.dir, "08-verify-fit.log"));

const summary = {
  inputHash: hash,
  beforeCandidateId: before.id,
  beforeDir: before.dir,
  candidateId: after.id,
  candidateDir: after.dir,
  productGlbModified: false,
  frameCandidatesStarted: false,
};
const summaryPath = path.join(harness, ".out/saddle-gate-result.json");
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(summaryPath);

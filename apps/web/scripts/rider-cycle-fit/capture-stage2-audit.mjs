import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../../../..");
const harness = path.join(root, "apps/web/scripts/rider-cycle-fit");
const oldInput = path.join(harness, ".out/inputs/manifest-98297e0b.json");
const oldCandidate = path.join(harness, ".out/candidates/20260730-070000-final");
const external = "C:/Users/kdrea/OneDrive/Documents/img/v2_4_cyclefit";
const blender = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";
const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().replace(/\D/g, "").slice(0, 14);
const out = path.join(harness, ".out/audits", `${stamp}-pre-stage2`);
fs.mkdirSync(out, { recursive: true });

const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const run = (exe, args, opts = {}) =>
  execFileSync(exe, args, { cwd: root, encoding: "utf8", maxBuffer: 128 << 20, ...opts });
const write = (name, value) => fs.writeFileSync(path.join(out, name), value);

const branch = run("git", ["branch", "--show-current"]).trim();
const head = run("git", ["rev-parse", "HEAD"]).trim();
const status = run("git", ["status", "--short"]);
write("01-git.txt", `branch=${branch}\nHEAD=${head}\n\n${status}`);
write("02-tracked-diff.patch", run("git", ["diff", "--no-ext-diff", "--binary"]));

const untracked = status.split(/\r?\n/).filter((x) => x.startsWith("?? ")).map((x) => x.slice(3));
let untrackedText = "";
for (const rel of untracked) {
  const abs = path.join(root, rel);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    untrackedText += `\n===== ${rel} =====\n${fs.readFileSync(abs, "utf8")}\n`;
  }
}
write("03-untracked-files.txt", untrackedText);

const fit = path.join(external, "fit_ik.py");
const fitBak = path.join(external, "fit_ik.py.20260730-C.bak");
const fitDiff = spawnSync("git", ["diff", "--no-index", "--", fitBak, fit],
  { cwd: root, encoding: "utf8", maxBuffer: 32 << 20 });
write("04-external-fit-ik.txt",
  `backupPath=${fitBak}\nbackupSha256=${sha(fitBak)}\ncurrentPath=${fit}\ncurrentSha256=${sha(fit)}\n\n${fitDiff.stdout}`);

const rider = "C:/Users/kdrea/OneDrive/Documents/img/output_v2_optimized/lod0/stylized_cyclist_v2_lod0.glb";
const cycle = path.join(external, "cycle-only.glb");
write("05-glb-inputs.json", JSON.stringify({
  rider: { absolutePath: rider, bytes: fs.statSync(rider).size, sha256: sha(rider) },
  cycle: { absolutePath: cycle, bytes: fs.statSync(cycle).size, sha256: sha(cycle) },
}, null, 2));

fs.copyFileSync(oldInput, path.join(out, "06-original-manifest-98297e0b.json"));
const old = JSON.parse(fs.readFileSync(oldInput, "utf8"));
const drift = {};
for (const key of ["fitik", "joints", "exporter"]) {
  const f = old.files[key];
  drift[key] = { path: f.path, registeredSha256: f.sha256, currentSha256: sha(f.path) };
}
write("07-drift-inputs.json", JSON.stringify(drift, null, 2));
fs.copyFileSync(path.join(oldCandidate, "render-manifest.json"),
  path.join(out, "08-final-render-manifest.json"));

const verifyFit = spawnSync("node", [path.join(harness, "verify-fit.mjs")],
  { cwd: root, encoding: "utf8" });
const verifyRender = spawnSync("node", [path.join(harness, "verify-renders.mjs"), oldCandidate],
  { cwd: root, encoding: "utf8" });
write("09-verification.log",
  `verify-fit exit=${verifyFit.status}\n${verifyFit.stdout}${verifyFit.stderr}\n` +
  `verify-renders exit=${verifyRender.status}\n${verifyRender.stdout}${verifyRender.stderr}`);

const oldRender = JSON.parse(fs.readFileSync(path.join(oldCandidate, "render-manifest.json"), "utf8"));
write("10-required-29.txt", oldRender.required.map((x, i) => `${String(i + 1).padStart(2, "0")} ${x}.png`).join("\n") + "\n");
write("11-cleat-errors-original.json", JSON.stringify({
  note: "20260730-070000-final 원본 manifest의 위상별 오차. 좌표는 원본에 기록되지 않았음.",
  measures: oldRender.measures,
}, null, 2));

const points = spawnSync(blender, ["--background", "--python", path.join(harness, "measure-points.py"),
  "--", "0.88", path.join(external, "ik-joints-v2.json")], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
write("12-point-measure-replay.log", points.stdout + points.stderr);
const line = points.stdout.split(/\r?\n/).find((x) => x.startsWith("@@POINTS@@"));
if (line) write("12-point-measure-replay.json", JSON.stringify(JSON.parse(line.slice(10)), null, 2));

write("README.txt",
  "Stage 2 사전 감사 증거 묶음\n" +
  "기존 후보와 manifest는 수정하지 않았다.\n" +
  "12-point-measure-replay는 drift 입력 재생이므로 기존 후보 PASS 근거로 사용할 수 없다.\n");
console.log(out);

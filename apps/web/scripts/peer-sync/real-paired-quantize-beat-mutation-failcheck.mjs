/**
 * 구 0.1m 양자로 되돌리면 quantize-beat AFTER 게이트가 FAIL 해야 한다.
 * (제품 0.01m 수정이 실제로 게이트를 지탱하는지 mutation 근거)
 *
 *   cd apps/web && node scripts/peer-sync/real-paired-quantize-beat-mutation-failcheck.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const OPS_DIR = resolve(WEB_ROOT, "../../document/ops/20261005-peer-spacing-jitter");
const EVIDENCE = resolve(OPS_DIR, "evidence/real-paired-20261005");
const QUANT_PATH = resolve(WEB_ROOT, "src/lib/peerMotion/motionWireQuantize.ts");

async function measureProductQuantumPp() {
  const vite = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  try {
    // Reuse harness logic by importing via dynamic — call harness binary instead.
  } finally {
    await vite.close();
  }
}

function runHarness() {
  const r = spawnSync(process.execPath, [resolve(HERE, "real-paired-quantize-beat-harness.mjs")], {
    cwd: WEB_ROOT,
    encoding: "utf8",
    timeout: 120_000,
  });
  return r;
}

async function main() {
  const started = performance.now();
  const fs = await import("node:fs");
  const original = fs.readFileSync(QUANT_PATH, "utf8");
  // Mutate product default quantum back to 0.1m (old wire)
  const mutated = original.replace(
    "export const MOTION_WIRE_DIST_QUANTUM_M = 0.01;",
    "export const MOTION_WIRE_DIST_QUANTUM_M = 0.1;",
  );
  if (mutated === original) {
    console.error("mutation pattern not found");
    process.exit(2);
  }
  let harness;
  try {
    fs.writeFileSync(QUANT_PATH, mutated);
    harness = runHarness();
  } finally {
    fs.writeFileSync(QUANT_PATH, original);
  }

  // With both before(forced 0.1) and after(product now also 0.1), afterPp ≈ 0.1 → FAIL gate
  const passMeansBug = harness.status === 0;
  const mutationOk = harness.status !== 0; // expect FAIL

  const out = {
    generatedAt: new Date().toISOString(),
    mutation: "MOTION_WIRE_DIST_QUANTUM_M 0.01→0.1",
    harnessExit: harness.status,
    stdoutTail: (harness.stdout || "").split("\n").slice(-8).join("\n"),
    stderrTail: (harness.stderr || "").split("\n").slice(-5).join("\n"),
    expectFail: true,
    mutationDetectedRegression: mutationOk,
    wallMs: Math.round(performance.now() - started),
  };
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(resolve(EVIDENCE, "quantize-beat-mutation-failcheck.json"), JSON.stringify(out, null, 2));
  writeFileSync(resolve(OPS_DIR, "quantize-beat-mutation-failcheck.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (passMeansBug) {
    console.error("FAIL: mutated 0.1m still PASSed harness — gate too weak");
    process.exit(1);
  }
  // 변이 중 harness 가 metrics 를 FAIL 로 덮어씀 → 복원 후 제품 게이트로 증거 파일 재기록
  const restore = runHarness();
  if (restore.status !== 0) {
    console.error("FAIL: post-restore harness did not PASS\n", restore.stdout, restore.stderr);
    process.exit(1);
  }
  console.log("PASS mutation failcheck (old 0.1m causes harness FAIL; metrics restored)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

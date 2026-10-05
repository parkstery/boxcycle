/**
 * residual gate 생존 증명 — bridgeFsPacketToServerTimeline 만 무력화하면
 * rtdbStallFs 가 FAIL 이어야 하고, 복원 후 PASS.
 *
 *   cd apps/web && node scripts/peer-sync/residual-peer-jitter-mutation-failcheck.mjs
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const TARGET = resolve(WEB_ROOT, "src/lib/peerMotion/syncFromPresence.ts");
const BACKUP = `${TARGET}.residual-mut.bak`;
const OPS = resolve(WEB_ROOT, "../../document/ops/20261005-peer-spacing-jitter");
const OUT_PRE = resolve(OPS, "residual-peer-jitter-metrics-mut-pre.json");
const OUT_POST = resolve(OPS, "residual-peer-jitter-metrics-mut-post.json");

const MARKER = "export function bridgeFsPacketToServerTimeline(";

const MUTATION_SCENARIOS =
  "rtdbStallFs,stallStopResume,stallAccelResume";

function runHarness(outPath) {
  const r = spawnSync(
    process.execPath,
    [
      resolve(HERE, "residual-peer-jitter-harness.mjs"),
      "--scenario",
      MUTATION_SCENARIOS,
      "--out",
      outPath,
    ],
    { cwd: WEB_ROOT, encoding: "utf8", timeout: 120_000 },
  );
  return r;
}

function mutateBridgeOff(src) {
  const idx = src.indexOf(MARKER);
  if (idx < 0) throw new Error("bridgeFsPacketToServerTimeline not found");
  const nextFn = src.indexOf("\nfunction rememberServerCapture", idx);
  if (nextFn < 0) throw new Error("rememberServerCapture not found after bridge");
  const replacement = `${MARKER}
  packet: PeerMotionPacket,
  _last: Pick<ServerCaptureAnchor, "tSrv" | "distM" | "speedMps">,
): PeerMotionPacket {
  // MUTATION: identity — FS tSrv bridge disabled (gate must FAIL)
  return packet;
}
`;
  return src.slice(0, idx) + replacement + src.slice(nextFn);
}

function main() {
  if (existsSync(BACKUP)) {
    copyFileSync(BACKUP, TARGET);
    unlinkSync(BACKUP);
    console.log("recovered leftover backup");
  }
  const original = readFileSync(TARGET, "utf8");
  const sha = createHash("sha256").update(original).digest("hex").slice(0, 16);
  copyFileSync(TARGET, BACKUP);

  let preFail = false;
  let postPass = false;
  try {
    writeFileSync(TARGET, mutateBridgeOff(original), "utf8");
    const pre = runHarness(OUT_PRE);
    preFail = pre.status !== 0;
    console.log(`PRE(mutated) exit=${pre.status} (want ≠0)`);
    for (const line of (pre.stdout || "").split("\n")) {
      if (/rtdbStallFs|stallStopResume|stallAccelResume/.test(line)) console.log(line);
    }

    copyFileSync(BACKUP, TARGET);
    const post = runHarness(OUT_POST);
    postPass = post.status === 0;
    console.log(`POST(restored) exit=${post.status} (want 0)`);
    for (const line of (post.stdout || "").split("\n")) {
      if (/rtdbStallFs|stallStopResume|stallAccelResume/.test(line)) console.log(line);
    }

    writeFileSync(
      resolve(OPS, "residual-peer-jitter-mutation-compare.json"),
      JSON.stringify(
        {
          targetSha16: sha,
          scenarios: MUTATION_SCENARIOS,
          preExit: pre.status,
          postExit: post.status,
          gateAlive: preFail && postPass,
        },
        null,
        2,
      ),
      "utf8",
    );
  } finally {
    if (existsSync(BACKUP)) {
      copyFileSync(BACKUP, TARGET);
      unlinkSync(BACKUP);
    }
  }

  if (!(preFail && postPass)) {
    console.error("FAIL: residual gate not alive (need PRE fail + POST pass)");
    process.exitCode = 1;
    return;
  }
  console.log("PASS: residual gate alive (PRE fail → POST pass)");
  process.exitCode = 0;
}

main();

/**
 * S4-14 C6·C7 — 캡처를 replay 시나리오로 고정하고, displayDistM 만으로
 * 통과하면 peerAnchor−selfAnchor 층을 검사한다. 수정 전 실패가 목적.
 *
 *   cd apps/web && node scripts/peer-sync/s414-rel-anchor.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELAY = resolve(HERE, "../../../../document/ops/sync-relay");
const REL_REVERSE_PX = 4;

function reversals(values, eps) {
  let n = 0;
  let maxMag = 0;
  let hits = [];
  let prev = 0;
  for (let i = 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    if (!Number.isFinite(d)) continue;
    const mag = Math.abs(d);
    if (mag > maxMag) maxMag = mag;
    if (i > 1 && prev !== 0 && Math.sign(d) !== 0 && Math.sign(d) !== Math.sign(prev) && mag > eps) {
      n += 1;
      if (hits.length < 12) hits.push({ i, mag, d });
    }
    if (mag > eps) prev = d;
  }
  return { n, maxMag, hits };
}

function packetsFromFrames(frames) {
  const events = [];
  let lastKey = "";
  for (const f of frames) {
    const p = f.peers?.[0];
    if (!p || p.newestDistM == null || p.newestServerAtMs == null) continue;
    const key = `${p.newestSeq ?? ""}:${p.newestServerAtMs}:${p.newestDistM}`;
    if (key === lastKey) continue;
    lastKey = key;
    events.push({
      atMs: p.newestRecvAtMs ?? f.dateNowMs,
      packet: {
        uid: p.uid,
        publicationId: "s414-capture",
        distM: p.newestDistM,
        speedMps: p.newestSpeedMps ?? 0,
        phase: p.phase === "paused" || p.phase === "completed" ? p.phase : "live",
        serverAtMs: p.newestServerAtMs,
        seq: p.newestSeq ?? undefined,
      },
    });
  }
  return events;
}

const chainPath = resolve(RELAY, "S414-chain.json");
const dump = JSON.parse(readFileSync(chainPath, "utf8"));
const pair = (dump.runs ?? []).find((r) => String(r.conditionId ?? "").includes("pair"));
if (!pair?.frames?.length) {
  console.error("S414-chain.json 에 pair 런이 없다");
  process.exit(2);
}

const events = packetsFromFrames(pair.frames);
const scenario = {
  name: "s414-pair-chain",
  routeLenM: 2000,
  events,
  expectFail: false,
};
writeFileSync(resolve(RELAY, "S414-scenario.json"), JSON.stringify(scenario, null, 2));

const relX = pair.frames.map((f) => f.peers?.[0]?.relX).filter((v) => typeof v === "number");
const relY = pair.frames.map((f) => f.peers?.[0]?.relY).filter((v) => typeof v === "number");
const rx = reversals(relX, REL_REVERSE_PX);
const ry = reversals(relY, REL_REVERSE_PX);
const relFail = rx.n + ry.n > 0;

const replay = spawnSync(
  process.execPath,
  ["scripts/peer-sync/replay.mjs", "--check", "--scenario", resolve(RELAY, "S414-scenario.json")],
  { cwd: resolve(HERE, "../.."), encoding: "utf8" },
);

const displayOnlyPass = replay.status === 0;
const log = {
  instruction: "S4-14",
  nEvents: events.length,
  nFrames: pair.frames.length,
  displayOnlyReplay: {
    status: replay.status,
    pass: displayOnlyPass,
    stdout: (replay.stdout ?? "").slice(-2000),
    stderr: (replay.stderr ?? "").slice(-1000),
  },
  relAnchor: { x: rx, y: ry, fail: relFail, thresholdPx: REL_REVERSE_PX },
  preFixFail: relFail || !displayOnlyPass,
  layer: displayOnlyPass ? "relAnchor(peer−self DOM translate)" : "displayDistM",
};

writeFileSync(resolve(RELAY, "S414-pre-fix-fail.json"), JSON.stringify(log, null, 2));
console.log(
  `displayOnlyPass=${displayOnlyPass} relFail=${relFail} layer=${log.layer} preFixFail=${log.preFixFail}`,
);
if (!log.preFixFail) {
  console.error("수정 전 실패가 안 나왔다 — 반례가 성립하지 않는다");
  process.exit(1);
}
process.exit(0);

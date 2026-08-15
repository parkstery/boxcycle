/**
 * S2 §1-2 수용 게이트 — S1 z15-cruise 실로그를 integrator 에 먹여
 * §1-0 확정 D_eff/residual 을 ±20% 안으로 재현하는지 판정.
 *
 *   cd apps/web && node scripts/peer-sync/s2-accuracy-gate.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import {
  parsePeerSyncLine,
  computeDeffResidualFromSeries,
} from "./s1-metrics.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const RAW = resolve(HERE, "../../../../document/ops/sync-relay/REPORT-S1-raw-logs.json");
const RECOMPUTE = resolve(HERE, "../../../../document/ops/sync-relay/S2-recompute.json");
const OUT_SCENARIO = resolve(HERE, "../../../../document/ops/sync-relay/s2-z15-cruise-scenario.json");
const OUT_GATE = resolve(HERE, "../../../../document/ops/sync-relay/S2-accuracy-gate.json");

const TOL = 0.2; // ±20%

function within(got, expected, tol = TOL) {
  if (!Number.isFinite(got) || !Number.isFinite(expected)) return false;
  if (expected === 0) return Math.abs(got) <= 1e-6;
  return Math.abs(got - expected) / Math.abs(expected) <= tol;
}

function selfSeries(lines) {
  const rows = [];
  for (const line of lines) {
    const p = parsePeerSyncLine(line);
    if (p) rows.push({ t: p.t, self: p.self });
  }
  return rows;
}

function buildCruiseScenario(raw, recompute) {
  const cruise = raw.reportCases.find((c) => c.id === "z15-cruise");
  if (!cruise) throw new Error("z15-cruise missing");
  const al = cruise.metrics.aligned;
  const t0 = al[0].t;
  const t1 = al[al.length - 1].t;
  const confirmed = recompute.z15.find((z) => z.id === "z15-cruise").confirmed;

  // B 로그에서 cruise 창의 peerDrive 줄 → 패킷( newest = distM )
  const events = [];
  for (const line of raw.logsB) {
    const p = parsePeerSyncLine(line);
    if (!p?.peers?.[0]) continue;
    if (p.t < t0 || p.t > t1) continue;
    const peer = p.peers[0];
    events.push({
      atMs: p.t,
      packet: {
        uid: "peer-A",
        publicationId: "s1-cruise",
        distM: peer.newest,
        speedMps: peer.spd,
        phase: "live",
        serverAtMs: p.t - Math.max(0, peer.age),
      },
    });
  }

  const aSelf = selfSeries(raw.logsA).filter(
    (r) => r.t >= t0 - confirmed.searchMaxMs - 2000 && r.t <= t1,
  );

  const scenario = {
    name: "s1-z15-cruise-real",
    routeLenM: 2000,
    stepIntervalMs: 100,
    events,
    meta: {
      t0,
      t1,
      windowMs: t1 - t0,
      confirmed,
      skewBefore: raw.skewBefore,
      aSelfN: aSelf.length,
    },
  };
  return { scenario, aSelf, confirmed, skew: raw.skewBefore ?? 0 };
}

async function replayToPeerRows(mod, scenario) {
  const { createPeerMotionEntity, applyPeerMotionIngest, stepPeerMotionEntity } = mod.integrator;
  const { events, routeLenM, stepIntervalMs = 100 } = scenario;
  const realNow = Date.now;
  let clockMs = events[0].atMs;
  Date.now = () => clockMs;

  const peerRows = [];
  let entity = null;
  try {
    const endMs = events[events.length - 1].atMs;
    let ei = 0;
    for (let t = clockMs; t <= endMs; t += stepIntervalMs) {
      clockMs = t;
      while (ei < events.length && events[ei].atMs <= t) {
        const { packet } = events[ei];
        if (!entity) entity = createPeerMotionEntity(packet, "A");
        else applyPeerMotionIngest(entity, packet, "A");
        ei += 1;
      }
      if (!entity) continue;
      stepPeerMotionEntity(entity, stepIntervalMs / 1000, routeLenM, t);
      const newest = entity.buffer[entity.buffer.length - 1];
      peerRows.push({
        t,
        newest: newest ? newest.distM : entity.displayDistM,
        disp: entity.displayDistM,
        age: newest ? t - newest.recvAtMs : -1,
        buf: entity.buffer.length,
        spd: entity.speedMps,
      });
    }
  } finally {
    Date.now = realNow;
  }
  return peerRows;
}

const raw = JSON.parse(readFileSync(RAW, "utf8"));
const recompute = JSON.parse(readFileSync(RECOMPUTE, "utf8"));
const { scenario, aSelf, confirmed, skew } = buildCruiseScenario(raw, recompute);
writeFileSync(OUT_SCENARIO, JSON.stringify(scenario, null, 2), "utf8");

const server = await createServer({
  root: WEB_ROOT,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

let gate;
try {
  const mod = {
    integrator: await server.ssrLoadModule("./src/lib/peerMotion/integrator.ts"),
  };
  const peerRows = await replayToPeerRows(mod, scenario);
  const metrics = computeDeffResidualFromSeries(aSelf, peerRows, {
    clockSkewMs: skew,
    maxDelayMs: confirmed.searchMaxMs,
    delayStepMs: 20,
  });

  const checks = {
    D_eff: {
      expected: confirmed.D_eff,
      got: metrics.D_eff,
      ok: within(metrics.D_eff, confirmed.D_eff),
    },
    residualRmse: {
      expected: confirmed.residualRmse,
      got: metrics.residualRmse,
      ok: within(metrics.residualRmse, confirmed.residualRmse),
    },
    residualMax: {
      expected: confirmed.residualMax,
      got: metrics.residualMax,
      ok: within(metrics.residualMax, confirmed.residualMax),
    },
  };
  const pass = Object.values(checks).every((c) => c.ok);
  gate = {
    pass,
    tol: TOL,
    confirmed,
    replay: {
      D_eff: metrics.D_eff,
      residualRmse: metrics.residualRmse,
      residualP95: metrics.residualP95,
      residualMax: metrics.residualMax,
      n: metrics.n,
      events: scenario.events.length,
      peerRows: peerRows.length,
    },
    checks,
  };
} finally {
  await server.close();
}

writeFileSync(OUT_GATE, JSON.stringify(gate, null, 2), "utf8");
console.log(JSON.stringify(gate.checks, null, 2));
console.log(gate.pass ? "✓ 수용 게이트 PASS (±20%)" : "✗ 수용 게이트 FAIL");
process.exit(gate.pass ? 0 : 1);

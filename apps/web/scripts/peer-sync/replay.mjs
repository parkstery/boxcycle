// peer-sync Replay Harness — 패킷 로그를 실제 프로덕션 보간 코드에 통과시켜
// displayDistM 타임라인을 재생/검증한다. 앱·실주행 불필요.
//
// 사용법·설계는 HARNESS.md 참고. 핵심: src/lib/peerMotion/* 순수 함수를 vite ssrLoadModule로
// 그대로 로드하므로, 이 하네스가 통과시키는 것이 프로덕션이 실제로 도는 코드다.
//
//   cd apps/web && node scripts/peer-sync/replay.mjs [--scenario <name|path>] [--check] [--graph] [--out <dir>]
//
// 기본: 내장 시나리오 전체를 --check(정적 불변식 검증, exit 0/1) + --graph(SVG) 로 재생.

import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute, basename } from "node:path";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createServer } from "vite";
import { SCENARIOS } from "./scenarios.mjs";
import { checkInvariants } from "./invariants.mjs";
import { renderTimelineSvg, svgToPng } from "./graph.mjs";
import { checkRecvJitter, measureGapPx } from "./s45-gates.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const OUT_DEFAULT = resolve(HERE, ".out");

function parseArgs(argv) {
  const a = { scenario: null, check: false, graph: false, out: OUT_DEFAULT };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === "--check") a.check = true;
    else if (t === "--graph") a.graph = true;
    else if (t === "--scenario") a.scenario = argv[++i];
    else if (t === "--out") a.out = resolve(process.cwd(), argv[++i]);
  }
  // 아무 모드도 안 주면 둘 다.
  if (!a.check && !a.graph) {
    a.check = true;
    a.graph = true;
  }
  return a;
}

/**
 * 한 시나리오를 재생한다.
 * 입력: 패킷 이벤트 배열 [{ atMs, packet }] — atMs 는 수신 측 시계(Date.now) 기준.
 * 출력: [{ tMs, displayDistM, bufferLen, phase }] 렌더 타임라인.
 *
 * ingest 는 내부에서 Date.now() 를 recvAtMs 로 쓰므로, 재생 결정성을 위해 Date.now 를
 * 이벤트 시각으로 스텁한다(소스 무수정). step 은 nowMs 파라미터로 직접 주입한다.
 */
async function replayScenario(mod, scenario) {
  const { createPeerMotionEntity, applyPeerMotionIngest, stepPeerMotionEntity } = mod.integrator;
  const { routeLenM, events, label = "peer", stepIntervalMs = 100 } = scenario;

  const realNow = Date.now;
  let clockMs = events.length ? events[0].atMs : 0;
  Date.now = () => clockMs;

  const timeline = [];
  let entity = null;
  try {
    const endMs = events.length ? events[events.length - 1].atMs + 4000 : 0;
    let ei = 0;
    for (let t = clockMs; t <= endMs; t += stepIntervalMs) {
      clockMs = t;
      // 이 스텝 시각까지 도착한 패킷을 순서대로 ingest
      while (ei < events.length && events[ei].atMs <= t) {
        const { packet } = events[ei];
        if (!entity) entity = createPeerMotionEntity(packet, label);
        else applyPeerMotionIngest(entity, packet, label);
        ei += 1;
      }
      if (!entity) continue;
      stepPeerMotionEntity(entity, stepIntervalMs / 1000, routeLenM, t);
      timeline.push({
        tMs: t - events[0].atMs,
        displayDistM: entity.displayDistM,
        bufferLen: entity.buffer.length,
        phase: entity.phase,
        speedMps: entity.speedMps,
        clockOffsetMs: entity.clockOffsetMs ?? null,
        serverAxisFallbackCount: entity.serverAxisFallbackCount ?? 0,
      });
    }
  } finally {
    Date.now = realNow;
  }

  // 원본 패킷 궤적(정답 비교용) — recvAtMs 대신 이벤트 시각
  const sent = events.map((e) => ({
    tMs: e.atMs - events[0].atMs,
    distM: e.packet.distM,
    phase: e.packet.phase,
  }));

  return { name: scenario.name, routeLenM, timeline, sent };
}

function loadExternalScenario(pathOrName) {
  const p = isAbsolute(pathOrName) ? pathOrName : resolve(process.cwd(), pathOrName);
  const raw = JSON.parse(readFileSync(p, "utf8"));
  return { name: raw.name ?? basename(p), ...raw };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.out, { recursive: true });

  const server = await createServer({
    root: WEB_ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  let failed = 0;
  try {
    const mod = {
      integrator: await server.ssrLoadModule("./src/lib/peerMotion/integrator.ts"),
      merge: await server.ssrLoadModule("./src/lib/peerMotion/mergePackets.ts"),
      policy: await server.ssrLoadModule("./src/lib/rideSyncPolicy.ts"),
    };

    let scenarios;
    if (args.scenario) {
      const built = SCENARIOS.find((s) => s.name === args.scenario);
      scenarios = built ? [built] : [loadExternalScenario(args.scenario)];
    } else {
      scenarios = SCENARIOS;
    }

    const results = [];
    for (const scenario of scenarios) {
      const result = await replayScenario(mod, scenario);
      results.push(result);

      if (args.check) {
        const violations = checkInvariants(result, mod.policy);
        if (scenario.recvJitter) {
          violations.push(...checkRecvJitter(result, scenario.recvJitter));
        }
        if (scenario.gapPx) {
          const gap = measureGapPx(result, scenario.gapPx);
          result.gapPx = gap;
          const last = result.timeline[result.timeline.length - 1];
          console.log(
            `  gap_px 대리 ${gap.pxPerM} px/m — 반전 ${gap.reverseCount} · 최대|Δ| ${gap.maxAbsDeltaPx.toFixed(3)} · 진폭 ${gap.peakToPeakPx.toFixed(3)}` +
              ` · fallback=${last?.serverAxisFallbackCount ?? 0}`,
          );
          writeFileSync(
            resolve(args.out, `gap-px-${result.name}.json`),
            JSON.stringify(gap, null, 2),
          );
        }
        const expectFail = scenario.expectFail === true;
        if (violations.length && !expectFail) {
          failed += 1;
          console.error(`\n✗ ${result.name} — ${violations.length} 위반`);
          for (const v of violations) console.error(`  · ${v}`);
        } else if (violations.length && expectFail) {
          // known-fail: 여전히 위반 = 예상대로. CI 는 통과시키되 눈에 보이게 남긴다.
          console.log(`~ ${result.name} (known-fail, 여전히 위반 ${violations.length}개)`);
        } else if (!violations.length && expectFail) {
          // 버그가 고쳐졌다 — expectFail 을 지우라고 알린다(방치 방지).
          failed += 1;
          console.error(`\n! ${result.name} — expectFail 인데 통과함. 고쳐졌으면 시나리오의 expectFail 을 제거하라.`);
        } else {
          console.log(`✓ ${result.name}`);
        }
      }
    }

    if (args.graph) {
      const svg = renderTimelineSvg(results);
      const svgPath = resolve(args.out, "peer-timeline.svg");
      const pngPath = resolve(args.out, "peer-timeline.png");
      writeFileSync(svgPath, svg);
      await svgToPng(svg, pngPath);
      console.log(`\n그래프: ${pngPath} (svg: ${svgPath})`);
    }
  } finally {
    await server.close();
  }

  if (args.check && failed > 0) {
    console.error(`\n${failed}개 시나리오 실패`);
    process.exit(1);
  }
  if (args.check) console.log(`\n전 시나리오 불변식 통과`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

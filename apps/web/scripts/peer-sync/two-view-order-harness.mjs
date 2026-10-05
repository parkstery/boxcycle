/**
 * B — 두 창(Two-view) 순서 일치 측정 하네스.
 *
 * 질문: 같은 실제 시각에 라이더 A 의 창과 B 의 창이 「누가 앞인가」를 같게 보여 주는가?
 *
 * 구조
 *  - 독립 Vite SSR 모듈 그래프 **두 개**(createServer ×2). PeerMotionRegistry 싱글턴과
 *    syncFromPresence 의 dualIngestStamp 맵이 창마다 따로 산다(충돌 없음).
 *  - 창 A: self=A 로컬 거리(즉시) · peer=B 를 syncPeerMotionFromPresence + Registry 로 표시.
 *    창 B: self=B 로컬 · peer=A 를 같은 경로로.
 *  - 같은 실제 시계(WALL_BASE_MS + t) 로 두 창을 한 프레임씩 번갈아 구동. 창마다 기기 시계 오프셋이 있고
 *    (전역 Date.now 를 창 전환 때마다 그 창 시계로 바꿔 끼움) 방향별 링크(편도 지연·지터·stall)가 따로 있다.
 *  - 제품 코드는 읽기만 한다(수정 없음).
 *
 * 순서 판정 (uid·경로 거리 기준 — 색/카메라 아님)
 *   창 A 의 「A−B」 = selfA − peerB_display
 *   창 B 의 「A−B」 = peerA_display − selfB      (= −gapB, gapB = selfB − peerA_display)
 *   부호가 서로 다르면 순서 불일치. |값| < 0.05m 이면 동률(0).
 *   ※ 지시서의 gapB(=B−A) 와 부호 비교하려면 gapA 와 −gapB 를 비교해야 같은 뜻이다.
 *
 * 06 주장 정정 (claimCorrection)
 *   「D_A≠D_B 일 때만 역순」은 틀렸다. D_A=D_B=D 여도 진실 간격 |g| < D×v(실측 평균 뒤처짐 L) 이면
 *   두 창이 모두 「내가 앞」을 보인다. 대칭 링크에서 진실 간격 g 를 쓸어(sweep) 증명한다.
 *
 * 비교 정책 (오프라인, 제품 미변경)
 *   --policy current          현행(self 즉시 / peer 과거 보간)만
 *   --policy common-timeline  공통 renderTime = commonNow−D 로 self·peer 모두 그림(+ 현행과 비교)
 *   --policy model-d600       D=600ms + clock-estimate-error 행렬 **모델**(Vite/현행/wire 미사용)
 *   --policy traffic-freq-compare  200ms·D600 vs 1000ms·D2200(/D600) 공통축 모델 비교(제품 미변경)
 *   (기본) all                current + common-timeline
 *   공통 시계는 「정확히 알려진다」고 가정한다 — 송신 좌표의 공통 시각 매핑 오차(±30s 기기 시계 등)는
 *   이 이상화에서 빠져 있으므로 common-timeline 결과는 하한(최선)이다.
 *   model-d600 은 추정 서버시계 오차 ε 를 주입한 **오프라인 모델**이며 제품 tSrv wire 검증이 아니다.
 *
 * 실행
 *   cd apps/web && node scripts/peer-sync/two-view-order-harness.mjs
 *   cd apps/web && node scripts/peer-sync/two-view-order-harness.mjs --policy common-timeline --common-delay 300,500
 *   cd apps/web && node scripts/peer-sync/two-view-order-harness.mjs --policy model-d600
 *   cd apps/web && node scripts/peer-sync/two-view-order-harness.mjs --policy traffic-freq-compare
 *
 * 이 하네스는 측정이다. 크래시·모듈 그래프 독립 실패·비유한 값 같은 명백한 불변식 위반일 때만 exit 1.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "../..");
const OUT_DIR = resolve(HERE, ".out");
const OPS_DIR = resolve(WEB_ROOT, "../../document/ops/20261005-peer-spacing-jitter");

const PUB = "pub-two-view";
const UID_A = "rider-A";
const UID_B = "rider-B";
const ROUTE_LEN_M = 5000;
const WALL_BASE_MS = 1_700_000_000_000;
const STEP_MS = 1000 / 60;
const RUN_MS = 40_000;
const WARMUP_MS = 10_000;
/** 활성 RTDB 송신 간격 — traffic-freq-compare / --interval 이 덮어쓴다. 제품 상수와 별개. */
let ACTIVE_INTERVAL_MS = 200;
const DEFAULT_INTERVAL_MS = 200;
const FS_INTERVAL_MS = 4_000;
const TIE_M = 0.05;
const V20 = 20 / 3.6;
const V25 = 25 / 3.6;
const V30 = 30 / 3.6;
const V10 = 10 / 3.6;
const V15 = 15 / 3.6;
const SPEED_WINDOW_FRAMES = 6;
const MAX_EXTRAP_MS = 1_200; // PEER_INTERP_MAX_EXTRAP_MS 와 같은 값(오프라인 모델용)

/** 시계 추정 오차 ε 조합(ms). 특히 +100/-100·반대 포함. */
const DEFAULT_EPS_MS = [0, -50, 50, -100, 100];

function parseArgs(argv) {
  const a = {
    policy: "all",
    commonDelays: [300, 500],
    jsonOut: resolve(OUT_DIR, "two-view-order-metrics.json"),
    summaryOut: resolve(OPS_DIR, "two-view-order-metrics.json"),
    sweep: true,
    modelDelayMs: 600,
    intervalMs: DEFAULT_INTERVAL_MS,
    epsList: DEFAULT_EPS_MS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--policy") a.policy = String(argv[++i]);
    else if (argv[i] === "--common-delay") {
      a.commonDelays = String(argv[++i])
        .split(",")
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
    } else if (argv[i] === "--out") a.jsonOut = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--summary-out") a.summaryOut = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--no-sweep") a.sweep = false;
    else if (argv[i] === "--model-delay") a.modelDelayMs = Number(argv[++i]) || 600;
    else if (argv[i] === "--interval") a.intervalMs = Number(argv[++i]) || DEFAULT_INTERVAL_MS;
    else if (argv[i] === "--eps") {
      a.epsList = String(argv[++i])
        .split(",")
        .map(Number)
        .filter((n) => Number.isFinite(n));
    }
  }
  return a;
}

/** 보수적 순서 tie 거리(m). 두 기기 오차 합 + 여유 50ms. SDK가 100ms 이내를 보장하지 않음. */
function tieBudgetM(speedMps, epsBudgetAMs, epsBudgetBMs, marginMs = 50) {
  const dtSec = (Math.abs(epsBudgetAMs) + Math.abs(epsBudgetBMs) + marginMs) / 1000;
  return Math.max(0.5, speedMps * dtSec);
}

const round = (n, d = 3) => {
  const m = 10 ** d;
  return Math.round(n * m) / m;
};
const sgn = (x) => (Math.abs(x) < TIE_M ? 0 : x > 0 ? 1 : -1);

// ── 진실 궤적 ────────────────────────────────────────────────────────────────
function makeTraj(startM, segs) {
  const cum = [startM];
  for (let i = 1; i < segs.length; i += 1) {
    cum[i] = cum[i - 1] + (segs[i - 1].mps * (segs[i].fromMs - segs[i - 1].fromMs)) / 1000;
  }
  const idx = (t) => {
    let k = 0;
    for (let i = 0; i < segs.length; i += 1) if (segs[i].fromMs <= t) k = i;
    return k;
  };
  return {
    segs,
    dist(t) {
      const tt = Math.max(0, t);
      const k = idx(tt);
      return cum[k] + (segs[k].mps * (tt - segs[k].fromMs)) / 1000;
    },
    speed(t) {
      return segs[idx(Math.max(0, t))].mps;
    },
  };
}

function constSegs(mps) {
  return [{ fromMs: 0, mps }];
}

// ── 링크(방향별 송신 → 수신 도착 모델) ────────────────────────────────────────
function jitterAt(pattern, k, intervalMs) {
  if (pattern === "none") return 0;
  if (pattern === "sin") {
    const j = Math.min(intervalMs * 0.9, Math.max(60, intervalMs * 0.45));
    return ((Math.sin(k * 7.13) + 1) / 2) * j;
  }
  const j = Math.min(900, Math.max(80, intervalMs * 0.85));
  return k % 2 === 0 ? j : 0;
}

function buildArrivals(link, intervalMs = ACTIVE_INTERVAL_MS) {
  const out = [];
  let k = 0;
  for (let t = intervalMs; t < RUN_MS; t += intervalMs) {
    k += 1;
    const arriveAt = t + link.oneWayMs + jitterAt(link.jitter, k - 1, intervalMs);
    const dropped =
      link.stall != null && arriveAt >= link.stall.fromMs && arriveAt < link.stall.toMs;
    out.push({ captureMs: t, arriveAt, seq: k, dropped });
  }
  out.sort((a, b) => a.arriveAt - b.arriveAt || a.seq - b.seq);
  return out;
}

// ── 시나리오 ────────────────────────────────────────────────────────────────
const SYM_LINK = { oneWayMs: 70, jitter: "sin" };

function scenario(id, title, o) {
  return {
    id,
    title,
    A: { clockOffsetMs: 0, ...o.A },
    B: { clockOffsetMs: 0, ...o.B },
    linkAB: o.linkAB ?? SYM_LINK, // A 가 보낸 것을 B 가 받는 길
    linkBA: o.linkBA ?? SYM_LINK, // B 가 보낸 것을 A 가 받는 길
  };
}

function buildScenarios() {
  const eq = (gapBAheadM) => ({
    A: { traj: makeTraj(0, constSegs(V20)) },
    B: { traj: makeTraj(gapBAheadM, constSegs(V20)) },
  });
  return [
    scenario("1a-equal-gap15", "등속 20km/h · 초기 간격 15m(B 앞) — 간격 > D×v", eq(15)),
    scenario("1b-equal-gap1", "등속 20km/h · 초기 간격 1m(B 앞) — 간격 < D×v, D_A=D_B", eq(1)),
    scenario("2-overtake", "추월: A 25km/h(0–20s) 후 20km/h, B 20km/h, 시작 B 12m 앞", {
      A: {
        traj: makeTraj(0, [
          { fromMs: 0, mps: V25 },
          { fromMs: 20_100, mps: V20 },
        ]),
      },
      B: { traj: makeTraj(12, constSegs(V20)) },
    }),
    scenario("3-speed-changes", "A 20→30(12.1s)→10(24.1s)km/h, B 20km/h 등속, B 10m 앞", {
      A: {
        traj: makeTraj(0, [
          { fromMs: 0, mps: V20 },
          { fromMs: 12_100, mps: V30 },
          { fromMs: 24_100, mps: V10 },
        ]),
      },
      B: {
        traj: makeTraj(10, [
          { fromMs: 0, mps: V20 },
          { fromMs: 18_100, mps: V15 },
        ]),
      },
    }),
    scenario("4-asymmetric", "비대칭 링크: A→B 편도70ms+sin, B→A 편도250ms+bundle · B 6m 앞", {
      ...eq(6),
      linkAB: { oneWayMs: 70, jitter: "sin" },
      linkBA: { oneWayMs: 250, jitter: "bundle" },
    }),
    scenario("5a-clock-A+30s", "A 기기 시계 +30s(송신 t 가 +30s) · B 6m 앞", {
      A: { traj: makeTraj(0, constSegs(V20)), clockOffsetMs: 30_000 },
      B: { traj: makeTraj(6, constSegs(V20)) },
    }),
    scenario("5b-clock-B-30s", "B 기기 시계 −30s · B 6m 앞", {
      A: { traj: makeTraj(0, constSegs(V20)) },
      B: { traj: makeTraj(6, constSegs(V20)), clockOffsetMs: -30_000 },
    }),
    scenario("6-stall-A-to-B", "한쪽 stall: A→B 길 16–22s 두절(RTDB+FS 재배달) · A 10m 앞", {
      A: { traj: makeTraj(10, constSegs(V20)) },
      B: { traj: makeTraj(0, constSegs(V20)) },
      linkAB: { oneWayMs: 70, jitter: "sin", stall: { fromMs: 16_000, toMs: 22_000 } },
    }),
    scenario(
      "7-asym-speed-changes",
      "비대칭 링크(B→A 편도250ms+bundle > D=300) + 속도 변화 · B 3m 앞 — 공통 지연보다 늦은 패킷",
      {
        A: {
          traj: makeTraj(0, [
            { fromMs: 0, mps: V20 },
            { fromMs: 12_100, mps: V30 },
            { fromMs: 24_100, mps: V10 },
          ]),
        },
        B: {
          traj: makeTraj(3, [
            { fromMs: 0, mps: V20 },
            { fromMs: 18_100, mps: V15 },
            { fromMs: 30_100, mps: V25 },
          ]),
        },
        linkAB: { oneWayMs: 70, jitter: "sin" },
        linkBA: { oneWayMs: 250, jitter: "bundle" },
      },
    ),
  ];
}

// ── 시계·콘솔 스텁 (전역 Date.now 를 활성 창의 기기 시계로) ───────────────────────
const clockState = { t: 0, active: null };

function installStubs() {
  const realNow = Date.now;
  const realDebug = console.debug;
  const realInfo = console.info;
  const realLog = console.log;
  Date.now = () => WALL_BASE_MS + clockState.t + (clockState.active?.clockOffsetMs ?? 0);
  console.debug = (...args) => {
    if (String(args[0] ?? "").includes("[peerSyncChain]")) return;
    realDebug(...args);
  };
  console.info = (...args) => {
    const head = String(args[0] ?? "");
    if (head.includes("[peerAlive]") || head.includes("[peerSmooth]")) return;
    realInfo(...args);
  };
  console.log = (...args) => {
    const head = String(args[0] ?? "");
    if (head.includes("[peerSmooth]") || head.includes("[peerAlive]")) return;
    realLog(...args);
  };
  return () => {
    Date.now = realNow;
    console.debug = realDebug;
    console.info = realInfo;
    console.log = realLog;
  };
}

function withView(view, fn) {
  const prev = clockState.active;
  clockState.active = view;
  try {
    return fn();
  } finally {
    clockState.active = prev;
  }
}

async function makeView(name, uid, peerUid) {
  const server = await createServer({
    root: WEB_ROOT,
    // hmr:false — 서버 두 개가 같은 HMR 웹소켓 포트(24678)를 다투지 않게 한다
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
    logLevel: "error",
    cacheDir: resolve(OUT_DIR, `.vite-two-view-${name}`),
  });
  const mods = {
    sync: await server.ssrLoadModule("./src/lib/peerMotion/syncFromPresence.ts"),
    registry: await server.ssrLoadModule("./src/lib/peerMotion/PeerMotionRegistry.ts"),
    integrator: await server.ssrLoadModule("./src/lib/peerMotion/integrator.ts"),
  };
  return { name, uid, peerUid, server, mods, clockOffsetMs: 0 };
}

function resetView(view) {
  view.mods.registry.resetPeerMotionRegistry();
  view.mods.sync.resetPeerMotionRtdbContentObservations?.();
}

// ── 현행 정책 재생(실제 sync→Registry, 두 모듈 그래프) ───────────────────────────
function makeDir(sender, receiver, link, senderSc) {
  return {
    sender,
    receiver,
    traj: senderSc.traj,
    senderClockOffsetMs: senderSc.clockOffsetMs,
    link,
    arrivals: buildArrivals(link),
    arrivalIdx: 0,
    motionRows: [],
    liveRideRows: [],
    lastArrivedCaptureMs: 0,
    fsRow: null,
    nextFsAt: 0,
  };
}

function rtdbRow(dir, a) {
  return {
    uid: dir.sender.uid,
    publicationId: PUB,
    distM: dir.traj.dist(a.captureMs),
    speedMps: dir.traj.speed(a.captureMs),
    ridePhase: "live",
    // 송신자 기기 시계(수신 now 와 무관)
    serverAtMs: WALL_BASE_MS + a.captureMs + dir.senderClockOffsetMs,
    seq: a.seq,
  };
}

function fsRowAt(dir, captureMs, recvLocalT) {
  const distM = dir.traj.dist(captureMs);
  return {
    uid: dir.sender.uid,
    publicationId: PUB,
    progressRatio: distM / ROUTE_LEN_M,
    distMeters: distM,
    // Firestore serverTimestamp ≈ 서버 시계(기기 시계 오프셋 없음)
    lastSeenAtMs: WALL_BASE_MS + captureMs,
    receivedAtLocalMs: WALL_BASE_MS + recvLocalT,
    displayName: dir.sender.uid,
    speedMps: dir.traj.speed(captureMs),
    ridePhase: "live",
  };
}

function refreshFs(dir, t) {
  if (dir.lastArrivedCaptureMs <= 0) return;
  // FS 는 4s steady, 값은 이미 도착한 RTDB capture 이하(미래 좌표 금지). 첫 도착 때는 즉시 dual.
  if (dir.fsRow == null || t >= dir.nextFsAt) {
    dir.fsRow = fsRowAt(dir, dir.lastArrivedCaptureMs, t);
    dir.nextFsAt = t + FS_INTERVAL_MS;
  }
  dir.liveRideRows = [dir.fsRow];
}

function callSync(dir, t) {
  const view = dir.receiver;
  withView(view, () => {
    view.mods.sync.syncPeerMotionFromPresence({
      publicationId: PUB,
      myUid: view.uid,
      motionRows: dir.motionRows,
      liveRideRows: dir.liveRideRows,
      sessionMembers: [{ uid: dir.sender.uid, displayName: dir.sender.uid, memberType: "member" }],
      guestUidsSorted: [],
      routeLenM: ROUTE_LEN_M,
      nowMs: WALL_BASE_MS + t + view.clockOffsetMs,
    });
  });
}

function peerEntity(view) {
  const reg = view.mods.registry.getPeerMotionRegistry();
  return reg.entities?.get?.(view.peerUid) ?? null;
}

/** 현행 정책 한 시나리오. 반환: 프레임 시리즈 */
function runCurrentPolicy(VA, VB, sc, runMs = RUN_MS) {
  VA.clockOffsetMs = sc.A.clockOffsetMs;
  VB.clockOffsetMs = sc.B.clockOffsetMs;
  resetView(VA);
  resetView(VB);
  const dirAB = makeDir(VA, VB, sc.linkAB, sc.A); // B 창이 A 를 받음
  const dirBA = makeDir(VB, VA, sc.linkBA, sc.B); // A 창이 B 를 받음
  const dirs = [dirAB, dirBA];
  const restore = installStubs();
  const series = { t: [], selfA: [], peerBinA: [], selfB: [], peerAinB: [], truthA: [], truthB: [], delayA: [], delayB: [] };
  try {
    for (let t = 0; t <= runMs; t += STEP_MS) {
      clockState.t = t;
      for (const dir of dirs) {
        while (dir.arrivalIdx < dir.arrivals.length && dir.arrivals[dir.arrivalIdx].arriveAt <= t) {
          const a = dir.arrivals[dir.arrivalIdx];
          dir.arrivalIdx += 1;
          if (a.dropped) continue; // stall: RTDB 도착 유실 → 마지막 행 재배달
          dir.motionRows = [rtdbRow(dir, a)];
          dir.lastArrivedCaptureMs = a.captureMs;
          refreshFs(dir, t);
          callSync(dir, t);
        }
        refreshFs(dir, t);
        callSync(dir, t);
        const view = dir.receiver;
        withView(view, () => {
          const reg = view.mods.registry.getPeerMotionRegistry();
          const nowMs = WALL_BASE_MS + t + view.clockOffsetMs;
          reg.step(STEP_MS / 1000, null, nowMs);
          reg.pruneInactive(nowMs);
        });
      }
      const eA = peerEntity(VA); // 창 A 가 보는 B
      const eB = peerEntity(VB); // 창 B 가 보는 A
      if (!eA || !eB) continue;
      series.t.push(t);
      series.selfA.push(sc.A.traj.dist(t));
      series.selfB.push(sc.B.traj.dist(t));
      series.peerBinA.push(eA.displayDistM);
      series.peerAinB.push(eB.displayDistM);
      series.truthA.push(sc.A.traj.dist(t));
      series.truthB.push(sc.B.traj.dist(t));
      series.delayA.push(VA.mods.integrator.peerRenderDelayMs(eA));
      series.delayB.push(VB.mods.integrator.peerRenderDelayMs(eB));
    }
  } finally {
    restore();
    const entsA = VA.mods.registry.getPeerMotionRegistry().getEntityCount();
    const entsB = VB.mods.registry.getPeerMotionRegistry().getEntityCount();
    series.endEntityCount = { A: entsA, B: entsB };
    resetView(VA);
    resetView(VB);
  }
  return series;
}

// ── 오프라인 공통 타임라인 정책 ──────────────────────────────────────────────────
function runCommonTimeline(sc, commonDelayMs, runMs = RUN_MS) {
  const arrAB = buildArrivals(sc.linkAB); // B 가 A 를 받는 길
  const arrBA = buildArrivals(sc.linkBA); // A 가 B 를 받는 길
  const mk = (arr, traj) => ({ arr, idx: 0, traj, samples: [] });
  const rcvB = mk(arrAB, sc.A.traj); // B 가 가진 A 의 샘플
  const rcvA = mk(arrBA, sc.B.traj); // A 가 가진 B 의 샘플
  const advance = (r, t) => {
    while (r.idx < r.arr.length && r.arr[r.idx].arriveAt <= t) {
      const a = r.arr[r.idx];
      r.idx += 1;
      if (a.dropped) continue;
      const s = { cap: a.captureMs, dist: r.traj.dist(a.captureMs), mps: r.traj.speed(a.captureMs) };
      // 캡처 시각 순 삽입 (번들 지터의 순서 뒤바뀜). 현행 Registry 처럼 뒤로 가는 거리는 버린다.
      let i = r.samples.length;
      while (i > 0 && r.samples[i - 1].cap > s.cap) i -= 1;
      r.samples.splice(i, 0, s);
    }
  };
  const peerAt = (r, renderT) => {
    const s = r.samples;
    if (!s.length) return NaN;
    if (renderT <= s[0].cap) return s[0].dist;
    const last = s[s.length - 1];
    if (renderT >= last.cap) {
      return last.dist + (last.mps * Math.min(renderT - last.cap, MAX_EXTRAP_MS)) / 1000;
    }
    for (let i = 1; i < s.length; i += 1) {
      if (s[i].cap >= renderT) {
        const span = s[i].cap - s[i - 1].cap;
        const f = span > 0 ? (renderT - s[i - 1].cap) / span : 0;
        return s[i - 1].dist + (s[i].dist - s[i - 1].dist) * f;
      }
    }
    return last.dist;
  };
  const series = { t: [], selfA: [], peerBinA: [], selfB: [], peerAinB: [], truthA: [], truthB: [], delayA: [], delayB: [] };
  for (let t = 0; t <= runMs; t += STEP_MS) {
    advance(rcvA, t);
    advance(rcvB, t);
    const renderT = t - commonDelayMs; // 두 창이 같은 절대 renderTime
    const pB = peerAt(rcvA, renderT);
    const pA = peerAt(rcvB, renderT);
    if (!Number.isFinite(pA) || !Number.isFinite(pB)) continue;
    series.t.push(t);
    series.selfA.push(sc.A.traj.dist(renderT)); // self 도 같은 과거 시점
    series.selfB.push(sc.B.traj.dist(renderT));
    series.peerBinA.push(pB);
    series.peerAinB.push(pA);
    series.truthA.push(sc.A.traj.dist(t));
    series.truthB.push(sc.B.traj.dist(t));
    series.delayA.push(commonDelayMs);
    series.delayB.push(commonDelayMs);
  }
  return series;
}

/**
 * D + clock-estimate-error 주입 **모델**(제품 tSrv wire 아님).
 *
 * 송신 샘플 stamp = real capture + sender ε
 * 창 renderTime = real now + viewer ε − D
 * self도 동일: intervalMs 캡처 버퍼만 사용(미래 표본 금지). peer는 도착 버퍼만.
 */
function runCommonTimelineClockErrorModel(sc, commonDelayMs, epsA, epsB, runMs = RUN_MS, intervalMs = ACTIVE_INTERVAL_MS) {
  const arrAB = buildArrivals(sc.linkAB, intervalMs); // B←A
  const arrBA = buildArrivals(sc.linkBA, intervalMs); // A←B
  // self 캡처: 송신과 같은 interval, 같은 기기에서는 arriveAt=capture(즉시 가용)
  const selfCaptures = [];
  for (let t = intervalMs; t < runMs; t += intervalMs) selfCaptures.push(t);

  const mkPeer = (arr, traj, senderEps) => ({
    arr,
    idx: 0,
    traj,
    senderEps,
    samples: [], // { stamp, capReal, dist, mps }
  });
  const mkSelf = (traj, selfEps) => ({
    traj,
    selfEps,
    capIdx: 0,
    samples: [],
  });

  const peerInA = mkPeer(arrBA, sc.B.traj, epsB); // 창 A 가 받는 B
  const peerInB = mkPeer(arrAB, sc.A.traj, epsA); // 창 B 가 받는 A
  const selfBufA = mkSelf(sc.A.traj, epsA);
  const selfBufB = mkSelf(sc.B.traj, epsB);

  const advancePeer = (r, t) => {
    while (r.idx < r.arr.length && r.arr[r.idx].arriveAt <= t) {
      const a = r.arr[r.idx];
      r.idx += 1;
      if (a.dropped) continue;
      // 미래 캡처 금지: capture ≤ 현재 wall t 만(도착 모델이 이미 보장하지만 이중 방어)
      if (a.captureMs > t) continue;
      const s = {
        stamp: a.captureMs + r.senderEps,
        capReal: a.captureMs,
        dist: r.traj.dist(a.captureMs),
        mps: r.traj.speed(a.captureMs),
      };
      let i = r.samples.length;
      while (i > 0 && r.samples[i - 1].stamp > s.stamp) i -= 1;
      // 같은 stamp면 나중 도착이 덮어쓰기 대신 거리 비역행만 유지
      if (i > 0 && r.samples[i - 1].stamp === s.stamp) {
        if (s.dist + 1e-9 < r.samples[i - 1].dist) continue;
        r.samples[i - 1] = s;
        continue;
      }
      r.samples.splice(i, 0, s);
    }
  };

  const advanceSelf = (r, t) => {
    while (r.capIdx < selfCaptures.length && selfCaptures[r.capIdx] <= t) {
      const cap = selfCaptures[r.capIdx];
      r.capIdx += 1;
      r.samples.push({
        stamp: cap + r.selfEps,
        capReal: cap,
        dist: r.traj.dist(cap),
        mps: r.traj.speed(cap),
      });
    }
  };

  const atStamp = (samples, renderStamp) => {
    if (!samples.length) return NaN;
    if (renderStamp <= samples[0].stamp) return samples[0].dist;
    const last = samples[samples.length - 1];
    if (renderStamp >= last.stamp) {
      const dt = Math.min(renderStamp - last.stamp, MAX_EXTRAP_MS);
      return last.dist + (last.mps * dt) / 1000;
    }
    for (let i = 1; i < samples.length; i += 1) {
      if (samples[i].stamp >= renderStamp) {
        const span = samples[i].stamp - samples[i - 1].stamp;
        const f = span > 0 ? (renderStamp - samples[i - 1].stamp) / span : 0;
        return samples[i - 1].dist + (samples[i].dist - samples[i - 1].dist) * f;
      }
    }
    return last.dist;
  };

  const series = {
    t: [],
    selfA: [],
    peerBinA: [],
    selfB: [],
    peerAinB: [],
    truthA: [],
    truthB: [],
    truthDelayedA: [],
    truthDelayedB: [],
    delayA: [],
    delayB: [],
    renderStampA: [],
    renderStampB: [],
    peerAgeMsA: [],
    peerAgeMsB: [],
    selfAgeMsA: [],
  };

  for (let t = 0; t <= runMs; t += STEP_MS) {
    advanceSelf(selfBufA, t);
    advanceSelf(selfBufB, t);
    advancePeer(peerInA, t);
    advancePeer(peerInB, t);

    const renderA = t + epsA - commonDelayMs;
    const renderB = t + epsB - commonDelayMs;
    const sA = atStamp(selfBufA.samples, renderA);
    const pB = atStamp(peerInA.samples, renderA);
    const sB = atStamp(selfBufB.samples, renderB);
    const pA = atStamp(peerInB.samples, renderB);
    if (![sA, pB, sB, pA].every(Number.isFinite)) continue;

    const lastPeerA = peerInA.samples[peerInA.samples.length - 1];
    const lastPeerB = peerInB.samples[peerInB.samples.length - 1];
    const lastSelfA = selfBufA.samples[selfBufA.samples.length - 1];

    series.t.push(t);
    series.selfA.push(sA);
    series.peerBinA.push(pB);
    series.selfB.push(sB);
    series.peerAinB.push(pA);
    series.truthA.push(sc.A.traj.dist(t));
    series.truthB.push(sc.B.traj.dist(t));
    // 공통 D 지연 시점의 진실(상대 간격 검산용). ε=0이면 표시와 같아야 함.
    const tDel = Math.max(0, t - commonDelayMs);
    series.truthDelayedA.push(sc.A.traj.dist(tDel));
    series.truthDelayedB.push(sc.B.traj.dist(tDel));
    series.delayA.push(commonDelayMs);
    series.delayB.push(commonDelayMs);
    series.renderStampA.push(renderA);
    series.renderStampB.push(renderB);
    series.peerAgeMsA.push(lastPeerA ? renderA - lastPeerA.stamp : null);
    series.peerAgeMsB.push(lastPeerB ? renderB - lastPeerB.stamp : null);
    series.selfAgeMsA.push(lastSelfA ? renderA - lastSelfA.stamp : null);
  }
  return series;
}

/** 모델 분석: 창 간 mismatch + 진실 대비 거리/순서, tie 제외·포함 */
function analyzeOrderModel(series, warmupMs, tieM) {
  const sgnTie = (x, band) => (Math.abs(x) < band ? 0 : x > 0 ? 1 : -1);
  const idx = [];
  for (let i = 0; i < series.t.length; i += 1) if (series.t[i] >= warmupMs) idx.push(i);

  let oppositeExcl = 0;
  let oppositeIncl = 0;
  let tieDisagree = 0;
  let bothTie = 0;
  let wrongAExcl = 0;
  let wrongBExcl = 0;
  let wrongAIncl = 0;
  let wrongBIncl = 0;
  const diffs = [];
  const errDistA = []; // |표시 A−B − 지연시점 진실 A−B| 창 A
  const errDistB = [];
  const lagSelfA = []; // 진실(now) − 표시 self (지연 거리)
  const lagPeerA = [];
  const dispGapA = [];
  const dispGapB = [];
  const truthGaps = [];
  const truthDelayedGaps = [];
  let peerExtrapFramesA = 0;
  let peerHoldFramesA = 0;
  let selfExtrapFramesA = 0;

  for (const i of idx) {
    const aMinusB_A = series.selfA[i] - series.peerBinA[i];
    const aMinusB_B = series.peerAinB[i] - series.selfB[i];
    const truthGap = series.truthA[i] - series.truthB[i];
    const truthDelayedGap =
      series.truthDelayedA && series.truthDelayedB
        ? series.truthDelayedA[i] - series.truthDelayedB[i]
        : truthGap;

    const sA_excl = sgnTie(aMinusB_A, tieM);
    const sB_excl = sgnTie(aMinusB_B, tieM);
    const sA_incl = sgn(aMinusB_A); // 기존 TIE_M=0.05
    const sB_incl = sgn(aMinusB_B);
    const truthExcl = sgnTie(truthDelayedGap, tieM);
    const truthIncl = sgn(truthDelayedGap);

    if (sA_excl === 0 && sB_excl === 0) bothTie += 1;
    if (sA_excl !== sB_excl) {
      if (sA_excl * sB_excl < 0) oppositeExcl += 1;
      else tieDisagree += 1;
    }
    if (sA_incl * sB_incl < 0) oppositeIncl += 1;

    if (truthExcl !== 0 && sA_excl !== 0 && sA_excl !== truthExcl) wrongAExcl += 1;
    if (truthExcl !== 0 && sB_excl !== 0 && sB_excl !== truthExcl) wrongBExcl += 1;
    if (truthIncl !== 0 && sA_incl !== 0 && sA_incl !== truthIncl) wrongAIncl += 1;
    if (truthIncl !== 0 && sB_incl !== 0 && sB_incl !== truthIncl) wrongBIncl += 1;

    diffs.push(Math.abs(aMinusB_A - aMinusB_B));
    errDistA.push(Math.abs(aMinusB_A - truthDelayedGap));
    errDistB.push(Math.abs(aMinusB_B - truthDelayedGap));
    lagSelfA.push(series.truthA[i] - series.selfA[i]);
    lagPeerA.push(series.truthB[i] - series.peerBinA[i]);
    dispGapA.push(aMinusB_A);
    dispGapB.push(aMinusB_B);
    truthGaps.push(truthGap);
    truthDelayedGaps.push(truthDelayedGap);
    if (series.peerAgeMsA) {
      const age = series.peerAgeMsA[i];
      if (age != null && age > 0) peerExtrapFramesA += 1;
      if (age != null && age > MAX_EXTRAP_MS) peerHoldFramesA += 1;
    }
    if (series.selfAgeMsA) {
      const age = series.selfAgeMsA[i];
      if (age != null && age > 0) selfExtrapFramesA += 1;
    }
  }

  const n = idx.length;
  const share = (c) => (n ? round(c / n) : null);
  const gapPp = (arr) => (arr.length ? round(Math.max(...arr) - Math.min(...arr)) : null);
  return {
    frames: n,
    tieM_m: round(tieM, 3),
    // tie 대역 적용(권고 UI): 대역 안은 동률 → 순서 단정 안 함
    orderMismatchFrames_tieExclude: oppositeExcl + tieDisagree,
    orderMismatchShare_tieExclude: share(oppositeExcl + tieDisagree),
    oppositeSignFrames_tieExclude: oppositeExcl,
    oppositeSignShare_tieExclude: share(oppositeExcl),
    tieDisagreeFrames: tieDisagree,
    bothTieFrames: bothTie,
    bothTieShare: share(bothTie),
    viewAWrongVsTruth_tieExclude: wrongAExcl,
    viewBWrongVsTruth_tieExclude: wrongBExcl,
    // 미세 TIE_M=0.05만(포함=거의 모든 비영을 순서로 셈)
    oppositeSignFrames_tieInclude05: oppositeIncl,
    oppositeSignShare_tieInclude05: share(oppositeIncl),
    viewAWrongVsTruth_tieInclude05: wrongAIncl,
    viewBWrongVsTruth_tieInclude05: wrongBIncl,
    abDiffMeanAbsM: diffs.length ? round(mean(diffs)) : null,
    abDiffMaxAbsM: diffs.length ? round(Math.max(...diffs)) : null,
    truthGapErrInViewA_meanAbsM: errDistA.length ? round(mean(errDistA)) : null,
    truthGapErrInViewB_meanAbsM: errDistB.length ? round(mean(errDistB)) : null,
    truthGapErrInViewA_maxAbsM: errDistA.length ? round(Math.max(...errDistA)) : null,
    meanDispGapA_M: dispGapA.length ? round(mean(dispGapA)) : null,
    meanDispGapB_M: dispGapB.length ? round(mean(dispGapB)) : null,
    dispGapA_pp_M: gapPp(dispGapA),
    meanTruthGap_M: truthGaps.length ? round(mean(truthGaps)) : null,
    meanTruthDelayedGap_M: truthDelayedGaps.length ? round(mean(truthDelayedGaps)) : null,
    // 공통 D: self·peer 모두 늦춤 → 각 rider의 진실 대비 지연 거리 ≈ v·D (상대 간격은 D×v만큼 벌어지지 않음)
    meanSelfLagVsTruthInViewA_M: lagSelfA.length ? round(mean(lagSelfA)) : null,
    meanPeerLagVsTruthInViewA_M: lagPeerA.length ? round(mean(lagPeerA)) : null,
    peerExtrapShare_viewA: share(peerExtrapFramesA),
    peerHoldAfterExtrapShare_viewA: share(peerHoldFramesA),
    selfExtrapShare_viewA: share(selfExtrapFramesA),
  };
}

function modelSelfCheck(epsA, epsB, metrics, speedMps, commonDelayMs) {
  const dEps = epsA - epsB;
  const predictedRelShiftM = round((speedMps * Math.abs(dEps)) / 1000);
  const predictedEachLagM = round((speedMps * commonDelayMs) / 1000);
  const checks = [];
  // 상대 간격 vs 지연시점 진실: 공통 D로 상대가 +vD 벌어지지 않음. ε 차분만큼 허용.
  if (metrics.meanTruthDelayedGap_M != null && metrics.meanDispGapA_M != null) {
    const gapDrift = Math.abs(metrics.meanDispGapA_M - metrics.meanTruthDelayedGap_M);
    const tol = Math.max(0.5, predictedRelShiftM + 0.4);
    checks.push({
      name: "relativeGapNotWidenedByD",
      ok: gapDrift <= tol,
      gapDriftM: round(gapDrift),
      tolM: round(tol),
      meanDispGapA_M: metrics.meanDispGapA_M,
      meanTruthDelayedGap_M: metrics.meanTruthDelayedGap_M,
      note: "공통 D면 self·peer 동시 지연 → 상대 간격 ≈ 지연시점 진실(±ε 차분). D×v는 각 rider의 진실 대비 지연.",
    });
  }
  if (metrics.meanSelfLagVsTruthInViewA_M != null && epsA === 0) {
    const lagErr = Math.abs(metrics.meanSelfLagVsTruthInViewA_M - predictedEachLagM);
    checks.push({
      name: "eachRiderLagApprox_vD",
      ok: lagErr < 0.55,
      measuredM: metrics.meanSelfLagVsTruthInViewA_M,
      predictedM: predictedEachLagM,
    });
  }
  checks.push({
    name: "predictedRelativeShift_v_dEps",
    predictedRelShiftM,
    dEpsMs: dEps,
    note: "창 A에서 peer 실효 시각 편이 ≈ ε_viewer−ε_sender",
  });
  return { predictedRelShiftM, predictedEachLagM, checks, allOk: checks.every((c) => c.ok !== false) };
}

function buildModelScenarios() {
  // 지시: 등속 1m/15m · 추월 · 20→30→10 · 비대칭 · 한쪽 stall
  const all = buildScenarios();
  const ids = new Set([
    "1a-equal-gap15",
    "1b-equal-gap1",
    "2-overtake",
    "3-speed-changes",
    "4-asymmetric",
    "6-stall-A-to-B",
  ]);
  return all.filter((s) => ids.has(s.id));
}

function runModelD600Suite(args, problems, opts = {}) {
  const D = opts.commonDelayMs ?? args.modelDelayMs;
  const intervalMs = opts.intervalMs ?? args.intervalMs ?? DEFAULT_INTERVAL_MS;
  const epsList = opts.epsList ?? args.epsList;
  const scenarios = buildModelScenarios();
  const matrix = [];
  const highlight = [];
  const prevInterval = ACTIVE_INTERVAL_MS;
  ACTIVE_INTERVAL_MS = intervalMs;

  // 전체 조합 + 강조(+100/-100, -100/+100)는 같은 루프에 포함
  try {
  for (const sc of scenarios) {
    const entry = {
      id: sc.id,
      title: sc.title,
      kind: "MODEL_NOT_WIRE",
      commonDelayMs: D,
      intervalMs,
      cells: [],
    };
    for (const epsA of epsList) {
      for (const epsB of epsList) {
        const series = runCommonTimelineClockErrorModel(sc, D, epsA, epsB, RUN_MS, intervalMs);
        if (series.t.length < 100) {
          problems.push(`${sc.id}/eps${epsA}/${epsB}: 프레임 부족(${series.t.length})`);
        }
        for (const k of ["selfA", "peerBinA", "selfB", "peerAinB"]) {
          if (series[k].some((v) => !Number.isFinite(v))) {
            problems.push(`${sc.id}/eps${epsA}/${epsB}: ${k} 비유한`);
          }
        }
        // 보수적 tie: 이 셀의 |ε| 합(예산) — 문서 기본은 budget=100+100
        const tieCell = tieBudgetM(V20, epsA, epsB);
        const tieDoc = tieBudgetM(V20, 100, 100); // 승인 문서 기준(두 기기 각 100ms)
        const mCell = analyzeOrderModel(series, WARMUP_MS, tieCell);
        const mDoc = analyzeOrderModel(series, WARMUP_MS, tieDoc);
        const selfCheck = modelSelfCheck(epsA, epsB, mDoc, V20, D);
        const cell = {
          epsA_ms: epsA,
          epsB_ms: epsB,
          dEps_ms: epsA - epsB,
          tieM_cell_m: mCell.tieM_m,
          tieM_docBudget100p100_m: mDoc.tieM_m,
          metrics_tieCell: mCell,
          metrics_tieDocBudget: mDoc,
          selfCheck,
        };
        entry.cells.push(cell);
        if (
          (epsA === 100 && epsB === -100) ||
          (epsA === -100 && epsB === 100) ||
          (epsA === 0 && epsB === 0) ||
          (Math.abs(epsA) === 100 && epsB === 0) ||
          (epsA === 0 && Math.abs(epsB) === 100)
        ) {
          highlight.push({
            scenario: sc.id,
            epsA_ms: epsA,
            epsB_ms: epsB,
            oppositeShare_tieExclude: mDoc.oppositeSignShare_tieExclude,
            oppositeShare_tieInclude05: mDoc.oppositeSignShare_tieInclude05,
            abDiffMaxM: mDoc.abDiffMaxAbsM,
            truthGapErrA_maxM: mDoc.truthGapErrInViewA_maxAbsM,
            selfCheckOk: selfCheck.allOk,
          });
        }
      }
    }
    matrix.push(entry);
    const z = entry.cells.find((c) => c.epsA_ms === 0 && c.epsB_ms === 0);
    const p = entry.cells.find((c) => c.epsA_ms === 100 && c.epsB_ms === -100);
    const n = entry.cells.find((c) => c.epsA_ms === -100 && c.epsB_ms === 100);
    console.log(
      `■ MODEL interval=${intervalMs}ms D=${D} ${sc.id}\n` +
        `    ε0/0   opposite(excl/incl05)=${z?.metrics_tieDocBudget.oppositeSignShare_tieExclude}/` +
        `${z?.metrics_tieDocBudget.oppositeSignShare_tieInclude05} ` +
        `|A−B|max=${z?.metrics_tieDocBudget.abDiffMaxAbsM}m gapPp=${z?.metrics_tieDocBudget.dispGapA_pp_M}m\n` +
        `    ε+100/-100 opposite(excl/incl05)=${p?.metrics_tieDocBudget.oppositeSignShare_tieExclude}/` +
        `${p?.metrics_tieDocBudget.oppositeSignShare_tieInclude05} ` +
        `truthErrMaxA=${p?.metrics_tieDocBudget.truthGapErrInViewA_maxAbsM}m selfLag=${p?.metrics_tieDocBudget.meanSelfLagVsTruthInViewA_M}m\n` +
        `    ε-100/+100 opposite(excl/incl05)=${n?.metrics_tieDocBudget.oppositeSignShare_tieExclude}/` +
        `${n?.metrics_tieDocBudget.oppositeSignShare_tieInclude05}`,
    );
  }
  } finally {
    ACTIVE_INTERVAL_MS = prevInterval;
  }

  const tieFormula = {
    formula: "tieM = max(0.5m, v · ((|ε_budget_A| + |ε_budget_B| + 50ms) / 1000))",
    note:
      "12 §5.2의 ε_budget=100ms 한 기기 → tie≈0.83m 는 +100/-100 차분 200ms를 빠뜨림. " +
      "두 기기 불확실성 합을 쓴다. SDK offset이 100ms 이내라고 보장하지 않음.",
    at20kmh_budget100each: {
      v_mps: round(V20),
      epsSumMs: 200,
      marginMs: 50,
      tieM_m: round(tieBudgetM(V20, 100, 100), 3),
      wrongSingleDeviceFormula_m: round(Math.max(0.5, V20 * 0.15), 3),
    },
  };

  return {
    task: "20261005-peer-spacing-jitter model D + clock estimate error",
    at: new Date().toISOString(),
    kind: "MODEL_NOT_PRODUCT_TSRV_WIRE",
    commonDelayMs: D,
    intervalMs,
    epsMs: epsList,
    scenariosRun: scenarios.map((s) => s.id),
    tieFormula,
    highlightCells: highlight,
    matrix,
    invariantProblems: problems,
  };
}

/** RTDB encodePayload 형태 UTF-8 직렬화 바이트 — 측정(추정 아님). 프레이밍·압축·fanout 제외. */
function measureEncodePayloadBytes() {
  // rtdbTrailMotion.encodePayload 키 계약 미러(p,d,v,ph,t[,s]). Vite 없이 결정적.
  const base = {
    p: "pub-two-view",
    d: 1234.5,
    v: 5.56,
    ph: "live",
    t: 1_700_000_000_123,
  };
  const withSeq = { ...base, s: 42 };
  const withTsrv = { ...base, tSrv: 1_700_000_000_100 };
  const utf8 = (o) => Buffer.byteLength(JSON.stringify(o), "utf8");
  return {
    kind: "MEASURED_JSON_UTF8_ENCODE_SHAPE",
    note:
      "apps/web/src/lib/peerMotion/repo/rtdbTrailMotion.ts encodePayload 키와 동일 형태. " +
      "RTDB 프로토콜 프레이밍·압축·팬아웃 미포함. tSrv는 아직 제품 필드 아님(후보).",
    existingNoSeq_utf8: utf8(base),
    existingWithDevSeq_utf8: utf8(withSeq),
    existingPlusOptionalTsrv_utf8: utf8(withTsrv),
    tSrvDelta_utf8: utf8(withTsrv) - utf8(base),
    samples: { base, withTsrv },
  };
}

function trafficCounts(intervalMs, runMs = RUN_MS, fsIntervalMs = FS_INTERVAL_MS) {
  const rtdbPerRider = Math.floor((runMs - intervalMs) / intervalMs);
  const fsPerRider = Math.floor(runMs / fsIntervalMs);
  return {
    runMs,
    intervalMs,
    fsIntervalMs,
    rtdbMsgsPerRider: rtdbPerRider,
    rtdbMsgsTwoRiders: rtdbPerRider * 2,
    fsHeartbeatsPerRider: fsPerRider,
    fsHeartbeatsTwoRiders: fsPerRider * 2,
    fsDeltaVsBaseline: 0,
    note: "FS heartbeat 4s 유지 → 후보 간 FS 작업 증분 0. RTDB만 interval에 비례.",
  };
}

function summarizeCandidateCells(report) {
  const focus = [
    { epsA: 0, epsB: 0 },
    { epsA: 100, epsB: -100 },
    { epsA: -100, epsB: 100 },
  ];
  return report.matrix.map((e) => {
    const cells = {};
    for (const f of focus) {
      const c = e.cells.find((x) => x.epsA_ms === f.epsA && x.epsB_ms === f.epsB);
      if (!c) continue;
      const m = c.metrics_tieDocBudget;
      cells[`eA${f.epsA}_eB${f.epsB}`] = {
        oppositeShare_tieExclude: m.oppositeSignShare_tieExclude,
        oppositeShare_tieInclude05: m.oppositeSignShare_tieInclude05,
        abDiffMaxAbsM: m.abDiffMaxAbsM,
        truthGapErrA_maxAbsM: m.truthGapErrInViewA_maxAbsM,
        truthGapErrA_meanAbsM: m.truthGapErrInViewA_meanAbsM,
        dispGapA_pp_M: m.dispGapA_pp_M,
        meanSelfLagVsTruth_M: m.meanSelfLagVsTruthInViewA_M,
        meanPeerLagVsTruth_M: m.meanPeerLagVsTruthInViewA_M,
        peerExtrapShare: m.peerExtrapShare_viewA,
        peerHoldShare: m.peerHoldAfterExtrapShare_viewA,
        selfExtrapShare: m.selfExtrapShare_viewA,
        selfCheckOk: c.selfCheck.allOk,
      };
    }
    return { id: e.id, title: e.title, cells };
  });
}

/**
 * 지시 16: 현재 빈도(200ms·D600) vs 낮은 RTDB 빈도(1s)를 self/peer 공통 시간축 모델로 비교.
 * 1s를 adaptive peer-only 실패만으로 제외하지 않음. 제품 코드 미변경.
 */
function runTrafficFreqCompareSuite(args, problems) {
  const candidates = [
    {
      id: "keep-200-D600",
      label: "현행 RTDB 200ms + 공통 D=600ms (권고 후보)",
      intervalMs: 200,
      commonDelayMs: 600,
      role: "baseline_keep_freq",
    },
    {
      id: "low-1000-D2200",
      label: "RTDB 1s + 공통 D=2200ms (gap×2.2 adaptive 상당)",
      intervalMs: 1000,
      commonDelayMs: 2200,
      role: "low_freq_matched_D",
    },
    {
      id: "low-1000-D600",
      label: "RTDB 1s + 공통 D=600ms (D 고정 유지 시 한계)",
      intervalMs: 1000,
      commonDelayMs: 600,
      role: "low_freq_same_D",
    },
  ];

  const payload = measureEncodePayloadBytes();
  const results = [];
  for (const cand of candidates) {
    console.log(`\n── traffic-freq-compare ${cand.id} ──`);
    const localProblems = [];
    const report = runModelD600Suite(args, localProblems, {
      intervalMs: cand.intervalMs,
      commonDelayMs: cand.commonDelayMs,
    });
    for (const p of localProblems) problems.push(`${cand.id}: ${p}`);
    const traffic = trafficCounts(cand.intervalMs);
    const bytesPerHourPerRider =
      traffic.rtdbMsgsPerRider > 0
        ? round(
            (payload.existingNoSeq_utf8 * (3_600_000 / cand.intervalMs)) / (1024 * 1024),
            3,
          )
        : null;
    const bytesPerHourWithTsrv =
      traffic.rtdbMsgsPerRider > 0
        ? round(
            (payload.existingPlusOptionalTsrv_utf8 * (3_600_000 / cand.intervalMs)) /
              (1024 * 1024),
            3,
          )
        : null;
    results.push({
      ...cand,
      traffic,
      payloadUtf8PerMsg: payload.existingNoSeq_utf8,
      payloadUtf8PerMsg_withTsrv: payload.existingPlusOptionalTsrv_utf8,
      rtdbPayloadMB_perHour_perRider_MEASURED_shape: bytesPerHourPerRider,
      rtdbPayloadMB_perHour_perRider_withTsrv_MEASURED_shape: bytesPerHourWithTsrv,
      scenarios: summarizeCandidateCells(report),
      invariantProblems: localProblems,
    });
  }

  // 비교표용 핵심 행
  const tableRows = [];
  for (const r of results) {
    for (const sc of r.scenarios) {
      for (const [epsKey, m] of Object.entries(sc.cells)) {
        tableRows.push({
          candidate: r.id,
          intervalMs: r.intervalMs,
          D_ms: r.commonDelayMs,
          scenario: sc.id,
          eps: epsKey,
          oppositeShare: m.oppositeShare_tieExclude,
          truthGapErrMaxM: m.truthGapErrA_maxAbsM,
          gapPpM: m.dispGapA_pp_M,
          selfLagM: m.meanSelfLagVsTruth_M,
          peerHoldShare: m.peerHoldShare,
          rtdbMsgs2riders_40s: r.traffic.rtdbMsgsTwoRiders,
          fsDelta: r.traffic.fsDeltaVsBaseline,
        });
      }
    }
  }

  return {
    task: "20261005-peer-spacing-jitter TASK-16 low-traffic bounded verification",
    at: new Date().toISOString(),
    kind: "MODEL_COMPARE_NOT_PRODUCT",
    note:
      "공통 과거 시점 모델만. 미래 패킷 미사용. 현행 adaptive peer-only 1s 한계는 기존 HARNESS/15 기록 인용(본 스위트 재실행 아님).",
    deployedTrafficBaseline: {
      rtdbMotionMs: 200,
      fsHeartbeatMs: 4000,
      source: "document/archive/261001 + rideSyncPolicy.ts; photo-era channel 미계측 유지",
    },
    timestampReuse: {
      existing_t: "기기 Date.now() at encode — capture snapshot time 아님(12§3.1)",
      canReuseAsCommonCapture: false,
      optionalTsrvNeeded: true,
      reason: "공통 renderTime=commonNow−D 에 캡처 시각이 필요. 기존 t 재정의는 구클라/Rules 충돌(B안).",
      tSrvCost: {
        measuredDeltaUtf8: payload.tSrvDelta_utf8,
        sendCountDelta: 0,
        fsRwDelta: 0,
      },
    },
    payloadBytes: payload,
    candidates: results,
    compareTable: tableRows,
    priorAdaptivePeerOnlyNote: {
      interval1000ms:
        "adaptive D≈2200ms; self 즉시면 상대 간격 ≈ v·D 벌어짐(HARNESS A3). 본 비교는 공통축이므로 그 실패만으로 1s 제외하지 않음.",
      interval3000ms: "RTDB stale 2500ms와 충돌 — 본 지시 후보 아님.",
    },
    invariantProblems: problems,
  };
}

// ── 분석 ────────────────────────────────────────────────────────────────────
function mean(a) {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}

function analyzeOrder(series, warmupMs) {
  const idx = [];
  for (let i = 0; i < series.t.length; i += 1) if (series.t[i] >= warmupMs) idx.push(i);
  let opposite = 0;
  let tieDisagree = 0;
  let wrongA = 0;
  let wrongB = 0;
  const diffs = [];
  const lagA = [];
  const lagB = [];
  const gapAs = [];
  const gapBs = [];
  const maxDistDiffTimes = { t: null, v: 0 };
  for (const i of idx) {
    const aMinusB_A = series.selfA[i] - series.peerBinA[i]; // 창 A 의 A−B
    const aMinusB_B = series.peerAinB[i] - series.selfB[i]; // 창 B 의 A−B
    const sA = sgn(aMinusB_A);
    const sB = sgn(aMinusB_B);
    const truthSign = sgn(series.truthA[i] - series.truthB[i]);
    if (sA !== sB) {
      if (sA * sB < 0) opposite += 1;
      else tieDisagree += 1;
    }
    if (truthSign !== 0 && sA !== 0 && sA !== truthSign) wrongA += 1;
    if (truthSign !== 0 && sB !== 0 && sB !== truthSign) wrongB += 1;
    const d = Math.abs(aMinusB_A - aMinusB_B);
    diffs.push(d);
    if (d > maxDistDiffTimes.v) {
      maxDistDiffTimes.v = d;
      maxDistDiffTimes.t = series.t[i];
    }
    lagA.push(series.truthB[i] - series.peerBinA[i]); // 창 A 에서 B 가 진실보다 얼마나 뒤로 보이나
    lagB.push(series.truthA[i] - series.peerAinB[i]);
    gapAs.push(series.selfA[i] - series.peerBinA[i]);
    gapBs.push(series.selfB[i] - series.peerAinB[i]);
  }
  const n = idx.length;
  return {
    frames: n,
    orderMismatchFrames: opposite + tieDisagree,
    orderMismatchShare: n ? round((opposite + tieDisagree) / n) : null,
    oppositeSignFrames: opposite,
    oppositeSignShare: n ? round(opposite / n) : null,
    tieDisagreeFrames: tieDisagree,
    viewAWrongVsTruthFrames: wrongA,
    viewBWrongVsTruthFrames: wrongB,
    // 같은 실제 시각 「A−B」 두 창 값의 차이(m)
    abDiffMeanAbsM: diffs.length ? round(mean(diffs)) : null,
    abDiffMaxAbsM: diffs.length ? round(Math.max(...diffs)) : null,
    abDiffMaxAtMs: maxDistDiffTimes.t == null ? null : Math.round(maxDistDiffTimes.t),
    peerLagInViewA_M: { mean: lagA.length ? round(mean(lagA)) : null, max: lagA.length ? round(Math.max(...lagA)) : null },
    peerLagInViewB_M: { mean: lagB.length ? round(mean(lagB)) : null, max: lagB.length ? round(Math.max(...lagB)) : null },
    meanGapA_M: gapAs.length ? round(mean(gapAs)) : null, // selfA − peerB_display
    meanGapB_M: gapBs.length ? round(mean(gapBs)) : null, // selfB − peerA_display
    meanDelayMs: {
      A: round(mean(idx.map((i) => series.delayA[i])) ?? 0, 1),
      B: round(mean(idx.map((i) => series.delayB[i])) ?? 0, 1),
    },
  };
}

/** 표시 거리 시리즈에서 속도 변화가 반영되기까지 걸린 시간(ms). W/2 는 창 평균 편향 보정. */
function speedReflect(ts, ds, atMs, fromMps, toMps, horizonMs = 8_000) {
  const w = SPEED_WINDOW_FRAMES;
  const biasMs = ((w * STEP_MS) / 2);
  const up = toMps > fromMps;
  const lvl50 = fromMps + 0.5 * (toMps - fromMps);
  const lvl90 = fromMps + 0.9 * (toMps - fromMps);
  let t50 = null;
  let t90 = null;
  for (let i = w; i < ts.length; i += 1) {
    if (ts[i] < atMs) continue;
    if (ts[i] > atMs + horizonMs) break;
    const v = (ds[i] - ds[i - w]) / ((ts[i] - ts[i - w]) / 1000);
    const ok50 = up ? v >= lvl50 : v <= lvl50;
    const ok90 = up ? v >= lvl90 : v <= lvl90;
    if (t50 == null && ok50) t50 = Math.max(0, ts[i] - atMs - biasMs);
    if (t90 == null && ok90) {
      t90 = Math.max(0, ts[i] - atMs - biasMs);
      break;
    }
  }
  return { t50Ms: t50 == null ? null : Math.round(t50), t90Ms: t90 == null ? null : Math.round(t90) };
}

function speedEvents(sc, series) {
  const out = [];
  for (const who of ["A", "B"]) {
    const segs = sc[who].traj.segs;
    for (let i = 1; i < segs.length; i += 1) {
      const atMs = segs[i].fromMs;
      const fromMps = segs[i - 1].mps;
      const toMps = segs[i].mps;
      const selfSeries = who === "A" ? series.selfA : series.selfB;
      const peerSeries = who === "A" ? series.peerAinB : series.peerBinA; // 상대 창에서 이 라이더
      out.push({
        rider: who,
        atMs,
        fromKmh: round(fromMps * 3.6, 1),
        toKmh: round(toMps * 3.6, 1),
        selfSees: speedReflect(series.t, selfSeries, atMs, fromMps, toMps),
        otherWindowSees: speedReflect(series.t, peerSeries, atMs, fromMps, toMps),
      });
    }
  }
  return out;
}

function thin(series, everyMs = 100) {
  const out = [];
  let next = 0;
  for (let i = 0; i < series.t.length; i += 1) {
    if (series.t[i] >= next) {
      out.push([
        Math.round(series.t[i]),
        round(series.selfA[i], 2),
        round(series.peerBinA[i], 2),
        round(series.selfB[i], 2),
        round(series.peerAinB[i], 2),
        round(series.truthA[i], 2),
        round(series.truthB[i], 2),
      ]);
      next += everyMs;
    }
  }
  return out;
}

function checkInvariants(series, label, sc, problems) {
  if (series.t.length < 100) problems.push(`${label}: 프레임 부족(${series.t.length})`);
  for (const k of ["selfA", "peerBinA", "selfB", "peerAinB"]) {
    if (series[k].some((v) => !Number.isFinite(v))) problems.push(`${label}: ${k} 에 비유한 값`);
  }
  if (series.endEntityCount) {
    if (series.endEntityCount.A !== 1 || series.endEntityCount.B !== 1) {
      problems.push(`${label}: 종료 시 entity 수 A=${series.endEntityCount.A} B=${series.endEntityCount.B} (기대 1/1)`);
    }
  }
  void sc;
}

// ── 주장 정정: 대칭 링크에서 진실 간격 g 를 쓸어 D_A=D_B 일 때의 순서 불일치 ─────────────
function runSweep(VA, VB, commonDelays, problems) {
  const gaps = [];
  for (let g = -6; g <= 6.0001; g += 0.5) gaps.push(round(g, 1));
  const rows = [];
  for (const g of gaps) {
    // g = 진실 A−B. B 는 시작 위치 = A시작 − g
    const sc = scenario(`sweep-${g}`, "sweep", {
      A: { traj: makeTraj(20, constSegs(V20)) },
      B: { traj: makeTraj(20 - g, constSegs(V20)) },
      linkAB: { oneWayMs: 70, jitter: "sin" },
      linkBA: { oneWayMs: 70, jitter: "sin" },
    });
    const series = runCurrentPolicy(VA, VB, sc, 24_000);
    checkInvariants(series, `sweep g=${g}`, sc, problems);
    const m = analyzeOrder(series, 8_000);
    const row = {
      truthGapAminusB_M: g,
      meanDelayMs: m.meanDelayMs,
      lagInViewA_M: m.peerLagInViewA_M.mean,
      lagInViewB_M: m.peerLagInViewB_M.mean,
      currentOrderMismatchShare: m.orderMismatchShare,
      currentOppositeSignShare: m.oppositeSignShare,
      common: {},
    };
    for (const dc of commonDelays) {
      const cs = runCommonTimeline(sc, dc, 24_000);
      row.common[`D${dc}`] = analyzeOrder(cs, 8_000).orderMismatchShare;
    }
    rows.push(row);
  }
  const lag = mean(rows.map((r) => (r.lagInViewA_M + r.lagInViewB_M) / 2));
  const dMs = mean(rows.map((r) => (r.meanDelayMs.A + r.meanDelayMs.B) / 2));
  const inside = rows.filter((r) => Math.abs(r.truthGapAminusB_M) < lag - 0.3);
  const outside = rows.filter((r) => Math.abs(r.truthGapAminusB_M) > lag + 0.3);
  return {
    note:
      "대칭 링크(편도70ms·sin 지터·같은 속도)에서 D_A≈D_B 이다. 진실 간격 |g| 가 평균 뒤처짐 L(=창 안 self−peer, " +
      "= v×(편도+적응지연))보다 작으면 두 창이 모두 「내가 앞」(부호 반대)을 보인다 — D_A≠D_B 가 아니어도 생긴다.",
    speedMps: round(V20),
    measuredMeanLagM: round(lag),
    measuredMeanAdaptiveDelayMs: round(dMs, 1),
    predictedMismatchBandM: `|g| < ${round(lag)} m (L)`,
    insideBandMeanMismatchShare: inside.length ? round(mean(inside.map((r) => r.currentOrderMismatchShare))) : null,
    outsideBandMeanMismatchShare: outside.length ? round(mean(outside.map((r) => r.currentOrderMismatchShare))) : null,
    rows,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(args.summaryOut), { recursive: true });
  const problems = [];

  // ── MODEL D=600 + ε 행렬 (Vite/현행/제품 wire 미사용) ────────────────────────
  if (args.policy === "model-d600") {
    ACTIVE_INTERVAL_MS = args.intervalMs || DEFAULT_INTERVAL_MS;
    console.log(`two-view-order — MODEL D=${args.modelDelayMs}ms interval=${ACTIVE_INTERVAL_MS}ms + clock-estimate-error matrix (NOT product tSrv wire)`);
    const report = runModelD600Suite(args, problems);
    const modelOut = resolve(OUT_DIR, "two-view-order-model-d600-metrics.json");
    const modelSummary = resolve(OPS_DIR, "two-view-order-model-d600-metrics.json");
    // 전체 행렬은 .out; ops 요약은 cells 수치만(타임라인 없음)
    writeFileSync(modelOut, JSON.stringify(report, null, 2), "utf8");
    const summary = {
      ...report,
      matrix: report.matrix.map((e) => ({
        id: e.id,
        title: e.title,
        kind: e.kind,
        commonDelayMs: e.commonDelayMs,
        intervalMs: e.intervalMs,
        cells: e.cells.map((c) => ({
          epsA_ms: c.epsA_ms,
          epsB_ms: c.epsB_ms,
          dEps_ms: c.dEps_ms,
          tieM_cell_m: c.tieM_cell_m,
          tieM_docBudget100p100_m: c.tieM_docBudget100p100_m,
          oppositeShare_tieExclude: c.metrics_tieDocBudget.oppositeSignShare_tieExclude,
          oppositeShare_tieInclude05: c.metrics_tieDocBudget.oppositeSignShare_tieInclude05,
          mismatchShare_tieExclude: c.metrics_tieDocBudget.orderMismatchShare_tieExclude,
          abDiffMaxAbsM: c.metrics_tieDocBudget.abDiffMaxAbsM,
          truthGapErrA_maxAbsM: c.metrics_tieDocBudget.truthGapErrInViewA_maxAbsM,
          meanDispGapA_M: c.metrics_tieDocBudget.meanDispGapA_M,
          dispGapA_pp_M: c.metrics_tieDocBudget.dispGapA_pp_M,
          meanTruthGap_M: c.metrics_tieDocBudget.meanTruthGap_M,
          meanSelfLagVsTruth_M: c.metrics_tieDocBudget.meanSelfLagVsTruthInViewA_M,
          meanPeerLagVsTruth_M: c.metrics_tieDocBudget.meanPeerLagVsTruthInViewA_M,
          peerHoldShare: c.metrics_tieDocBudget.peerHoldAfterExtrapShare_viewA,
          selfCheckOk: c.selfCheck.allOk,
          selfCheck: c.selfCheck,
        })),
      })),
      summaryOf: "apps/web/scripts/peer-sync/.out/two-view-order-model-d600-metrics.json",
    };
    writeFileSync(modelSummary, JSON.stringify(summary, null, 2), "utf8");
    // 호환: --out/--summary-out 도 덮어씀
    if (args.jsonOut !== resolve(OUT_DIR, "two-view-order-metrics.json")) {
      writeFileSync(args.jsonOut, JSON.stringify(report, null, 2), "utf8");
    }
    writeFileSync(args.summaryOut.replace(/two-view-order-metrics\.json$/, "two-view-order-model-d600-metrics.json"), JSON.stringify(summary, null, 2), "utf8");
    console.log(`\nwrote ${modelOut}\nwrote ${modelSummary}`);
    console.log(
      problems.length
        ? `INVARIANT PROBLEMS (${problems.length}):\n  - ${problems.join("\n  - ")}`
        : "invariants OK (유한 값 · 프레임 수)",
    );
    process.exitCode = problems.length ? 1 : 0;
    return;
  }

  // ── 200ms vs 1s 공통축 모델 비교 (지시 16, 제품 미변경) ─────────────────────
  if (args.policy === "traffic-freq-compare") {
    const t0 = Date.now();
    console.log("two-view-order — traffic-freq-compare (MODEL only, no product/Vite ride)");
    const report = runTrafficFreqCompareSuite(args, problems);
    report.wallClockMs = Date.now() - t0;
    const outFull = resolve(OUT_DIR, "two-view-order-traffic-freq-compare.json");
    const outOps = resolve(OPS_DIR, "two-view-order-traffic-freq-compare.json");
    writeFileSync(outFull, JSON.stringify(report, null, 2), "utf8");
    // ops: 전체 셀 타임라인 없음 — 이미 요약
    writeFileSync(outOps, JSON.stringify(report, null, 2), "utf8");
    if (args.jsonOut !== resolve(OUT_DIR, "two-view-order-metrics.json")) {
      writeFileSync(args.jsonOut, JSON.stringify(report, null, 2), "utf8");
    }
    console.log(`\nwrote ${outFull}\nwrote ${outOps} (wallClock=${report.wallClockMs}ms)`);
    console.log(
      problems.length
        ? `INVARIANT PROBLEMS (${problems.length}):\n  - ${problems.join("\n  - ")}`
        : "invariants OK (유한 값 · 프레임 수)",
    );
    process.exitCode = problems.length ? 1 : 0;
    return;
  }

  ACTIVE_INTERVAL_MS = args.intervalMs || DEFAULT_INTERVAL_MS;
  const runCommon = args.policy === "all" || args.policy === "common-timeline";

  console.log("two-view-order — 독립 Vite 모듈 그래프 2개 (창 A / 창 B)");
  const VA = await makeView("A", UID_A, UID_B);
  const VB = await makeView("B", UID_B, UID_A);
  try {
    // 모듈 그래프 독립 확인
    if (VA.mods.registry === VB.mods.registry) problems.push("두 창이 같은 Registry 모듈 인스턴스를 공유함");
    const regA = VA.mods.registry.getPeerMotionRegistry();
    const regB = VB.mods.registry.getPeerMotionRegistry();
    if (regA === regB) problems.push("두 창이 같은 Registry 싱글턴을 공유함");
    if (VA.mods.sync === VB.mods.sync) problems.push("두 창이 같은 syncFromPresence 모듈 인스턴스를 공유함");
    console.log(
      `module graphs independent: registry=${VA.mods.registry !== VB.mods.registry} ` +
        `sync(dualStamp maps)=${VA.mods.sync !== VB.mods.sync} singleton=${regA !== regB}`,
    );
    resetView(VA);
    resetView(VB);

    const scenarios = buildScenarios();
    const results = [];
    for (const sc of scenarios) {
      const entry = { id: sc.id, title: sc.title, clock: { A: sc.A.clockOffsetMs, B: sc.B.clockOffsetMs }, link: { AtoB: sc.linkAB, BtoA: sc.linkBA } };
      // 현행 정책은 항상 돈다 — common-timeline 비교의 기준선이기도 하다.
      const curSeries = runCurrentPolicy(VA, VB, sc);
      checkInvariants(curSeries, `${sc.id}/current`, sc, problems);
      entry.current = {
        afterWarmup: analyzeOrder(curSeries, WARMUP_MS),
        all: analyzeOrder(curSeries, 0),
        speedChanges: speedEvents(sc, curSeries),
        timeline: thin(curSeries),
      };
      if (runCommon) {
        entry.commonTimeline = {};
        for (const dc of args.commonDelays) {
          const cs = runCommonTimeline(sc, dc);
          checkInvariants(cs, `${sc.id}/common-${dc}`, sc, problems);
          entry.commonTimeline[`D${dc}`] = {
            afterWarmup: analyzeOrder(cs, WARMUP_MS),
            speedChanges: speedEvents(sc, cs),
            timeline: thin(cs),
          };
        }
      }
      results.push(entry);
      const m = entry.current.afterWarmup;
      console.log(
        `■ ${sc.id}  ${sc.title}\n` +
          `    current : mismatch=${m.orderMismatchFrames}/${m.frames} (${m.orderMismatchShare}) opposite=${m.oppositeSignFrames} ` +
          `wrongA=${m.viewAWrongVsTruthFrames} wrongB=${m.viewBWrongVsTruthFrames} ` +
          `|A−B diff| mean=${m.abDiffMeanAbsM}m max=${m.abDiffMaxAbsM}m  D(A/B)=${m.meanDelayMs.A}/${m.meanDelayMs.B}ms ` +
          `lag(A/B)=${m.peerLagInViewA_M.mean}/${m.peerLagInViewB_M.mean}m`,
      );
      for (const ev of entry.current.speedChanges) {
        console.log(
          `    speed ${ev.rider} @${ev.atMs}ms ${ev.fromKmh}→${ev.toKmh}km/h : ` +
            `self t50=${ev.selfSees.t50Ms}ms t90=${ev.selfSees.t90Ms}ms | other window t50=${ev.otherWindowSees.t50Ms}ms t90=${ev.otherWindowSees.t90Ms}ms`,
        );
      }
      if (runCommon) {
        for (const [k, v] of Object.entries(entry.commonTimeline)) {
          const c = v.afterWarmup;
          console.log(
            `    common ${k}: mismatch=${c.orderMismatchFrames}/${c.frames} (${c.orderMismatchShare}) ` +
              `|A−B diff| mean=${c.abDiffMeanAbsM}m max=${c.abDiffMaxAbsM}m`,
          );
        }
      }
    }

    let claimCorrection = null;
    if (args.sweep) {
      claimCorrection = runSweep(VA, VB, runCommon ? args.commonDelays : [], problems);
      console.log(
        `\n06 주장 정정 — 대칭 링크(D_A≈D_B≈${claimCorrection.measuredMeanAdaptiveDelayMs}ms)에서 진실 간격 sweep:\n` +
          `    평균 뒤처짐 L=${claimCorrection.measuredMeanLagM}m → 예측 불일치 대역 ${claimCorrection.predictedMismatchBandM}\n` +
          `    대역 안 평균 불일치 비율=${claimCorrection.insideBandMeanMismatchShare}  대역 밖=${claimCorrection.outsideBandMeanMismatchShare}`,
      );
      console.log("    g(A−B)m : current mismatch share" + (runCommon ? " | common " + args.commonDelays.map((d) => `D${d}`).join("/") : ""));
      for (const r of claimCorrection.rows) {
        console.log(
          `    ${String(r.truthGapAminusB_M).padStart(5)} : ${r.currentOrderMismatchShare}` +
            (runCommon ? " | " + Object.values(r.common).join("/") : ""),
        );
      }
    }

    // 정책 비교 요약
    const policyCompare = results.map((e) => ({
      id: e.id,
      currentMismatchShare: e.current.afterWarmup.orderMismatchShare,
      currentOppositeShare: e.current.afterWarmup.oppositeSignShare,
      currentAbDiffMaxM: e.current.afterWarmup.abDiffMaxAbsM,
      ...(runCommon
        ? Object.fromEntries(
            Object.entries(e.commonTimeline).flatMap(([k, v]) => [
              [`common${k}MismatchShare`, v.afterWarmup.orderMismatchShare],
              [`common${k}AbDiffMaxM`, v.afterWarmup.abDiffMaxAbsM],
            ]),
          )
        : {}),
    }));

    const report = {
      task: "20261005-peer-spacing-jitter B two-view order",
      at: new Date().toISOString(),
      policy: args.policy,
      measurement: true,
      note:
        "측정 하네스(제품 미변경). 현행=self 즉시·peer 과거 보간(실제 sync→Registry, 독립 모듈 그래프 2개). " +
        "common-timeline=오프라인 이상화(공통 시계 정확·self/peer 모두 renderTime=commonNow−D). " +
        "FS 는 dual-from-first-packet fixture(첫 RTDB 도착부터 dual). RTDB-only→dual 축은 peer-spacing --suite transitions 가 담당.",
      definitions: {
        viewA_AminusB: "selfA − peerB_display (창 A)",
        viewB_AminusB: "peerA_display − selfB (창 B) = −gapB",
        gapB: "selfB − peerA_display (지시서 정의; 순서 비교는 gapA 와 −gapB)",
        mismatch: `부호(동률 |x|<${TIE_M}m=0)가 서로 다른 프레임`,
        oppositeSign: "서로 반대 부호(양쪽 모두 「내가 앞」)",
        warmupMs: WARMUP_MS,
        runMs: RUN_MS,
        intervalMs: ACTIVE_INTERVAL_MS,
        speedReflect: `표시 거리의 ${SPEED_WINDOW_FRAMES}프레임 창 속도가 전환 폭의 50%/90% 에 이르기까지(창 편향 W/2 보정). self 는 로컬 즉시이므로 ≈0.`,
      },
      commonDelaysMs: args.commonDelays,
      scenarios: results,
      claimCorrection,
      policyCompare,
      invariantProblems: problems,
    };
    writeFileSync(args.jsonOut, JSON.stringify(report, null, 2), "utf8");

    // ops 요약: 타임라인 제외
    const summary = JSON.parse(JSON.stringify(report));
    for (const e of summary.scenarios) {
      delete e.current.timeline;
      if (e.commonTimeline) for (const v of Object.values(e.commonTimeline)) delete v.timeline;
    }
    summary.summaryOf = "apps/web/scripts/peer-sync/.out/two-view-order-metrics.json (timeline 10Hz 포함 전체본, gitignore)";
    writeFileSync(args.summaryOut, JSON.stringify(summary, null, 2), "utf8");
    console.log(`\nwrote ${args.jsonOut}\nwrote ${args.summaryOut} (summary only)`);
    console.log(
      problems.length
        ? `INVARIANT PROBLEMS (${problems.length}):\n  - ${problems.join("\n  - ")}`
        : "invariants OK (모듈 그래프 독립 · 유한 값 · entity 1/1)",
    );
    process.exitCode = problems.length ? 1 : 0;
  } finally {
    await VA.server.close();
    await VB.server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * 동행이 **화면에서 얼마나 매끄럽게 움직이는가** — 실제 주행에서 잰다.
 *
 * 왜 (2026-09-28) — 모의 계측(`npm run probe:peer-interp`)은 고친 뒤 크게 좋아졌다고
 * 말하는데 chief 는 「전과 별 차이 없다」고 했다. 둘 중 하나가 틀렸고, 그것은 **재 봐야**
 * 안다. 모의와 **같은 값**(프레임 간 화면 속도)을 실주행에서 재서 맞대어 본다.
 *
 * 쓰는 법 — **아무것도 안 해도 5초마다 콘솔에 스스로 찍는다.** 콘솔 필터에 `peerSmooth`
 * 를 넣고 읽으면 된다(필터 칸은 걸러내는 곳이지 명령을 치는 곳이 아니다 — 2026-09-28).
 *
 *     [peerSmooth] xOTFTZ  avg=1.39 min=1.21 max=1.58 back=0.0%  gap=131ms delay=288ms
 *
 * 구간을 다시 잡고 싶으면 콘솔 **맨 아래 `>` 줄**에서:
 *
 *     window.__rtwPeerSmooth.reset()
 *
 * 읽는 법 — 송신자가 등속이면 화면 속도도 등속이어야 한다.
 *   `minMps` 가 **음수** → 동행이 뒤로 간다(보간이 깨진 것)
 *   `maxMps` 가 평균의 2배↑ → 튄다
 *   `backPct` 가 0 이 아니면 그만큼의 프레임에서 뒤로 갔다
 *   `arrivalGapMs` → 좌표가 실제로 도착하는 간격. `delayMs` 는 그에 맞춘 재생 지연
 */
import type { PeerMotionEntity } from "../peerMotion/types";
import { peerRenderDelayMs } from "../peerMotion/integrator";

type Acc = {
  frames: number;
  lastDistM: number;
  lastAtMs: number;
  minMps: number;
  maxMps: number;
  backFrames: number;
  sumMps: number;
  arrivalGapMs: number;
  delayMs: number;
};

const byUid = new Map<string, Acc>();
let windowStartMs = 0;
let lastReportMs = 0;

/** 스스로 찍는 주기 — 주행 중 눈으로 좇을 수 있을 만큼 드물게. */
const REPORT_INTERVAL_MS = 5_000;

/** 한 프레임이 너무 길면(탭 전환·긴 멈춤) 속도가 의미 없다 — 그 프레임은 버린다. */
const MAX_FRAME_MS = 200;

function reset(nowMs = Date.now()): void {
  byUid.clear();
  windowStartMs = nowMs;
  lastReportMs = nowMs;
}

/**
 * 5초마다 한 줄씩 스스로 찍는다.
 *
 * ⚠️ 판정은 **`back`** 부터 본다. 0%가 아니면 동행이 뒤로 갔다는 뜻이고, 그게 곧 튐이다.
 * `back=0` 인데도 눈에 튀어 보인다면 **동행의 위치가 아니라 카메라**를 의심해야 한다 —
 * 내 라이더는 화면 중앙에 붙박이고 지도가 움직이므로, 카메라가 흔들리면 동행만 흔들려 보인다.
 */
function report(nowMs: number): void {
  if (nowMs - lastReportMs < REPORT_INTERVAL_MS) return;
  lastReportMs = nowMs;
  for (const r of read()) {
    if ((r.frames as number) < 10) continue;
    console.info(
      `[peerSmooth] ${r.uid}  avg=${r.avgMps} min=${r.minMps} max=${r.maxMps}` +
        `  back=${r.backPct}%  gap=${r.arrivalGapMs}ms delay=${r.delayMs}ms  (${r.frames}프레임)`,
    );
  }
}

function read(): Array<Record<string, number | string>> {
  const windowMs = Date.now() - windowStartMs;
  return [...byUid.entries()].map(([uid, a]) => ({
    uid,
    frames: a.frames,
    minMps: Math.round(a.minMps * 100) / 100,
    maxMps: Math.round(a.maxMps * 100) / 100,
    avgMps: a.frames > 0 ? Math.round((a.sumMps / a.frames) * 100) / 100 : 0,
    backPct: a.frames > 0 ? Math.round((a.backFrames / a.frames) * 1000) / 10 : 0,
    arrivalGapMs: Math.round(a.arrivalGapMs),
    delayMs: Math.round(a.delayMs),
    windowSec: Math.round(windowMs / 100) / 10,
  }));
}

let installed = false;

function install(): void {
  if (installed || !import.meta.env.DEV || typeof window === "undefined") return;
  installed = true;
  windowStartMs = Date.now();
  (window as Window & { __rtwPeerSmooth?: { reset: typeof reset; read: typeof read } })
    .__rtwPeerSmooth = { reset, read };
}

/** 매 프레임 호출 — 동행의 **화면 위 속도**를 누적한다. DEV 밖에서는 아무것도 하지 않는다. */
export function notePeerSmoothness(
  entities: Iterable<PeerMotionEntity>,
  nowMs: number = Date.now(),
): void {
  if (!import.meta.env.DEV) return;
  install();

  for (const e of entities) {
    const prev = byUid.get(e.uid);
    if (!prev) {
      byUid.set(e.uid, {
        frames: 0,
        lastDistM: e.displayDistM,
        lastAtMs: nowMs,
        minMps: Number.POSITIVE_INFINITY,
        maxMps: Number.NEGATIVE_INFINITY,
        backFrames: 0,
        sumMps: 0,
        arrivalGapMs: e.arrivalGapMsEma,
        delayMs: peerRenderDelayMs(e),
      });
      continue;
    }
    const dtMs = nowMs - prev.lastAtMs;
    prev.arrivalGapMs = e.arrivalGapMsEma;
    prev.delayMs = peerRenderDelayMs(e);
    if (dtMs <= 0 || dtMs > MAX_FRAME_MS) {
      prev.lastDistM = e.displayDistM;
      prev.lastAtMs = nowMs;
      continue;
    }
    const mps = (e.displayDistM - prev.lastDistM) / (dtMs / 1000);
    prev.frames += 1;
    prev.sumMps += mps;
    if (mps < prev.minMps) prev.minMps = mps;
    if (mps > prev.maxMps) prev.maxMps = mps;
    if (mps < 0) prev.backFrames += 1;
    prev.lastDistM = e.displayDistM;
    prev.lastAtMs = nowMs;
  }

  if (byUid.size > 0) report(nowMs);
}

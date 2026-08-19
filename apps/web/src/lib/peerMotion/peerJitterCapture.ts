/**
 * S4-4 / S4-4R / S4-4R2 — 상대 라이더 튐 DEV 링 버퍼.
 * 제품 ingest 경로는 바꾸지 않는다. begin() 전에는 no-op.
 *
 * S4-4R: 앞뒤는 화면 X/Y 고정이 아니라, displayDistM 전진 구간에서
 * 화면 좌표를 회귀해 구한 진행축 û 에 Δscreen 을 투영한 부호로 판정한다.
 *
 * S4-4R2: 같은 û 에 ① peer 절대 · ② local 절대 · ③ (peer−local) 을
 * 나란히 투영한다. ② 가 없으면 카메라를 증명할 수 없다.
 * 판정은 px 원시값·부호·횟수·진폭만 쓴다. px/m 은 근거가 아니다.
 */

import type { PeerMotionPacket } from "./types";

/** 라벨 밴드일 뿐 합격 기준이 아니다. S4-4R2 판정 근거로 쓰지 마라. */
export const BAND_LABEL_PX = 8;
/** S44 급 = 수십 px (재현 46.7). C1 3.1 은 해당 없음. 제품 합격선이 아니다. */
export const S44_CLASS_PX = 20;
/** ① − ② − ③ = 0 대수 항등. 이보다 크면 계측 모순이라 판정을 쓰지 않는다. */
export const K1_RESIDUAL_EPS_PX = 1e-3;
const MAX_EVENTS = 16_000;
const UHAT_HALF_WINDOW = 12;
const UHAT_MIN_DIST_SPAN_M = 2;
const UHAT_MIN_PX_PER_M = 0.4;

export type JitterSourceSample = {
  recvAtMs: number;
  serverAtMs: number;
  distM: number;
  speedMps: number;
  phase: string;
  seq?: number;
};

export type JitterMergeNote = {
  invoked: boolean;
  choice: "rtdb-only" | "fs-fallback" | "none";
  reason: string;
  wouldDistM: number | null;
  wouldSpeedMps: number | null;
  wouldPhase: string | null;
  wouldServerAtMs: number | null;
};

export type JitterIngestEvent = {
  kind: "ingest";
  atMs: number;
  uid: string;
  conditionId: string | null;
  rtdb: JitterSourceSample | null;
  fs: JitterSourceSample | null;
  merge: JitterMergeNote;
  ingest: {
    result: string;
    newestDistM: number;
    packetDistM: number;
  };
};

export type JitterDisplayEvent = {
  kind: "display";
  atMs: number;
  uid: string;
  conditionId: string | null;
  displayDistM: number;
  lng: number;
  lat: number;
  screenX: number | null;
  screenY: number | null;
  localDistM: number | null;
  localScreenX: number | null;
  localScreenY: number | null;
  camBearing: number | null;
  camPitch: number | null;
  camLng: number | null;
  camLat: number | null;
};

export type JitterEvent = JitterIngestEvent | JitterDisplayEvent;

export type DominantSignal =
  | "undetermined"
  | "along-track-screen"
  | "distance"
  | "both"
  | "screen-2d-unprojected"
  | "quiet";

export type DistBacktrackHit = {
  atMs: number;
  uid: string;
  fromM: number;
  toM: number;
  backM: number;
};

export type AlongReverseHit = {
  atMs: number;
  uid: string;
  sPx: number;
  prevSPx: number;
  magPx: number;
  ux: number;
  uy: number;
  pxPerM: number;
  distDeltaM: number;
  absDx: number;
  absDy: number;
  localSPx: number | null;
  relSPx: number | null;
  residualPx: number | null;
  source: "absolute" | "relative";
};

export type AlongSeriesStats = {
  reverseCount: number;
  maxReversePx: number;
  peakToPeakPx: number;
  negativeCount: number;
};

export type CameraVsPeerVerdict = "camera" | "peer" | "mixed";

export type CameraSplitSample = {
  atMs: number;
  uid: string;
  peerSPx: number;
  localSPx: number;
  relSPx: number;
  residualPx: number;
  peerReversed: boolean;
  localReversed: boolean;
  relReversed: boolean;
  vote: CameraVsPeerVerdict;
};

export type CameraSplitJudgment = {
  hasLocalScreen: boolean;
  k1MaxAbsResidualPx: number;
  k1MedianAbsResidualPx: number | null;
  k1FrameCount: number;
  k1Pass: boolean;
  s44ClassReproduced: boolean;
  verdict: CameraVsPeerVerdict | null;
  verdictReason: string;
  largePeerReverseCount: number;
  cameraVotes: number;
  peerVotes: number;
  mixedVotes: number;
  peerAlong: AlongSeriesStats;
  localAlong: AlongSeriesStats;
  relativeAlong: AlongSeriesStats;
  samples: CameraSplitSample[];
};

export type JitterAxisJudgment = {
  /** @deprecated S4-4. dominantSignal 을 쓴다. none 을 합격으로 쓰지 마라. */
  axis: DominantSignal;
  dominantSignal: DominantSignal;
  alongTrackMethod: "forward-regression-window";
  maxDistBacktrackM: number;
  distBacktrackCount: number;
  distBacktracks: DistBacktrackHit[];
  maxScreenReversePx: number;
  screenReverseCount: number;
  alongReverseCount: number;
  maxAlongReversePx: number;
  alongPeakToPeakPx: number;
  alongNegativeCount: number;
  alongReverses: AlongReverseHit[];
  subThresholdAlongReverseCount: number;
  pxPerMMedian: number | null;
  bandLabelPx: number;
  bandPxEqualsM: number | null;
  startGapDistM: number | null;
  startGapScreenPx: number | null;
  hasLocalScreen: boolean;
  displayFrames: number;
  ingestEvents: number;
  peerUids: string[];
  reason: string;
  cameraSplit: CameraSplitJudgment;
};

export type JitterCaptureDump = {
  windowStartedAt: number | null;
  windowEndedAt: number | null;
  recording: boolean;
  conditionId: string | null;
  events: JitterEvent[];
  judgment: JitterAxisJudgment;
};

type MapProject = {
  project: (ll: { lng: number; lat: number }) => { x: number; y: number };
  getBearing?: () => number;
  getPitch?: () => number;
  getCenter?: () => { lng: number; lat: number };
};

let recording = false;
let windowStartedAt: number | null = null;
let windowEndedAt: number | null = null;
let conditionId: string | null = null;
const events: JitterEvent[] = [];

export function isPeerJitterCapturing(): boolean {
  return recording;
}

export function resetPeerJitterCaptureForTests(): void {
  recording = false;
  windowStartedAt = null;
  windowEndedAt = null;
  conditionId = null;
  events.length = 0;
}

export function beginPeerJitterCapture(
  nowMs = Date.now(),
  nextConditionId: string | null = null,
): void {
  events.length = 0;
  recording = true;
  windowStartedAt = nowMs;
  windowEndedAt = null;
  conditionId = nextConditionId;
}

export function snapshotPeerJitterCapture(nowMs = Date.now()): JitterCaptureDump {
  return {
    windowStartedAt,
    windowEndedAt: recording ? nowMs : windowEndedAt,
    recording,
    conditionId,
    events: events.slice(),
    judgment: analyzeJitterAxis(events),
  };
}

export function endPeerJitterCapture(nowMs = Date.now()): JitterCaptureDump {
  recording = false;
  windowEndedAt = nowMs;
  return snapshotPeerJitterCapture(nowMs);
}

export function packetToJitterSource(
  packet: PeerMotionPacket | null,
  recvAtMs: number,
): JitterSourceSample | null {
  if (!packet) return null;
  return {
    recvAtMs,
    serverAtMs: packet.serverAtMs,
    distM: packet.distM,
    speedMps: packet.speedMps,
    phase: packet.phase,
    ...(packet.seq != null ? { seq: packet.seq } : {}),
  };
}

function pushEvent(ev: JitterEvent): void {
  if (!recording) return;
  if (events.length >= MAX_EVENTS) events.shift();
  events.push(ev);
}

export function noteJitterIngest(input: {
  atMs: number;
  uid: string;
  rtdb: JitterSourceSample | null;
  fs: JitterSourceSample | null;
  merge: JitterMergeNote;
  result: string;
  newestDistM: number;
  packetDistM: number;
}): void {
  if (!recording) return;
  pushEvent({
    kind: "ingest",
    atMs: input.atMs,
    uid: input.uid,
    conditionId,
    rtdb: input.rtdb,
    fs: input.fs,
    merge: input.merge,
    ingest: {
      result: input.result,
      newestDistM: input.newestDistM,
      packetDistM: input.packetDistM,
    },
  });
}

function readMap(): MapProject | null {
  if (typeof window === "undefined") return null;
  const map = (window as Window & { __RTW_MAP__?: MapProject }).__RTW_MAP__;
  return map && typeof map.project === "function" ? map : null;
}

function projectLngLat(
  map: MapProject | null,
  lng: number | null | undefined,
  lat: number | null | undefined,
): { x: number; y: number } | null {
  if (!map || lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  const p = map.project({ lng, lat });
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return p;
}

export function noteJitterDisplay(input: {
  atMs: number;
  uid: string;
  displayDistM: number;
  lng: number;
  lat: number;
  localDistM?: number | null;
  localLng?: number | null;
  localLat?: number | null;
}): void {
  if (!recording) return;
  const map = readMap();
  const peer = projectLngLat(map, input.lng, input.lat);
  const local = projectLngLat(map, input.localLng, input.localLat);
  let camBearing: number | null = null;
  let camPitch: number | null = null;
  let camLng: number | null = null;
  let camLat: number | null = null;
  if (map) {
    if (typeof map.getBearing === "function") camBearing = map.getBearing();
    if (typeof map.getPitch === "function") camPitch = map.getPitch();
    if (typeof map.getCenter === "function") {
      const c = map.getCenter();
      camLng = c.lng;
      camLat = c.lat;
    }
  }
  pushEvent({
    kind: "display",
    atMs: input.atMs,
    uid: input.uid,
    conditionId,
    displayDistM: input.displayDistM,
    lng: input.lng,
    lat: input.lat,
    screenX: peer?.x ?? null,
    screenY: peer?.y ?? null,
    localDistM: input.localDistM ?? null,
    localScreenX: local?.x ?? null,
    localScreenY: local?.y ?? null,
    camBearing,
    camPitch,
    camLng,
    camLat,
  });
}

function olsSlope(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += xs[i]!;
    my += ys[i]!;
  }
  mx /= n;
  my /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx;
    num += dx * (ys[i]! - my);
    den += dx * dx;
  }
  if (Math.abs(den) < 1e-12) return null;
  return num / den;
}

export type AlongUnit = { ux: number; uy: number; pxPerM: number };

function emptySeries(): AlongSeriesStats {
  return { reverseCount: 0, maxReversePx: 0, peakToPeakPx: 0, negativeCount: 0 };
}

function finishSeries(
  reverseCount: number,
  maxReversePx: number,
  negativeCount: number,
  sMin: number,
  sMax: number,
): AlongSeriesStats {
  return {
    reverseCount,
    maxReversePx,
    peakToPeakPx: Number.isFinite(sMin) && Number.isFinite(sMax) ? sMax - sMin : 0,
    negativeCount,
  };
}

function projectDelta(dx: number, dy: number, u: AlongUnit): number {
  return dx * u.ux + dy * u.uy;
}

/** ①=②+③ 분해로 한 프레임을 표 §3-1 에 넣는다. 비율은 분류 힌트일 뿐 합격선이 아니다. */
export function voteCameraVsPeerFrame(sample: {
  peerSPx: number;
  localSPx: number;
  relSPx: number;
  peerReversed: boolean;
  localReversed: boolean;
  relReversed: boolean;
}): CameraVsPeerVerdict {
  const a = sample.peerSPx;
  const b = sample.localSPx;
  const c = sample.relSPx;
  const mag = Math.abs(a);
  if (!sample.peerReversed || mag < 1e-9) return "mixed";
  const sameDirLocal = a * b > 0;
  const sameDirRel = a * c > 0;
  const localShare = Math.abs(b);
  const relShare = Math.abs(c);
  const sameSize = Math.abs(a - b) <= 0.25 * mag;
  const localSmall = localShare <= 0.25 * mag;
  const relSmall = relShare <= 0.25 * mag;
  if (sample.localReversed && sameDirLocal && sameSize && !sample.relReversed && relSmall) {
    return "camera";
  }
  if (sample.relReversed && sameDirRel && (localSmall || !sample.localReversed)) {
    return "peer";
  }
  return "mixed";
}

export function emptyCameraSplit(reason: string, hasLocalScreen = false): CameraSplitJudgment {
  return {
    hasLocalScreen,
    k1MaxAbsResidualPx: 0,
    k1MedianAbsResidualPx: null,
    k1FrameCount: 0,
    k1Pass: false,
    s44ClassReproduced: false,
    verdict: null,
    verdictReason: reason,
    largePeerReverseCount: 0,
    cameraVotes: 0,
    peerVotes: 0,
    mixedVotes: 0,
    peerAlong: emptySeries(),
    localAlong: emptySeries(),
    relativeAlong: emptySeries(),
    samples: [],
  };
}

export function concludeCameraSplit(input: {
  hasLocalScreen: boolean;
  peerAlong: AlongSeriesStats;
  localAlong: AlongSeriesStats;
  relativeAlong: AlongSeriesStats;
  residuals: readonly number[];
  samples: CameraSplitSample[];
}): CameraSplitJudgment {
  const absRes = input.residuals.map((r) => Math.abs(r));
  const k1MaxAbsResidualPx = absRes.length ? Math.max(...absRes) : 0;
  const k1MedianAbsResidualPx = median(absRes);
  const k1FrameCount = absRes.length;
  const k1Pass = k1FrameCount > 0 && k1MaxAbsResidualPx <= K1_RESIDUAL_EPS_PX;
  const s44ClassReproduced = input.peerAlong.maxReversePx >= S44_CLASS_PX;
  const large = input.samples.filter((s) => s.peerReversed && Math.abs(s.peerSPx) >= S44_CLASS_PX);
  let cameraVotes = 0;
  let peerVotes = 0;
  let mixedVotes = 0;
  for (const s of large) {
    if (s.vote === "camera") cameraVotes += 1;
    else if (s.vote === "peer") peerVotes += 1;
    else mixedVotes += 1;
  }

  let verdict: CameraVsPeerVerdict | null = null;
  let verdictReason: string;
  if (!input.hasLocalScreen) {
    verdictReason = "hasLocalScreen=false. ② 가 없어 카메라를 증명할 수 없다. §3 생략.";
  } else if (!k1Pass) {
    verdictReason = `K1 검산 실패 (max |①−②−③|=${k1MaxAbsResidualPx.toFixed(6)} px, n=${k1FrameCount}). 판정을 쓰지 않는다.`;
  } else if (!s44ClassReproduced) {
    verdictReason = `S44급 진행축 반전 미재현 (① 최대 ${input.peerAlong.maxReversePx.toFixed(1)} px < ${S44_CLASS_PX} px). §3 판정 생략.`;
  } else if (large.length === 0) {
    verdictReason = "S44급 ① 반전 프레임이 없다. §3 판정 생략.";
  } else if (cameraVotes === large.length) {
    verdict = "camera";
    verdictReason = `① 반전 ${large.length} 프레임이 모두 ② 와 같은 방향·크기이고 ③ 은 반전 없음.`;
  } else if (peerVotes === large.length) {
    verdict = "peer";
    verdictReason = `① 반전 ${large.length} 프레임이 ② 와 무관하고 ③ 이 같이 반전.`;
  } else {
    verdict = "mixed";
    verdictReason = `① 반전 ${large.length} 프레임: 카메라 ${cameraVotes} · peer ${peerVotes} · 혼합 ${mixedVotes}. 두 성분을 각각 제시.`;
  }

  return {
    hasLocalScreen: input.hasLocalScreen,
    k1MaxAbsResidualPx,
    k1MedianAbsResidualPx,
    k1FrameCount,
    k1Pass,
    s44ClassReproduced,
    verdict,
    verdictReason,
    largePeerReverseCount: large.length,
    cameraVotes,
    peerVotes,
    mixedVotes,
    peerAlong: input.peerAlong,
    localAlong: input.localAlong,
    relativeAlong: input.relativeAlong,
    samples: input.samples,
  };
}

/** displayDistM 전진 창에서 screen~dist 회귀. 튐이 û 를 한 프레임으로 뒤집지 않게 창을 쓴다. */
export function estimateAlongTrackUnit(
  series: readonly JitterDisplayEvent[],
  index: number,
): AlongUnit | null {
  const lo = Math.max(0, index - UHAT_HALF_WINDOW);
  const hi = Math.min(series.length - 1, index + UHAT_HALF_WINDOW);
  const dist: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = lo; i <= hi; i += 1) {
    const ev = series[i]!;
    if (ev.screenX == null || ev.screenY == null) continue;
    dist.push(ev.displayDistM);
    xs.push(ev.screenX);
    ys.push(ev.screenY);
  }
  if (dist.length < 4) return null;
  const span = Math.max(...dist) - Math.min(...dist);
  if (span < UHAT_MIN_DIST_SPAN_M) return null;
  const sx = olsSlope(dist, xs);
  const sy = olsSlope(dist, ys);
  if (sx == null || sy == null) return null;
  const mag = Math.hypot(sx, sy);
  if (mag < UHAT_MIN_PX_PER_M) return null;
  return { ux: sx / mag, uy: sy / mag, pxPerM: mag };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function emptyJudgment(
  extra: Partial<JitterAxisJudgment> & Pick<JitterAxisJudgment, "dominantSignal" | "reason">,
): JitterAxisJudgment {
  const dominantSignal = extra.dominantSignal;
  return {
    axis: dominantSignal,
    alongTrackMethod: "forward-regression-window",
    maxDistBacktrackM: 0,
    distBacktrackCount: 0,
    distBacktracks: [],
    maxScreenReversePx: 0,
    screenReverseCount: 0,
    alongReverseCount: 0,
    maxAlongReversePx: 0,
    alongPeakToPeakPx: 0,
    alongNegativeCount: 0,
    alongReverses: [],
    subThresholdAlongReverseCount: 0,
    pxPerMMedian: null,
    bandLabelPx: BAND_LABEL_PX,
    bandPxEqualsM: null,
    startGapDistM: null,
    startGapScreenPx: null,
    hasLocalScreen: false,
    displayFrames: 0,
    ingestEvents: 0,
    peerUids: [],
    cameraSplit: extra.cameraSplit ?? emptyCameraSplit(extra.reason),
    ...extra,
    dominantSignal,
  };
}

export function analyzeJitterAxis(log: readonly JitterEvent[]): JitterAxisJudgment {
  const ingestEvents = log.filter((e): e is JitterIngestEvent => e.kind === "ingest").length;
  const display = log.filter((e): e is JitterDisplayEvent => e.kind === "display");
  const peerUids = [...new Set(log.map((e) => e.uid))];

  if (display.length < 3) {
    return emptyJudgment({
      dominantSignal: "undetermined",
      displayFrames: display.length,
      ingestEvents,
      peerUids,
      reason: "display 프레임이 부족하다 (3 미만).",
    });
  }

  const distBacktracks: DistBacktrackHit[] = [];
  const alongReverses: AlongReverseHit[] = [];
  const pxPerMAll: number[] = [];
  let maxScreenReversePx = 0;
  let screenReverseCount = 0;
  let alongNegativeCount = 0;
  let sMin = Infinity;
  let sMax = -Infinity;
  let localNeg = 0;
  let localMin = Infinity;
  let localMax = -Infinity;
  let localRevCount = 0;
  let localMaxRev = 0;
  let relNeg = 0;
  let relMin = Infinity;
  let relMax = -Infinity;
  let relRevCount = 0;
  let relMaxRev = 0;
  let hasLocalScreen = false;
  const residuals: number[] = [];
  const splitSamples: CameraSplitSample[] = [];

  const first = display[0]!;
  const startGapDistM =
    first.localDistM != null ? first.displayDistM - first.localDistM : null;
  const startGapScreenPx =
    first.screenX != null &&
    first.screenY != null &&
    first.localScreenX != null &&
    first.localScreenY != null
      ? Math.hypot(first.screenX - first.localScreenX, first.screenY - first.localScreenY)
      : null;

  const byUid = new Map<string, JitterDisplayEvent[]>();
  for (const ev of display) {
    const list = byUid.get(ev.uid) ?? [];
    list.push(ev);
    byUid.set(ev.uid, list);
    if (ev.localScreenX != null && ev.localScreenY != null) hasLocalScreen = true;
  }

  for (const series of byUid.values()) {
    let prev: JitterDisplayEvent | null = null;
    let prevDx = 0;
    let prevDy = 0;
    let prevS: number | null = null;
    let prevLocalS: number | null = null;
    let prevRelS: number | null = null;
    let lockedU: AlongUnit | null = null;
    for (let i = 0; i < series.length; i += 1) {
      const ev = series[i]!;
      const rawU = estimateAlongTrackUnit(series, i);
      let u = rawU;
      if (u && lockedU && u.ux * lockedU.ux + u.uy * lockedU.uy < 0) {
        u = { ux: -u.ux, uy: -u.uy, pxPerM: u.pxPerM };
      }
      if (u) {
        lockedU = u;
        pxPerMAll.push(u.pxPerM);
      }
      if (prev) {
        const back = prev.displayDistM - ev.displayDistM;
        if (back > 0) {
          distBacktracks.push({
            atMs: ev.atMs,
            uid: ev.uid,
            fromM: prev.displayDistM,
            toM: ev.displayDistM,
            backM: back,
          });
        }
        if (
          prev.screenX != null &&
          prev.screenY != null &&
          ev.screenX != null &&
          ev.screenY != null
        ) {
          const dx = ev.screenX - prev.screenX;
          const dy = ev.screenY - prev.screenY;
          const reverse2d =
            dx * prevDx + dy * prevDy < 0 &&
            Math.hypot(dx, dy) > 0 &&
            Math.hypot(prevDx, prevDy) > 0;
          if (reverse2d) {
            screenReverseCount += 1;
            const mag = Math.hypot(dx, dy);
            if (mag > maxScreenReversePx) maxScreenReversePx = mag;
          }
          if (u) {
            const s = projectDelta(dx, dy, u);
            if (s < 0) alongNegativeCount += 1;
            if (s < sMin) sMin = s;
            if (s > sMax) sMax = s;
            const peerReversed = prevS != null && s * prevS < 0;
            let localS: number | null = null;
            let relS: number | null = null;
            let residual: number | null = null;
            if (
              prev.localScreenX != null &&
              prev.localScreenY != null &&
              ev.localScreenX != null &&
              ev.localScreenY != null
            ) {
              const ldx = ev.localScreenX - prev.localScreenX;
              const ldy = ev.localScreenY - prev.localScreenY;
              localS = projectDelta(ldx, ldy, u);
              relS = projectDelta(dx - ldx, dy - ldy, u);
              residual = s - localS - relS;
              residuals.push(residual);
              if (localS < 0) localNeg += 1;
              if (localS < localMin) localMin = localS;
              if (localS > localMax) localMax = localS;
              if (relS < 0) relNeg += 1;
              if (relS < relMin) relMin = relS;
              if (relS > relMax) relMax = relS;
              const localReversed = prevLocalS != null && localS * prevLocalS < 0;
              const relReversed = prevRelS != null && relS * prevRelS < 0;
              if (localReversed) {
                localRevCount += 1;
                if (Math.abs(localS) > localMaxRev) localMaxRev = Math.abs(localS);
              }
              if (relReversed) {
                relRevCount += 1;
                if (Math.abs(relS) > relMaxRev) relMaxRev = Math.abs(relS);
              }
              const voteSample = {
                peerSPx: s,
                localSPx: localS,
                relSPx: relS,
                peerReversed,
                localReversed,
                relReversed,
              };
              splitSamples.push({
                atMs: ev.atMs,
                uid: ev.uid,
                ...voteSample,
                residualPx: residual,
                vote: voteCameraVsPeerFrame(voteSample),
              });
              prevLocalS = localS;
              prevRelS = relS;
            } else {
              prevLocalS = null;
              prevRelS = null;
            }
            if (peerReversed) {
              alongReverses.push({
                atMs: ev.atMs,
                uid: ev.uid,
                sPx: s,
                prevSPx: prevS!,
                magPx: Math.abs(s),
                ux: u.ux,
                uy: u.uy,
                pxPerM: u.pxPerM,
                distDeltaM: ev.displayDistM - prev.displayDistM,
                absDx: dx,
                absDy: dy,
                localSPx: localS,
                relSPx: relS,
                residualPx: residual,
                source: relS != null ? "relative" : "absolute",
              });
            }
            prevS = s;
          } else {
            prevS = null;
            prevLocalS = null;
            prevRelS = null;
          }
          prevDx = dx;
          prevDy = dy;
        }
      }
      prev = ev;
    }
  }

  distBacktracks.sort((a, b) => b.backM - a.backM);
  const maxDistBacktrackM = distBacktracks[0]?.backM ?? 0;
  const maxAlongReversePx = alongReverses.reduce((m, h) => Math.max(m, h.magPx), 0);
  const pxPerMMedian = median(pxPerMAll);
  const bandPxEqualsM =
    pxPerMMedian != null && pxPerMMedian > 0 ? BAND_LABEL_PX / pxPerMMedian : null;
  const subThresholdAlongReverseCount = alongReverses.filter(
    (h) => h.magPx < BAND_LABEL_PX,
  ).length;
  const alongPeakToPeakPx = Number.isFinite(sMin) && Number.isFinite(sMax) ? sMax - sMin : 0;

  let dominantSignal: DominantSignal = "quiet";
  if (alongReverses.length > 0 && distBacktracks.length > 0) dominantSignal = "both";
  else if (alongReverses.length > 0) dominantSignal = "along-track-screen";
  else if (distBacktracks.length > 0) dominantSignal = "distance";
  else if (screenReverseCount > 0) dominantSignal = "screen-2d-unprojected";

  const cameraSplit = concludeCameraSplit({
    hasLocalScreen,
    peerAlong: finishSeries(
      alongReverses.length,
      maxAlongReversePx,
      alongNegativeCount,
      sMin,
      sMax,
    ),
    localAlong: finishSeries(localRevCount, localMaxRev, localNeg, localMin, localMax),
    relativeAlong: finishSeries(relRevCount, relMaxRev, relNeg, relMin, relMax),
    residuals,
    samples: splitSamples,
  });

  const reason = [
    `진행축=displayDistM 창 회귀. û 는 X/Y 고정이 아니다.`,
    `거리 역행 ${distBacktracks.length} 회 최대 ${maxDistBacktrackM.toFixed(3)} m (임계로 버리지 않음).`,
    `① peer절대 반전 ${alongReverses.length} 회 최대 ${maxAlongReversePx.toFixed(1)} px, 음수 ${alongNegativeCount} 스텝, peak-to-peak ${alongPeakToPeakPx.toFixed(1)} px.`,
    `② local절대 반전 ${cameraSplit.localAlong.reverseCount} 회 최대 ${cameraSplit.localAlong.maxReversePx.toFixed(1)} px.`,
    `③ 상대 반전 ${cameraSplit.relativeAlong.reverseCount} 회 최대 ${cameraSplit.relativeAlong.maxReversePx.toFixed(1)} px.`,
    `K1 max|①−②−③|=${cameraSplit.k1MaxAbsResidualPx.toExponential(2)} px n=${cameraSplit.k1FrameCount} pass=${cameraSplit.k1Pass}.`,
    `2D 반전 ${screenReverseCount} 회 최대 ${maxScreenReversePx.toFixed(1)} px.`,
    `밴드 ${BAND_LABEL_PX}px 미만 진행축 반전 ${subThresholdAlongReverseCount} 회 (라벨. 판정 근거 아님).`,
    hasLocalScreen ? `로컬 화면 좌표 있음.` : `로컬 화면 좌표 없음.`,
    cameraSplit.verdictReason,
  ].join(" ");

  return {
    axis: dominantSignal,
    dominantSignal,
    alongTrackMethod: "forward-regression-window",
    maxDistBacktrackM,
    distBacktrackCount: distBacktracks.length,
    distBacktracks,
    maxScreenReversePx,
    screenReverseCount,
    alongReverseCount: alongReverses.length,
    maxAlongReversePx,
    alongPeakToPeakPx,
    alongNegativeCount,
    alongReverses,
    subThresholdAlongReverseCount,
    pxPerMMedian,
    bandLabelPx: BAND_LABEL_PX,
    bandPxEqualsM,
    startGapDistM,
    startGapScreenPx,
    hasLocalScreen,
    displayFrames: display.length,
    ingestEvents,
    peerUids,
    reason,
    cameraSplit,
  };
}

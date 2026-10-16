/**
 * 라이더 경로 거리 떨림(`?perflab=1`).
 *
 * 쿼리가 없으면 즉시 반환한다. 샘플 버퍼를 밀지 않고 `performance.now()` 도 부르지 않는다.
 * 최근 10 s 의 프레임 거리로 역행·속도 변동·본인 대비 상대 거리 표준편차를 낸다.
 */

import { isPerfLabEnabled, PERF_LAB_WINDOW_MS } from "./perfLab";

/** 이보다 작은 후퇴는 부동소수 잡음으로 본다. */
export const RIDER_JITTER_REVERSE_EPS_M = 1e-4;

/** 평균 속도가 이보다 작으면 변동계수를 내지 않는다. */
const SPEED_MEAN_EPS_MPS = 1e-6;

export type RiderJitterKind = "self" | "pacer" | "peer";

export type RiderJitterSample = { t: number; distM: number };

export type RiderJitterSeries = {
  id: string;
  kind: RiderJitterKind;
  samples: readonly RiderJitterSample[];
};

export type RiderJitterStats = {
  id: string;
  kind: RiderJitterKind;
  frames: number;
  reverseFrames: number;
  /** 한 프레임 후퇴의 최댓값(m). 역행이 없으면 0. */
  maxReverseM: number;
  /** 프레임 속도 표준편차 / 평균. 평균이 0 근처면 null. */
  speedCv: number | null;
  /** 같은 시각 본인 거리와의 차의 표준편차(m). 본인은 0. */
  relStdM: number | null;
};

export type RiderJitterPeerLike = {
  properties: { id: string; displayDistM?: number };
};

export type RiderJitterPacerLike = {
  properties: { id: string; pathDistM?: number };
};

type StoredSample = RiderJitterSample & { id: string; kind: RiderJitterKind };

const stored: StoredSample[] = [];

function prune(nowMs: number): void {
  const minT = nowMs - PERF_LAB_WINDOW_MS;
  let drop = 0;
  while (drop < stored.length && stored[drop]!.t < minT) drop += 1;
  if (drop > 0) stored.splice(0, drop);
}

function meanOf(values: readonly number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function stddevOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = meanOf(values);
  let acc = 0;
  for (const v of values) {
    const d = v - mean;
    acc += d * d;
  }
  return Math.sqrt(acc / values.length);
}

function inWindow(t: number, nowMs: number, windowMs: number): boolean {
  return t >= nowMs - windowMs && t <= nowMs && Number.isFinite(t);
}

/**
 * 창 안의 연속 샘플로 떨림 지수를 계산한다.
 * 본인 시리즈(`kind === "self"`)가 있으면 그 시각의 거리로 상대 거리를 잰다.
 */
export function summarizeRiderJitter(
  series: readonly RiderJitterSeries[],
  nowMs: number,
  windowMs = PERF_LAB_WINDOW_MS,
): RiderJitterStats[] {
  const self = series.find((s) => s.kind === "self");
  const selfAt = new Map<number, number>();
  if (self) {
    for (const sample of self.samples) {
      if (!inWindow(sample.t, nowMs, windowMs) || !Number.isFinite(sample.distM)) continue;
      selfAt.set(sample.t, sample.distM);
    }
  }

  const out: RiderJitterStats[] = [];
  for (const row of series) {
    const samples = row.samples.filter(
      (sample) => inWindow(sample.t, nowMs, windowMs) && Number.isFinite(sample.distM),
    );
    if (samples.length === 0) continue;
    let reverseFrames = 0;
    let maxReverseM = 0;
    const speeds: number[] = [];
    const rels: number[] = [];
    for (let i = 0; i < samples.length; i += 1) {
      const cur = samples[i]!;
      if (row.kind === "self") rels.push(0);
      else {
        const base = selfAt.get(cur.t);
        if (base != null) rels.push(cur.distM - base);
      }
      if (i === 0) continue;
      const prev = samples[i - 1]!;
      const dd = cur.distM - prev.distM;
      const dtSec = (cur.t - prev.t) / 1000;
      if (dd < -RIDER_JITTER_REVERSE_EPS_M) {
        reverseFrames += 1;
        if (-dd > maxReverseM) maxReverseM = -dd;
      }
      if (dtSec > 0 && Number.isFinite(dtSec)) speeds.push(dd / dtSec);
    }
    let speedCv: number | null = null;
    if (speeds.length >= 2) {
      const mean = meanOf(speeds);
      if (Math.abs(mean) >= SPEED_MEAN_EPS_MPS) speedCv = stddevOf(speeds) / mean;
    }
    let relStdM: number | null = null;
    if (row.kind === "self") relStdM = samples.length >= 2 ? 0 : null;
    else if (rels.length >= 2) relStdM = stddevOf(rels);
    out.push({
      id: row.id,
      kind: row.kind,
      frames: samples.length,
      reverseFrames,
      maxReverseM,
      speedCv,
      relStdM,
    });
  }
  return out;
}

function groupStored(nowMs: number): RiderJitterSeries[] {
  const minT = nowMs - PERF_LAB_WINDOW_MS;
  const byId = new Map<string, RiderJitterSeries>();
  for (const sample of stored) {
    if (sample.t < minT || sample.t > nowMs) continue;
    let series = byId.get(sample.id);
    if (!series) {
      series = { id: sample.id, kind: sample.kind, samples: [] };
      byId.set(sample.id, series);
    }
    (series.samples as RiderJitterSample[]).push({ t: sample.t, distM: sample.distM });
  }
  return [...byId.values()];
}

/**
 * 렌더 spec 을 만든 프레임의 경로 거리.
 * 쿼리가 없으면 인자를 읽지 않고 반환한다.
 */
export function noteRiderJitterFrame(
  rafTs: number,
  selfDistM: number | null,
  peers: readonly RiderJitterPeerLike[],
  pacers: readonly RiderJitterPacerLike[],
): void {
  if (!isPerfLabEnabled()) return;
  if (!Number.isFinite(rafTs)) return;
  if (selfDistM != null && Number.isFinite(selfDistM)) {
    stored.push({ id: "live-self", kind: "self", t: rafTs, distM: selfDistM });
  }
  for (const feature of peers) {
    const distM = feature.properties.displayDistM;
    const id = feature.properties.id;
    if (!id || typeof distM !== "number" || !Number.isFinite(distM)) continue;
    stored.push({ id, kind: "peer", t: rafTs, distM });
  }
  for (const feature of pacers) {
    const distM = feature.properties.pathDistM;
    const id = feature.properties.id;
    if (!id || typeof distM !== "number" || !Number.isFinite(distM)) continue;
    stored.push({ id, kind: "pacer", t: rafTs, distM });
  }
  prune(rafTs);
}

export function readRiderJitterStats(nowMs?: number): RiderJitterStats[] {
  if (!isPerfLabEnabled()) return [];
  const now = nowMs ?? performance.now();
  return summarizeRiderJitter(groupStored(now), now);
}

export function resetRiderJitterProbe(): void {
  stored.length = 0;
}

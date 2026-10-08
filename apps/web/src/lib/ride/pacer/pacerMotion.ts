import { estimateCrankRpmFromSpeedKmh } from "../../sensor/crankRpm";
import { mulberry32 } from "./pacerPrng";

export type PacerId = "pacer-a" | "pacer-b";

export type PacerState = {
  id: PacerId;
  /** 나와의 경로 거리 차(앞 +, 뒤 −) */
  gapM: number;
  /** 페이서 속도 − 내 속도 */
  relVMps: number;
  targetGapM: number;
  retargetInSec: number;
  /** 차선 오프셋(오른쪽 +) */
  laneM: number;
  /** 크랭크 위상(렌더용, 연속값) */
  phaseRev: number;
};

export type PacerWorld = { pacers: PacerState[]; rng: () => number };

export const PACER_MAX_GAP_M = 20;
export const PACER_SOFT_GAP_M = 18;
export const PACER_MIN_TARGET_ABS_M = 4;
export const PACER_RETARGET_SEC = [15, 40] as const;
export const PACER_CROSS_PROB = 0.7;
/**
 * 목표 근처 감속 비례 이득. 실제 접근 속도는 제동 곡선(`pacerApproachSpeedMps`)이 함께 묶는다.
 * 비례 이득만 키우면 가속 상한 때문에 목표를 지나쳐 ±20 경계에 부딪힌다(Cursor 초안의 gain 2 가 그랬다).
 */
export const PACER_GAIN_PER_SEC = 0.5;
/** 제동 곡선 여유 — 1 보다 작아야 상한 가속으로 목표 안에서 선다 */
export const PACER_BRAKE_MARGIN = 0.9;
/** 상대속도 절대 상한. 실제 상한은 `pacerMaxRelVMps`. */
export const PACER_MAX_REL_V_MPS = 1.5;
export const PACER_REL_V_FLOOR_MPS = 0.3;
export const PACER_REL_V_SPEED_FACTOR = 0.2;
export const PACER_MAX_ACCEL_MPS2 = 0.4;
export const PACER_DT_MAX_SEC = 0.25;
/** 이 속도 미만이면 함께 선다 */
export const PACER_STOP_SELF_MPS = 0.5;
/** 페달 위상을 멈추는 속도(km/h) — 동행 마커와 같은 문턱 */
export const PACER_PHASE_HOLD_KMH = 0.38;

/** 방향을 경로 앞뒤 이 거리의 현으로 잡는다 — 꺾임점에서 yaw·차선 오프셋이 연속 */
export const PACER_HEADING_HALF_SPAN_M = 3;

export const PACER_LANE_M: Record<PacerId, number> = {
  "pacer-a": 1.2,
  "pacer-b": -1.2,
};

export const PACER_INITIAL_GAP_M: Record<PacerId, number> = {
  "pacer-a": -8,
  "pacer-b": 6,
};

const PACER_IDS: readonly PacerId[] = ["pacer-a", "pacer-b"];

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function uniform(rng: () => number, lo: number, hi: number): number {
  return lo + (hi - lo) * rng();
}

/** min(1.5, max(0.3, 0.2 × selfSpeed)) */
export function pacerMaxRelVMps(selfSpeedMps: number): number {
  const speed = Number.isFinite(selfSpeedMps) ? Math.max(0, selfSpeedMps) : 0;
  return Math.min(
    PACER_MAX_REL_V_MPS,
    Math.max(PACER_REL_V_FLOOR_MPS, PACER_REL_V_SPEED_FACTOR * speed),
  );
}

/**
 * 목표까지 남은 거리 `remainM` 안에서 가속 상한으로 설 수 있는 최대 접근 속도.
 * v ≤ √(2·a·d). 이 곡선을 따르면 목표(≤ 18 m)를 넘지 않으므로 ±20 경계는 안전장치로만 남는다.
 */
export function pacerApproachSpeedMps(remainM: number): number {
  return PACER_BRAKE_MARGIN * Math.sqrt(2 * PACER_MAX_ACCEL_MPS2 * Math.max(0, remainM));
}

function pickTarget(p: PacerState, rng: () => number, forceOpposite: boolean): void {
  const ahead = p.gapM >= 0;
  const cross = forceOpposite || rng() < PACER_CROSS_PROB;
  const positive = cross ? !ahead : ahead;
  const mag = uniform(rng, PACER_MIN_TARGET_ABS_M, PACER_SOFT_GAP_M);
  p.targetGapM = positive ? mag : -mag;
  p.retargetInSec = uniform(rng, PACER_RETARGET_SEC[0], PACER_RETARGET_SEC[1]);
}

export function createPacerWorld(seed: number): PacerWorld {
  const rng = mulberry32(seed);
  const pacers = PACER_IDS.map((id): PacerState => ({
    id,
    gapM: PACER_INITIAL_GAP_M[id],
    relVMps: 0,
    targetGapM: PACER_INITIAL_GAP_M[id],
    retargetInSec: uniform(rng, PACER_RETARGET_SEC[0], PACER_RETARGET_SEC[1]),
    laneM: PACER_LANE_M[id],
    phaseRev: 0,
  }));
  return { pacers, rng };
}

export function stepPacerWorld(
  world: PacerWorld,
  input: { dtSec: number; selfSpeedMps: number; status: "running" | "paused" },
): void {
  if (input.status === "paused") return;
  const rawDt = input.dtSec;
  const dt = Number.isFinite(rawDt) ? clamp(rawDt, 0, PACER_DT_MAX_SEC) : 0;
  const selfSpeed = Number.isFinite(input.selfSpeedMps) ? Math.max(0, input.selfSpeedMps) : 0;
  const stopped = selfSpeed < PACER_STOP_SELF_MPS;
  const maxRel = pacerMaxRelVMps(selfSpeed);

  for (const p of world.pacers) {
    p.retargetInSec -= dt;
    if (p.retargetInSec <= 0) pickTarget(p, world.rng, false);

    const desired = stopped
      ? 0
      : (() => {
          const err = p.targetGapM - p.gapM;
          const mag = Math.min(maxRel, PACER_GAIN_PER_SEC * Math.abs(err), pacerApproachSpeedMps(Math.abs(err)));
          return Math.sign(err) * mag;
        })();

    if (stopped) {
      // 가속 상한으로 감속하면 상대속도 1.5 m/s 가 수 미터를 더 밀고 간다.
      // 정지 구간 간격 변화 < 1 m 와 「함께 선다」를 같이 지키려고 즉시 0 으로 둔다.
      p.relVMps = 0;
    } else {
      const maxDelta = PACER_MAX_ACCEL_MPS2 * dt;
      p.relVMps += clamp(desired - p.relVMps, -maxDelta, maxDelta);
      if (p.relVMps < -selfSpeed) p.relVMps = -selfSpeed;
    }

    p.gapM += p.relVMps * dt;
    // 안전장치 — 제동 곡선이 지켜지면 닿지 않는다(U8 이 경계 상태를 직접 넣어 시험).
    if (p.gapM > PACER_MAX_GAP_M || p.gapM < -PACER_MAX_GAP_M) {
      p.gapM = clamp(p.gapM, -PACER_MAX_GAP_M, PACER_MAX_GAP_M);
      p.relVMps = 0;
      pickTarget(p, world.rng, true);
    }

    const speedKmh = pacerSpeedMps(selfSpeed, p) * 3.6;
    if (speedKmh > PACER_PHASE_HOLD_KMH) {
      const rpm = estimateCrankRpmFromSpeedKmh(speedKmh);
      p.phaseRev += (rpm / 60) * dt;
    }
  }
}

export function resolvePacerDistM(selfDistM: number, gapM: number, routeLenM: number): number {
  const hi = Number.isFinite(routeLenM) ? Math.max(0, routeLenM) : 0;
  const raw = (Number.isFinite(selfDistM) ? selfDistM : 0) + (Number.isFinite(gapM) ? gapM : 0);
  return clamp(raw, 0, hi);
}

export function pacerSpeedMps(selfSpeedMps: number, p: PacerState): number {
  const self = Number.isFinite(selfSpeedMps) ? selfSpeedMps : 0;
  return Math.max(0, self + p.relVMps);
}

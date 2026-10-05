/** RTDB motion wire 양자 — encode 와 self 표시 표본이 동일 canonical 값을 쓴다. */

/**
 * 거리 양자(m).
 * 0.1m 는 두 라이더 독립 보간 시 상대간격 ~0.1m pp·발행주기 소진동을 만든다
 * (실측 paired JSON · quantize-beat harness). 0.01m 로 비트 진폭을 줄인다.
 * 송신 주기·D600·FS4s 불변.
 */
export const MOTION_WIRE_DIST_QUANTUM_M = 0.01;

/** 속도 양자(m/s). */
export const MOTION_WIRE_SPEED_QUANTUM_MPS = 0.01;

let distQuantumM = MOTION_WIRE_DIST_QUANTUM_M;

export function quantizeMotionWireDistM(distM: number): number {
  const inv = 1 / distQuantumM;
  return Math.round(Math.max(0, distM) * inv) / inv;
}

export function quantizeMotionWireSpeedMps(speedMps: number): number {
  return Math.round(Math.max(0, speedMps) * 100) / 100;
}

/** harness — 구 0.1m vs 제품 0.01m BEFORE/AFTER. 제품 경로 기본값은 상수. */
export function __setMotionWireDistQuantumForTests(quantumM: number | null): void {
  distQuantumM =
    quantumM == null || !Number.isFinite(quantumM) || quantumM <= 0
      ? MOTION_WIRE_DIST_QUANTUM_M
      : quantumM;
}

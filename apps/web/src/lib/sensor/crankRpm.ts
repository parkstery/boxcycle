/**
 * 크랭크 RPM 해석 — **기계 계산**. BLE 관측 RPM 이 신뢰 구간이면 우선, 아니면
 * 속도(km/h)로 추정한다.
 *
 * 왜 `sensor` 인가 (2026-09-28) — 종전 위치는 `rider/riderPedalMotion.ts` 였다. 그러나
 * 이것은 **라이더 표현이 아니라 자전거 크랭크 운동학**이다. 배정이 틀린 탓에 동행
 * 전송 계층(`peerMotion`)이 페달을 돌리려고 라이더 도메인을 열어야 했다. 계산을 맨
 * 아래층인 `sensor` 로 내려 그 의존을 없앤다 — 소비자는 라이더 마커·동행 마커 둘 다다.
 */
export const CRANK_RPM_MIN = 14;
export const CRANK_RPM_MAX = 128;
/** 이 값 미만이면 “페달링 아님”으로 보고 속도 기반 추정으로 넘긴다 */
export const SENSOR_PEDALING_RPM_THRESHOLD = 8;

export function estimateCrankRpmFromSpeedKmh(speedKmh: number): number {
  const speed = Math.min(95, Math.max(0, speedKmh));
  return Math.min(CRANK_RPM_MAX, Math.max(16, 22 + speed * 2.85));
}

export type LivePedalMotionInput = {
  speedKmh: number;
  /** BLE 등 관측 RPM — 유효·임계 이상일 때만 속도 추정보다 우선 */
  crankRpmFromSensor?: number | null;
};

export function resolvePedalCrankRpm(m: LivePedalMotionInput): number {
  const s = m.crankRpmFromSensor;
  if (typeof s === "number" && Number.isFinite(s) && s >= SENSOR_PEDALING_RPM_THRESHOLD) {
    return Math.min(CRANK_RPM_MAX, Math.max(CRANK_RPM_MIN, s));
  }
  return estimateCrankRpmFromSpeedKmh(m.speedKmh);
}

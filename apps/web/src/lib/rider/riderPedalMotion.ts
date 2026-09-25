/**
 * 내 라이더 마커 페달 애니메이션용 RPM 해석.
 * BLE 크랭크 RPM이 신뢰 구간이면 우선, 아니면 속도(km/h)로 추정.
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

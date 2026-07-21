/** 가상 주행 세션과 연동해 페달 루프 주기·재생 여부를 맞춘다 */
export type LiveRiderMotion = {
  sessionStatus: "running" | "paused";
  speedKmh: number;
  /** BLE 크랭크 RPM 등 — 유효·임계 이상이면 속도 추정보다 우선 */
  crankRpmFromSensor?: number | null;
};

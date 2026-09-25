/** 지도 위 OSRM(도로 네트) 커버리지 표시 모드 */
export type CoverageOverlayMode = "off" | "osrm";

export const COVERAGE_OVERLAY_OPTIONS: { value: CoverageOverlayMode; label: string }[] = [
  { value: "off", label: "끔" },
  { value: "osrm", label: "OSRM" },
];

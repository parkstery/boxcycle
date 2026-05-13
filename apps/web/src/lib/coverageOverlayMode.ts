/** 지도 위 OSRM(도로 네트)·Mapillary 촬영 시퀀스 커버리지 표시 모드 */
export type CoverageOverlayMode = "off" | "osrm" | "mapillary" | "both";

export const COVERAGE_OVERLAY_OPTIONS: { value: CoverageOverlayMode; label: string }[] = [
  { value: "off", label: "끔" },
  { value: "osrm", label: "OSRM" },
  { value: "mapillary", label: "Mapillary" },
  { value: "both", label: "OSRM+Mapillary" },
];

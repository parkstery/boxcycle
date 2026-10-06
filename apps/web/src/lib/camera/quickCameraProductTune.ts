/**
 * Quick Camera 슬롯별 제품 고정 튜닝(Follow 스키마만).
 * QC2·QC3 은 2026-10-02 camlab 미세조정 확정값. 나머지 슬롯은 표에 없으면
 * `getCameraForFollowMode` + 전역 framing 기본값 그대로다.
 *
 * camlab(`?camlab=1`) 오버라이드가 있으면 제품 튜닝보다 우선한다.
 */
export type QuickCameraSlot = 1 | 2 | 3 | 4 | 5 | 6;

export type QuickCameraProductTune = {
  distanceM: number;
  pitchDeg: number;
  bearingOffsetDeg: number;
  lookAtAlongExtraM: number;
  screenAnchor: number;
};

/**
 * 2026-10-06 Chief: QC2~6 기본 거리를 HUD 「−」 두 번(×1.25², 0.1m 반올림) 만큼 멀게.
 * 종전 QC2 6m → 9.4m, QC3 7m → 11.0m, QC4·5·6(튜닝 없음) 6m → 9.4m.
 */
export const QUICK_CAMERA_FALLBACK_DISTANCE_M = 9.4;

/** 슬롯에 항목이 있는 QC 만 제품 경로에서 덮어쓴다. */
export const QUICK_CAMERA_PRODUCT_TUNE: Readonly<
  Partial<Record<QuickCameraSlot, QuickCameraProductTune>>
> = {
  2: {
    distanceM: 9.4,
    pitchDeg: 83.5,
    bearingOffsetDeg: 7.5,
    lookAtAlongExtraM: -0.8,
    screenAnchor: 0.63,
  },
  3: {
    distanceM: 11,
    pitchDeg: 83.5,
    bearingOffsetDeg: -6.5,
    lookAtAlongExtraM: -0.4,
    screenAnchor: 0.6,
  },
};

export function getQuickCameraProductTune(
  slot: QuickCameraSlot | null | undefined,
): QuickCameraProductTune | null {
  if (slot == null) return null;
  return QUICK_CAMERA_PRODUCT_TUNE[slot] ?? null;
}

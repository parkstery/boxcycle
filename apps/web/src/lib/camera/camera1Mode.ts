/**
 * Quick Camera 1 — 순환 단계 정의(지시07·지시11·20260924-지시01). **한 곳에서만** 관리한다.
 * App.tsx(순환 로직·거리 적용)와 MapHud.tsx(버튼 표식)가 이 모듈을 함께 import 해서,
 * 단계를 늘릴 때 두 파일에 흩어진 하드코딩 분기를 늘리지 않는다.
 *
 * routeFit 은 거리 개념이 없다(fitBounds 1회 — App.tsx 가 별도 처리).
 * aerial* 은 전부 `followMode: "aerial"` + preset 거리(m)로 동일하게 다룬다.
 *
 * ⚠ 거리 상한 `RIDE_CAMERA_DISTANCE_MAX_M`(60m, mapGlobeView.ts)은 **맵 뷰 시트 수동
 * 슬라이더 전용 클램프**다. 이 preset 경로(`setRideCameraDistanceM` → `computeRideFollowFraming`)는
 * 그 상한을 거치지 않으므로 200m 는 상한을 건드리지 않고도 그대로 통과한다
 * (구조 확인: 20260924-지시01수행결과).
 */
export type Camera1Mode = "routeFit" | "aerial200" | "aerial60" | "aerial5";

export const CAMERA1_MODE_CYCLE: readonly Camera1Mode[] = [
  "routeFit",
  "aerial200",
  "aerial60",
  "aerial5",
];

export function nextCamera1Mode(cur: Camera1Mode): Camera1Mode {
  const i = CAMERA1_MODE_CYCLE.indexOf(cur);
  return CAMERA1_MODE_CYCLE[(i + 1) % CAMERA1_MODE_CYCLE.length]!;
}

type Camera1AerialMode = Exclude<Camera1Mode, "routeFit">;

/**
 * aerial 단계의 preset 거리(m). QC1 의 aerial 은 pitch **0**(top-down, 지시04 확정 —
 * QC2~6 밀착 카메라의 pitch 80 과는 다른 경로)이라 `rideSpanM` floor≈1.79m 밖이고,
 * 세 값 모두 클램프 없이 그대로 적용된다(20260924-지시01수행결과 실측 — zoom 18.4/20.1/23.7).
 */
export const CAMERA1_AERIAL_DISTANCE_M: Readonly<Record<Camera1AerialMode, number>> = {
  aerial200: 200,
  aerial60: 60,
  aerial5: 5,
};

/** 버튼 표식(2~4자, 단위 반복 없음) · aria-label 문구 */
export const CAMERA1_MODE_META: Readonly<Record<Camera1Mode, { mark: string; label: string }>> = {
  routeFit: { mark: "R", label: "전체 경로" },
  aerial200: { mark: "200", label: "200m 상공" },
  aerial60: { mark: "60", label: "60m 상공" },
  aerial5: { mark: "5", label: "5m 상공" },
};

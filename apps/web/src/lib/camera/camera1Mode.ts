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
 * 그 상한을 거치지 않으므로 500m 는 상한을 건드리지 않고도 그대로 통과한다
 * (구조 확인: 20260924-지시01수행결과 · 지시11).
 *
 * 순환(지시11): routeFit → aerial500 → aerial20 → routeFit.
 */
export type Camera1Mode = "routeFit" | "aerial500" | "aerial20";

/** 지시11 이전 식별자 — localStorage·옛 세션에 남으면 routeFit 으로 이관 */
export const CAMERA1_LEGACY_MODES = ["aerial200", "aerial60", "aerial5"] as const;
export type Camera1LegacyMode = (typeof CAMERA1_LEGACY_MODES)[number];

export const CAMERA1_MODE_CYCLE: readonly Camera1Mode[] = [
  "routeFit",
  "aerial500",
  "aerial20",
];

export function isCamera1Mode(raw: unknown): raw is Camera1Mode {
  return raw === "routeFit" || raw === "aerial500" || raw === "aerial20";
}

/** 알 수 없거나 옛 aerial* 값은 routeFit 으로 안전하게 대체 */
export function normalizeCamera1Mode(raw: unknown): Camera1Mode {
  if (isCamera1Mode(raw)) return raw;
  return "routeFit";
}

export function nextCamera1Mode(cur: Camera1Mode | string): Camera1Mode {
  const normalized = normalizeCamera1Mode(cur);
  const i = CAMERA1_MODE_CYCLE.indexOf(normalized);
  return CAMERA1_MODE_CYCLE[(i + 1) % CAMERA1_MODE_CYCLE.length]!;
}

type Camera1AerialMode = Exclude<Camera1Mode, "routeFit">;

/**
 * aerial 단계의 preset 거리(m). QC1 의 aerial 은 pitch **0**(top-down, 지시04 확정 —
 * QC2~6 밀착 카메라의 pitch 80 과는 다른 경로)이라 `rideSpanM` floor≈1.79m 밖이고,
 * 값은 클램프 없이 그대로 적용된다.
 */
export const CAMERA1_AERIAL_DISTANCE_M: Readonly<Record<Camera1AerialMode, number>> = {
  aerial500: 500,
  aerial20: 20,
};

/** 버튼 표식(2~4자, 단위 반복 없음) · aria-label 문구 */
export const CAMERA1_MODE_META: Readonly<Record<Camera1Mode, { mark: string; label: string }>> = {
  routeFit: { mark: "R", label: "전체 경로" },
  aerial500: { mark: "500", label: "500m 상공" },
  aerial20: { mark: "20", label: "20m 상공" },
};

/**
 * 다른 카메라(또는 없음)에서 1번으로 **들어올 때** 위성으로.
 * 1번 안 순환에서는 호출하지 않는다(사용자 「야외」 토글 존중).
 */
export function resolveCamera1EnterMapStyle(args: {
  currentStyle: string;
  satelliteStyle: string;
}): { nextStyle: string; styleBeforeEnter: string } {
  return {
    nextStyle: args.satelliteStyle,
    styleBeforeEnter: args.currentStyle,
  };
}

/**
 * 1번에서 **나갈 때** 진입 직전 스타일 복원.
 * 단 1번 안에서 사용자가 맵 스타일을 직접 토글했다면 복원하지 않고 현재 선택 유지.
 */
export function resolveCamera1ExitMapStyle(args: {
  currentStyle: string;
  styleBeforeEnter: string | null;
  userToggledWhileInCamera1: boolean;
}): string {
  if (args.userToggledWhileInCamera1) return args.currentStyle;
  if (args.styleBeforeEnter != null) return args.styleBeforeEnter;
  return args.currentStyle;
}

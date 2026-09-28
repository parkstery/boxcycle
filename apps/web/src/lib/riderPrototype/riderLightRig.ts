/**
 * 라이더 조명 리그 — **값과 계산만**. 지도(mapbox)를 모른다.
 *
 * 왜 나뉘어 있나 (2026-09-28) — 종전에는 이 값·계산이 지도 레이어 파일(지금의 `map/riderPreservedLayer.ts`) 안에
 * mapbox 커스텀 레이어와 함께 있었다. 그래서 조절판(`riderLightLab.ts`, 라이더 도메인)이
 * 조명 기본값을 읽으려면 지도 레이어 파일을 열어야 했고, 그 파일이 레이어 순서
 * 레지스트리(`map/layerOrder.ts`)를 import 하는 탓에 **라이더가 지도를 아는** 역방향
 * 의존이 생겼다. 조명 상태는 라이더 표현이고, 캔버스에 그리는 일은 지도다 — 그 선으로 갈랐다.
 *
 * 제품 기본값은 불변이다. 아래 숫자들은 원래 레이어 파일에 하드코딩돼 있던 값 그대로다.
 */
import { Vector3 } from "three";

export type RiderLightLabState = {
  ambient: number;
  hemisphere: number;
  keyIntensity: number;
  keyAzimuthDeg: number;
  keyElevationDeg: number;
};

export const DEFAULT_AMBIENT_INTENSITY = 0.9;
export const DEFAULT_HEMISPHERE_INTENSITY = 1.2;
export const DEFAULT_KEY_INTENSITY = 1.6;
export const DEFAULT_KEY_POSITION = new Vector3(-3, 8, 5);
export const KEY_LIGHT_RADIUS = DEFAULT_KEY_POSITION.length();

/** Key 위치 → (방위각, 고도각) — 조절판 초기 슬라이더 값을 기존 `(-3, 8, 5)`에서 역산한다. */
function keyLightAzimuthElevationDeg(pos: Vector3): { azimuthDeg: number; elevationDeg: number } {
  const r = pos.length() || 1;
  const clampedSin = Math.min(1, Math.max(-1, pos.y / r));
  return {
    azimuthDeg: ((Math.atan2(pos.x, pos.z) * 180) / Math.PI + 360) % 360,
    elevationDeg: (Math.asin(clampedSin) * 180) / Math.PI,
  };
}

/** (방위각, 고도각, 반지름) → Key 위치 — 조절판 슬라이더를 씬에 즉시 반영할 때 쓰는 역변환. */
export function keyLightPositionFromAzimuthElevationDeg(
  azimuthDeg: number,
  elevationDeg: number,
  radius: number,
): Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const y = radius * Math.sin(el);
  const horizontal = radius * Math.cos(el);
  return new Vector3(horizontal * Math.sin(az), y, horizontal * Math.cos(az));
}

const DEFAULT_KEY_AZIMUTH_ELEVATION = keyLightAzimuthElevationDeg(DEFAULT_KEY_POSITION);

export const RIDER_LIGHT_LAB_DEFAULT_STATE: RiderLightLabState = {
  ambient: DEFAULT_AMBIENT_INTENSITY,
  hemisphere: DEFAULT_HEMISPHERE_INTENSITY,
  keyIntensity: DEFAULT_KEY_INTENSITY,
  keyAzimuthDeg: DEFAULT_KEY_AZIMUTH_ELEVATION.azimuthDeg,
  keyElevationDeg: DEFAULT_KEY_AZIMUTH_ELEVATION.elevationDeg,
};

/** 조절판 「값 복사」용 — 강도만 다루는 프로덕션 코드(`key.position.set(...)`)와 같은 좌표계. */
export function riderLightLabKeyPosition(state: RiderLightLabState): { x: number; y: number; z: number } {
  const p = keyLightPositionFromAzimuthElevationDeg(state.keyAzimuthDeg, state.keyElevationDeg, KEY_LIGHT_RADIUS);
  return { x: p.x, y: p.y, z: p.z };
}

/**
 * 조명 상태를 실제 광원에 반영할 수 있는 것 — **라이더가 지도 레이어에 요구하는 최소 계약**.
 * 이 타입 하나만 알면 되므로, 렌더러가 무엇인지(mapbox·오프스크린·시험용 가짜)는 상관없다.
 */
export type RiderLightLabTarget = {
  applyLightLabState(state: RiderLightLabState): void;
};

const liveRiderLightLabTargets = new Set<RiderLightLabTarget>();
let riderLightLabOverrideState: RiderLightLabState | null = null;

/**
 * 살아 있는 대상으로 등록한다. 이미 조절판 값이 정해져 있으면 **즉시 한 번 반영**한다
 * — 레이어가 뒤늦게 생겨도 슬라이더 값이 적용된 채로 뜬다(종전 동작과 동일).
 */
export function registerRiderLightLabTarget(target: RiderLightLabTarget): void {
  liveRiderLightLabTargets.add(target);
  if (riderLightLabOverrideState) target.applyLightLabState(riderLightLabOverrideState);
}

export function unregisterRiderLightLabTarget(target: RiderLightLabTarget): void {
  liveRiderLightLabTargets.delete(target);
}

/** 조절판 전용 진입점. 화면의 모든 대상에 즉시 반영한다 — 재로드·재시작 불필요. */
export function setRiderLightLabState(state: RiderLightLabState): void {
  riderLightLabOverrideState = state;
  for (const target of liveRiderLightLabTargets) target.applyLightLabState(state);
}

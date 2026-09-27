/**
 * 주행 입력 모드와 케이던스→가상 속도 변환 — 순수 로직.
 *
 * 튜닝 상수는 전부 여기에만 둔다(컴포넌트에 흩뿌리지 않는다).
 */

import { SESSION_SPEED_MAX_KMH, SESSION_SPEED_MIN_KMH } from "./sessionSpeedKmh";

/**
 * - `manual`: 속도 슬라이더로 달리는 체험 입력(T0)
 * - `cadence`: BLE 케이던스 센서가 가상 속도를 결정하는 센서 입력(T1)
 */
export type RideInputMode = "cadence" | "manual";

/** 이 미만은 「페달을 돌리지 않음」 — 센서 노이즈로 전진하지 않게 한다 */
export const CADENCE_DEADZONE_RPM = 8;
/** 고정 가상 기어비. 파워·저항·기어 정보가 없으므로 현실 속도가 아니다 */
export const CADENCE_TO_KMH = 0.32;
/** 현행 T1 정복 인정 상한과 맞춘 초기값 */
export const CADENCE_SPEED_MAX_KMH = 30;

/**
 * 크랭크 RPM → 가상 주행 속도(km/h).
 * 소수값을 그대로 돌려준다 — 반올림은 UI 에서만.
 */
export function cadenceRpmToVirtualSpeedKmh(rpm: number | null | undefined): number {
  if (rpm == null || !Number.isFinite(rpm)) return 0;
  if (rpm < CADENCE_DEADZONE_RPM) return 0;
  return Math.min(CADENCE_SPEED_MAX_KMH, rpm * CADENCE_TO_KMH);
}

export type RideTargetSpeedInput = {
  mode: RideInputMode;
  /** 체험 모드에서 사용자가 정한 값(km/h) */
  manualSpeedKmh: number;
  /** 센서 케이던스. `null`=아직 유효 샘플 없음, `0`=페달 정지 */
  crankRpm: number | null;
  /** GATT 연결이 살아 있는가 (RPM 유무로 판정하지 않는다) */
  sensorConnected: boolean;
};

/**
 * 현재 입력 모드가 만든 목표 속도(km/h).
 *
 * 핵심 규칙 — cadence 모드에서 센서가 끊기거나 정지해도 **manual 로 자동 복귀하지 않는다**.
 * 목표 속도는 0 이 되어 감속 정지한다. manual 복귀는 사용자의 명시적 선택뿐이다.
 */
export function resolveRideTargetSpeedKmh(input: RideTargetSpeedInput): number {
  if (input.mode === "manual") {
    if (!Number.isFinite(input.manualSpeedKmh)) return SESSION_SPEED_MIN_KMH;
    return Math.min(SESSION_SPEED_MAX_KMH, Math.max(SESSION_SPEED_MIN_KMH, input.manualSpeedKmh));
  }
  if (!input.sensorConnected) return 0;
  return cadenceRpmToVirtualSpeedKmh(input.crankRpm);
}

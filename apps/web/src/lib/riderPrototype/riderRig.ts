/**
 * Rider Rig (TS 파사드) — 실제 파생 계산은 `riderRig.geometry.mjs`(순수 JS)에 있다.
 * gen 스크립트·프리뷰 뷰어(브라우저)가 TS 를 import 할 수 없으므로 계산부는 .mjs 에 두고,
 * 앱 코드(riderGlbPedalPose 등)는 이 TS 파사드로 타입과 함께 쓴다. 값의 단일 진실은 .mjs.
 */
// @ts-expect-error — .mjs 순수 모듈(타입 선언 없음). 값은 아래에서 명시적으로 타입 부여.
import * as rig from "./riderRig.geometry.mjs";

export type Vec2 = readonly [number, number];

export const BB: Vec2 = rig.BB;
export const SADDLE: Vec2 = rig.SADDLE;
export const SEAT_TOP: Vec2 = rig.SEAT_TOP;
export const BAR_HOOD: Vec2 = rig.BAR_HOOD;
export const PELVIS: Vec2 = rig.PELVIS;
export const SHOULDER: Vec2 = rig.SHOULDER;
export const HEAD_C: Vec2 = rig.HEAD_C;

export const CRANK_ARM_M: number = rig.CRANK_ARM_M;
export const THIGH_LEN: number = rig.THIGH_LEN;
export const SHIN_LEN: number = rig.SHIN_LEN;
export const UPPER_ARM_LEN: number = rig.UPPER_ARM_LEN;
export const FOREARM_LEN: number = rig.FOREARM_LEN;

/** 페달 원주 위 한 점 — side, crankRad(라디안) */
export function pedalWorld(side: "l" | "r", crankRad: number): Vec2 {
  return rig.pedalWorld(side, crankRad) as Vec2;
}

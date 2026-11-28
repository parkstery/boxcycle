import type { Group } from "three";
import type { RiderVisualKind } from "./iso2dMarker";
import type { RiderRidePostureBlend } from "./riderRidePosture";
import type { RiderSkinMode } from "./riderSkinMode";

/** 레이어가 리그에 넘기는 흔들림 값. rider15 는 아직 받지 않는다(S5). */
export type PreservedRiderSway = { shaderRollRad: number; bobM: number };

/**
 * 레이어가 쓰는 리그 공통 표면. rider14(절차 리그)와 rider15(표준 스킨 리그)가
 * 이만큼만 공유한다. `skinModeValue`·`setSkinMode` 는 rider14 전용 폴백이라 선택이다.
 */
export interface PreservedRiderHandle {
  readonly object: Group;
  readonly supportsSway: boolean;
  readonly crankPhaseR: number;
  setPhase(phaseRev: number, wheelPhaseRev?: number): void;
  setSway(v: PreservedRiderSway): void;
  setVisualKind(kind: RiderVisualKind): void;
  dispose(): void;
  readonly skinModeValue?: RiderSkinMode;
  setSkinMode?(mode: RiderSkinMode): void;
  /** rider15 전용 — 주행 자세(Hoods·Aero·Sprint) 전환. 다음 `setPhase` 부터 반영된다. */
  setRidePosture?(blend: RiderRidePostureBlend): void;
  /** 엄지척(left/right)·hi(hi-left/hi-right) 상체 제스처. */
  setThumbGesture?(side: RiderGestureKey | null, elapsedSec: number, eventId?: string): void;
}

/** 상체 제스처 — 엄지척은 기존 키(left/right), hi 는 11-28 복원 LookHi 클립. */
export type RiderGestureKey = "left" | "right" | "hi-left" | "hi-right";

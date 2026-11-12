import type { Group } from "three";
import type { RiderVisualKind } from "./iso2dMarker";
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
  setPhase(phaseRev: number): void;
  setSway(v: PreservedRiderSway): void;
  setVisualKind(kind: RiderVisualKind): void;
  dispose(): void;
  readonly skinModeValue?: RiderSkinMode;
  setSkinMode?(mode: RiderSkinMode): void;
}

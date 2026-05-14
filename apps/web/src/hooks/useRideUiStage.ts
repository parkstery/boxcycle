import { useMemo } from "react";
import type { RideSessionStatus } from "./useVirtualRideSession";

/**
 * 라이딩 UI 단일 상태 머신.
 * - App.tsx 는 이 stage 와 슬롯 컨테이너만 마운트한다.
 * - 모달·드로어 등 보조 오버레이(메뉴/계정/AuxDial)는 stage 와 직교한다.
 */
export type RideUiStage =
  | "gate"
  | "gate-nickname"
  | "idle"
  | "setup"
  | "ready-to-start"
  | "riding"
  | "paused"
  | "summary";

export type RideUiStageInputs = {
  /** 인증 카드(게스트/Google 선택)가 필요한 상태 */
  needsAuthCard: boolean;
  /** Gmail 로그인 직후 닉네임 입력이 필요한 상태 */
  needsNicknameCard: boolean;
  /** RAF 기반 라이딩 세션 상태 */
  rideStatus: RideSessionStatus;
  /** 지도에 경로가 그려진 상태 */
  hasRoute: boolean;
  /** 출발 핀 설정 여부 */
  hasStartPin: boolean;
  /** 도착 핀 설정 여부 */
  hasEndPin: boolean;
  /** 도착/종료 직후 결과 시트 노출 여부 */
  summaryVisible: boolean;
};

export function useRideUiStage(input: RideUiStageInputs): RideUiStage {
  return useMemo(() => {
    if (input.needsAuthCard) return "gate";
    if (input.needsNicknameCard) return "gate-nickname";
    if (input.summaryVisible) return "summary";
    if (input.rideStatus === "paused") return "paused";
    if (input.rideStatus === "running") return "riding";
    if (input.hasRoute) return "ready-to-start";
    if (input.hasStartPin || input.hasEndPin) return "setup";
    return "idle";
  }, [
    input.needsAuthCard,
    input.needsNicknameCard,
    input.summaryVisible,
    input.rideStatus,
    input.hasRoute,
    input.hasStartPin,
    input.hasEndPin,
  ]);
}

/** stage 가 라이딩 컨트롤이 잠겨야 하는 단계인지 */
export function isRideStageLocked(stage: RideUiStage): boolean {
  return stage === "riding" || stage === "paused";
}

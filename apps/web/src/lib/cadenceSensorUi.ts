/**
 * 케이던스 센서의 **표시 계약**과 **주행 입력 준비 상태** — 순수 로직.
 *
 * HUD 칩·상세 설정 컴포넌트가 상태 조합을 각자 해석하면 「연결됨인데 아직 페달을
 * 안 돌린 상태」 같은 구분이 표면마다 어긋난다. 그 판정을 여기 한 곳에 둔다.
 * BLE 패킷 해석(`bleCscCadence`)이나 속도 공식(`cadenceRideInput`)은 알지 않는다.
 */

import type { RideInputMode } from "./cadenceRideInput";

/**
 * - `idle`: 연결한 적 없음(또는 사용자가 명시적으로 해제)
 * - `connecting`: chooser·GATT 진행 중
 * - `connected`: 알림 수신 중
 * - `disconnected`: 연결됐다가 끊김 — 「다시 연결」 유도
 * - `error`: 연결 실패
 */
export type BleCrankRpmUiState = "idle" | "connecting" | "connected" | "disconnected" | "error";

/** HUD 칩이 그리는 데 필요한 최소 상태 — BLE 훅 객체 전체를 넘기지 않는다 */
export type CadenceHudState = {
  capable: boolean;
  uiState: BleCrankRpmUiState;
  /** `null`=유효 샘플 없음 · `0`=페달 정지 · `>0`=유효 케이던스 */
  crankRpm: number | null;
};

/**
 * 메인 칩 표시. LED 는 제품 결정대로 **초록/흰색 두 의미만** 쓴다 —
 * 오류를 제3의 색으로 만들지 않고 접근성 이름·상세 설정 문구로 전달한다.
 */
export type CadenceChipView = {
  led: "green" | "white";
  /** 검색·연결 중 — 텍스트 폭은 그대로 두고 LED 만 깜빡인다 */
  pulsing: boolean;
  /** 짧은 칩 텍스트. 장치명은 절대 들어가지 않는다 */
  text: string;
  ariaLabel: string;
};

const CHIP_IDLE_TEXT = "CAD";
const CHIP_NO_SAMPLE_TEXT = "-- rpm";
const ARIA_PREFIX = "케이던스 센서";

/**
 * 칩 표시 계산.
 * @param riding `riding`·`paused` — 이때만 RPM 을 칩에 노출한다(주행 전엔 연결 여부만).
 */
export function cadenceChipView(state: CadenceHudState, riding: boolean): CadenceChipView {
  if (!state.capable) {
    return {
      led: "white",
      pulsing: false,
      text: CHIP_IDLE_TEXT,
      ariaLabel: `${ARIA_PREFIX}: 지원 안 됨`,
    };
  }

  if (state.uiState === "connecting") {
    return {
      led: "white",
      pulsing: true,
      text: CHIP_IDLE_TEXT,
      ariaLabel: `${ARIA_PREFIX}: 연결 중`,
    };
  }

  if (state.uiState === "connected") {
    if (!riding) {
      return {
        led: "green",
        pulsing: false,
        text: CHIP_IDLE_TEXT,
        ariaLabel: `${ARIA_PREFIX}: 연결됨`,
      };
    }
    if (state.crankRpm == null) {
      return {
        led: "green",
        pulsing: false,
        text: CHIP_NO_SAMPLE_TEXT,
        ariaLabel: `${ARIA_PREFIX}: 연결됨, 페달 확인 대기`,
      };
    }
    const rpm = Math.max(0, Math.round(state.crankRpm));
    return {
      led: "green",
      pulsing: false,
      text: `${rpm} rpm`,
      ariaLabel:
        rpm === 0 ? `${ARIA_PREFIX}: 연결됨, 페달 정지` : `${ARIA_PREFIX}: 연결됨, ${rpm} rpm`,
    };
  }

  // idle · disconnected · error — 전부 흰 LED. 주행 중에만 RPM 자리를 비워 둔 채 남긴다.
  const ariaSuffix =
    state.uiState === "disconnected"
      ? "연결 끊김"
      : state.uiState === "error"
        ? "연결 오류"
        : "연결 안 됨";
  return {
    led: "white",
    pulsing: false,
    text: riding ? CHIP_NO_SAMPLE_TEXT : CHIP_IDLE_TEXT,
    ariaLabel: `${ARIA_PREFIX}: ${ariaSuffix}`,
  };
}

/**
 * Go 이전 주행 입력 준비 상태.
 *
 * 앱 초기값 `manual` 은 **사용자의 선택이 아니다** — 선택하지 않은 체험 주행이
 * 시작되지 않도록 `choice-required` 에서 출발한다.
 */
export type RideInputReadiness =
  | "choice-required"
  | "manual-ready"
  | "cadence-connecting"
  | "cadence-awaiting-sample"
  | "cadence-ready";

export type RideInputReadinessInput = {
  mode: RideInputMode;
  /** 사용자가 상세 설정에서 「체험 속도로 준비」를 명시적으로 골랐는가 */
  manualChosen: boolean;
  uiState: BleCrankRpmUiState;
  /** 이번 연결에서 유효 크랭크 샘플을 최소 한 번 받았는가(이후 0rpm 이어도 유지) */
  cadenceSampleSeen: boolean;
};

export function resolveRideInputReadiness(input: RideInputReadinessInput): RideInputReadiness {
  if (input.mode === "cadence") {
    if (input.uiState === "connecting") return "cadence-connecting";
    if (input.uiState !== "connected") return "choice-required";
    return input.cadenceSampleSeen ? "cadence-ready" : "cadence-awaiting-sample";
  }
  return input.manualChosen ? "manual-ready" : "choice-required";
}

export function isRideInputReady(readiness: RideInputReadiness): boolean {
  return readiness === "manual-ready" || readiness === "cadence-ready";
}

/** Go 를 막는 이유 한 줄. 준비됐으면 `null` */
export function rideInputBlockedReason(readiness: RideInputReadiness): string | null {
  switch (readiness) {
    case "manual-ready":
    case "cadence-ready":
      return null;
    case "cadence-connecting":
      return "센서를 연결하는 중입니다.";
    case "cadence-awaiting-sample":
      return "페달을 돌려 센서를 확인하세요.";
    default:
      return "센서를 연결해 페달을 확인하거나 체험 속도를 선택하세요.";
  }
}

/** 상세 설정 헤더의 현재 상태 한 줄 */
export function cadenceSensorStatusLine(state: CadenceHudState): string {
  if (!state.capable) return "지원 안 됨";
  switch (state.uiState) {
    case "connecting":
      return "검색·연결 중";
    case "connected":
      if (state.crankRpm == null) return "연결됨 · 페달을 돌려 센서를 확인하세요";
      return state.crankRpm <= 0 ? "연결됨 · 페달 정지" : "연결됨";
    case "disconnected":
      return "연결 끊김";
    case "error":
      return "오류";
    default:
      return "미연결";
  }
}

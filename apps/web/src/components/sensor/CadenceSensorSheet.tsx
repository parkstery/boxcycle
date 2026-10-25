import { useEffect, useRef } from "react";
import { cadenceRpmToVirtualSpeedKmh, type RideInputMode } from "../../lib/sensor/cadenceRideInput";
import {
  cadenceSensorShortStatus,
  rideInputBlockedReason,
  type BleCrankRpmUiState,
  type RideInputReadiness,
} from "../../lib/sensor/cadenceSensorUi";
import { ALLOW_MANUAL_SPEED_WHILE_RIDING } from "../../lib/sensor/manualSpeedWhileRiding";
import { SessionSpeedControl } from "./SessionSpeedControl";
import "./CadenceSensorSheet.css";
import { SettingsCloseIcon } from "../ui/SettingsCloseIcon";
import { useDialogFocus } from "../ui/useDialogFocus";

export type CadenceSensorSheetProps = {
  open: boolean;
  onClose: () => void;
  capable: boolean;
  uiState: BleCrankRpmUiState;
  /** 선택한 장치의 전체 표시명 — 메인 칩이 아니라 여기서만 보여 준다 */
  deviceLabel: string | null;
  crankRpm: number | null;
  errorMessage: string | null;
  mode: RideInputMode;
  readiness: RideInputReadiness;
  /** `riding`·`paused` — 최초 센서 설정을 막고 단절 복구만 남긴다 */
  riding: boolean;
  manualSpeedKmh: number;
  onManualSpeedKmh: (n: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  /** 「센서 없음」 — 항상 사용자의 명시적 선택 */
  onChooseManual: () => void;
  onChooseCadence: () => void;
};

function rpmLine(props: CadenceSensorSheetProps): string | null {
  if (props.uiState !== "connected") return null;
  if (props.crankRpm == null) return "페달을 돌려 센서를 확인하세요";
  const rpm = Math.max(0, Math.round(props.crankRpm));
  const kmh = Math.round(cadenceRpmToVirtualSpeedKmh(props.crankRpm));
  return `${rpm} rpm · 가상 ${kmh} km/h`;
}

/**
 * 케이던스 센서 전용 상세 설정 — HUD 센서 칩의 단일 진입점.
 *
 * 주행 전에는 입력 준비(센서 연결·페달 확인 또는 체험 속도 선택)를 끝내는 표면이고,
 * 주행 중에는 단절 복구와 안전한 체험 입력 전환에만 쓴다.
 * TTS·BGM 같은 무관한 설정은 여기에 두지 않는다(주행 설정 시트가 계속 소유).
 */
export function CadenceSensorSheet(props: CadenceSensorSheetProps) {
  const { open, onClose } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const connected = props.uiState === "connected";
  const connecting = props.uiState === "connecting";
  const reconnecting = props.uiState === "disconnected";
  const cadenceMode = props.mode === "cadence";
  // 주행 중 최초 센서 설정은 하지 않는다 — manual 로 시작한 주행에서는 검색을 열지 않는다.
  const allowFirstSetup = !props.riding;
  const showReconnect =
    props.capable && !connected && !connecting && (allowFirstSetup || cadenceMode);
  const rpm = rpmLine(props);
  const manualReady = props.readiness === "manual-ready";
  const blockedReason = rideInputBlockedReason(props.readiness);
  // 체험 속도가 명시 선택된 상태에서는 제목 표기만 바꾼다 — dialog aria-label·콜백·조건 불변.
  const manualSelected = manualReady && !cadenceMode;

  return (
    <div className="cadence-sheet settings-surface" role="dialog" aria-label="케이던스 센서">
      <button
        type="button"
        className="cadence-sheet__scrim"
        aria-label="닫기"
        title="닫기"
        onClick={onClose}
      />
      <div className="cadence-sheet__panel settings-surface__panel" ref={panelRef}>
        <section className="cadence-sheet__hero" aria-label="센서 상태">
          <span className="cadence-sheet__hero-label">케이던스</span>
          <p className={`cadence-sheet__hero-value${connected && props.crankRpm != null ? "" : " cadence-sheet__hero-value--empty"}`} aria-label={rpm ?? "센서를 연결해 페달을 확인하세요"}>
            {connected && props.crankRpm != null ? <>{Math.max(0, Math.round(props.crankRpm))}{" "}<small>rpm</small></> : connected ? "페달을 돌려 보세요" : manualSelected ? "체험 속도" : "센서를 연결하세요"}
          </p>
          <p className="cadence-sheet__status"><span className={connected ? "is-connected" : ""} />{manualSelected ? "센서 없이 달리기" : cadenceSensorShortStatus(props)}</p>
          {props.deviceLabel ? <p className="cadence-sheet__device">{props.deviceLabel}</p> : null}
        </section>
        <div className="cadence-sheet__detail">
        {/*
         * 폰에는 Escape 키가 없고, 가로에서는 시트가 화면을 거의 채워 scrim 이 얇은 띠만
         * 남는다 — 명시적 닫기 버튼이 없으면 빠져나갈 길이 사실상 없다.
         */}
        <div className="cadence-sheet__head settings-surface__head">
          {/* 제목과 연결 상태를 한 줄로(2026-09-18 Chief) */}
          <h2 className="cadence-sheet__title settings-surface__title">
            {manualSelected ? "체험 속도" : "케이던스 센서"}
          </h2>
          <button
            type="button"
            className="cadence-sheet__close settings-surface__close"
            aria-label="센서 설정 닫기"
            title="닫기"
            onClick={onClose}
          >
            <SettingsCloseIcon />
          </button>
        </div>

        <p className="cadence-sheet__intro">페달을 돌리면 왼쪽 숫자가 바뀌어요.<br />센서로 달린 주행만 순위에 올라가요.</p>

        {/* Go 가 잠긴 이유는 실제로 해소할 수 있는 이 자리에서만 말한다(RouteDock 에 두지 않는다) */}
        {/* 「센서를 연결해 페달을 확인하거나 체험 속도를 선택하세요」(choice-required)는
            아래 두 버튼이 이미 말한다 — 제거(2026-09-18 Chief). 연결 중·페달 대기 안내는 남긴다. */}
        {blockedReason && props.readiness !== "choice-required" ? (
          <p className="cadence-sheet__blocked" role="status">
            {blockedReason}
          </p>
        ) : null}

        {!props.capable ? (
          <p className="cadence-sheet__help">
            이 브라우저는 Web Bluetooth 를 지원하지 않습니다. Chrome 또는 Edge 에서 HTTPS 또는
            localhost 로 열어 주세요.
          </p>
        ) : null}

        {props.capable && props.riding && !cadenceMode ? (
          <p className="cadence-sheet__help">
            체험 속도로 주행 중입니다 — 센서는 다음 주행 전에 설정하세요.
          </p>
        ) : null}

        <div className="cadence-sheet__actions">
          {connecting ? <span className="cadence-sheet__help">검색·연결 중…</span> : null}

          {showReconnect ? (
            <button
              type="button"
              className={`cadence-sheet__btn${
                manualReady ? "" : " cadence-sheet__btn--primary"
              }`}
              title="센서 연결"
              onClick={props.onConnect}
            >
              센서 연결
            </button>
          ) : null}

          {connected ? (
            <button
              type="button"
              className="cadence-sheet__btn"
              title="연결 해제"
              onClick={props.onDisconnect}
            >
              연결 해제
            </button>
          ) : null}

          {connected ? (
            <button
              type="button"
              className="cadence-sheet__btn cadence-sheet__btn--primary"
              aria-label={cadenceMode ? "이 센서로 달리기" : "센서 속도로 전환"}
              title="센서 선택 완료"
              onClick={() => {
                if (!cadenceMode) props.onChooseCadence();
                onClose();
              }}
            >
              이 센서로 달리기
            </button>
          ) : null}

          {/* 단절 중에도 남는다 — 자동 fallback 은 없고 오직 사용자의 명시적 선택뿐이다 */}
          <button
            type="button"
            className={`cadence-sheet__btn${
              !cadenceMode && !manualReady ? " cadence-sheet__btn--primary" : ""
            }${manualReady ? " cadence-sheet__btn--on" : ""}`}
            aria-pressed={manualReady}
            title="센서 없이 달리기 · 순위 제외"
            onClick={props.onChooseManual}
          >
            센서 없음
          </button>
        </div>

        {props.errorMessage ? (
          <p
            className={reconnecting ? "cadence-sheet__notice" : "cadence-sheet__error"}
            role={reconnecting ? "status" : "alert"}
          >
            {props.errorMessage}
          </p>
        ) : null}

        {/*
          체험 속도는 Go 전에 여기서 정한다 — 주행 중 재튜닝 흐름은 만들지 않는다.
          → 지시06: 개발 편의로 한시 허용, 출시 전 정리(출시 전 확인사항 §5).
          스위치는 `ALLOW_MANUAL_SPEED_WHILE_RIDING` 한 곳(false = 종전 Go 전에만).
          센서 연결(cadence) 중에는 노출하지 않는다 — 진실은 케이던스다.
        */}
        {!cadenceMode && (!props.riding || ALLOW_MANUAL_SPEED_WHILE_RIDING) ? (
          <div className="cadence-sheet__speed">
            <span className="cadence-sheet__speed-label">센서 없이 달리기 · 순위 제외</span>
            <SessionSpeedControl
              speedKmh={props.manualSpeedKmh}
              onSpeedKmh={props.onManualSpeedKmh}
            />
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { cadenceRpmToVirtualSpeedKmh, type RideInputMode } from "../../lib/cadenceRideInput";
import {
  cadenceSensorStatusLine,
  rideInputBlockedReason,
  type BleCrankRpmUiState,
  type RideInputReadiness,
} from "../../lib/cadenceSensorUi";
import { SessionSpeedControl } from "./SessionSpeedControl";
import "./CadenceSensorSheet.css";

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
  /** 「체험 속도로 준비」·「체험 속도로 전환」 — 항상 사용자의 명시적 선택 */
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
  const ready = props.readiness === "manual-ready" || props.readiness === "cadence-ready";
  const manualReady = props.readiness === "manual-ready";
  const blockedReason = rideInputBlockedReason(props.readiness);

  return (
    <div className="cadence-sheet" role="dialog" aria-label="케이던스 센서">
      <button
        type="button"
        className="cadence-sheet__scrim"
        aria-label="닫기"
        title="Close"
        onClick={onClose}
      />
      <div className="cadence-sheet__panel">
        <div className="cadence-sheet__handle" aria-hidden />
        <h2 className="cadence-sheet__title">케이던스 센서</h2>

        <p className="cadence-sheet__status">{cadenceSensorStatusLine(props)}</p>
        {props.deviceLabel ? (
          <p className="cadence-sheet__device">{props.deviceLabel}</p>
        ) : null}
        {rpm ? <p className="cadence-sheet__rpm">{rpm}</p> : null}

        <p className="cadence-sheet__mode">
          현재 입력: <strong>{cadenceMode ? "센서 속도" : "체험 속도"}</strong>
          {props.readiness === "cadence-awaiting-sample" ? " · 페달 확인 대기" : null}
          {props.readiness === "choice-required" ? " · 준비 필요" : null}
          {ready ? " · 주행 준비됨" : null}
        </p>

        {/* Go 가 잠긴 이유는 실제로 해소할 수 있는 이 자리에서만 말한다(RouteDock 에 두지 않는다) */}
        {blockedReason ? (
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
              className="cadence-sheet__btn cadence-sheet__btn--primary"
              title="Connect cadence sensor"
              onClick={props.onConnect}
            >
              {props.uiState === "idle" ? "센서 검색" : "다시 연결"}
            </button>
          ) : null}

          {connected ? (
            <button
              type="button"
              className="cadence-sheet__btn"
              title="Disconnect sensor"
              onClick={props.onDisconnect}
            >
              연결 해제
            </button>
          ) : null}

          {connected && !cadenceMode ? (
            <button
              type="button"
              className="cadence-sheet__btn cadence-sheet__btn--primary"
              title="Switch to cadence speed"
              onClick={props.onChooseCadence}
            >
              센서 속도로 전환
            </button>
          ) : null}

          {/* 단절 중에도 남는다 — 자동 fallback 은 없고 오직 사용자의 명시적 선택뿐이다 */}
          <button
            type="button"
            className={`cadence-sheet__btn${
              !cadenceMode && !manualReady ? " cadence-sheet__btn--primary" : ""
            }${manualReady ? " cadence-sheet__btn--on" : ""}`}
            aria-pressed={manualReady}
            title="Use manual speed"
            onClick={props.onChooseManual}
          >
            {cadenceMode ? "체험 속도로 전환" : "체험 속도로 준비"}
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

        {/* 체험 속도는 Go 전에 여기서 정한다 — 주행 중 재튜닝 흐름은 만들지 않는다 */}
        {!cadenceMode && !props.riding ? (
          <div className="cadence-sheet__speed">
            <SessionSpeedControl
              speedKmh={props.manualSpeedKmh}
              onSpeedKmh={props.onManualSpeedKmh}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

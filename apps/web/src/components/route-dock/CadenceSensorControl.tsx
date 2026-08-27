import type { BleCrankRpmUiState } from "../../hooks/useBleCrankRpm";
import { cadenceRpmToVirtualSpeedKmh, type RideInputMode } from "../../lib/cadenceRideInput";

export type CadenceSensorControlProps = {
  /** `navigator.bluetooth` 사용 가능 여부 */
  capable: boolean;
  uiState: BleCrankRpmUiState;
  deviceLabel: string | null;
  /** `null`=유효 샘플 없음 · `0`=페달 정지 · `>0`=유효 케이던스 */
  crankRpm: number | null;
  errorMessage: string | null;
  mode: RideInputMode;
  onConnect: () => void;
  /** 명시적 manual 복귀 — 센서 단절이 자동으로 이걸 부르면 안 된다 */
  onSwitchToManual: () => void;
  onSwitchToCadence: () => void;
  disabled?: boolean;
};

function statusLine(props: CadenceSensorControlProps): string {
  const device = props.deviceLabel?.trim() || "케이던스 센서";
  switch (props.uiState) {
    case "connecting":
      return "연결 중…";
    case "connected": {
      if (props.crankRpm == null) return `${device} · 연결됨 · 페달을 돌려 확인하세요`;
      if (props.crankRpm <= 0) return `${device} · 페달 정지 · 0 km/h`;
      const kmh = cadenceRpmToVirtualSpeedKmh(props.crankRpm);
      return `${device} · ${Math.round(props.crankRpm)} rpm · 가상 ${Math.round(kmh)} km/h`;
    }
    case "disconnected":
      return `${device} · 연결 끊김`;
    case "error":
      return `${device} · 연결 실패`;
    default:
      return "케이던스 센서로 달리기";
  }
}

/**
 * 주행 전·중 케이던스 센서 연결과 입력 모드 전환 — 사용자 본류(RouteDock)에 노출한다.
 * 상세 연결 상태·연결 해제는 주행 설정 시트가 보조로 제공한다.
 */
export function CadenceSensorControl(props: CadenceSensorControlProps) {
  if (!props.capable) {
    return (
      <div className="route-dock__sensor" aria-label="케이던스 센서">
        <p className="route-dock__sensor-help">
          이 브라우저는 케이던스 센서를 지원하지 않습니다 — Chrome·Edge, HTTPS 또는 localhost
        </p>
      </div>
    );
  }

  const connected = props.uiState === "connected";
  const cadenceActive = props.mode === "cadence";

  return (
    <div className="route-dock__sensor" aria-label="케이던스 센서">
      <div className="route-dock__sensor-row">
        <span className="route-dock__sensor-kicker">CAD</span>
        <span
          className={`route-dock__sensor-status${
            props.uiState === "disconnected" || props.uiState === "error"
              ? " route-dock__sensor-status--warn"
              : ""
          }`}
        >
          {statusLine(props)}
        </span>
        {props.uiState === "connecting" ? (
          <span className="route-dock__sensor-help">연결 중…</span>
        ) : (
          <span className="route-dock__sensor-actions">
            {!connected ? (
              <button
                type="button"
                className="route-dock__sensor-btn route-dock__sensor-btn--primary"
                aria-label={props.uiState === "disconnected" ? "다시 연결" : "센서 연결"}
                title="Connect cadence sensor"
                disabled={props.disabled}
                onClick={props.onConnect}
              >
                {props.uiState === "disconnected" ? "다시 연결" : "센서 연결"}
              </button>
            ) : null}
            {connected && !cadenceActive ? (
              <button
                type="button"
                className="route-dock__sensor-btn route-dock__sensor-btn--primary"
                aria-label="센서 속도로 전환"
                title="Switch to cadence speed"
                disabled={props.disabled}
                onClick={props.onSwitchToCadence}
              >
                센서 속도로 전환
              </button>
            ) : null}
            {/* 단절 중에도 남는다 — manual 복귀는 오직 사용자의 명시적 선택이다. */}
            {cadenceActive ? (
              <button
                type="button"
                className="route-dock__sensor-btn"
                aria-label="체험 속도로 전환"
                title="Switch to manual speed"
                disabled={props.disabled}
                onClick={props.onSwitchToManual}
              >
                체험 속도로 전환
              </button>
            ) : null}
          </span>
        )}
      </div>
      {props.errorMessage ? (
        <p className="route-dock__sensor-error" role="alert">
          {props.errorMessage}
        </p>
      ) : null}
      {cadenceActive && props.uiState !== "connected" ? (
        <p className="route-dock__sensor-help">
          센서가 연결될 때까지 전진하지 않습니다 — 슬라이더로 달리려면 「체험 속도로 전환」.
        </p>
      ) : null}
    </div>
  );
}

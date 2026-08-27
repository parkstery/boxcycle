import type { BleCrankRpmUiState } from "../../hooks/useBleCrankRpm";
import { cadenceRpmToVirtualSpeedKmh, type RideInputMode } from "../../lib/cadenceRideInput";
import "./RideSettingsSheet.css";

export type RideSettingsBle = {
  uiState: BleCrankRpmUiState;
  crankRpm: number | null;
  deviceLabel: string | null;
  errorMessage: string | null;
  /** 현재 주행 입력 모드 — 센서 단절이 이 값을 바꾸지 않는다 */
  mode: RideInputMode;
  onConnect: () => void | Promise<void>;
  onDisconnect: () => void;
  onSwitchToManual: () => void;
  onSwitchToCadence: () => void;
};

export type RideSettingsPanelProps = {
  rideTtsEnabled: boolean;
  onRideTtsEnabled: (enabled: boolean) => void;
  rideBgmEnabled: boolean;
  onRideBgmEnabled: (enabled: boolean) => void;
  rideCoachingBanner: boolean;
  onRideCoachingBanner: (enabled: boolean) => void;
  rideBgmCatalogConfigured: boolean;
  rideElevationProfileLoading: boolean;
  bleCadence?: RideSettingsBle;
  /** 계정 시트 등에 임베드 */
  embedded?: boolean;
};

/** BLE·TTS·BGM 등 주행 설정 본문 */
export function RideSettingsPanel(props: RideSettingsPanelProps) {
  const rootClass = props.embedded
    ? "ride-settings-panel ride-settings-panel--embedded"
    : "ride-settings-panel";

  return (
    <div className={rootClass}>
      <div className="ride-settings-sheet__group" aria-label="화면 표시">
        <span className="ride-settings-sheet__kicker">표시</span>
        <div className="ride-settings-sheet__toggles">
          <label className="ride-settings-sheet__toggle" title="Coaching banner">
            <input
              type="checkbox"
              checked={props.rideCoachingBanner}
              onChange={(e) => props.onRideCoachingBanner(e.target.checked)}
            />
            코칭 배너
          </label>
          <label className="ride-settings-sheet__toggle" title="Text-to-speech">
            <input
              type="checkbox"
              checked={props.rideTtsEnabled}
              onChange={(e) => props.onRideTtsEnabled(e.target.checked)}
            />
            TTS
          </label>
          <label
            className="ride-settings-sheet__toggle"
            title={!props.rideBgmCatalogConfigured ? "BGM not configured" : "Background music"}
          >
            <input
              type="checkbox"
              checked={props.rideBgmEnabled}
              disabled={!props.rideBgmCatalogConfigured}
              onChange={(e) => props.onRideBgmEnabled(e.target.checked)}
            />
            BGM
          </label>
        </div>
        {props.rideElevationProfileLoading ? (
          <p className="ride-settings-sheet__help">고도 프로필 로드 중…</p>
        ) : null}
      </div>

      {props.bleCadence ? (
        <div className="ride-settings-sheet__group" aria-label="케이던스 센서">
          <span className="ride-settings-sheet__kicker">케이던스 센서 (Bluetooth)</span>
          {props.bleCadence.deviceLabel ? (
            <p className="ride-settings-sheet__device">
              <strong>{props.bleCadence.deviceLabel}</strong>
              {props.bleCadence.uiState === "connected" ? (
                props.bleCadence.crankRpm == null ? (
                  <> · 연결됨 · 페달을 돌려 확인하세요</>
                ) : props.bleCadence.crankRpm <= 0 ? (
                  <> · 페달 정지 · 0 km/h</>
                ) : (
                  <>
                    {" · "}
                    {Math.round(props.bleCadence.crankRpm)} rpm · 가상{" "}
                    {Math.round(cadenceRpmToVirtualSpeedKmh(props.bleCadence.crankRpm))} km/h
                  </>
                )
              ) : props.bleCadence.uiState === "disconnected" ? (
                <> · 연결 끊김</>
              ) : null}
            </p>
          ) : null}
          <p className="ride-settings-sheet__help">
            Chrome/Edge · HTTPS 또는 localhost에서 CSC 케이던스 센서를 연결합니다. 센서 모드에서는
            페달을 돌린 만큼만 전진합니다.
          </p>
          <div className="ride-settings-sheet__row">
            {props.bleCadence.uiState === "connecting" ? (
              <span className="ride-settings-sheet__help">연결 중…</span>
            ) : props.bleCadence.uiState === "connected" ? (
              <button
                type="button"
                className="ride-settings-sheet__btn"
                title="Disconnect sensor"
                onClick={props.bleCadence.onDisconnect}
              >
                연결 해제
              </button>
            ) : (
              <button
                type="button"
                className="ride-settings-sheet__btn ride-settings-sheet__btn--primary"
                title="Connect sensor"
                onClick={() => void props.bleCadence?.onConnect()}
              >
                {props.bleCadence.uiState === "disconnected" ? "다시 연결" : "센서 연결"}
              </button>
            )}
            {/* manual 복귀는 오직 여기(또는 RouteDock)의 명시적 선택으로만 일어난다 */}
            {props.bleCadence.mode === "cadence" ? (
              <button
                type="button"
                className="ride-settings-sheet__btn"
                title="Switch to manual speed"
                onClick={props.bleCadence.onSwitchToManual}
              >
                체험 속도로 전환
              </button>
            ) : props.bleCadence.uiState === "connected" ? (
              <button
                type="button"
                className="ride-settings-sheet__btn"
                title="Switch to cadence speed"
                onClick={props.bleCadence.onSwitchToCadence}
              >
                센서 속도로 전환
              </button>
            ) : null}
          </div>
          {props.bleCadence.errorMessage ? (
            <p className="ride-settings-sheet__error" role="alert">
              {props.bleCadence.errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

import type { BleCrankRpmUiState } from "../../hooks/useBleCrankRpm";
import "./RideSettingsSheet.css";

export type RideSettingsBle = {
  uiState: BleCrankRpmUiState;
  crankRpm: number | null;
  deviceLabel: string | null;
  errorMessage: string | null;
  onConnect: () => void | Promise<void>;
  onDisconnect: () => void;
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
        <div className="ride-settings-sheet__group" aria-label="RPM 센서">
          <span className="ride-settings-sheet__kicker">RPM (Bluetooth)</span>
          {props.bleCadence.deviceLabel ? (
            <p className="ride-settings-sheet__device">
              <strong>{props.bleCadence.deviceLabel}</strong>
              {props.bleCadence.crankRpm != null ? (
                <> · {Math.round(props.bleCadence.crankRpm)} rpm</>
              ) : null}
            </p>
          ) : null}
          <p className="ride-settings-sheet__help">
            Chrome/Edge · HTTPS 또는 localhost에서 CSC 센서를 연결합니다.
          </p>
          <div className="ride-settings-sheet__row">
            {props.bleCadence.uiState === "connected" ? (
              <button
                type="button"
                className="ride-settings-sheet__btn"
                title="Disconnect sensor"
                onClick={props.bleCadence.onDisconnect}
              >
                연결 해제
              </button>
            ) : props.bleCadence.uiState === "connecting" ? (
              <span className="ride-settings-sheet__help">연결 중…</span>
            ) : (
              <button
                type="button"
                className="ride-settings-sheet__btn ride-settings-sheet__btn--primary"
                title="Connect sensor"
                onClick={() => void props.bleCadence?.onConnect()}
              >
                센서 연결
              </button>
            )}
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

import { useEffect } from "react";
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

type RideSettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  rideTtsEnabled: boolean;
  onRideTtsEnabled: (enabled: boolean) => void;
  rideBgmEnabled: boolean;
  onRideBgmEnabled: (enabled: boolean) => void;
  rideCoachingBanner: boolean;
  onRideCoachingBanner: (enabled: boolean) => void;
  rideBgmCatalogConfigured: boolean;
  rideElevationProfileLoading: boolean;
  bleCadence?: RideSettingsBle;
};

/** 주행·표시·센서 설정 — MENU 와 분리된 하단 시트. */
export function RideSettingsSheet(props: RideSettingsSheetProps) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div className="ride-settings-sheet" role="dialog" aria-label="주행 설정">
      <button
        type="button"
        className="ride-settings-sheet__scrim"
        aria-label="닫기"
        title="Close"
        onClick={props.onClose}
      />
      <div className="ride-settings-sheet__panel">
        <div className="ride-settings-sheet__handle" aria-hidden />
        <h2 className="ride-settings-sheet__title">주행 설정</h2>

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
    </div>
  );
}

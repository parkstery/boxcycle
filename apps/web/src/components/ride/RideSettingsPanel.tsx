import "./RideSettingsSheet.css";

export type RideSettingsPanelProps = {
  rideTtsEnabled: boolean;
  onRideTtsEnabled: (enabled: boolean) => void;
  rideBgmEnabled: boolean;
  onRideBgmEnabled: (enabled: boolean) => void;
  rideCoachingBanner: boolean;
  onRideCoachingBanner: (enabled: boolean) => void;
  rideBgmCatalogConfigured: boolean;
  rideElevationProfileLoading: boolean;
  /** 계정 시트 등에 임베드 */
  embedded?: boolean;
};

/** TTS·BGM·코칭 배너 등 주행 설정 본문. 케이던스 센서는 HUD 센서 칩 → 센서 상세 설정이 소유한다. */
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

    </div>
  );
}

import "./RideSettingsSheet.css";

export type RideSettingsPanelProps = {
  rideTtsEnabled: boolean;
  onRideTtsEnabled: (enabled: boolean) => void;
  rideBgmEnabled: boolean;
  onRideBgmEnabled: (enabled: boolean) => void;
  rideCoachingBanner: boolean;
  onRideCoachingBanner: (enabled: boolean) => void;
  pacerEnabled: boolean;
  onPacerEnabled: (enabled: boolean) => void;
  rideBgmCatalogConfigured: boolean;
  rideElevationProfileLoading: boolean;
  /** 계정 시트 등에 임베드 */
  embedded?: boolean;
  rideMomentSoundEnabled?: boolean;
  onRideMomentSoundEnabled?: (enabled: boolean) => void;
};

type ToggleCell = {
  name: string;
  value: boolean;
  change: (enabled: boolean) => void;
  disabled?: boolean;
  description?: string;
};

/** 주행 중 표시 선택. 체중·체력은 사용자 정보의 프로필 수정이 소유한다(Chief 10-30: 여기서 칼로리 줄 제거). */
export function RideSettingsPanel(props: RideSettingsPanelProps) {
  const cells: Array<ToggleCell | null> = [
    { name: "코칭 문구", value: props.rideCoachingBanner, change: props.onRideCoachingBanner, description: "주행 중 화면 아래에 짧게 보여요" },
    { name: "페이서", value: props.pacerEnabled, change: props.onPacerEnabled },
    { name: "음성 안내", value: props.rideTtsEnabled, change: props.onRideTtsEnabled },
    props.onRideMomentSoundEnabled
      ? { name: "효과음", value: props.rideMomentSoundEnabled ?? false, change: props.onRideMomentSoundEnabled, description: "짧은 신호만, 기본은 꺼짐" }
      : null,
    { name: "배경 음악", value: props.rideBgmEnabled, change: props.onRideBgmEnabled, disabled: !props.rideBgmCatalogConfigured, description: props.rideBgmCatalogConfigured ? undefined : "배경 음악을 준비 중이에요" },
    null,
  ];
  return (
    <div className={`ride-settings-panel${props.embedded ? " ride-settings-panel--embedded" : ""}`}>
      <div className="ride-settings-panel__choices" role="group" aria-label="화면 표시">
        {cells.map((toggle, index) => toggle ? (
          <label key={toggle.name} className="ride-settings-panel__choice">
            <span className="ride-settings-panel__copy">
              <span>{toggle.name}{toggle.disabled ? <small> 준비 중</small> : null}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={toggle.value}
              disabled={toggle.disabled}
              aria-label={toggle.name}
              aria-description={toggle.description}
              onChange={event => toggle.change(event.target.checked)}
            />
          </label>
        ) : <span key={`empty-${index}`} className="ride-settings-panel__choice-spacer" aria-hidden />)}
      </div>
      {props.rideElevationProfileLoading ? <p className="ride-settings-sheet__help">고도 프로필 로드 중…</p> : null}
    </div>
  );
}

import { CALORIE_INTENSITY_OPTIONS, type CalorieIntensityId } from "../../lib/ride/caloriesEstimate";
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
  /** 추정 kcal용 체중(kg). null = 미설정 */
  calorieWeightKg?: number | null;
  /** 저장 성공 여부. false 면 draft 를 prop 으로 되돌림 */
  onCalorieWeightKg?: (raw: string) => boolean | void;
  calorieIntensityId?: CalorieIntensityId | null;
  onCalorieIntensityId?: (id: CalorieIntensityId) => boolean | void;
  onEditProfile?: () => void;
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

/** 주행 중 표시 선택. 체중·체력 편집은 프로필이 소유한다(Chief 승인 묶음4). */
export function RideSettingsPanel(props: RideSettingsPanelProps) {
  const intensity = CALORIE_INTENSITY_OPTIONS.find(option => option.id === props.calorieIntensityId);
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
      <div className="ride-settings-panel__calories">
        <div className="ride-settings-panel__copy"><span>칼로리 계산</span>
          <small>{props.calorieWeightKg != null ? `체중 ${props.calorieWeightKg} kg` : "프로필에 체중을 입력하세요"}{intensity ? ` · 체력 ${intensity.label}` : " · 체력을 선택하세요"}</small>
        </div>
        {props.onEditProfile ? <button type="button" className="ride-settings-panel__profile" onClick={props.onEditProfile}>프로필 수정</button> : null}
      </div>
      {props.rideElevationProfileLoading ? <p className="ride-settings-sheet__help">고도 프로필 로드 중…</p> : null}
    </div>
  );
}

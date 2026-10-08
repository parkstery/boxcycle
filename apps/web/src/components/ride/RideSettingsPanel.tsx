import { useState } from "react";
import {
  CALORIE_INTENSITY_OPTIONS,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  parseWeightKg,
  type CalorieIntensityId,
} from "../../lib/ride/caloriesEstimate";
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
  /** 계정 시트 등에 임베드 */
  embedded?: boolean;
};

/** TTS·BGM·코칭 배너 등 주행 설정 본문. 케이던스 센서는 HUD 센서 칩 → 센서 상세 설정이 소유한다. */
export function RideSettingsPanel(props: RideSettingsPanelProps) {
  const rootClass = props.embedded
    ? "ride-settings-panel ride-settings-panel--embedded"
    : "ride-settings-panel";
  const showCalorie =
    typeof props.onCalorieWeightKg === "function" &&
    typeof props.onCalorieIntensityId === "function";
  const [weightDraft, setWeightDraft] = useState(
    props.calorieWeightKg != null ? String(props.calorieWeightKg) : "",
  );
  // prop 체중 변경 시 draft 동기화 — effect setState 금지(react-hooks/set-state-in-effect)
  const [syncedWeightKg, setSyncedWeightKg] = useState(props.calorieWeightKg);
  if (props.calorieWeightKg !== syncedWeightKg) {
    setSyncedWeightKg(props.calorieWeightKg);
    setWeightDraft(props.calorieWeightKg != null ? String(props.calorieWeightKg) : "");
  }

  const revertWeightDraft = () => {
    setWeightDraft(props.calorieWeightKg != null ? String(props.calorieWeightKg) : "");
  };

  return (
    <div className={rootClass}>
      {showCalorie ? (
        <div className="ride-settings-sheet__group" aria-label="추정 칼로리">
          <span className="ride-settings-sheet__kicker">추정 kcal</span>
          <div className="ride-settings-sheet__calorie-row">
            <label className="ride-settings-sheet__weight" title="Body weight">
              <span>체중(kg)</span>
              <input
                type="number"
                inputMode="decimal"
                min={WEIGHT_KG_MIN}
                max={WEIGHT_KG_MAX}
                step={1}
                placeholder={`${WEIGHT_KG_MIN}–${WEIGHT_KG_MAX}`}
                value={weightDraft}
                onChange={(e) => {
                  const raw = e.target.value;
                  setWeightDraft(raw);
                  // 빈 칸·범위 밖은 확정 null. 입력 중(예: 7→70)은 draft만 유지.
                  if (raw.trim() === "") {
                    const ok = props.onCalorieWeightKg?.("");
                    if (ok === false) revertWeightDraft();
                    return;
                  }
                  if (parseWeightKg(raw) != null) {
                    const ok = props.onCalorieWeightKg?.(raw);
                    if (ok === false) revertWeightDraft();
                  }
                }}
                onBlur={() => {
                  const parsed = parseWeightKg(weightDraft);
                  if (parsed == null && weightDraft.trim() !== "") {
                    revertWeightDraft();
                  } else if (parsed != null) {
                    setWeightDraft(String(parsed));
                    const ok = props.onCalorieWeightKg?.(String(parsed));
                    if (ok === false) revertWeightDraft();
                  }
                }}
              />
            </label>
            <div className="ride-settings-sheet__chips" role="group" aria-label="강도">
              {CALORIE_INTENSITY_OPTIONS.map((opt) => {
                const active = props.calorieIntensityId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`ride-settings-sheet__chip${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    title={opt.label}
                    onClick={() => {
                      props.onCalorieIntensityId?.(opt.id);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="ride-settings-sheet__help">
            페달이 도는 시간과 선택 강도로 추정합니다. 체중·강도가 없으면 —. 센서 없으면
            측정 안 함. 주행 중 변경은 다음 주행부터.
          </p>
        </div>
      ) : null}

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
          <label className="ride-settings-sheet__toggle" title="Pacer riders">
            <input
              type="checkbox"
              checked={props.pacerEnabled}
              onChange={(e) => props.onPacerEnabled(e.target.checked)}
            />
            페이서
          </label>
        </div>
        {props.rideElevationProfileLoading ? (
          <p className="ride-settings-sheet__help">고도 프로필 로드 중…</p>
        ) : null}
      </div>

    </div>
  );
}

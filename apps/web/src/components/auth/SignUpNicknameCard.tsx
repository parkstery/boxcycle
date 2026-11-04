import { useState, type FormEvent } from "react";
import { isValidNickname, NICKNAME_CASE_FOLD_HINT_KO, NICKNAME_MAX_LENGTH, NICKNAME_RULES_SUMMARY_KO } from "../../lib/identity/nickname";
import {
  CALORIE_INTENSITY_OPTIONS,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  parseWeightKg,
  type CalorieIntensityId,
} from "../../lib/ride/caloriesEstimate";
import { guessHomeCountryFromDevice } from "../../lib/identity/homeCountry";
import { HomeCountrySelect } from "./HomeCountrySelect";
import "./SignUpNicknameCard.css";

/** 가입 시 한 번 받는 칼로리 프로필 — 비워 두면 null(나중에 주행 설정에서) */
export type SignUpCalorieInput = {
  weightKg: number | null;
  intensityId: CalorieIntensityId | null;
};

type SignUpNicknameCardProps = {
  busy: boolean;
  /** 익명 시절 이미 넣은 값이 있으면 미리 채운다 */
  initialWeightKg?: number | null;
  initialIntensityId?: CalorieIntensityId | null;
  /** 대표 국가(ISO 2글자) — 필수. 기기 시간대로 미리 채운다 */
  onSubmit: (nickname: string, calorie: SignUpCalorieInput, homeCountry: string) => void | Promise<void>;
};

export function SignUpNicknameCard({
  busy,
  initialWeightKg = null,
  initialIntensityId = null,
  onSubmit,
}: SignUpNicknameCardProps) {
  const [value, setValue] = useState("");
  const [weightDraft, setWeightDraft] = useState(initialWeightKg != null ? String(initialWeightKg) : "");
  const [intensityId, setIntensityId] = useState<CalorieIntensityId | null>(initialIntensityId);
  const [homeCountry, setHomeCountry] = useState<string | null>(() => guessHomeCountryFromDevice());
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!isValidNickname(trimmed)) {
      setLocalError(NICKNAME_RULES_SUMMARY_KO);
      return;
    }
    const weightKg = parseWeightKg(weightDraft);
    if (weightKg == null && weightDraft.trim() !== "") {
      setLocalError(`체중은 ${WEIGHT_KG_MIN}–${WEIGHT_KG_MAX}kg 사이로 입력해 주세요.`);
      return;
    }
    if (homeCountry == null) {
      setLocalError("국가를 골라 주세요.");
      return;
    }
    setLocalError(null);
    await onSubmit(trimmed, { weightKg, intensityId }, homeCountry);
  }

  return (
    <section className="signup-nickname" aria-label="닉네임 설정">
      <h2 className="signup-nickname__title">회원가입 마무리</h2>
      <p className="signup-nickname__lead">
        사용할 <strong>닉네임</strong>을 입력해 주세요.
      </p>
      <p className="signup-nickname__rules">{NICKNAME_RULES_SUMMARY_KO}</p>
      <p className="signup-nickname__rules signup-nickname__rules--meta">{NICKNAME_CASE_FOLD_HINT_KO}</p>
      <form className="signup-nickname__form" noValidate onSubmit={(ev) => void handleSubmit(ev)}>
        {/* Chief 11-04 A안: 닉네임과 국가를 한 줄에 — 줄을 늘려 지도를 더 가리지 않게 */}
        <div className="signup-nickname__pair">
          <label className="signup-nickname__cell" htmlFor="signup-nickname-input">
            <span className="signup-nickname__label">닉네임</span>
            <input
              id="signup-nickname-input"
              className="signup-nickname__input"
              type="text"
              name="nickname"
              autoComplete="username"
              spellCheck={false}
              maxLength={NICKNAME_MAX_LENGTH}
              value={value}
              disabled={busy}
              onChange={(ev) => {
                setValue(ev.target.value);
                setLocalError(null);
              }}
              placeholder="예: rider42"
            />
          </label>
          <label className="signup-nickname__cell" htmlFor="signup-country-select">
            <span className="signup-nickname__label">국가</span>
            <HomeCountrySelect
              id="signup-country-select"
              className="signup-nickname__input signup-nickname__select"
              value={homeCountry}
              disabled={busy}
              onChange={(code) => {
                setHomeCountry(code);
                setLocalError(null);
              }}
            />
          </label>
          <p className="signup-nickname__rules signup-nickname__rules--meta signup-nickname__pair-help">
            국가: 지역 순위 기준 · 30일에 한 번 변경
          </p>
        </div>
        <fieldset className="signup-nickname__calorie" disabled={busy}>
          <legend className="signup-nickname__label">칼로리 계산용 (선택)</legend>
          <label className="signup-nickname__weight">
            <span>체중(kg)</span>
            <input
              className="signup-nickname__input"
              type="number"
              inputMode="decimal"
              name="weightKg"
              min={WEIGHT_KG_MIN}
              max={WEIGHT_KG_MAX}
              step="0.1"
              placeholder={`${WEIGHT_KG_MIN}–${WEIGHT_KG_MAX}`}
              value={weightDraft}
              onChange={(ev) => {
                setWeightDraft(ev.target.value);
                setLocalError(null);
              }}
            />
          </label>
          {/* 체력 1~5(Chief 10-26) — 운동 강도를 고르는 것이 아니라 내 체력 수준 */}
          <div className="signup-nickname__weight">
          <span>체력</span>
          <span aria-hidden="true">약함</span>
          <div className="signup-nickname__chips" role="group" aria-label="체력 1 약함 ~ 5 강함">
            {CALORIE_INTENSITY_OPTIONS.map((opt) => {
              const active = intensityId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`signup-nickname__chip${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  aria-label={`체력 ${opt.label}`}
                  title={`체력 ${opt.label}`}
                  onClick={() => setIntensityId(active ? null : opt.id)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <span aria-hidden="true">강함</span>
          </div>
          <p className="signup-nickname__rules signup-nickname__rules--meta">
            본인만 볼 수 있고 다른 기기에서도 이어 씁니다. 나중에 주행 설정에서 바꿀 수 있습니다.
          </p>
        </fieldset>
        {localError ? (
          <p className="signup-nickname__err" role="alert">
            {localError}
          </p>
        ) : null}
        <button
          type="submit"
          className="btn primary signup-nickname__submit"
          disabled={busy}
          title="Save nickname"
        >
          {busy ? "저장 중…" : "가입 완료"}
        </button>
      </form>
    </section>
  );
}

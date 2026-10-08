import { useState, type FormEvent } from "react";
import { isValidNickname, NICKNAME_CASE_FOLD_HINT_KO, NICKNAME_RULES_SUMMARY_KO } from "../../lib/identity/nickname";
import {
  CALORIE_INTENSITY_OPTIONS,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  parseWeightKg,
  type CalorieIntensityId,
} from "../../lib/ride/caloriesEstimate";
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
  onSubmit: (nickname: string, calorie: SignUpCalorieInput) => void | Promise<void>;
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
    setLocalError(null);
    await onSubmit(trimmed, { weightKg, intensityId });
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
        <label className="signup-nickname__label" htmlFor="signup-nickname-input">
          닉네임
        </label>
        <input
          id="signup-nickname-input"
          className="signup-nickname__input"
          type="text"
          name="nickname"
          autoComplete="username"
          spellCheck={false}
          maxLength={12}
          value={value}
          disabled={busy}
          onChange={(ev) => {
            setValue(ev.target.value);
            setLocalError(null);
          }}
          placeholder="예: rider42"
        />
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
          <div className="signup-nickname__chips" role="group" aria-label="평소 운동 강도">
            {CALORIE_INTENSITY_OPTIONS.map((opt) => {
              const active = intensityId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`signup-nickname__chip${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  title={opt.label}
                  onClick={() => setIntensityId(active ? null : opt.id)}
                >
                  {opt.label}
                </button>
              );
            })}
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

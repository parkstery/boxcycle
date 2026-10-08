import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import {
  CALORIE_INTENSITY_OPTIONS,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  parseWeightKg,
  type CalorieIntensityId,
} from "../lib/ride/caloriesEstimate";
import { isValidNickname, NICKNAME_RULES_SUMMARY_KO } from "../lib/identity/nickname";
import "./ride/RideSettingsSheet.css";
import "./ProfileEditSheet.css";

type ProfileEditSheetProps = {
  open: boolean;
  onClose: () => void;
  user: User | null;
  weightKg: number | null;
  intensityId: CalorieIntensityId | null;
  /** 실패 시 throw — 메시지를 시트에 보여 준다 */
  onChangeNickname: (nickname: string) => Promise<void>;
  onWeightKg: (raw: string) => boolean | void;
  onIntensityId: (id: CalorieIntensityId | null) => boolean | void;
};

/**
 * 프로필 수정 — 닉네임(정식 계정만)·체중·강도. 2026-10-08 Chief.
 * 체중·강도는 본인 전용 서버 문서로 기기 간 동기화된다(useCalorieProfile).
 */
export function ProfileEditSheet(props: ProfileEditSheetProps) {
  if (!props.open || !props.user) return null;
  // 열 때마다 현재 값으로 새로 시작한다(닫힌 동안 바뀐 값·이전 오류가 남지 않게)
  return <ProfileEditForm {...props} user={props.user} />;
}

function ProfileEditForm(props: ProfileEditSheetProps & { user: User }) {
  const { onClose } = props;
  const isGuest = props.user.isAnonymous;
  const currentNickname = props.user.displayName?.trim() ?? "";
  const [nickname, setNickname] = useState(currentNickname);
  const [weightDraft, setWeightDraft] = useState(props.weightKg != null ? String(props.weightKg) : "");
  const [intensityId, setIntensityId] = useState<CalorieIntensityId | null>(props.intensityId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextNickname = nickname.trim();
    const nicknameChanged = !isGuest && nextNickname !== currentNickname;
    if (nicknameChanged && !isValidNickname(nextNickname)) {
      setError(NICKNAME_RULES_SUMMARY_KO);
      return;
    }
    const weightKg = parseWeightKg(weightDraft);
    if (weightKg == null && weightDraft.trim() !== "") {
      setError(`체중은 ${WEIGHT_KG_MIN}–${WEIGHT_KG_MAX}kg 사이로 입력해 주세요.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (nicknameChanged) await props.onChangeNickname(nextNickname);
      if (weightKg !== props.weightKg) props.onWeightKg(weightKg == null ? "" : String(weightKg));
      if (intensityId !== props.intensityId) props.onIntensityId(intensityId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ride-settings-sheet profile-edit-sheet" role="dialog" aria-label="프로필 수정">
      <button
        type="button"
        className="ride-settings-sheet__scrim"
        aria-label="닫기"
        title="Close"
        disabled={saving}
        onClick={onClose}
      />
      <form className="ride-settings-sheet__panel" noValidate onSubmit={(ev) => void handleSubmit(ev)}>
        <div className="ride-settings-sheet__handle" aria-hidden />
        <h2 className="ride-settings-sheet__title">프로필 수정</h2>

        <div className="ride-settings-sheet__group">
          <span className="ride-settings-sheet__kicker">닉네임</span>
          {isGuest ? (
            <p className="ride-settings-sheet__help">
              게스트는 닉네임이 없습니다. Google 연결 후 정할 수 있습니다.
            </p>
          ) : (
            <>
              <input
                className="profile-edit-sheet__input"
                type="text"
                aria-label="닉네임"
                autoComplete="username"
                spellCheck={false}
                maxLength={12}
                value={nickname}
                disabled={saving}
                onChange={(ev) => {
                  setNickname(ev.target.value);
                  setError(null);
                }}
              />
              <p className="ride-settings-sheet__help">{NICKNAME_RULES_SUMMARY_KO}</p>
            </>
          )}
        </div>

        <div className="ride-settings-sheet__group">
          <span className="ride-settings-sheet__kicker">칼로리 계산</span>
          <div className="ride-settings-sheet__calorie-row">
            <label className="ride-settings-sheet__weight">
              <span>체중(kg)</span>
              <input
                type="number"
                inputMode="decimal"
                min={WEIGHT_KG_MIN}
                max={WEIGHT_KG_MAX}
                step="0.1"
                placeholder={`${WEIGHT_KG_MIN}–${WEIGHT_KG_MAX}`}
                value={weightDraft}
                disabled={saving}
                onChange={(ev) => {
                  setWeightDraft(ev.target.value);
                  setError(null);
                }}
              />
            </label>
            <div className="ride-settings-sheet__chips" role="group" aria-label="평소 운동 강도">
              {CALORIE_INTENSITY_OPTIONS.map((opt) => {
                const active = intensityId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`ride-settings-sheet__chip${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    title={opt.label}
                    disabled={saving}
                    onClick={() => setIntensityId(active ? null : opt.id)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="ride-settings-sheet__help">본인만 볼 수 있고 다른 기기에서도 이어 씁니다.</p>
        </div>

        {error ? (
          <p className="ride-settings-sheet__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ride-settings-sheet__row profile-edit-sheet__actions">
          <button type="button" className="ride-settings-sheet__btn" disabled={saving} onClick={onClose}>
            취소
          </button>
          <button
            type="submit"
            className="ride-settings-sheet__btn ride-settings-sheet__btn--primary"
            disabled={saving}
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

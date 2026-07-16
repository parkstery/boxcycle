import { useState, type FormEvent } from "react";
import { isValidNickname, NICKNAME_CASE_FOLD_HINT_KO, NICKNAME_RULES_SUMMARY_KO } from "../../lib/nickname";
import "./SignUpNicknameCard.css";

type SignUpNicknameCardProps = {
  busy: boolean;
  onSubmit: (nickname: string) => void | Promise<void>;
};

export function SignUpNicknameCard({ busy, onSubmit }: SignUpNicknameCardProps) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!isValidNickname(trimmed)) {
      setLocalError(NICKNAME_RULES_SUMMARY_KO);
      return;
    }
    setLocalError(null);
    await onSubmit(trimmed);
  }

  return (
    <section className="signup-nickname" aria-label="닉네임 설정">
      <h2 className="signup-nickname__title">회원가입 마무리</h2>
      <p className="signup-nickname__lead">
        사용할 <strong>닉네임</strong>을 입력해 주세요.
      </p>
      <p className="signup-nickname__rules">{NICKNAME_RULES_SUMMARY_KO}</p>
      <p className="signup-nickname__rules signup-nickname__rules--meta">{NICKNAME_CASE_FOLD_HINT_KO}</p>
      <form className="signup-nickname__form" onSubmit={(ev) => void handleSubmit(ev)}>
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

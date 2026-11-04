import { useState } from "react";
import type { User } from "firebase/auth";
import { guessHomeCountryFromDevice } from "../../lib/identity/homeCountry";
import { saveHomeCountry } from "../../lib/identity/repo/firestoreUser";
import { AuthGateCard } from "./AuthGateCard";
import { HomeCountrySelect } from "./HomeCountrySelect";
import "./SignUpNicknameCard.css";

/**
 * 국가가 없는 기존 Google 사용자에게 한 번 묻는다(Chief 11-03 D15, 11-04 A안 승인).
 * 기기 시간대로 미리 골라 두어 대개 「확인」 한 번이면 끝난다. 저장되면 users 구독이 국가를 받아 카드가 사라진다.
 */
export function HomeCountryConfirmCard({ user }: { user: User }) {
  const [code, setCode] = useState<string | null>(() => guessHomeCountryFromDevice());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    if (code == null) {
      setErr("국가를 골라 주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await saveHomeCountry(user, code, null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <AuthGateCard title="국가 확인">
      <form
        className="signup-nickname__form home-country-confirm"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void confirm();
        }}
      >
        <HomeCountrySelect
          className="signup-nickname__input signup-nickname__select"
          value={code}
          disabled={busy}
          onChange={(next) => {
            setCode(next);
            setErr(null);
          }}
        />
        <p className="signup-nickname__rules signup-nickname__rules--meta home-country-confirm__help">
          지역 순위 기준 · 30일에 한 번 변경
        </p>
        {err ? (
          <p className="signup-nickname__err" role="alert">
            {err}
          </p>
        ) : null}
        <button type="submit" className="btn primary signup-nickname__submit" disabled={busy} title="Confirm country">
          {busy ? "저장 중…" : "확인"}
        </button>
      </form>
    </AuthGateCard>
  );
}

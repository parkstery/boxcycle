import { AuthGoogleMark } from "./AuthGateCard";
import "./GuestEntryCard.css";

type GuestEntryCardProps = {
  busy: boolean;
  error: string | null;
  onStartGuest: () => void;
  onGoogleSignIn: () => void;
};

/**
 * 최초 진입 — 임시 라이더(익명 인증) 안내 후 세계 참가.
 * [tier 정책 §3.2](document/260519-사용자-tier-및-진입-정책.md)
 */
export function GuestEntryCard({ busy, error, onStartGuest, onGoogleSignIn }: GuestEntryCardProps) {
  return (
    <div className="guest-entry" role="dialog" aria-modal="true" aria-label="시작">
      <div className="guest-entry__card">
        <div className="guest-entry__brand">
          <span className="guest-entry__brand-dot" aria-hidden />
          BOXCYCLE
        </div>
        <h2 className="guest-entry__title">세계에 참가하기</h2>
        <p className="guest-entry__lead">
          임시 라이더 ID를 만들어 지도에서 입문·퍼블릭 코스를 주행할 수 있습니다. 나중에 Google
          계정과 닉네임으로 전환해 경로를 클라우드에 저장하고 퍼블릭 신청을 할 수 있습니다.
        </p>
        <div className="guest-entry__actions">
          <button type="button" className="btn primary" disabled={busy} onClick={onStartGuest}>
            {busy ? "연결 중…" : "시작"}
          </button>
          <button
            type="button"
            className="btn secondary guest-entry__google"
            disabled={busy}
            title="Sign in with Google"
            onClick={onGoogleSignIn}
          >
            <AuthGoogleMark />
            Google로 시작
          </button>
        </div>
        {error ? <p className="error tight">{error}</p> : null}
      </div>
    </div>
  );
}

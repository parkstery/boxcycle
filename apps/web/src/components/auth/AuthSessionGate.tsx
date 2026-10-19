import { AuthGateCard, AuthGoogleMark } from "./AuthGateCard";

export type AuthSessionGateProps = {
  configured: boolean;
  authInitialized: boolean;
  authSigningIn: boolean;
  userSignedOut: boolean;
  authOffline?: boolean;
  busy: boolean;
  error: string | null;
  onStartGuest: () => void;
  onGoogleSignIn: () => void;
  onRetryAuth?: () => void;
};

/**
 * `stage === "gate" && !needsGuestEntry` 전용 표현.
 * 설정 없음 → 부트·서명·busy 대기 → 복원 전 오프라인 재시도 → 오류 설명 + 로그인/게스트로 시작 → 같은 두 버튼의 idle.
 * 대기는 실패 문구와 선택 버튼을 그리지 않고, 남아 있는 error 도 숨긴다.
 * 구글 창이 열렸는지는 별도 신호가 없어 대기 문구를 그것과 구분하지 않는다.
 */
export function AuthSessionGate({
  configured,
  authInitialized,
  authSigningIn,
  userSignedOut,
  authOffline = false,
  busy,
  error,
  onStartGuest,
  onGoogleSignIn,
  onRetryAuth,
}: AuthSessionGateProps) {
  const pending = configured && (!authInitialized || authSigningIn || busy);

  return (
    <AuthGateCard>
      {!configured ? (
        <p className="meta tight">Firebase 설정 필요</p>
      ) : pending ? (
        <p className="meta tight" role="status">
          {authSigningIn || busy ? "로그인 중…" : "연결 중…"}
        </p>
      ) : authOffline ? (
        <>
          <p className="meta tight" role="status">
            연결을 확인하지 못했습니다.
          </p>
          <button type="button" className="btn primary" disabled={busy} onClick={onRetryAuth}>
            재시도
          </button>
        </>
      ) : error && !userSignedOut ? (
        <>
          <p className="meta tight">서비스에 연결할 수 없습니다.</p>
          <p className="error tight">{error}</p>
          <div className="auth-actions auth-actions--gate">
            <button
              type="button"
              className="btn auth-gate-google"
              disabled={busy}
              title="Sign in with Google"
              onClick={onGoogleSignIn}
            >
              <AuthGoogleMark />
              로그인
            </button>
            <button type="button" className="btn secondary" disabled={busy} onClick={onStartGuest}>
              {busy ? "…" : "게스트로 시작"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="meta tight">시작 방법을 선택해 주세요.</p>
          <div className="auth-actions auth-actions--gate">
            <button
              type="button"
              className="btn auth-gate-google"
              disabled={busy}
              title="Sign in with Google"
              onClick={onGoogleSignIn}
            >
              <AuthGoogleMark />
              로그인
            </button>
            <button type="button" className="btn secondary" disabled={busy} onClick={onStartGuest}>
              {busy ? "…" : "게스트로 시작"}
            </button>
          </div>
        </>
      )}
      {!pending && error && (userSignedOut || !configured) ? (
        <p className="error tight">{error}</p>
      ) : null}
    </AuthGateCard>
  );
}

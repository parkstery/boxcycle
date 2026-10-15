import { AuthGateCard, AuthGoogleMark } from "./AuthGateCard";

export type AuthSessionGateProps = {
  configured: boolean;
  authInitialized: boolean;
  authSigningIn: boolean;
  userSignedOut: boolean;
  busy: boolean;
  error: string | null;
  onStartGuest: () => void;
  onGoogleSignIn: () => void;
};

/**
 * `stage === "gate" && !needsGuestEntry` 전용 표현.
 * 설정 없음 → 부트·서명·busy 대기 → 명시 로그아웃 → 실제 error → 선택 idle.
 * 대기는 실패 문구와 선택·재시도 버튼을 그리지 않고, 남아 있는 error 도 숨긴다.
 * 구글 창이 열렸는지는 별도 신호가 없어 대기 문구를 그것과 구분하지 않는다.
 */
export function AuthSessionGate({
  configured,
  authInitialized,
  authSigningIn,
  userSignedOut,
  busy,
  error,
  onStartGuest,
  onGoogleSignIn,
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
      ) : userSignedOut ? (
        <>
          {/*
            로그아웃 후(2026-10-09 Chief) — 등록이 주 행동이다. 종전 주 버튼 「다시 시작」 은 누르면 **새**
            게스트를 만든다는 것이 드러나지 않아, 로그아웃한 사람에게 원치 않은 게스트가 생겼다.
          */}
          <p className="meta tight">로그아웃되었습니다.</p>
          <p className="meta tight">Google로 로그인하면 내 도로망과 주행 기록이 계속 쌓입니다.</p>
          <div className="auth-actions auth-actions--gate">
            <button
              type="button"
              className="btn auth-gate-google"
              disabled={busy}
              title="Sign in with Google"
              onClick={onGoogleSignIn}
            >
              <AuthGoogleMark />
              Google로 로그인
            </button>
            <button type="button" className="btn secondary" disabled={busy} onClick={onStartGuest}>
              {busy ? "…" : "게스트로 새로 시작"}
            </button>
          </div>
          <p className="meta tight">새 게스트는 이전 게스트의 기록을 이어받지 않습니다.</p>
        </>
      ) : error ? (
        <>
          <p className="meta tight">서비스에 연결할 수 없습니다.</p>
          <p className="error tight">{error}</p>
          <div className="auth-actions auth-actions--gate">
            <button type="button" className="btn primary" disabled={busy} onClick={onStartGuest}>
              {busy ? "…" : "다시 시도"}
            </button>
            <button
              type="button"
              className="btn auth-gate-google"
              disabled={busy}
              title="Sign in with Google"
              onClick={onGoogleSignIn}
            >
              <AuthGoogleMark />
              Google로 로그인
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
              Google로 로그인
            </button>
            <button type="button" className="btn secondary" disabled={busy} onClick={onStartGuest}>
              {busy ? "…" : "게스트로 새로 시작"}
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

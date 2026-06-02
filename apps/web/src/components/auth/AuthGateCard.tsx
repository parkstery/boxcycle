import type { ReactNode } from "react";
import "./AuthGateCard.css";

/** Google 로그인 버튼용 마크(앱 UI 한정; 실제 OAuth 화면은 구글 호스트) */
export function AuthGoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "auth-gate-google-mark"}
      width={16}
      height={16}
      viewBox="0 0 48 48"
      aria-hidden
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.95-2.26 5.48-4.78 7.18l7.73 6C43.42 37.65 46.98 31.76 46.98 24.55z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type AuthGateCardProps = {
  title?: string;
  children: ReactNode;
  /** 있으면 카드 우상단에 닫기(X) 버튼 표시 */
  onDismiss?: () => void;
  dismissDisabled?: boolean;
};

/**
 * 인증/닉네임 단계 전용 풀스크린 오버레이.
 * - 맵 위 모든 다른 UI(메뉴/아바타 등)는 숨기고 이 카드만 노출.
 */
export function AuthGateCard({
  title,
  children,
  onDismiss,
  dismissDisabled,
}: AuthGateCardProps) {
  return (
    <div className="auth-gate" role="dialog" aria-modal="true" aria-label="인증">
      <div className="auth-gate__card">
        <div className="auth-gate__topbar">
          <div className="auth-gate__brand">
            <span className="auth-gate__brand-dot" aria-hidden />
            RTW Pro
          </div>
          {onDismiss ? (
            <button
              type="button"
              className="auth-gate__close"
              aria-label="닫기"
              title="Close"
              disabled={dismissDisabled}
              onClick={onDismiss}
            >
              <span aria-hidden>×</span>
            </button>
          ) : null}
        </div>
        {title ? <h2 className="auth-gate__title">{title}</h2> : null}
        <div className="auth-gate__body">{children}</div>
      </div>
    </div>
  );
}

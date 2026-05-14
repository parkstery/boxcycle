import type { ReactNode } from "react";
import "./AuthGateCard.css";

type AuthGateCardProps = {
  title?: string;
  children: ReactNode;
};

/**
 * 인증/닉네임 단계 전용 풀스크린 오버레이.
 * - 맵 위 모든 다른 UI(메뉴/아바타 등)는 숨기고 이 카드만 노출.
 */
export function AuthGateCard({ title, children }: AuthGateCardProps) {
  return (
    <div className="auth-gate" role="dialog" aria-modal="true" aria-label="인증">
      <div className="auth-gate__card">
        <div className="auth-gate__brand">
          <span className="auth-gate__brand-dot" aria-hidden />
          BOXCYCLE
        </div>
        {title ? <h2 className="auth-gate__title">{title}</h2> : null}
        <div className="auth-gate__body">{children}</div>
      </div>
    </div>
  );
}

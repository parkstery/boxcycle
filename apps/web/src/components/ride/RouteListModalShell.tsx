import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import "./OfficialCourseListModal.css";

export type RouteListModalShellProps = {
  /** 제목 요소의 id — 각 모달이 다른 값을 쓴다(둘이 같으면 셀렉터가 서로를 집는다) */
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * 경로 목록 모달의 공용 껍데기 — 오버레이 · 제목 행 · 스크롤 본문.
 *
 * 2026-09-16(B단계): 「내 경로」가 공식 코스와 같은 급의 모달을 갖게 되면서
 * `OfficialCourseListModal` 이 혼자 들고 있던 껍데기를 여기로 뺐다.
 * 스타일은 종전 `oc-modal*` 를 그대로 쓴다 — 두 모달이 같은 옷을 입어야
 * 「경로를 고르는 자리」로 읽힌다.
 */
export function RouteListModalShell(props: RouteListModalShellProps) {
  return createPortal(
    <div className="oc-modal-overlay" role="presentation" onMouseDown={() => props.onClose()}>
      <div
        className="oc-modal"
        role="dialog"
        aria-labelledby={props.titleId}
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="oc-modal__head">
          <h2 id={props.titleId} className="oc-modal__title">
            {props.title}
          </h2>
          <button
            type="button"
            className="oc-modal__close"
            aria-label="닫기"
            title="닫기"
            onClick={() => props.onClose()}
          >
            닫기
          </button>
        </div>
        <div className="oc-modal__body">{props.children}</div>
      </div>
    </div>,
    document.body,
  );
}

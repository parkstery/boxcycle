import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import "./OfficialCourseListModal.css";

export type RouteListModalShellProps = {
  /** 제목 요소의 id — 각 모달이 다른 값을 쓴다(둘이 같으면 셀렉터가 서로를 집는다) */
  titleId: string;
  /** 제목 칩에 보이는 짧은 이름(입문 · 퍼블릭 · 내 경로) */
  title: string;
  /** 대화상자 접근성 이름 — 짧은 칩 대신 온전한 이름(「입문 경로」 등)을 읽힌다 */
  dialogLabel: string;
  /** 제목 줄 검색 — 값·변경 핸들러는 목록을 거르는 쪽이 소유한다 */
  searchValue: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  children: ReactNode;
};

/**
 * 경로 목록 모달의 공용 껍데기 — 오버레이 · 제목 줄 · 스크롤 본문.
 *
 * 2026-09-16(B단계): 「내 경로」가 공식 코스와 같은 급의 모달을 갖게 되면서
 * `OfficialCourseListModal` 이 혼자 들고 있던 껍데기를 여기로 뺐다.
 * 스타일은 종전 `oc-modal*` 를 그대로 쓴다 — 두 모달이 같은 옷을 입어야
 * 「경로를 고르는 자리」로 읽힌다.
 *
 * 2026-10-06(Chief): 제목 줄 한 줄에 [제목 칩][검색][X] 를 담는다. 종전에는 제목 줄이
 * 제목과 「닫기」만 들고 있었고 검색은 본문 첫 줄을 따로 먹었다(내 경로), 입문·퍼블릭은
 * 검색이 아예 없었다. 닫기는 글자 대신 X 로 우상단 구석에 붙여 검색 폭을 최대로 준다.
 * 닫기 버튼의 접근성 이름(「닫기」)과 대화상자 이름(「입문 경로」 등)은 그대로 — e2e 계약.
 */
export function RouteListModalShell(props: RouteListModalShellProps) {
  return createPortal(
    <div className="oc-modal-overlay" role="presentation" onMouseDown={() => props.onClose()}>
      <div
        className="oc-modal"
        role="dialog"
        aria-label={props.dialogLabel}
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="oc-modal__head">
          <h2 id={props.titleId} className="oc-modal__title">
            {props.title}
          </h2>
          <input
            type="search"
            className="oc-modal__search"
            value={props.searchValue}
            placeholder="경로 이름 검색"
            aria-label="경로 이름 검색"
            onChange={(e) => props.onSearchChange(e.target.value)}
          />
          <button
            type="button"
            className="oc-modal__close"
            aria-label="닫기"
            title="닫기"
            onClick={() => props.onClose()}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="oc-modal__body">{props.children}</div>
      </div>
    </div>,
    document.body,
  );
}

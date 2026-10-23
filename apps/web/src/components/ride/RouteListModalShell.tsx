import { createPortal } from "react-dom";
import { useEffect, useRef, type ReactNode } from "react";
import { useDialogFocus } from "../ui/useDialogFocus";
import "./OfficialCourseListModal.css";

export type RouteListSource = "intro" | "public" | "saved";

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
  /** 한 모달 안에서 입문/퍼블릭/내 경로를 전환할 때 */
  sourceNav?: ReactNode;
  /** 공용 경로 목록 패널의 넓은 map 레이아웃 vs 기존 좁은 sheet 레이아웃 */
  appearance?: "sheet" | "map";
  /** map 모드 헤더 한 줄 오른쪽(정렬 등) */
  headTools?: ReactNode;
  /** map 모드 하단 안내 */
  footerHint?: ReactNode;
};

const SOURCE_ITEMS: { id: RouteListSource; label: string }[] = [
  { id: "intro", label: "입문" },
  { id: "public", label: "퍼블릭" },
  { id: "saved", label: "내 경로" },
];

export function RouteListSourceNav(props: {
  current: RouteListSource;
  onSelect: (source: RouteListSource) => void;
}) {
  return (
    <div className="oc-modal__sources" role="navigation" aria-label="경로 출처">
      {SOURCE_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`oc-modal__source${props.current === item.id ? " is-active" : ""}`}
          aria-current={props.current === item.id ? "page" : undefined}
          aria-pressed={props.current === item.id}
          onClick={() => props.onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 경로 목록 모달의 공용 껍데기 — 오버레이 · 제목 줄 · 스크롤 본문.
 */
export function RouteListModalShell(props: RouteListModalShellProps) {
  const { onClose } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const appearance = props.appearance ?? "map";
  const isMap = appearance === "map";
  useDialogFocus(true, panelRef);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className={`oc-modal-overlay${isMap ? " oc-modal-overlay--map" : ""}`}
      role="presentation"
      onMouseDown={() => props.onClose()}
    >
      <div
        ref={panelRef}
        className={`oc-modal${isMap ? " oc-modal--map" : ""}`}
        role="dialog"
        aria-label={props.dialogLabel}
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`oc-modal__head${isMap ? " oc-modal__head--map" : ""}`}>
          {isMap ? (
            <>
              <h2 id={props.titleId} className="oc-modal__title oc-modal__title--slot">
                {props.title}
              </h2>
              {props.sourceNav}
              <label className="oc-modal__search-wrap">
                <svg
                  className="oc-modal__search-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M10.5 10.5L14 14"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  type="search"
                  className="oc-modal__search oc-modal__search--map"
                  value={props.searchValue}
                  placeholder="경로 이름으로 찾기"
                  aria-label="경로 이름 검색"
                  onChange={(e) => props.onSearchChange(e.target.value)}
                />
              </label>
              {props.headTools}
              <button
                type="button"
                className="oc-modal__close oc-modal__close--map"
                aria-label="닫기"
                title="닫기"
                onClick={() => props.onClose()}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M3 3l10 10M13 3L3 13"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </>
          ) : (
            <>
              <h2
                id={props.titleId}
                className={`oc-modal__title${props.sourceNav ? " oc-modal__title--slot" : ""}`}
              >
                {props.title}
              </h2>
              {props.sourceNav}
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
            </>
          )}
        </div>
        <div className={`oc-modal__body${isMap ? " oc-modal__body--map" : ""}`}>
          {props.children}
          {isMap && props.footerHint ? (
            <p className="oc-modal__map-footer">{props.footerHint}</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

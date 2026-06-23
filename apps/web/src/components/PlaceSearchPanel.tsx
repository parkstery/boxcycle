import { useEffect, type ReactNode } from "react";
import "./PlaceSearchPanel.css";

type PlaceSearchPanelProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** 좌상단 Route menu 옆 버튼 — 지명 검색 전용 플로팅 패널 */
export function PlaceSearchPanel({ open, onClose, children }: PlaceSearchPanelProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="place-search-panel-root" role="presentation">
      <button
        type="button"
        className="place-search-panel__scrim"
        aria-label="지명 검색 닫기"
        title="Close place search"
        onClick={onClose}
      />
      <aside className="place-search-panel" role="dialog" aria-label="지명 검색">
        <div className="place-search-panel__head">
          <h2 className="place-search-panel__title">지명 검색</h2>
          <button
            type="button"
            className="place-search-panel__close"
            onClick={onClose}
            aria-label="지명 검색 닫기"
            title="Close"
          >
            ×
          </button>
        </div>
        <div className="place-search-panel__body">{children}</div>
      </aside>
    </div>
  );
}

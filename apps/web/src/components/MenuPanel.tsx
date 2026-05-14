import { useEffect, type ReactNode } from "react";
import "./MenuPanel.css";

type MenuPanelProps = {
  open: boolean;
  onClose: () => void;
  /** 라이딩·일시정지 단계에서는 메뉴 자체를 열 수 없도록 강제 닫기 */
  locked?: boolean;
  children: ReactNode;
};

/**
 * 좌측에서 슬라이드 인 하는 글래스 드로어.
 * - 라이딩 중 잠금: `locked` 가 true 면 마운트되어 있어도 자동으로 닫힘.
 */
export function MenuPanel({ open, onClose, locked, children }: MenuPanelProps) {
  useEffect(() => {
    if (locked && open) onClose();
  }, [locked, open, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`menu-panel-root${open ? " is-open" : ""}`} aria-hidden={!open}>
      <button
        type="button"
        className="menu-panel__scrim"
        aria-label="메뉴 닫기"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside className="menu-panel" role="dialog" aria-label="메뉴">
        <div className="menu-panel__head">
          <h2 className="menu-panel__title">MENU</h2>
          <button
            type="button"
            className="menu-panel__close"
            onClick={onClose}
            aria-label="메뉴 닫기"
          >
            ×
          </button>
        </div>
        <div className="menu-panel__body">{children}</div>
      </aside>
    </div>
  );
}

import { useEffect, type ReactNode } from "react";
import "./MenuPanel.css";

type MenuPanelProps = {
  open: boolean;
  onClose: () => void;
  /** @deprecated 주행 중 자동 닫기는 사용하지 않음 — 하위 호환용만 유지 */
  locked?: boolean;
  /** 주행 설정 시트( BLE·TTS 등 ) */
  onOpenSettings?: () => void;
  children: ReactNode;
};

/**
 * 좌측에서 슬라이드 인 하는 글래스 드로어.
 */
export function MenuPanel({ open, onClose, locked: _locked, onOpenSettings, children }: MenuPanelProps) {
  void _locked;

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
        title="Close menu"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside className="menu-panel" role="dialog" aria-label="메뉴">
        <div className="menu-panel__head">
          <h2 className="menu-panel__title">MENU</h2>
          <div className="menu-panel__head-actions">
            {onOpenSettings ? (
              <button
                type="button"
                className="menu-panel__settings"
                onClick={onOpenSettings}
                aria-label="주행 설정"
                title="BLE·TTS·BGM 등"
              >
                설정
              </button>
            ) : null}
            <button
              type="button"
              className="menu-panel__close"
              onClick={onClose}
              aria-label="메뉴 닫기"
              title="Close menu"
            >
              ×
            </button>
          </div>
        </div>
        <div className="menu-panel__body">{children}</div>
      </aside>
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDialogFocus } from "./ui/useDialogFocus";
import { usePanelHeaderCloseDrag } from "./ui/usePanelHeaderCloseDrag";
import "./MenuPanel.css";

type MenuPanelProps = {
  open: boolean;
  onClose: () => void;
  /** @deprecated 주행 중 자동 닫기는 사용하지 않음 — 하위 호환용만 유지 */
  locked?: boolean;
  /** 주행 설정 시트( BLE·TTS 등 ) */
  onOpenSettings?: () => void;
  /** 지명 검색 패널 — 헤더 행에 칩으로 산다(전폭 행은 한 줄을 통째로 낭비했다) */
  onOpenPlaceSearch?: () => void;
  children: ReactNode;
  revealProgress?: number | null;
};

/**
 * 좌측에서 슬라이드 인 하는 글래스 드로어.
 */
export function MenuPanel({
  open,
  onClose,
  locked: _locked,
  onOpenSettings,
  onOpenPlaceSearch,
  children,
  revealProgress = null,
}: MenuPanelProps) {
  void _locked;
  const panelRef = useRef<HTMLElement>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [headerReveal, setHeaderReveal] = useState<number | null>(null);
  useDialogFocus(open && !overlayOpen, panelRef);
  const headerDrag = usePanelHeaderCloseDrag({
    enabled: open && !overlayOpen,
    closeDir: -1,
    onProgress: setHeaderReveal,
    onClose,
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.querySelector(".oc-modal-overlay")) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open && overlayOpen) setOverlayOpen(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const check = () => {
      if (!cancelled) setOverlayOpen(Boolean(document.querySelector(".oc-modal-overlay")));
    };
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true });
    const frame = requestAnimationFrame(check);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      mo.disconnect();
    };
  }, [open]);

  const dragging = revealProgress != null || headerReveal != null;
  const reveal = headerReveal ?? (open ? (revealProgress ?? 1) : (revealProgress ?? 0));
  const inert = !open || overlayOpen;

  return (
    <div
      className={`menu-panel-root${open ? " is-open" : ""}${dragging ? " is-dragging" : ""}${overlayOpen ? " has-list-modal" : ""}`}
      aria-hidden={inert}
      {...(inert ? { inert: true } : {})}
      style={{ ["--menu-reveal" as string]: reveal }}
    >
      <button
        type="button"
        className="menu-panel__scrim"
        aria-label="메뉴 닫기"
        title="Close menu"
        onClick={onClose}
        tabIndex={open && !overlayOpen ? 0 : -1}
      />
      <aside
        ref={panelRef}
        id="menu-panel"
        className="menu-panel"
        role="dialog"
        aria-label="메뉴"
      >
        <div className="menu-panel__head" {...headerDrag}>
          <div className="menu-panel__head-brand">
            <span className="menu-panel__brand-dot" aria-hidden />
            <span className="menu-panel__brand">SPINATLAS</span>
            <h2 className="menu-panel__title">MENU</h2>
          </div>
          <div className="menu-panel__head-actions">
            {onOpenPlaceSearch ? (
              <button
                type="button"
                className="menu-panel__place-search"
                onClick={onOpenPlaceSearch}
                aria-label="지명 검색"
                title="지명으로 찾기"
              >
                <span className="menu-panel__place-search-icon" aria-hidden>
                  ⌕
                </span>
                지명
              </button>
            ) : null}
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
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>
        <div className="menu-panel__body">{children}</div>
      </aside>
    </div>
  );
}

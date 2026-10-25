import { useEffect, useRef, useState, type ReactNode } from "react";
import { SpinatlasMark } from "./brand/SpinatlasMark";
import { useDialogFocus } from "./ui/useDialogFocus";
import { usePanelHeaderCloseDrag } from "./ui/usePanelHeaderCloseDrag";
import "./MenuPanel.css";

type MenuPanelProps = {
  open: boolean;
  onClose: () => void;
  /** @deprecated 주행 중 자동 닫기는 사용하지 않음 — 하위 호환용만 유지 */
  locked?: boolean;
  children: ReactNode;
  revealProgress?: number | null;
};

/**
 * 좌측 흰 판 메뉴(시안 06) — 경로 6행은 RideRoutePanel, Trail 목록은 TrailHubPanel.
 */
export function MenuPanel({
  open,
  onClose,
  locked: _locked,
  children,
  revealProgress = null,
}: MenuPanelProps) {
  void _locked;
  const panelRef = useRef<HTMLElement>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [headerReveal, setHeaderReveal] = useState<number | null>(null);
  const entryFocusRef = useRef<HTMLElement | null>(null);
  // 목록을 열고 닫을 때 포커스 트랩이 재개돼도, 메뉴를 연 원래 버튼은 보존한다.
  useEffect(() => {
    if (open) {
      entryFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return;
    }
    const origin = entryFocusRef.current;
    if (!origin) return;
    const frame = requestAnimationFrame(() => { if (document.contains(origin)) origin.focus(); });
    return () => cancelAnimationFrame(frame);
  }, [open]);
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
        <header className="menu-panel__head" {...headerDrag}>
          <div className="menu-panel__head-brand">
            <span className="menu-panel__brand-mark" aria-hidden="true">
              <SpinatlasMark className="menu-panel__brand-svg" />
            </span>
            <span className="menu-panel__brand">Spinatlas</span>
          </div>
          <button
            type="button"
            className="menu-panel__close"
            onClick={onClose}
            aria-label="메뉴 닫기"
            title="Close menu"
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
        </header>
        <div className="menu-panel__body">{children}</div>
      </aside>
    </div>
  );
}

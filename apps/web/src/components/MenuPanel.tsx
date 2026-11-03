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
  onOpenPlaceSearch?: () => void;
  /** 지도 핀 — 경로 목록 창(기본 「내 경로」). 주행 전에만 준다(Chief 11-02 v4, RouteDock 에서 옮김). */
  onOpenRouteList?: () => void;
  /** ⚙ — 주행 설정 창(Chief 11-02 v4, RouteDock 에서 옮김). */
  onOpenSettings?: () => void;
  /** 센서 상세 설정 창(Chief 11-03 「센서 메뉴를 메인메뉴 안에」 — 계기판 RPM 칸과 같은 창). */
  onOpenSensor?: () => void;
  /** 센서 실제 연결 — 아이콘의 점을 초록으로(계기판 LED 와 같은 두 의미: 초록=연결, 흰색=그 밖). */
  sensorConnected?: boolean;
  /** 센서 짧은 상태(「연결됨」 등) — 툴팁에만 */
  sensorStatus?: string;
};

/**
 * 좌측 흰 판 메뉴(시안 06) — 경로 6행은 RideRoutePanel, Trail 목록은 TrailHubPanel.
 */
function MenuPinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-5.8-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </svg>
  );
}

function MenuGearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M10.11 4.12L10.34 1.53A10.6 10.6 0 0 1 13.66 1.53L13.89 4.12A8.1 8.1 0 0 1 16.23 5.09L18.23 3.42A10.6 10.6 0 0 1 20.58 5.77L18.91 7.77A8.1 8.1 0 0 1 19.88 10.11L22.47 10.34A10.6 10.6 0 0 1 22.47 13.66L19.88 13.89A8.1 8.1 0 0 1 18.91 16.23L20.58 18.23A10.6 10.6 0 0 1 18.23 20.58L16.23 18.91A8.1 8.1 0 0 1 13.89 19.88L13.66 22.47A10.6 10.6 0 0 1 10.34 22.47L10.11 19.88A8.1 8.1 0 0 1 7.77 18.91L5.77 20.58A10.6 10.6 0 0 1 3.42 18.23L5.09 16.23A8.1 8.1 0 0 1 4.12 13.89L1.53 13.66A10.6 10.6 0 0 1 1.53 10.34L4.12 10.11A8.1 8.1 0 0 1 5.09 7.77L3.42 5.77A10.6 10.6 0 0 1 5.77 3.42L7.77 5.09A8.1 8.1 0 0 1 10.11 4.12ZM12 8.7a3.3 3.3 0 1 0 0 6.6a3.3 3.3 0 1 0 0 -6.6Z" />
    </svg>
  );
}

/** 크랭크(체인링·크랭크 팔·페달) + 오른쪽 위 상태 점 */
function MenuSensorIcon({ connected }: { connected: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10" cy="13" r="5.2" stroke="currentColor" strokeWidth="2" />
      <circle cx="10" cy="13" r="1.4" fill="currentColor" />
      <path d="M10 13l6.2 5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14.6 20.2h3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle
        className={`menu-panel__sensor-led${connected ? " is-connected" : ""}`}
        cx="18.6"
        cy="5.4"
        r="3.4"
      />
    </svg>
  );
}

function MenuSearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MenuPanel({
  open,
  onClose,
  locked: _locked,
  children,
  revealProgress = null,
  onOpenPlaceSearch,
  onOpenRouteList,
  onOpenSettings,
  onOpenSensor,
  sensorConnected = false,
  sensorStatus,
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
        title="메뉴 닫기"
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
            {onOpenPlaceSearch ? (
              <button
                type="button"
                className="menu-panel__search"
                onClick={onOpenPlaceSearch}
                aria-label="지명 검색"
                title="지명 검색"
              >
                <MenuSearchIcon />
              </button>
            ) : null}
            {onOpenRouteList ? (
              <button
                type="button"
                className="menu-panel__search menu-panel__routes"
                onClick={onOpenRouteList}
                aria-label="경로 목록"
                title="경로 목록"
              >
                <MenuPinIcon />
              </button>
            ) : null}
            {onOpenSettings ? (
              <button
                type="button"
                className="menu-panel__search menu-panel__settings"
                onClick={onOpenSettings}
                aria-label="주행 설정"
                title="주행 설정"
              >
                <MenuGearIcon />
              </button>
            ) : null}
            {onOpenSensor ? (
              <button
                type="button"
                className="menu-panel__search menu-panel__sensor"
                onClick={onOpenSensor}
                aria-label="센서"
                title={sensorStatus ? `센서 · ${sensorStatus}` : "센서"}
                data-connected={sensorConnected ? "true" : "false"}
              >
                <MenuSensorIcon connected={sensorConnected} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="menu-panel__close"
            onClick={onClose}
            aria-label="메뉴 닫기"
            title="메뉴 닫기"
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

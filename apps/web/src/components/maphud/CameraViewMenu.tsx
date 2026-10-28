import { useEffect, useId, useRef, useState } from "react";
import {
  CAMERA1_MODE_CYCLE,
  CAMERA1_MODE_META,
  type Camera1Mode,
} from "../../lib/camera/camera1Mode";
import { quickCameraMenuAriaLabel, quickCameraMenuLabel } from "../../lib/camera/quickCameraMenuLabels";
import type { QuickCameraSlot } from "../../lib/camera/quickCameraProductTune";
import "./CameraViewMenu.css";

const PERSPECTIVE_SLOTS = [2, 3, 4, 5, 6] as const;
type PerspectiveSlot = (typeof PERSPECTIVE_SLOTS)[number];

export type CameraViewMenuProps = {
  active: QuickCameraSlot | null;
  enable3D?: boolean;
  terrainFallback?: boolean;
  onEnable3D?: (enabled: boolean) => void;
  camera1Mode?: Camera1Mode;
  onSelect: (n: QuickCameraSlot) => void;
  onSelectFlat: (mode: Camera1Mode) => void;
};

function FlatCameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function VideoCameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="camera-view-menu__video-icon">
      <path fill="currentColor" stroke="none" d="M2 5h12v14H2zM16 9l7-4v14l-7-4z" />
    </svg>
  );
}

/** Chief 제공 방향표시.svg 순서: 2 위, 3 아래, 4 오른쪽, 5 왼쪽, 6 오른쪽 아래 대각선. */
function PerspectiveCameraIcon({ slot }: { slot: PerspectiveSlot }) {
  const rotationBySlot: Record<PerspectiveSlot, number> = {
    2: -90,
    3: 90,
    4: 0,
    5: 180,
    6: 40,
  };
  return (
    <svg className="camera-view-menu__direction-icon" viewBox="0 0 32 32" aria-hidden data-camera-direction={slot}>
      <defs>
        <linearGradient id={`camera-arrow-gradient-${slot}`} x1="4" y1="6" x2="27" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5eb8ff" />
          <stop offset="0.48" stopColor="#347dff" />
          <stop offset="1" stopColor="#263ee8" />
        </linearGradient>
        <filter id={`camera-arrow-glow-${slot}`} x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`rotate(${rotationBySlot[slot]} 16 16)`}>
        <path
          className="camera-view-menu__direction-path"
          d="M5 16H25M18 9L25 16L18 23"
          stroke={`url(#camera-arrow-gradient-${slot})`}
          filter={`url(#camera-arrow-glow-${slot})`}
        />
      </g>
    </svg>
  );
}

export function CameraViewMenu({ active, camera1Mode = "routeFit", onSelect, onSelectFlat, enable3D = false, onEnable3D, terrainFallback = false }: CameraViewMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const currentPerspective: PerspectiveSlot =
    active === 2 || active === 3 || active === 4 || active === 5 || active === 6 ? active : 2;
  const triggerLabel = active === 1
    ? quickCameraMenuLabel(1, camera1Mode)
    : String(currentPerspective);
  const triggerAria = `카메라 메뉴 · ${active === 1 ? quickCameraMenuAriaLabel(1, camera1Mode) : quickCameraMenuAriaLabel(currentPerspective, undefined)}`;

  const closeMenu = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu(true);
      }
    };
    const onPointer = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(e.target as Node)) return;
      closeMenu(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  return (
    <div
      className="camera-view-menu"
      ref={rootRef}
      role="group"
      aria-label="Quick Camera"
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        ref={triggerRef}
        className={`camera-view-menu__trigger${active != null ? " is-selected" : ""}`}
        aria-label={triggerAria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-camera1-mode={active === 1 ? camera1Mode : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {active === 1 ? (
          <>
            <span className="camera-view-menu__item-num" aria-hidden>1</span>
            <span className="camera-view-menu__svg"><FlatCameraIcon /></span>
            <span className="camera-view-menu__trigger-label">{triggerLabel}</span>
          </>
        ) : (
          <>
            <span className="camera-view-menu__item-num" aria-hidden>{currentPerspective}</span>
            <span className="camera-view-menu__svg"><VideoCameraIcon /></span>
            <span className="camera-view-menu__svg"><PerspectiveCameraIcon slot={currentPerspective} /></span>
          </>
        )}
        <span className="camera-view-menu__caret" aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="camera-view-menu__panel" id={menuId} role="menu" aria-label="카메라 선택">
          <div className="camera-view-menu__unit camera-view-menu__unit--flat" role="group" aria-label="평면 카메라 높이">
            <div className="camera-view-menu__column-title">1</div>
            <ul className="camera-view-menu__list camera-view-menu__list--flat">
              {CAMERA1_MODE_CYCLE.map((mode) => (
                <li key={mode} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    className={`camera-view-menu__item${active === 1 && camera1Mode === mode ? " is-selected" : ""}`}
                    aria-checked={active === 1 && camera1Mode === mode}
                    aria-label={`평면 카메라 · ${CAMERA1_MODE_META[mode].label}`}
                    onClick={() => {
                      onSelectFlat(mode);
                      closeMenu(true);
                    }}
                  >
                    <span className="camera-view-menu__item-label">{quickCameraMenuLabel(1, mode)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="camera-view-menu__unit camera-view-menu__unit--perspective" role="group" aria-label="시점 카메라">
            <div className="camera-view-menu__column-title">2–6</div>
            <ul className="camera-view-menu__list camera-view-menu__list--perspective">
              {PERSPECTIVE_SLOTS.map((slot) => (
                <li key={slot} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    className={`camera-view-menu__item camera-view-menu__item--icon${active === slot ? " is-selected" : ""}`}
                    data-camera-slot={slot}
                    aria-checked={active === slot}
                    aria-label={quickCameraMenuAriaLabel(slot, undefined)}
                    title={quickCameraMenuAriaLabel(slot, undefined)}
                    onClick={() => {
                      onSelect(slot);
                      closeMenu(true);
                    }}
                  >
                    <span className="camera-view-menu__item-num" aria-hidden>{slot}</span>
                    <span className="camera-view-menu__svg"><PerspectiveCameraIcon slot={slot} /></span>
                  </button>
                </li>
              ))}
              {onEnable3D ? (
                <li role="none" className="camera-view-menu__terrain">
                  <button type="button" role="menuitemcheckbox" aria-checked={enable3D}
                    aria-label={terrainFallback && enable3D ? "3D 뷰 · 자동 2D로 주행 중" : "3D 뷰"}
                    className={`camera-view-menu__item camera-view-menu__item--terrain${enable3D ? " is-selected" : ""}`}
                    onClick={() => onEnable3D(!enable3D)}>
                    <span>3D 뷰</span>
                    <span aria-hidden>{enable3D ? (terrainFallback ? "자동 2D" : "켜짐") : "꺼짐"}</span>
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

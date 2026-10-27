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
type OpenMenu = "flat" | "perspective" | null;

export type CameraViewMenuProps = {
  active: QuickCameraSlot | null;
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

export function CameraViewMenu({ active, camera1Mode = "routeFit", onSelect, onSelectFlat }: CameraViewMenuProps) {
  const [open, setOpen] = useState<OpenMenu>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flatMenuId = useId();
  const perspectiveMenuId = useId();
  const currentPerspective: PerspectiveSlot =
    active === 2 || active === 3 || active === 4 || active === 5 || active === 6 ? active : 2;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(null);
      }
    };
    const onPointer = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(e.target as Node)) return;
      setOpen(null);
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
      <div className="camera-view-menu__unit camera-view-menu__unit--flat">
        <button
          type="button"
          className={`camera-view-menu__trigger${active === 1 ? " is-selected" : ""}`}
          aria-label={`평면 카메라 · ${CAMERA1_MODE_META[camera1Mode].label}`}
          aria-pressed={active === 1}
          data-camera1-mode={camera1Mode}
          aria-haspopup="menu"
          aria-expanded={open === "flat"}
          aria-controls={flatMenuId}
          onClick={() => setOpen((value) => value === "flat" ? null : "flat")}
        >
          <span className="camera-view-menu__svg"><FlatCameraIcon /></span>
          <span className="camera-view-menu__trigger-label">{quickCameraMenuLabel(1, camera1Mode)}</span>
          <span className="camera-view-menu__caret" aria-hidden>▾</span>
        </button>
        {open === "flat" ? (
          <ul className="camera-view-menu__list camera-view-menu__list--flat" id={flatMenuId} role="menu" aria-label="평면 카메라 높이">
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
                    setOpen(null);
                  }}
                >
                  <span className="camera-view-menu__svg"><FlatCameraIcon /></span>
                  <span className="camera-view-menu__item-label">{quickCameraMenuLabel(1, mode)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="camera-view-menu__unit camera-view-menu__unit--perspective">
        <button
          type="button"
          className={`camera-view-menu__trigger camera-view-menu__trigger--perspective${active != null && active >= 2 ? " is-selected" : ""}`}
          aria-label={quickCameraMenuAriaLabel(currentPerspective, undefined)}
          aria-haspopup="menu"
          aria-expanded={open === "perspective"}
          aria-controls={perspectiveMenuId}
          onClick={() => setOpen((value) => value === "perspective" ? null : "perspective")}
        >
          <span className="camera-view-menu__item-num" aria-hidden>{currentPerspective}</span>
          <span className="camera-view-menu__svg"><PerspectiveCameraIcon slot={currentPerspective} /></span>
          <span className="camera-view-menu__caret" aria-hidden>▾</span>
        </button>
        {open === "perspective" ? (
          <ul className="camera-view-menu__list camera-view-menu__list--perspective" id={perspectiveMenuId} role="menu" aria-label="시점 카메라">
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
                    setOpen(null);
                  }}
                >
                  <span className="camera-view-menu__item-num" aria-hidden>{slot}</span>
                  <span className="camera-view-menu__svg"><PerspectiveCameraIcon slot={slot} /></span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

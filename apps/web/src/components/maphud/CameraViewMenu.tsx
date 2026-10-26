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

/** 카메라 위치(작은 사각형)에서 라이더(원)를 바라보는 탑뷰 도안. */
function PerspectiveCameraIcon({ slot }: { slot: PerspectiveSlot }) {
  const cameraBySlot: Record<PerspectiveSlot, { x: number; y: number; tx: number; ty: number }> = {
    2: { x: 10, y: 17, tx: 12, ty: 11 },
    3: { x: 10, y: 3, tx: 12, ty: 10 },
    4: { x: 3, y: 10, tx: 10, ty: 12 },
    5: { x: 17, y: 10, tx: 14, ty: 12 },
    6: { x: 10, y: 17, tx: 12, ty: 11 },
  };
  const c = cameraBySlot[slot];
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="2.5" />
      <path d={`M${c.x + 2} ${c.y + 2}L${c.tx} ${c.ty}`} />
      <rect x={c.x} y={c.y} width="4" height="4" rx="0.8" />
      {slot === 6 ? <path className="camera-view-menu__lock" d="M17 5v-1.2a2 2 0 0 1 4 0V5m-4 0h4v4h-4z" /> : null}
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

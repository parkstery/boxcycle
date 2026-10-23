import { useEffect, useId, useRef, useState } from "react";
import type { Camera1Mode } from "../../lib/camera/camera1Mode";
import {
  quickCameraMenuAriaLabel,
  quickCameraMenuLabel,
} from "../../lib/camera/quickCameraMenuLabels";
import type { QuickCameraSlot } from "../../lib/camera/quickCameraProductTune";
import "./CameraViewMenu.css";

const SLOTS: readonly QuickCameraSlot[] = [1, 2, 3, 4, 5, 6];

export type CameraViewMenuProps = {
  active: QuickCameraSlot | null;
  camera1Mode?: Camera1Mode;
  onSelect: (n: QuickCameraSlot) => void;
};

export function CameraViewMenu({ active, camera1Mode, onSelect }: CameraViewMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const currentSlot = active ?? 2;
  const triggerLabel = quickCameraMenuLabel(currentSlot, camera1Mode);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(e.target as Node)) return;
      setOpen(false);
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
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="camera-view-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="camera-view-menu__trigger-icon" aria-hidden />
        <span className="camera-view-menu__trigger-label">{triggerLabel}</span>
        <span className="camera-view-menu__caret" aria-hidden>▾</span>
      </button>
      {open ? (
        <ul className="camera-view-menu__list" id={menuId} role="menu" aria-label="카메라 시점">
          {SLOTS.map((n) => {
            const selected = active === n;
            const itemLabel = quickCameraMenuLabel(n, n === 1 ? camera1Mode : undefined);
            return (
              <li key={n} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  className={`camera-view-menu__item${selected ? " is-selected" : ""}`}
                  aria-checked={selected}
                  aria-label={quickCameraMenuAriaLabel(n, n === 1 ? camera1Mode : undefined)}
                  onClick={() => {
                    onSelect(n);
                    setOpen(false);
                  }}
                >
                  <span className="camera-view-menu__item-num" aria-hidden>{n}</span>
                  <span className="camera-view-menu__item-label">{itemLabel}</span>
                  {n === 1 && camera1Mode ? (
                    <span className="camera-view-menu__item-hint" aria-hidden>
                      {camera1Mode === "routeFit" ? "R" : camera1Mode === "aerial500" ? "500" : "20"}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

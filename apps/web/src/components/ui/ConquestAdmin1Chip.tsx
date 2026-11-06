import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ListRegionChip.css";

type Item = { code: string; label: string; meters: number };

type Props = {
  /** 고른 행정구역 코드. null = 국가 전체 */
  value: string | null;
  valueLabel: string;
  countryMeters: number;
  items: readonly Item[];
  onPick: (code: string | null) => void;
};

const km = (m: number) => `${(m / 1000).toFixed(1)}km`;

/** 내 도로망 행정구역 칩(Chief 11-06 A안) — 국가 칩 옆. 메뉴: 전체(국가 합계) + 거리 많은 순 행정구역. */
export function ConquestAdmin1Chip({ value, valueLabel, countryMeters, items, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      close();
      btnRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const top = r.bottom + 2;
      setPos({ top, left: Math.max(4, Math.min(r.left, window.innerWidth - 212)), maxHeight: Math.max(80, window.innerHeight - top - 6) });
    }
    setOpen(true);
  };

  const pick = (code: string | null) => {
    onPick(code);
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="list-region-chip list-region-chip--modal"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`행정구역 (현재: ${valueLabel})`}
        onClick={toggle}
      >
        <span className="list-region-chip__label">{valueLabel}</span> ▾
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="list-region-menu"
              role="menu"
              style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight, maxWidth: 208 }}
            >
              <button
                type="button"
                role="menuitemradio"
                aria-checked={value == null}
                className={`list-region-menu__item${value == null ? " is-selected" : ""}`}
                onClick={() => pick(null)}
              >
                {value == null ? "✓ " : ""}전체<span className="list-region-menu__tag">{km(countryMeters)}</span>
              </button>
              {items.map((it) => (
                <button
                  key={it.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={value === it.code}
                  className={`list-region-menu__item${value === it.code ? " is-selected" : ""}`}
                  onClick={() => pick(it.code)}
                >
                  {value === it.code ? "✓ " : ""}
                  {it.label}
                  <span className="list-region-menu__tag">{km(it.meters)}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

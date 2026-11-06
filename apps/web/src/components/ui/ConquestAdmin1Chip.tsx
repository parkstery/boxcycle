import { createPortal } from "react-dom";
import { useAnchoredMenu } from "./useAnchoredMenu";
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
  const { open, pos, btnRef, menuRef, toggle, closeAndFocus } = useAnchoredMenu(212);

  const pick = (code: string | null) => {
    onPick(code);
    closeAndFocus();
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

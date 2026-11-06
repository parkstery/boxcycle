import { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  buildRegionMenu,
  regionLabel,
  type ListRegionKey,
  type RegionGeo,
} from "../../lib/geo/listRegionFilter";
import { useAnchoredMenu } from "./useAnchoredMenu";
import "./ListRegionChip.css";

type Props = {
  region: ListRegionKey;
  recents: readonly ListRegionKey[];
  /** 메뉴에 올릴 대륙·국가를 고르는 근거 — 지금 받아 둔 목록 행의 지역 */
  geos: readonly RegionGeo[];
  homeCountry: string | null;
  onPick: (key: ListRegionKey) => void;
  /** 놓일 자리의 크기·색 — 경로 목록 창 머리줄(modal) / 지도 위 오른쪽 목록 머리줄(glance) */
  variant: "modal" | "glance";
};

/**
 * 목록 머리줄의 지역 범위 칩(Chief 11-06 A안) — 누르면 작은 메뉴. 순위 창의 범위 칩과 같은 「이름 ▾」 꼴.
 * 메뉴는 부모의 잘림(overflow)을 피하려고 body 로 띄운다. 열려 있는 동안 Esc 는 메뉴만 닫는다.
 */
export function ListRegionChip({ region, recents, geos, homeCountry, onPick, variant }: Props) {
  const { open, pos, btnRef, menuRef, toggle, closeAndFocus } = useAnchoredMenu(164);
  const items = useMemo(() => buildRegionMenu(geos, homeCountry, recents), [geos, homeCountry, recents]);

  const label = regionLabel(region);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`list-region-chip list-region-chip--${variant}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`지역 범위 (현재: ${label})`}
        onClick={toggle}
      >
        <span className="list-region-chip__label">{label}</span> ▾
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="list-region-menu"
              role="menu"
              style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
            >
              {items.map((it, i) => {
                const startsGroup = it.group !== items[i - 1]?.group;
                const head = startsGroup ? (it.group === "recent" ? "최근 고른 곳" : it.group === "country" ? "국가" : null) : null;
                const selected = it.key === region;
                return (
                  <div key={`${it.group}:${it.key}`}>
                    {head ? <div className="list-region-menu__sep">{head}</div> : null}
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      className={`list-region-menu__item${selected ? " is-selected" : ""}`}
                      onClick={() => {
                        onPick(it.key);
                        closeAndFocus();
                      }}
                    >
                      {selected ? "✓ " : ""}
                      {it.label}
                      {it.tag ? <span className="list-region-menu__tag">{it.tag}</span> : null}
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

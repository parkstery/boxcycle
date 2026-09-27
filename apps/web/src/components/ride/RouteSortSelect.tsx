import type { RouteSortKey } from "../../lib/route/routeListSort";
import "./RouteSortSelect.css";

const LABEL: Record<RouteSortKey, string> = {
  recent: "최근순",
  distance: "거리순",
  name: "이름순",
};

export type RouteSortSelectProps = {
  value: RouteSortKey;
  onChange: (key: RouteSortKey) => void;
  /** 이 목록이 제공하는 기준만 노출. 순서가 곧 표시 순서다 */
  keys: readonly RouteSortKey[];
};

/**
 * 경로 목록 정렬 선택 — 내 경로 · 입문 · 퍼블릭이 **같은 컨트롤**을 쓴다(2026-09-16 Chief).
 *
 * 「최근순」의 시계는 목록마다 다르다 — 내 경로는 `updatedAt`, 퍼블릭 코스는 **등록 시각**.
 * `keys` 를 받는 이유는 목록이 댈 수 있는 기준만 노출하기 위해서다.
 */
export function RouteSortSelect({ value, onChange, keys }: RouteSortSelectProps) {
  return (
    <label className="route-sort">
      <span className="route-sort__caption">정렬</span>
      <select
        className="route-sort__select"
        value={value}
        aria-label="정렬 기준"
        onChange={(e) => onChange(e.target.value as RouteSortKey)}
      >
        {keys.map((k) => (
          <option key={k} value={k}>
            {LABEL[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

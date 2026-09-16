import type { RouteSortKey } from "../../lib/routeListSort";
import "./RouteSortSelect.css";

const LABEL: Record<RouteSortKey, string> = {
  recent: "최근순",
  default: "기본순",
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
 * 목록마다 어떤 기준을 댈 수 있는지는 데이터가 정한다:
 *   - 내 경로는 `updatedAtIso` 가 있어 「최근순」
 *   - 공식 코스 요약에는 자기 시각이 없어 「기본순」(카탈로그 순서)이 기본값
 * 그래서 `keys` 를 받는다 — 없는 기준을 띄워 놓고 아무 일도 안 일어나게 두지 않는다.
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

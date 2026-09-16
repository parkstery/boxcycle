import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  compareRouteListItems,
  sortRouteList,
  type RouteSortKey,
} from "../../src/lib/routeListSort.ts";

/**
 * 경로 목록 정렬 — 내 경로 · 입문 · 퍼블릭이 **같은 규칙**을 쓴다(2026-09-16 Chief).
 *
 * 세 목록이 각자 비교 함수를 들면 「거리순」이 한쪽은 긴 것부터, 다른 쪽은 짧은 것부터가
 * 되는 식으로 조용히 갈라진다. 방향까지 못 박는다.
 */

type Item = { id: string; name: string; distanceMeters: number; updatedAtMs?: number | null };

const ITEMS: Item[] = [
  { id: "a", name: "나 루트", distanceMeters: 5_000, updatedAtMs: 300 },
  { id: "b", name: "가 루트", distanceMeters: 12_000, updatedAtMs: 100 },
  { id: "c", name: "다 루트", distanceMeters: 800, updatedAtMs: 200 },
];

const fields = (i: Item) => ({
  name: i.name,
  distanceMeters: i.distanceMeters,
  updatedAtMs: i.updatedAtMs,
});

const ids = (arr: Item[]) => arr.map((i) => i.id).join(",");

describe("routeListSort — 목록 정렬 단일 진실", () => {
  it("default 는 원래 순서를 그대로 둔다", () => {
    assert.equal(ids(sortRouteList(ITEMS, "default", fields)), "a,b,c");
  });

  it("distance 는 **긴 것이 위** — 세 목록이 같은 방향", () => {
    assert.equal(ids(sortRouteList(ITEMS, "distance", fields)), "b,a,c");
  });

  it("name 은 한국어 로캘 오름차순", () => {
    assert.equal(ids(sortRouteList(ITEMS, "name", fields)), "b,a,c");
  });

  it("recent 는 최근이 위", () => {
    assert.equal(ids(sortRouteList(ITEMS, "recent", fields)), "a,c,b");
  });

  it("시각이 없으면 recent 는 원래 순서로 물러난다(엉뚱하게 섞지 않는다)", () => {
    const noTime = ITEMS.map((i) => ({ ...i, updatedAtMs: null }));
    assert.equal(ids(sortRouteList(noTime, "recent", fields)), "a,b,c");
    // 한쪽만 없어도 비교하지 않는다
    assert.equal(
      compareRouteListItems(
        { name: "x", distanceMeters: 1, updatedAtMs: 10 },
        { name: "y", distanceMeters: 1, updatedAtMs: null },
        "recent",
      ),
      0,
    );
    assert.equal(
      compareRouteListItems(
        { name: "x", distanceMeters: 1, updatedAtMs: Number.NaN },
        { name: "y", distanceMeters: 1, updatedAtMs: 5 },
        "recent",
      ),
      0,
    );
  });

  it("원본 배열을 건드리지 않는다", () => {
    const before = ids(ITEMS);
    sortRouteList(ITEMS, "distance", fields);
    assert.equal(ids(ITEMS), before);
  });

  it("같은 값이면 원래 순서 유지(안정)", () => {
    const same: Item[] = [
      { id: "x", name: "같음", distanceMeters: 100 },
      { id: "y", name: "같음", distanceMeters: 100 },
      { id: "z", name: "같음", distanceMeters: 100 },
    ];
    for (const key of ["distance", "name", "recent"] as RouteSortKey[]) {
      assert.equal(ids(sortRouteList(same, key, fields)), "x,y,z", key);
    }
  });
});

describe("정렬 컨트롤이 세 목록에 실제로 붙어 있다", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const read = (rel: string) =>
    fs.readFileSync(path.resolve(__dirname, "../../src", rel), "utf8");

  it("내 경로 · 공식 코스 모달이 같은 컨트롤·같은 정렬 함수를 쓴다", () => {
    for (const rel of [
      "components/ride/SavedRoutesPanel.tsx",
      "components/ride/OfficialCourseListModal.tsx",
    ]) {
      const src = read(rel);
      assert.match(src, /RouteSortSelect/, `${rel}: 공용 정렬 컨트롤`);
      assert.match(src, /sortRouteList\(/, `${rel}: 공용 정렬 함수`);
      // 자체 비교 함수를 되살리지 않는다 — 갈라지는 원인
      assert.doesNotMatch(src, /localeCompare\([^)]*"ko"\)/, `${rel}: 인라인 이름 비교 금지`);
    }
  });

  it("공식 코스는 기본값이 카탈로그 순서 — 입문 Basic 1·2·3 순서를 지킨다", () => {
    const src = read("components/ride/OfficialCourseListModal.tsx");
    assert.match(src, /useState<RouteSortKey>\("default"\)/);
    assert.match(src, /keys=\{\["default", "distance", "name"\]\}/);
  });

  it("내 경로는 기본값이 최근순(종전 동작 유지)", () => {
    const src = read("components/ride/SavedRoutesPanel.tsx");
    assert.match(src, /useState<RouteSortKey>\("recent"\)/);
    assert.match(src, /keys=\{\["recent", "distance", "name"\]\}/);
  });
});

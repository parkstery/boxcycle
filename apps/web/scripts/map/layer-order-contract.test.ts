/**
 * 지도 레이어 순서 계약 (Phase 5 D4 · 게이트 G4).
 *
 * 왜 렌더가 아니라 정책을 재는가 — 헤드리스 e2e 에서는 preserved 라이더 레이어가
 * **생성되지 않는다**(구조 감사 P3). 「라이더가 경로선보다 위」를 화면으로 확인하려다
 * 3번 시도 끝에 보류했다. 그래서 순서를 순수 함수로 내려 **렌더 없이** 판정한다.
 *
 * 무엇을 막는가
 *   P4 — 주행 중 최상단이 라이더가 아니라 activity pulse dots 였다. 순서를 세우는 코드가
 *        다섯 곳에서 각자 「내가 top」이라고 주장해, **마지막에 실행된 쪽이 이겼다.**
 *   R6 — layer id 문자열을 바꾸면 소스·레이어 참조가 어긋나 오버레이가 조용히 사라진다.
 *        레지스트리에 없는 id 를 쓰면 여기서 막힌다.
 *
 * ⚠️ 라이더가 **실제로 그려지는지**는 여기서 알 수 없다. Chief 실기 확인이 최종 게이트다.
 *
 * 실행: `npm run test:next-ride` (pre-push 게이트)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  RTW_LAYER_ORDER,
  applyRtwLayerOrder,
  RTW_LAYER_RANK,
  effectiveRank,
  isRtwLayerId,
  moveLayerByRank,
  resolveBeforeIdByRank,
  rtwLayerRank,
} from "../../src/lib/map/layerOrder.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "../../src");

const RIDER_PRESERVED = "boxcycle-rider-preserved-layer";
const RIDER_GLB = "boxcycle-rider-prototype-layer";
const ROUTE = "route";
const PULSE_DOTS = "boxcycle-activity-pulse-dots-layer";
const HEAT_DOTS = "boxcycle-activity-heat-dots-layer";
const PRESENCE_DOT = "boxcycle-global-live-presence-dot";

/** 가짜 지도 — Mapbox 의 `moveLayer(id, beforeId)` 의미만 재현한다. */
function fakeMap(order: string[]) {
  let layers = [...order];
  return {
    get order() {
      return [...layers];
    },
    getStyle: () => ({ layers: layers.map((id) => ({ id })) }),
    getLayer: (id: string) => (layers.includes(id) ? {} : undefined),
    moveLayer: (id: string, beforeId?: string) => {
      layers = layers.filter((l) => l !== id);
      if (beforeId === undefined) {
        layers.push(id);
        return;
      }
      const i = layers.indexOf(beforeId);
      if (i < 0) throw new Error(`no such layer: ${beforeId}`);
      layers.splice(i, 0, id);
    },
  };
}

describe("G4 — 레이어 순서 레지스트리", () => {
  it("랭크가 서로 겹치지 않는다 (겹치면 순서가 호출 순서에 달린다)", () => {
    const ranks = Object.values(RTW_LAYER_RANK);
    assert.equal(new Set(ranks).size, ranks.length, "중복 랭크가 있으면 결정적이지 않다");
    assert.ok(ranks.length > 20, `레지스트리가 비었다(${ranks.length}) — 시험이 헛돈다`);
  });

  it("RTW_LAYER_ORDER — 낮은 → 높은 순으로 정렬돼 있고 모든 id 를 담는다", () => {
    assert.equal(RTW_LAYER_ORDER.length, Object.keys(RTW_LAYER_RANK).length);
    for (let i = 1; i < RTW_LAYER_ORDER.length; i += 1) {
      assert.ok(
        RTW_LAYER_RANK[RTW_LAYER_ORDER[i - 1]] < RTW_LAYER_RANK[RTW_LAYER_ORDER[i]],
        `${RTW_LAYER_ORDER[i - 1]} 가 ${RTW_LAYER_ORDER[i]} 보다 먼저 와야 한다`,
      );
    }
    assert.equal(RTW_LAYER_ORDER[RTW_LAYER_ORDER.length - 1], "debug-world-light-circle");
  });

  it("사람이 최상단 — 라이더가 경로선·활동 점·presence 보다 위", () => {
    for (const rider of [RIDER_PRESERVED, RIDER_GLB]) {
      for (const below of [ROUTE, PULSE_DOTS, HEAT_DOTS, PRESENCE_DOT]) {
        assert.ok(
          RTW_LAYER_RANK[rider] > RTW_LAYER_RANK[below],
          `${rider} 가 ${below} 보다 위여야 한다 — 내 위치를 덮으면 주행을 읽을 수 없다`,
        );
      }
    }
  });

  it("P4 — activity pulse dots 는 라이더보다 위가 아니다", () => {
    // 이것이 실측된 증상이었다(주행 중 최상단이 pulse dots).
    assert.ok(RTW_LAYER_RANK[PULSE_DOTS] < RTW_LAYER_RANK[RIDER_PRESERVED]);
  });

  it("활동 선은 경로선 아래, 활동 점은 경로선 위", () => {
    assert.ok(RTW_LAYER_RANK["boxcycle-activity-pulse-routes-line"] < RTW_LAYER_RANK[ROUTE]);
    assert.ok(RTW_LAYER_RANK[PULSE_DOTS] > RTW_LAYER_RANK[ROUTE]);
  });

  it("단계 조건부 — 내 도로망이 경로선 위/아래로 뒤집힌다 (2026-09-16 결정)", () => {
    const traces = "boxcycle-conquest-traces-line";
    const below = effectiveRank(traces, false)!;
    const above = effectiveRank(traces, true)!;
    const route = effectiveRank(ROUTE, false)!;
    assert.ok(below < route, "경로 설정·확인 중에는 경로선이 위");
    assert.ok(above > route, "주행 중에는 궤적이 위");
    // 위로 올라가도 관전 오버레이를 덮지는 않는다.
    assert.ok(above < effectiveRank("boxcycle-lobby-spectator-routes-line", true)!);
  });

  const SCRAMBLED = [RIDER_PRESERVED, ROUTE, PULSE_DOTS, HEAT_DOTS, PRESENCE_DOT];
  const WANT = [ROUTE, HEAT_DOTS, PULSE_DOTS, PRESENCE_DOT, RIDER_PRESERVED];

  it("applyRtwLayerOrder — 뒤섞여 있어도 한 번에 랭크 순서가 된다", () => {
    // P4 의 실제 모양 — 라이더가 맨 아래로 밀린 상태.
    const map = fakeMap(SCRAMBLED);
    applyRtwLayerOrder(map, SCRAMBLED);
    assert.deepEqual(map.order, WANT);
    assert.equal(map.order[map.order.length - 1], RIDER_PRESERVED, "라이더가 최상단");
  });

  it("applyRtwLayerOrder — 목록의 순서가 결과를 바꾸지 않는다", () => {
    const a = fakeMap(SCRAMBLED);
    applyRtwLayerOrder(a, [...SCRAMBLED].reverse());
    const b = fakeMap(SCRAMBLED);
    applyRtwLayerOrder(b, SCRAMBLED);
    assert.deepEqual(a.order, b.order, "인자 순서가 결과를 바꾸면 그것은 정책이 아니다");
    assert.deepEqual(a.order, WANT);
  });

  it("applyRtwLayerOrder — 이미 정렬돼 있으면 아무것도 옮기지 않는다(멱등)", () => {
    const map = fakeMap(WANT);
    let moves = 0;
    const spy = { ...map, moveLayer: (i: string, b?: string) => { moves += 1; map.moveLayer(i, b); } };
    applyRtwLayerOrder(spy, WANT);
    assert.equal(moves, 0, "정렬된 상태에서 옮기면 매 프레임 헛일을 한다");
  });

  it("applyRtwLayerOrder — 목록 밖 레이어의 위아래 관계는 건드리지 않는다", () => {
    // 베이스맵 라벨을 블록째 넘어가면 지도 판독이 달라진다.
    const map = fakeMap(["basemap-low", ...SCRAMBLED, "basemap-high"]);
    applyRtwLayerOrder(map, SCRAMBLED);
    assert.equal(map.order[0], "basemap-low");
    assert.equal(map.order[map.order.length - 1], "basemap-high");
  });

  it("moveLayerByRank — 한 레이어 교정용. 라이더를 되돌린다", () => {
    const map = fakeMap([RIDER_PRESERVED, ROUTE, PULSE_DOTS]);
    moveLayerByRank(map, RIDER_PRESERVED);
    assert.equal(map.order[map.order.length - 1], RIDER_PRESERVED);
  });

  it("역방향 검산 — 랭크를 무시하면 이 시험이 실패한다", () => {
    // 종전 동작(무조건 top)을 흉내내면 라이더가 덮인다. 시험이 축퇴되지 않았음을 보인다.
    const map = fakeMap([ROUTE, RIDER_PRESERVED]);
    map.moveLayer(PULSE_DOTS === PULSE_DOTS ? RIDER_PRESERVED : RIDER_PRESERVED); // no-op
    const m2 = fakeMap([ROUTE, RIDER_PRESERVED, PULSE_DOTS]);
    m2.moveLayer(PULSE_DOTS); // beforeId 없음 = 무조건 top (종전 방식)
    assert.equal(
      m2.order[m2.order.length - 1],
      PULSE_DOTS,
      "무조건 top 은 라이더를 덮는다 — 이것이 고친 증상이다",
    );
    moveLayerByRank(m2, PULSE_DOTS);
    assert.equal(m2.order[m2.order.length - 1], RIDER_PRESERVED, "랭크로 옮기면 라이더가 위");
  });

  it("모르는 id 는 랭크가 없다 (레지스트리 밖은 판정하지 않는다)", () => {
    assert.equal(rtwLayerRank("mapbox-basemap-label"), null);
    assert.equal(isRtwLayerId("mapbox-basemap-label"), false);
    assert.equal(resolveBeforeIdByRank(fakeMap([ROUTE]), "unknown-layer"), undefined);
  });

  it("G4 구조 — 소스에 쓰인 boxcycle layer id 가 전부 레지스트리에 있다", () => {
    /*
     * 레지스트리에 없는 레이어는 순서 정책 밖에 있다 — 그러면 다시 「마지막에 실행된 쪽이
     * 이기는」 상태로 돌아간다. 새 레이어를 추가하면 여기서 막힌다.
     *
     * source id(`-src`·`-routes`·`-dots`)는 레이어가 아니므로 제외한다.
     */
    const SOURCE_ONLY = new Set([
      "boxcycle-activity-heat-dots",
      "boxcycle-activity-heat-routes",
      "boxcycle-activity-pulse-dots",
      "boxcycle-activity-pulse-routes",
      "boxcycle-conquest-live",
      "boxcycle-conquest-traces",
      "boxcycle-global-live-presence",
      "boxcycle-lobby-spectator-dots",
      "boxcycle-lobby-spectator-routes",
      "boxcycle-routable-roads-src",
      "boxcycle-rider-prototype-source",
      "boxcycle-dem",
      // CSS 키프레임 style 태그 id — 지도 레이어가 아니다
      "boxcycle-rider-pedal-strip-keyframes",
    ]);
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(e.name)) continue;
        // 레지스트리 자신은 제외한다 — 거기 적힌 리터럴이 곧 레지스트리다.
        if (/layerOrder\.ts$/.test(e.name)) continue;
        const src = fs.readFileSync(p, "utf8");
        for (const m of src.matchAll(/"(boxcycle-[a-z0-9-]+)"/g)) {
          // `"boxcycle-conquest-"` 처럼 접두어로 쓰인 것은 id 가 아니다.
          if (!m[1].endsWith("-")) found.add(m[1]);
        }
      }
    };
    walk(SRC);
    assert.ok(found.size > 20, `id 를 못 찾았다(${found.size}) — 검사가 헛돈다`);
    const missing = [...found].filter((id) => !SOURCE_ONLY.has(id) && !isRtwLayerId(id));
    assert.deepEqual(
      missing,
      [],
      `레지스트리에 없는 layer id: ${missing.join(", ")} — 랭크를 정하거나 source 목록에 넣어라`,
    );
  });

  it("G4 구조 — 순서를 세우는 곳이 레지스트리를 거친다", () => {
    /*
     * `moveLayer(id)` 를 beforeId 없이 부르면 무조건 top 이다 — 그것이 P4 를 만들었다.
     * 순서를 다루는 파일들은 `moveLayerByRank` 를 써야 한다.
     * 예외: 레지스트리 자신, 그리고 DEV 진단(최상단이 정책인 레이어).
     */
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(e.name)) continue;
        if (/layerOrder\.ts$|DebugWorldLightMap\.tsx$/.test(e.name)) continue;
        const src = fs.readFileSync(p, "utf8");
        // `moveLayer(x)` — 인자가 하나뿐인 호출
        for (const m of src.matchAll(/\.moveLayer\(\s*([^,()]+)\s*\)/g)) {
          offenders.push(`${path.relative(SRC, p).split(path.sep).join("/")}: ${m[0]}`);
        }
      }
    };
    walk(SRC);
    assert.deepEqual(
      offenders,
      [],
      `beforeId 없는 moveLayer 는 무조건 top 이다 — moveLayerByRank 를 쓰라:\n  ${offenders.join("\n  ")}`,
    );
  });
});

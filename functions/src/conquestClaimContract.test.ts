/**
 * Claim ↔ 경로 순위 계약 (Phase 5 D2 · 게이트 G3).
 *
 * 무엇을 막는가 — 구조 감사 R10: 「경로 생성기를 통합할 때 Claim 읽기 의존을 같이
 * 옮기지 않으면 **새 도로 비율이 조용히 0 으로 돌아간다**」.
 *
 * 왜 조용한가 — 셀 ID 계산이 **쓰는 쪽과 읽는 쪽에 따로** 있으면 `claimedCellIds.has(...)`
 * 가 영영 실패한다. 그런데 그 결과(비율 전부 1.0)는 「Claim 이 없는 사용자」와 **구분되지
 * 않는다**. 가산 항이 모든 후보에 같아져 순위 효과만 사라지고, 에러도 로그 이상도 없다.
 * 전형적인 축퇴값 자동통과다 — 그래서 **판정이 정확한 일치에 의존함을 역방향으로도 검산**한다.
 *
 * 실행: `npm test` (functions). `node --test lib/conquestClaimContract.test.js`
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  computeRouteNewRoadRatio,
  scoreReadyOnewayWithClaim,
  type ClaimReader,
  type LngLat,
} from "./distanceAutoRouteCore.js";
import { loadClaimedCellsNearStart } from "./conquestClaimRead.js";
import {
  CONQUEST_CELL_ZOOM,
  CONQUEST_CHUNK_ZOOM,
  chunkIdsCoveringRadius,
  conquestCellIdAt,
  lngLatToTileXY,
} from "./geoTiles.js";

/** 컴파일된 `lib/` 에서 소스 `src/` 를 가리킨다(구조 검사용). */
const SRC = path.resolve(__dirname, "../src");

// ─────────────────────────────────────── 1. 고정 벡터
//
// 값을 직접 박는다. 공유 함수로 계산해 공유 함수를 검증하면 아무것도 검증하지 않는다.
// ⚠️ 이 값들은 `apps/web/scripts/conquest/cell-id-vectors.test.ts` 와 **같아야 한다**
//    — 클라이언트가 Claim 을 쓰고 서버가 읽으므로, 둘이 어긋나면 조용히 깨진다.
//    빌드가 나뉘어 코드를 공유할 수 없으니 벡터로 고정한다. 바꿀 땐 두 곳을 함께.

const V_GANGNAM: LngLat = [127.0276, 37.4979];
const V_GANGNAM_CELL = "20_894282_406315";
const V_GANGNAM_CHUNK = "12_3493_1587";
const V_ORIGIN_CELL = "20_524288_524288";

test("G3 고정 벡터 — z20 셀 ID (클라이언트와 반드시 동일)", () => {
  assert.equal(conquestCellIdAt(V_GANGNAM), V_GANGNAM_CELL);
  assert.equal(conquestCellIdAt([0, 0]), V_ORIGIN_CELL);
  assert.equal(CONQUEST_CELL_ZOOM, 20, "Claim 단위는 축적 데이터의 단위 — 변경 불가에 준한다");
  assert.equal(CONQUEST_CHUNK_ZOOM, 12);
});

test("G3 고정 벡터 — z12 청크 ID, 그리고 셀이 그 청크에 담긴다", () => {
  const { x, y } = lngLatToTileXY(V_GANGNAM[0], V_GANGNAM[1], CONQUEST_CHUNK_ZOOM);
  assert.equal(`${CONQUEST_CHUNK_ZOOM}_${x}_${y}`, V_GANGNAM_CHUNK);
  // 셀 → 청크는 비트 시프트 관계다. 어긋나면 반경 안을 읽었는데 셀이 안 들어온다.
  const shift = CONQUEST_CELL_ZOOM - CONQUEST_CHUNK_ZOOM;
  const [, cx, cy] = V_GANGNAM_CELL.split("_").map(Number);
  assert.equal(`${CONQUEST_CHUNK_ZOOM}_${cx >> shift}_${cy >> shift}`, V_GANGNAM_CHUNK);
  assert.ok(
    chunkIdsCoveringRadius(V_GANGNAM, 3000).includes(V_GANGNAM_CHUNK),
    "출발점이 든 청크는 반경 목록에 반드시 있다",
  );
});

// ─────────────────────────────────────── 2. 배선 — 읽는 쪽과 재는 쪽이 같은 매핑을 쓰는가
//
// claimed 를 **reader 가 만드는 방식**(공유 `conquestCellIdAt`)으로 채운다.
// 코어가 다른 매핑을 쓰면 여기서 깨진다 — 종전에는 이 시험이 자기 안에 타일 계산을
// 또 한 벌 두고 있어서, 코어와 reader 가 어긋나도 통과했다.

function claimedAlong(coords: LngLat[], steps = 40): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < coords.length - 1; i += 1) {
    const [ax, ay] = coords[i];
    const [bx, by] = coords[i + 1];
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      out.add(conquestCellIdAt([ax + (bx - ax) * t, ay + (by - ay) * t]));
    }
  }
  return out;
}

const ROUTE: LngLat[] = [
  [127.0276, 37.4979],
  [127.0299, 37.4979],
  [127.0299, 37.4996],
];

test("G3 배선 — reader 가 만드는 셀 ID 로 채우면 신규도로 비율≈0", () => {
  const ratio = computeRouteNewRoadRatio(ROUTE, claimedAlong(ROUTE));
  assert.ok(ratio < 0.1, `코어와 reader 의 셀 매핑이 어긋났다 — ratio=${ratio}`);
});

// ─────────────────────────────────────── 3. 역방향 검산 (축퇴 방지)
//
// 위 판정이 「무엇을 넣어도 0」이 아님을 증명한다. 이것이 없으면 M0 없는 게이트다.

test("G3 역방향 — Claim 이 비면 비율 1 (Claim 없는 사용자와 동일)", () => {
  assert.equal(computeRouteNewRoadRatio(ROUTE, new Set()), 1);
});

test("G3 역방향 — 줌이 어긋난 ID(z19) 로 채우면 비율 1. 판정은 정확한 일치에 의존한다", () => {
  const wrongZoom = new Set<string>();
  for (const p of ROUTE) {
    const { x, y } = lngLatToTileXY(p[0], p[1], CONQUEST_CELL_ZOOM - 1);
    wrongZoom.add(`${CONQUEST_CELL_ZOOM - 1}_${x}_${y}`);
  }
  assert.equal(
    computeRouteNewRoadRatio(ROUTE, wrongZoom),
    1,
    "z19 로 채웠는데 0 이 나오면 판정이 ID 를 제대로 보지 않는다",
  );
});

test("G3 역방향 — 이웃 셀로 1 칸 밀면 비율이 크게 오른다", () => {
  const shifted = new Set<string>();
  for (const id of claimedAlong(ROUTE)) {
    const [z, x, y] = id.split("_").map(Number);
    shifted.add(`${z}_${x + 1000}_${y}`);
  }
  const ratio = computeRouteNewRoadRatio(ROUTE, shifted);
  assert.ok(ratio > 0.9, `엉뚱한 셀인데 Claim 으로 인정됐다 — ratio=${ratio}`);
});

// ─────────────────────────────────────── 4. 순위 효과가 실제로 있는가
//
// 비율이 계산돼도 점수에 반영되지 않으면 기능은 없는 것과 같다.

test("G3 — 거리오차가 같으면 신규도로 비율이 높은 쪽이 낮은 점수(=우선)", () => {
  const common = { errorMeters: 50, targetMeters: 3000, selfOverlapRatio: 0 };
  const allNew = scoreReadyOnewayWithClaim({ ...common, newRoadRatio: 1 });
  const allClaimed = scoreReadyOnewayWithClaim({ ...common, newRoadRatio: 0 });
  assert.ok(allNew < allClaimed, `순위 가산이 작동하지 않는다 — ${allNew} vs ${allClaimed}`);
});

// ─────────────────────────────────────── 5. 구조 — 코어는 Conquest 를 모른다 (D2)

test("G3 구조 — distanceAutoRouteCore 는 conquest 모듈을 import 하지 않는다", () => {
  const src = fs.readFileSync(path.join(SRC, "distanceAutoRouteCore.ts"), "utf8");
  // 검사 대상은 **모듈 경로**다. 줄 전체를 보면 `geoTiles` 에서 가져오는
  // `conquestCellIdAt` 같은 심볼 이름이 걸려 오탐한다 — 셀 ID 계산은 지리이지 Conquest 가 아니다.
  const specifiers = [...src.matchAll(/^\s*import\b[\s\S]*?from\s*"([^"]+)"/gm)].map((m) => m[1]);
  assert.ok(specifiers.length > 0, "import 를 하나도 못 찾았다 — 검사가 작동하지 않는다");
  for (const spec of specifiers) {
    assert.ok(
      !/conquest/i.test(spec),
      `코어가 Conquest 모듈을 import 하면 포트가 무의미하다: ${spec}`,
    );
  }
  assert.ok(
    /from "\.\/geoTiles\.js"/.test(src),
    "코어는 타일 계산을 geoTiles 에서 가져와야 한다(자기 사본 금지)",
  );
});

test("G3 구조 — 타일 계산 사본이 geoTiles 밖에 되살아나지 않았다", () => {
  const offenders: string[] = [];
  for (const f of fs.readdirSync(SRC)) {
    if (!f.endsWith(".ts") || f === "geoTiles.ts") continue;
    const src = fs.readFileSync(path.join(SRC, f), "utf8");
    // 타일 y 계산 고유형(`tan(φ) + 1/cos(φ)`). 이름을 바꿔 복제해도 이 식은 남는다.
    // ⚠️ `Math.log(Math.tan(...))` 만 보면 안 된다 — Mercator **미터** 투영(거리 계산)이
    //    정당하게 그 형태를 쓴다(`lngLatToMercatorMeters` 2곳). 탐지가 정상 코드를
    //    잡으면 결국 탐지가 꺼진다.
    if (/Math\.tan\([^)]*\)\s*\+\s*1\s*\/\s*Math\.cos\(/.test(src)) offenders.push(f);
  }
  assert.deepEqual(
    offenders,
    [],
    `타일 계산이 geoTiles 밖에 또 있다(쓰는 쪽과 어긋나면 조용히 깨진다): ${offenders.join(", ")}`,
  );
});

test("G3 구조 — Firestore 구현이 ClaimReader 포트에 대입 가능하다", () => {
  const real: ClaimReader = loadClaimedCellsNearStart;
  assert.equal(typeof real, "function");
  // 가짜 주입이 가능해야 시험이 Firestore 없이 순위를 고정할 수 있다.
  const fake: ClaimReader = async ({ start, radiusMeters }) => ({
    claimedCellIds: new Set([conquestCellIdAt(start)]),
    chunkIdsRequested: chunkIdsCoveringRadius(start, radiusMeters),
    chunksHit: 1,
    readMs: 0,
  });
  assert.equal(typeof fake, "function");
});

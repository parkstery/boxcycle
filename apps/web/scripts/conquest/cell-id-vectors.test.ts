/**
 * Claim 셀 ID 고정 벡터 — **클라이언트 쪽 절반** (Phase 5 D2 · 게이트 G3).
 *
 * 왜 여기에도 있는가 — 클라이언트가 Claim 을 **쓰고**(주행 종료 시 `buildConquestCellsFromRoute`),
 * 서버가 그것을 **읽어 경로 순위에 쓴다**(`conquestClaimRead` → `computeRouteNewRoadRatio`).
 * 두 쪽의 타일 계산이 어긋나면 서버의 `claimedCellIds.has(...)` 가 **영영 실패**하는데,
 * 그 결과는 「Claim 이 없는 사용자」와 **구분되지 않는다** — 비율이 전부 1.0 이 되고 가산 항이
 * 모든 후보에 같아져 **에러 없이 순위 기능만 사라진다**(구조 감사 R10).
 *
 * `apps/web` 과 `functions` 는 빌드가 나뉘어 코드를 공유할 수 없다. 그래서 **같은 고정 벡터**를
 * 양쪽에 박아 고정한다.
 *
 * ⚠️ 이 값들은 `functions/src/conquestClaimContract.test.ts` 와 **반드시 같아야 한다.**
 *    바꿀 일이 있으면 두 파일을 함께 바꿔라. 한쪽만 바꾸면 이 게이트가 무의미해진다.
 *
 * 실행: `npm run test:conquest-cells` (apps/web)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONQUEST_CELL_ZOOM,
  CONQUEST_CHUNK_ZOOM,
  chunkIdOfConquestCellId,
  conquestCellIdAt,
  lngLatToTileXY,
} from "../../src/lib/conquestTiles.ts";

// ── functions/src/conquestClaimContract.test.ts 와 동일해야 하는 값 ──
const V_GANGNAM: [number, number] = [127.0276, 37.4979];
const V_GANGNAM_CELL = "20_894282_406315";
const V_GANGNAM_CHUNK = "12_3493_1587";
const V_ORIGIN_CELL = "20_524288_524288";

describe("Claim 셀 ID 고정 벡터 (서버와 동일해야 한다)", () => {
  it("z20 셀 ID", () => {
    assert.equal(conquestCellIdAt(V_GANGNAM), V_GANGNAM_CELL);
    assert.equal(conquestCellIdAt([0, 0]), V_ORIGIN_CELL);
  });

  it("줌 상수 — 축적 데이터의 단위이므로 변경 불가에 준한다(OQ-1)", () => {
    assert.equal(CONQUEST_CELL_ZOOM, 20);
    assert.equal(CONQUEST_CHUNK_ZOOM, 12);
  });

  it("z12 청크 ID, 그리고 셀→청크 변환이 그 청크를 가리킨다", () => {
    const { x, y } = lngLatToTileXY(V_GANGNAM[0], V_GANGNAM[1], CONQUEST_CHUNK_ZOOM);
    assert.equal(`${CONQUEST_CHUNK_ZOOM}_${x}_${y}`, V_GANGNAM_CHUNK);
    assert.equal(chunkIdOfConquestCellId(V_GANGNAM_CELL), V_GANGNAM_CHUNK);
  });

  it("역방향 검산 — 이웃 좌표는 다른 셀이어야 한다(상수 반환이 아님)", () => {
    // z20 한 변은 서울 위도에서 ~30m. 200m 옮기면 반드시 다른 셀이다.
    const moved: [number, number] = [V_GANGNAM[0] + 0.0023, V_GANGNAM[1]];
    assert.notEqual(conquestCellIdAt(moved), V_GANGNAM_CELL);
  });
});

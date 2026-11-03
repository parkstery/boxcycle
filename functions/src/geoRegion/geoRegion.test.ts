/**
 * 위치 판정 고정 시험값 (G1 완료 조건 — 00-plan.md §3.3).
 *
 * 무엇을 막는가 — 판정이 틀리면 공개 경로·순위가 **엉뚱한 나라에 조용히** 쌓인다. 에러가 나지
 * 않으므로 실제 경계 데이터(geo-data/v1)로 알려진 지점을 고정해 둔다.
 * 데이터를 다시 만들 때(생성기 허용오차·원본 판 변경) 이 표가 먼저 깨져야 한다.
 *
 * 실행 (C:\20.HDev\boxcycle\functions): `npm test` 또는 `npx tsc && node --test lib/geoRegion/geoRegion.test.js`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { LngLat } from "../geoTiles.js";
import {
  findArea,
  geoQuadkeyAt,
  resolveGeoRegionWith,
  tileQuadkey,
  type GeoArea,
  type GeoRegionDataset,
} from "./geoRegionCore.js";
import { loadGeoRegionDataset } from "./geoRegionData.js";

type Vector = { name: string; at: LngLat; country: string | null; admin1: string | null; continent: string | null };

const VECTORS: Vector[] = [
  { name: "서울 시청", at: [126.978, 37.5665], country: "KR", admin1: "KR-11", continent: "AS" },
  { name: "성남 분당(서울 경계 밖)", at: [127.1189, 37.3826], country: "KR", admin1: "KR-41", continent: "AS" },
  { name: "독도 — 행정구역 데이터에 없음 → 가장 가까운 경북(울릉)", at: [131.8667, 37.2417], country: "KR", admin1: "KR-47", continent: "AS" },
  { name: "울릉도", at: [130.865, 37.484], country: "KR", admin1: "KR-47", continent: "AS" },
  { name: "해운대 앞바다 1km — 해안 보정", at: [129.165, 35.15], country: "KR", admin1: "KR-26", continent: "AS" },
  { name: "파주(DMZ 남쪽)", at: [126.78, 37.76], country: "KR", admin1: "KR-41", continent: "AS" },
  { name: "개성(DMZ 북쪽)", at: [126.55, 37.97], country: "KP", admin1: null, continent: "AS" },
  { name: "도쿄", at: [139.6917, 35.6895], country: "JP", admin1: "JP-13", continent: "AS" },
  { name: "파리 — 도(75)가 아니라 레지옹", at: [2.3522, 48.8566], country: "FR", admin1: "FR-IDF", continent: "EU" },
  { name: "스트라스부르(라인강 서쪽)", at: [7.7521, 48.5734], country: "FR", admin1: "FR-GES", continent: "EU" },
  { name: "켈(라인강 동쪽)", at: [7.815, 48.573], country: "DE", admin1: "DE-BW", continent: "EU" },
  { name: "베를린 — 브란덴부르크 안의 구멍", at: [13.405, 52.52], country: "DE", admin1: "DE-BE", continent: "EU" },
  { name: "런던 — 자치구가 아니라 잉글랜드", at: [-0.1276, 51.5072], country: "GB", admin1: "GB-ENG", continent: "EU" },
  { name: "에든버러", at: [-3.1883, 55.9533], country: "GB", admin1: "GB-SCT", continent: "EU" },
  { name: "마드리드 — 주(M)가 아니라 자치지방", at: [-3.7038, 40.4168], country: "ES", admin1: "ES-MD", continent: "EU" },
  { name: "바르셀로나", at: [2.1734, 41.3851], country: "ES", admin1: "ES-CT", continent: "EU" },
  { name: "밀라노 — 현(MI)이 아니라 롬바르디아", at: [9.19, 45.4642], country: "IT", admin1: "IT-25", continent: "EU" },
  { name: "크림 — 한국 관점 판", at: [34.1, 44.95], country: "UA", admin1: "UA-43", continent: "EU" },
  { name: "모스크바 붉은광장 — 원본 코드 뒤바뀜 정정", at: [37.6173, 55.7558], country: "RU", admin1: "RU-MOW", continent: "EU" },
  { name: "세르기예프포사드(모스크바 주)", at: [38.13, 56.31], country: "RU", admin1: "RU-MOS", continent: "EU" },
  { name: "뉴욕", at: [-74.006, 40.7128], country: "US", admin1: "US-NY", continent: "NA" },
  { name: "시드니", at: [151.2093, -33.8688], country: "AU", admin1: "AU-NSW", continent: "OC" },
  { name: "수바(날짜변경선 근처)", at: [178.4419, -18.1416], country: "FJ", admin1: null, continent: "OC" },
  { name: "태평양 한가운데", at: [-150, 0], country: null, admin1: null, continent: null },
];

const dataset = loadGeoRegionDataset();

for (const v of VECTORS) {
  test(`판정: ${v.name}`, () => {
    const r = resolveGeoRegionWith(dataset, v.at);
    assert.ok(r, "좌표가 정상이면 결과가 있어야 한다");
    assert.equal(r.geoCountry, v.country, "국가");
    if (v.admin1 !== null || v.country === null) assert.equal(r.geoAdmin1, v.admin1, "행정구역");
    assert.equal(r.geoContinent, v.continent, "대륙");
    assert.equal(r.geoResolverVersion, 1);
    assert.equal(r.geoQuadkey.length, 16);
  });
}

test("행정구역 코드는 모두 자기 나라 접두어를 가진다(묶음 규칙 회귀)", () => {
  for (const c of ["KR", "FR", "GB", "ES", "IT", "US", "JP", "UA"]) {
    const areas = dataset.admin1Of(c);
    assert.ok(areas.length > 0, `${c} 행정구역이 비었다`);
    for (const a of areas) assert.match(a.code, new RegExp(`^${c}-[A-Z0-9]{1,3}$`));
  }
  assert.equal(dataset.admin1Of("GB").length, 4, "영국은 잉글랜드·스코틀랜드·웨일스·북아일랜드 넷");
  assert.equal(dataset.admin1Of("KR").length, 17, "한국 광역 17");
});

test("quadkey: 알려진 타일·앞부분 = 상위 타일", () => {
  assert.equal(tileQuadkey(3, 5, 3), "213"); // Bing 문서 예제
  const seoul = geoQuadkeyAt([126.978, 37.5665]);
  assert.equal(seoul, geoQuadkeyAt([126.978, 37.5665], 16));
  assert.ok(seoul.startsWith(geoQuadkeyAt([126.978, 37.5665], 8)), "z8 은 z16 의 앞부분");
});

test("잘못된 좌표는 null, 경도는 감아서 판정", () => {
  assert.equal(resolveGeoRegionWith(dataset, [Number.NaN, 37]), null);
  assert.equal(resolveGeoRegionWith(dataset, [127, 91]), null);
  assert.equal(resolveGeoRegionWith(dataset, [126.978 + 360, 37.5665])?.geoAdmin1, "KR-11");
});

// ── 합성 데이터: 실제 경계와 무관하게 알고리즘 자체를 시험한다 ──────────────────
function square(code: string, x0: number, y0: number, x1: number, y1: number, hole?: number[]): GeoArea {
  const outer = new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1, x0, y0]);
  return { code, polygons: [{ bbox: [x0, y0, x1, y1], rings: hole ? [outer, new Float64Array(hole)] : [outer] }] };
}

test("합성: 구멍 안은 바깥 구역이 아니다, 대신 구멍 구역", () => {
  const outer = square("XX-A", 0, 0, 10, 10, [4, 4, 6, 4, 6, 6, 4, 6, 4, 4]);
  const inner = square("XX-B", 4, 4, 6, 6);
  assert.equal(findArea([outer, inner], [5, 5], 0)?.area.code, "XX-B");
  assert.equal(findArea([outer, inner], [2, 2], 0)?.area.code, "XX-A");
});

test("합성: 경계 밖 점은 허용 거리 안에서만 가장 가까운 구역", () => {
  const a = square("XX-A", 0, 0, 1, 1);
  const b = square("XX-B", 3, 0, 4, 1);
  const hit = findArea([a, b], [2.4, 0.5], 200_000);
  assert.equal(hit?.area.code, "XX-B", "B 가 더 가깝다(0.6° vs 1.4°)");
  assert.ok(hit && hit.fallbackMeters !== null && hit.fallbackMeters > 0);
  assert.equal(findArea([a, b], [2.4, 0.5], 10_000), null, "허용 거리 밖이면 null");
});

test("합성: 데이터가 비면 국가·행정구역 모두 null(자동 통과 방지)", () => {
  const empty: GeoRegionDataset = { version: 0, countries: [], admin1Of: () => [] };
  const r = resolveGeoRegionWith(empty, [126.978, 37.5665]);
  assert.equal(r?.geoCountry, null);
  assert.equal(r?.geoAdmin1, null);
});

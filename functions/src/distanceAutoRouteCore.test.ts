/**
 * 지시04 §4 단위 시험 — 없는 길(직선 기하) 근절 게이트.
 *
 * `node --test`(Node 20 내장 러너)로 돈다. 새 의존성을 추가하지 않기 위해서다
 * (functions 패키지에는 기존 테스트 러너가 없었다 — 이번에 처음 들인다).
 * 실행: `npm run build && node --test lib/distanceAutoRouteCore.test.js`
 * (`npm test` 스크립트로도 배선했다 — package.json 참고)
 *
 * 정상 경로 샘플(REAL_ROUTE_FIXTURE)은 **실 Mapbox Directions API 응답을 그대로 박제**한
 * 것이다(지시04 재조사, 2026-09-24, 마포구 월드컵로 인근 1.98km cycling 경로) —
 * `document/ops/20260923-first_ride/.out/jisi04/real-route-fixture.json` 과 동일.
 * synthetic 으로 만들지 않은 이유: 기준(V1~V3)이 과하게 조여져 정상 경로까지 버리는
 * 반대 사고를 막으려면 **진짜 도로 응답**으로 검증해야 한다(지시04 §4 경고).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  offsetLngLatByBearingMeters,
  validateRouteGeometryPlausibility,
  type LngLat,
} from "./distanceAutoRouteCore.js";

const REAL_ROUTE_START: LngLat = [126.9016, 37.5563];
const REAL_ROUTE_FIXTURE: { type: "LineString"; coordinates: LngLat[] } = {
  type: "LineString",
  coordinates: [
    [126.901833, 37.556349], [126.901888, 37.556183], [126.901975, 37.555917],
    [126.902043, 37.555714], [126.902161, 37.55534], [126.902238, 37.555107],
    [126.902258, 37.555047], [126.902398, 37.554616], [126.902441, 37.554485],
    [126.90241, 37.554429], [126.902488, 37.554373], [126.902789, 37.554163],
    [126.903074, 37.55397], [126.903139, 37.553925], [126.903559, 37.553636],
    [126.903788, 37.553684], [126.904158, 37.553759], [126.904564, 37.553843],
    [126.904937, 37.553923], [126.905273, 37.553998], [126.905502, 37.554048],
    [126.905877, 37.553666], [126.905962, 37.55358], [126.906016, 37.553528],
    [126.906135, 37.553406], [126.906311, 37.553058], [126.906376, 37.552929],
    [126.906546, 37.552592], [126.906698, 37.552295], [126.906791, 37.552111],
    [126.906945, 37.551844], [126.906999, 37.551658], [126.907137, 37.551187],
    [126.907351, 37.551001], [126.907419, 37.550944], [126.907644, 37.550758],
    [126.908129, 37.550356], [126.908214, 37.550286], [126.908567, 37.54998],
    [126.908605, 37.549948], [126.909097, 37.549522], [126.909256, 37.54964],
    [126.909472, 37.549802], [126.909643, 37.549925], [126.910004, 37.550171],
    [126.91013, 37.550255], [126.910361, 37.550282], [126.910877, 37.550343],
    [126.91143, 37.550366], [126.911874, 37.550423], [126.912951, 37.550495],
    [126.912976, 37.550414], [126.91312, 37.549847], [126.913155, 37.549756],
    [126.913229, 37.54954], [126.913291, 37.549458], [126.913449, 37.549242],
    [126.913623, 37.549299], [126.914056, 37.549555], [126.914412, 37.549787],
    [126.914857, 37.549388], [126.915341, 37.549777], [126.915626, 37.549542],
    [126.915822, 37.549675], [126.916119, 37.549902],
  ] as LngLat[],
};

test("V1~V3 — 실제 도로 경로(다수 점, 65points/1.98km)는 통과해야 한다", () => {
  const result = validateRouteGeometryPlausibility({
    start: REAL_ROUTE_START,
    geometry: REAL_ROUTE_FIXTURE,
  });
  assert.equal(result.ok, true, "진짜 도로 경로가 기준에 걸리면 안 된다 — 과잉 차단");
});

test("V1/V2 — 직선 2점 geometry(한강 횡단 흉내)는 거부해야 한다", () => {
  const start: LngLat = [126.9016, 37.5563]; // 마포구 월드컵로 인근(Chief 재현 좌표)
  // 지시03 capture-b.mjs 의 onewayBody() 와 동일한 방식 — bearing 144°(남동, 한강 방향) 3km
  const end = offsetLngLatByBearingMeters(start, 144, 3000);
  const straightLine: { type: "LineString"; coordinates: LngLat[] } = {
    type: "LineString",
    coordinates: [start, end],
  };
  const result = validateRouteGeometryPlausibility({ start, geometry: straightLine });
  assert.equal(result.ok, false, "직선 2점은 반드시 거부돼야 한다");
  if (!result.ok) {
    assert.equal(result.reason, "low_point_density");
  }
});

test("V2 — 대부분 정상이지만 장거리 단일 구간(한강 같은 간격)이 낀 geometry는 거부해야 한다", () => {
  // 실제 65점 도로 경로를 그대로 쓰되, 마지막 점만 2.5km 떨어진 곳으로 바꿔치기한다
  // (다른 데이터로는 지점 밀도가 정상인데, 그 구간 하나만 강을 건너뛴 상황을 흉내).
  const lastReal = REAL_ROUTE_FIXTURE.coordinates[REAL_ROUTE_FIXTURE.coordinates.length - 2]!;
  const farAwayPoint = offsetLngLatByBearingMeters(lastReal, 180, 2500);
  const coordsWithGap: LngLat[] = [
    ...REAL_ROUTE_FIXTURE.coordinates.slice(0, -1),
    farAwayPoint,
  ];
  const result = validateRouteGeometryPlausibility({
    start: REAL_ROUTE_START,
    geometry: { type: "LineString", coordinates: coordsWithGap },
  });
  assert.equal(result.ok, false, "장거리 단일 구간이 끼면 거부돼야 한다");
  if (!result.ok) {
    assert.equal(result.reason, "long_straight_segment");
  }
});

test("V3 — geometry 첫 점이 요청 start 에서 지나치게 멀면 거부해야 한다", () => {
  const requestedStart: LngLat = [126.9016, 37.5563];
  const wrongFirstPoint = offsetLngLatByBearingMeters(requestedStart, 90, 1000); // 1km 오프
  const coords: LngLat[] = [wrongFirstPoint, ...REAL_ROUTE_FIXTURE.coordinates];
  const result = validateRouteGeometryPlausibility({
    start: requestedStart,
    geometry: { type: "LineString", coordinates: coords },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "start_mismatch");
  }
});

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import { test } from "node:test";
import {
  installRideViewDistance,
  isTileInRideView,
  RIDE_NEAR_DETAIL_M,
  parseRideViewDistanceM,
  RIDE_VIEW_DISTANCE_DEFAULT_M,
  RIDE_VIEW_DISTANCE_SDK_VERSION,
} from "../../src/lib/map/rideViewDistance.ts";

const require = createRequire(import.meta.url);

class Tile {
  canonical: { z: number; x: number; y: number };
  constructor(z: number, x: number, y: number) { this.canonical = { z, x, y }; }
  children() {
    const { z, x, y } = this.canonical;
    return [0, 1, 2, 3].map((i) => new Tile(z + 1, x * 2 + (i % 2), y * 2 + (i >> 1)));
  }
}

/** 카메라는 z15 타일 (16384,16384) 한가운데, 북쪽을 본다. 적도라 z15 타일 ≈ 1223m. */
const CAM = { x: 16384.5 / 32768, y: 16384.5 / 32768 };
class FakeTransform {
  projection = { name: "mercator", farthestPixelDistance: (_tr: unknown): number => 94 * 120 };
  elevation: unknown = null;
  pitch = 83.5;
  zoom = 22;
  bearing = 0;
  fov = 36.87;
  width = 1562;
  height = 754;
  pixelsPerMeter = 120;
  center = { lat: 0 };
  _camera = { position: [CAM.x, CAM.y, 0] };
  farZ = 0;
  cover: Tile[] = [];
  _calcMatrices() { this.farZ = this.projection.farthestPixelDistance(this); }
  coveringTiles(): Tile[] { return this.cover; }
  clone(): FakeTransform { return Object.assign(new FakeTransform(), { cover: this.cover, pitch: this.pitch }); }
}
function setup(distanceM = 1000, version = RIDE_VIEW_DISTANCE_SDK_VERSION) {
  const transform = new FakeTransform();
  const map = { version, transform, triggerRepaint() {} };
  const controller = installRideViewDistance(map as never, distanceM);
  return { transform, controller };
}
const cover = (tr: FakeTransform, maxzoom = 16, extra = {}) =>
  (tr.coveringTiles as unknown as (o: object) => Tile[]).call(tr, { maxzoom, ...extra }).map((t) => `${t.canonical.z}/${t.canonical.x}/${t.canonical.y}`);

test("SDK 버전과 감싸는 함수가 설치본과 같다 — 다르면 시야 확장을 다시 검증해야 한다", () => {
  const web = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(web.dependencies["mapbox-gl"], RIDE_VIEW_DISTANCE_SDK_VERSION, "범위(^)가 아니라 고정 버전이어야 한다");
  const pkgPath = require.resolve("mapbox-gl/package.json");
  assert.equal(JSON.parse(fs.readFileSync(pkgPath, "utf8")).version, RIDE_VIEW_DISTANCE_SDK_VERSION);
  const bundle = fs.readFileSync(pkgPath.replace(/package\.json$/, "dist/mapbox-gl.js"), "utf8");
  for (const name of ["_calcMatrices()", "coveringTiles(", "farthestPixelDistance(", "isTerrainDEM"]) {
    assert.ok(bundle.includes(name), `제품 번들에 ${name} 이 없다`);
  }
});

test("켜기 전에는 SDK 원거리 한계를 그대로 쓰고, 켜면 시야 거리까지 늘고, 끄면 복원한다", () => {
  const { transform, controller } = setup();
  transform._calcMatrices();
  assert.equal(transform.farZ, 94 * 120);
  controller.setActive(true);
  assert.equal(transform.farZ, 1000 * 120);
  assert.equal(transform.projection.farthestPixelDistance(transform), 94 * 120, "투영 함수는 계산 뒤 원래대로다");
  controller.setActive(false);
  assert.equal(transform.farZ, 94 * 120);
});

test("SDK 한계가 이미 더 멀면 줄이지 않는다", () => {
  const { transform, controller } = setup();
  transform.projection.farthestPixelDistance = () => 5000 * 120;
  controller.setActive(true);
  assert.equal(transform.farZ, 5000 * 120);
});

test("지형 ON·내려다보는 구도·먼 줌·다른 투영에서는 개입하지 않는다", () => {
  const off: Array<(tr: FakeTransform) => void> = [
    (tr) => { tr.elevation = {}; }, (tr) => { tr.pitch = 0; }, (tr) => { tr.zoom = 12; }, (tr) => { tr.projection.name = "globe"; },
  ];
  for (const change of off) {
    const { transform, controller } = setup();
    change(transform);
    transform.cover = [new Tile(14, 8192, 8191)];
    controller.setActive(true);
    assert.equal(transform.farZ, 94 * 120);
    assert.deepEqual(cover(transform), ["14/8192/8191"]);
  }
});

test("시야 안의 거친 타일만 z15 로 나누고 뒤쪽·가까운 정밀 타일은 보존한다", () => {
  const { transform, controller } = setup();
  const ahead = new Tile(13, 4096, 4095);
  const behind = new Tile(13, 4096, 4098);
  transform.cover = [new Tile(16, 32769, 32769), ahead, behind];
  controller.setActive(true);
  const result = cover(transform);
  assert.ok(result.includes("16/32769/32769"));
  assert.ok(result.includes("13/4096/4098"), "시야 밖은 SDK 결과 그대로");
  assert.ok(!result.includes("13/4096/4095"));
  assert.ok(result.includes("15/16384/16383"), "바로 앞 건물 타일");
  assert.ok(result.filter((id) => id.startsWith("15/")).length <= 6, "시야 밖까지 나누지 않는다");
  assert.ok(result.every((id) => !id.startsWith("14/")), "중간 단계 타일을 남기지 않는다");
});

test("주인을 모르는 GeoJSON 줌(18)·랜드마크(14)·DEM 타일은 나누지 않는다", () => {
  const { transform, controller } = setup();
  transform.cover = [new Tile(13, 4096, 4095)];
  controller.setActive(true);
  assert.deepEqual(cover(transform, 18), ["13/4096/4095"]);
  assert.deepEqual(cover(transform, 14), ["13/4096/4095"]);
  assert.deepEqual(cover(transform, 16, { isTerrainDEM: true }), ["13/4096/4095"]);
  assert.notDeepEqual(cover(transform, 15), ["13/4096/4095"]);
});

class FakeCache {
  id: string;
  _source: { type: string };
  map: FakeTransform;
  result: string[] = [];
  constructor(map: FakeTransform, id: string, type: string) { this.map = map; this.id = id; this._source = { type }; }
  update(maxzoom: number) { this.result = cover(this.map, maxzoom); }
}

test("글자와 앱 선 소스는 300m 안 조각만, 건물·땅 소스는 1km 조각을 쓴다", () => {
  const transform = new FakeTransform();
  const caches = {
    symbol: new FakeCache(transform, "symbol:composite", "vector"),
    geojson: new FakeCache(transform, "other:boxcycle-conquest-live", "geojson"),
    other: new FakeCache(transform, "other:composite", "vector"),
  };
  const map = { version: RIDE_VIEW_DISTANCE_SDK_VERSION, transform, triggerRepaint() {}, style: { _mergedSourceCaches: caches } };
  const controller = installRideViewDistance(map as never, 1000);
  // 발밑(0m) · 앞으로 약 611m 떨어진 z15 · 먼 z13
  transform.cover = [new Tile(15, 16384, 16384), new Tile(15, 16384, 16383), new Tile(13, 4096, 4095)];
  controller.setActive(true);
  assert.ok(RIDE_NEAR_DETAIL_M >= 135, "종전 글자 시야보다 좁히지 않는다");
  caches.symbol.update(16);
  assert.deepEqual(caches.symbol.result, ["15/16384/16384"]);
  caches.geojson.update(18);
  assert.deepEqual(caches.geojson.result, ["15/16384/16384"]);
  caches.other.update(16);
  assert.ok(caches.other.result.includes("15/16384/16383"));
  assert.ok(!caches.other.result.includes("13/4096/4095"), "먼 거친 타일은 z15 로 나뉜다");
  assert.equal(cover(transform, 18).length, 3, "소스 갱신 밖의 호출은 그대로");
  controller.setActive(false);
  caches.symbol.update(16);
  assert.equal(caches.symbol.result.length, 3, "끄면 SDK 결과 그대로");
});

test("복제 transform 에도 적용되고 dispose 는 원래 함수로 되돌린다", () => {
  const { transform, controller } = setup();
  transform.cover = [new Tile(13, 4096, 4095)];
  controller.setActive(true);
  const clone = transform.clone();
  assert.notDeepEqual(cover(clone), ["13/4096/4095"]);
  controller.dispose();
  assert.equal(transform._calcMatrices, FakeTransform.prototype._calcMatrices);
  assert.equal(transform.coveringTiles, FakeTransform.prototype.coveringTiles);
  assert.equal(transform.clone, FakeTransform.prototype.clone);
});

test("SDK 버전이 다르거나 거리 0이면 아무것도 감싸지 않는다", () => {
  for (const { transform, controller } of [setup(1000, "3.24.0"), setup(0)]) {
    controller.setActive(true);
    assert.equal(transform._calcMatrices, FakeTransform.prototype._calcMatrices);
  }
});

test("타일 나누기 오류는 지도를 멈추지 않고 SDK 결과로 돌아간다", () => {
  const { transform, controller } = setup();
  const broken = new Tile(13, 4096, 4095);
  broken.children = () => { throw new Error("contract"); };
  transform.cover = [broken];
  controller.setActive(true);
  assert.deepEqual(cover(transform), ["13/4096/4095"]);
  transform._calcMatrices();
  assert.equal(transform.farZ, 94 * 120, "한 번 어긋나면 원거리 한계도 기본으로");
});

test("시야각은 방위를 따르고 카메라가 든 타일은 항상 포함한다", () => {
  const view = { ...CAM, lat: 0, bearingDeg: 0, halfFovRad: 0.7, reachM: 1300 };
  assert.ok(isTileInRideView({ z: 15, x: 16384, y: 16384 }, view));
  assert.ok(isTileInRideView({ z: 15, x: 16384, y: 16383 }, view), "북쪽");
  assert.ok(!isTileInRideView({ z: 15, x: 16384, y: 16386 }, view), "남쪽 뒤");
  assert.ok(isTileInRideView({ z: 15, x: 16384, y: 16385 }, { ...view, bearingDeg: 180 }), "남쪽을 보면 포함");
  assert.ok(!isTileInRideView({ z: 15, x: 16384, y: 16380 }, view), "거리 밖");
});

test("비교용 쿼리는 0과 200~3000만 받는다", () => {
  assert.equal(parseRideViewDistanceM(""), RIDE_VIEW_DISTANCE_DEFAULT_M);
  assert.equal(parseRideViewDistanceM("?viewdist=0"), 0);
  assert.equal(parseRideViewDistanceM("?viewdist=2000"), 2000);
  for (const bad of ["50", "9999", "abc", "-1", ""]) assert.equal(parseRideViewDistanceM(`?viewdist=${bad}`), RIDE_VIEW_DISTANCE_DEFAULT_M);
});

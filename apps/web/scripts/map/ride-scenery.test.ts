import assert from "node:assert/strict";
import { test } from "node:test";
import { createRideBuildings, RIDE_BUILDING_COLOR, RIDE_WINDOW_LAYER, wallPixelRatio } from "../../src/lib/map/rideBuildings.ts";
import { computeRidgeProfile, ridgeDemTiles, ridgeVertices, type RidgeProfile } from "../../src/lib/map/rideRidge.ts";
import { installRideScenery, rideFogRange, rideSceneryEnabled } from "../../src/lib/map/rideScenery.ts";

/** 설치 SDK(3.23.1)의 안개 식. 시야 끝까지 실제로 얼마나 덮이는지 확인한다. */
function fogOpacity(range: readonly [number, number], distanceM: number, unitM: number): number {
  const t = (distanceM / unitM - 1.5 - range[0]) / (range[1] - range[0]);
  const falloff = 1 - Math.min(1, Math.exp(-6 * t));
  return Math.min(1, 1.00747 * falloff ** 3);
}

test("안개는 250m 까지 맑고 1km 에서 대부분 덮인다 — 카메라 줌이 달라도 같다", () => {
  for (const unitM of [4, 6.27, 8.97, 40]) {
    const range = rideFogRange(unitM, 1000);
    assert.equal(fogOpacity(range, 250, unitM), 0);
    assert.ok(fogOpacity(range, 400, unitM) < 0.15, "400m");
    const end = fogOpacity(range, 1000, unitM);
    assert.ok(end > 0.85 && end < 0.97, `1km ${end}`);
  }
  // Standard 기본값(약 14~20)은 이 시야에서 150m 를 거의 덮는다 — 이 시험이 잡으려는 결함이다.
  assert.ok(fogOpacity([14, 20], 150, 6.27) > 0.9);
});

test("?ridelook=0 만 끈다", () => {
  assert.equal(rideSceneryEnabled(""), true);
  assert.equal(rideSceneryEnabled("?ridelook=1"), true);
  assert.equal(rideSceneryEnabled("?ridelook=0"), false);
});

function profileOf(elevation: (lng: number, lat: number) => number): RidgeProfile {
  const job = computeRidgeProfile([127.95, 37.34], elevation);
  for (;;) {
    const step = job.next();
    if (step.done) return step.value;
  }
}

test("능선은 산이 있는 방향·거리 띠에만, 실제 올려본 각으로 선다", () => {
  const kmPerLng = 111.32 * Math.cos((37.34 * Math.PI) / 180);
  // 동쪽 6km 에 표고 800m(주변 150m) 봉우리.
  const profile = profileOf((lng, lat) => {
    const east = (lng - 127.95) * kmPerLng - 6, north = (lat - 37.34) * 110.54;
    return Math.hypot(east, north) < 0.4 ? 800 : 150;
  });
  assert.equal(profile.length, 3);
  const [near, mid, far] = profile;
  const east = 180; // 720칸 중 동쪽(90°)
  const want = Math.atan((800 - 152) / 6000);
  assert.ok(Math.abs(mid[east] - want) < 0.02, `${mid[east]} / ${want}`);
  assert.equal(near[east], 0);
  assert.equal(far[east], 0);
  assert.equal(mid[540], 0, "서쪽은 평지");
});

test("바다·평지에서는 능선이 없고 지평선 아래로 내려가지 않는다", () => {
  for (const angles of profileOf(() => 0)) assert.ok(angles.every((a) => a === 0));
  const basin = profileOf((lng) => (lng === 127.95 ? 900 : 100));
  for (const angles of basin) assert.ok(angles.every((a) => a >= 0));
});

test("능선 띠는 북에서 시작해 시계 방향으로 한 바퀴 닫힌다", () => {
  const angles = new Float32Array(720).fill(0.1);
  const v = ridgeVertices(angles, 900);
  assert.equal(v.length, 721 * 8);
  assert.ok(Math.abs(v[0]) < 1e-3 && Math.abs(v[1] + 900) < 1e-3, "처음은 북(남쪽 축 −)");
  assert.ok(Math.abs(v[180 * 8] - 900) < 1e-2, "1/4 바퀴는 동");
  assert.ok(Math.abs(v[6] - 900 * Math.tan(0.1)) < 1e-2);
  for (let k = 0; k < 8; k++) assert.ok(Math.abs(v[k] - v[720 * 8 + k]) < 1e-2, "닫힘");
});

test("표고 조각은 주행 한 곳에 최대 9장이고 겹치지 않는다", () => {
  for (const c of [[127.95, 37.34], [2.34, 48.86], [-73.97, 40.78], [10.45, 46.53], [103.8, 1.3]] as const) {
    const tiles = ridgeDemTiles(c);
    assert.ok(tiles.length >= 1 && tiles.length <= 9, `${c} ${tiles.length}`);
    assert.equal(new Set(tiles.map(String)).size, tiles.length);
  }
});

test("창문 무늬 네 층이 어느 줌에서도 13.2m 다", () => {
  for (const zoom of [18, 20, 22]) {
    const metersPerPx = (40_075_016.686 * Math.cos((37.3 * Math.PI) / 180)) / (512 * 2 ** zoom);
    assert.ok(Math.abs((256 / wallPixelRatio(zoom, 37.3)) * metersPerPx - 13.2) < 1e-6);
  }
});

const ORIGINAL_FILTER = ["all", ["==", ["get", "extrude"], "true"]];

function buildingFixture(options: { standard?: boolean; failAddLayer?: boolean } = {}) {
  const images = new Map<string, unknown>();
  const copies = new Map<string, unknown>();
  let merges = 0;
  const layers: Record<string, { color?: unknown; filter?: unknown; spec?: Record<string, unknown> }> = {
    "3d-building": { color: "original", filter: ORIGINAL_FILTER },
  };
  const fragment = {
    _layers: options.standard === false ? {} : layers,
    getPaintProperty: (id: string) => layers[id].color,
    setPaintProperty: (id: string, _name: string, value: unknown) => { layers[id].color = value; },
    getFilter: (id: string) => layers[id].filter,
    setFilter: (id: string, filter: unknown) => { layers[id].filter = filter; },
    addLayer: (spec: Record<string, unknown>) => {
      if (options.failAddLayer) throw new Error("계약 변경");
      layers[String(spec.id)] = { spec, filter: spec.filter };
    },
    removeLayer: (id: string) => { delete layers[id]; },
    getImage: (ref: { name: string }) => copies.get(ref.name),
    addImage: (ref: { name: string }, image: unknown) => { copies.set(ref.name, image); },
    removeImage: (ref: { name: string }) => { copies.delete(ref.name); },
  };
  const view = { lng: 127.95, lat: 37.34 };
  const transform = { tileZoom: 22, height: 754, pixelsPerMeter: 100 };
  const style = {
    _layers: {}, fragments: [{ style: fragment }],
    mergeLayers: () => { merges += 1; },
    listImages: () => [...images.keys()].map((name) => ({ name })),
    getImage: (ref: { name: string }) => images.get(ref.name),
  };
  const map = {
    style, transform, _update() {}, getCenter: () => view,
    hasImage: (n: string) => images.has(n), removeImage: (n: string) => images.delete(n),
    addImage: (n: string, _image: unknown, o: { pixelRatio: number }) => { images.set(n, { pixelRatio: o.pixelRatio }); },
  };
  const buildings = createRideBuildings(map as never, (() => ({})) as never);
  return { map, layers, view, transform, copies, buildings, style, merges: () => merges };
}

test("건물 색과 250m 창문을 적용하고 종료하면 원래 색·필터로 되돌린다", () => {
  const f = buildingFixture();
  assert.equal(f.buildings.apply(), true);
  assert.equal(f.layers["3d-building"].color, RIDE_BUILDING_COLOR);
  assert.ok(f.layers[RIDE_WINDOW_LAYER]);
  assert.equal(f.copies.size, 21);
  // 같은 건물이 두 레이어에 나오지 않는다 — 조건이 서로 반대다.
  const near = (f.layers[RIDE_WINDOW_LAYER].filter as unknown[]).at(-1);
  assert.deepEqual((f.layers["3d-building"].filter as unknown[]).at(-1), ["!", near]);
  // 높이 추정값이 있는 Standard 자료를 쓴다. 일반 자료로 바꾸면 건물이 3m 로 낮아진다.
  assert.equal(f.layers[RIDE_WINDOW_LAYER].spec?.source, "composite");
  assert.match(JSON.stringify(f.layers[RIDE_WINDOW_LAYER].spec), /est_height/);
  // 둥근 모서리는 창문을 세로 줄무늬로 누른다.
  assert.deepEqual(f.layers[RIDE_WINDOW_LAYER].spec?.layout, { "fill-extrusion-edge-radius": 0 });
  assert.ok(f.merges() > 0);

  f.buildings.restore();
  assert.equal(f.layers["3d-building"].color, "original");
  assert.equal(f.layers["3d-building"].filter, ORIGINAL_FILTER);
  assert.equal(f.layers[RIDE_WINDOW_LAYER], undefined);
});

test("100m 넘게 움직였을 때만 창문 건물을 다시 고르고, 줌이 바뀌면 무늬를 새로 맞춘다", () => {
  const f = buildingFixture();
  f.buildings.apply();
  const first = f.layers[RIDE_WINDOW_LAYER].filter;
  f.view.lat += 50 / 110_540;
  f.buildings.apply();
  assert.equal(f.layers[RIDE_WINDOW_LAYER].filter, first);
  f.view.lat += 80 / 110_540;
  f.buildings.apply();
  assert.notDeepEqual(f.layers[RIDE_WINDOW_LAYER].filter, first);
  const before = (f.copies.get("ride-wall-l0") as { pixelRatio: number }).pixelRatio;
  f.transform.tileZoom = 21;
  f.buildings.apply();
  const after = (f.copies.get("ride-wall-l0") as { pixelRatio: number }).pixelRatio;
  assert.ok(Math.abs(after / before - 2) < 1e-3, `${after} / ${before}`);
  assert.ok(f.layers[RIDE_WINDOW_LAYER]);
});

test("Standard 가 아니면 손대지 않고, SDK 계약이 다르면 되돌린 뒤 다시 시도하지 않는다", () => {
  const other = buildingFixture({ standard: false });
  assert.equal(other.buildings.apply(), false);
  const warn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    const broken = buildingFixture({ failAddLayer: true });
    broken.buildings.apply();
    broken.buildings.apply();
    assert.equal(broken.layers["3d-building"].color, "original");
    assert.equal(broken.layers["3d-building"].filter, ORIGINAL_FILTER);
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = warn;
  }
});

test("주행 풍경은 낮은 카메라·지형 OFF 에서만 켜지고, 카메라 1·저녁·종료에서 되돌린다", () => {
  const f = buildingFixture();
  let pitch = 83, terrain: unknown = null, preset = "day";
  let fog: unknown = "standard-fog";
  const layers = new Set<string>();
  let tick: () => void = () => {};
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = { window: globals.window, document: globals.document, fetch: globals.fetch };
  const requests: string[] = [];
  globals.window = { setInterval: (fn: () => void) => { tick = fn; return 1; }, clearInterval() {}, setTimeout() {} };
  const context = { fillRect() {}, getImageData: () => ({}) };
  globals.document = { hidden: false, createElement: () => ({ getContext: () => context }) };
  globals.fetch = (url: string) => { requests.push(url); return new Promise(() => {}); };
  try {
    const map = Object.assign(f.map, {
      version: "3.23.1", on() {}, off() {}, triggerRepaint() {},
      getPitch: () => pitch, getZoom: () => 22, getTerrain: () => terrain, getConfigProperty: () => preset,
      getFog: () => fog, setFog: (next: unknown) => { fog = next; },
      getLayer: (id: string) => layers.has(id), addLayer: (l: { id: string }) => layers.add(l.id), removeLayer: (id: string) => layers.delete(id),
    });
    const scenery = installRideScenery(map as never, { viewDistanceM: 1000, token: "t" });
    tick();
    assert.equal(fog, "standard-fog", "주행 전에는 손대지 않는다");
    scenery.setActive(true);
    assert.notEqual(fog, "standard-fog");
    assert.ok(f.layers[RIDE_WINDOW_LAYER]);
    const asked = requests.length;
    assert.ok(asked >= 1 && asked <= 9);
    tick();
    assert.equal(requests.length, asked, "받는 동안 되풀이해 요청하지 않는다");

    const applied = fog;
    tick();
    assert.equal(fog, applied, "단위가 같으면 안개를 다시 정하지 않는다");
    f.transform.pixelsPerMeter = 50;
    tick();
    assert.notEqual(fog, applied);

    pitch = 0;
    tick();
    assert.equal(fog, "standard-fog");
    assert.equal(f.layers["3d-building"].color, "original");
    pitch = 83;
    tick();
    assert.notEqual(fog, "standard-fog");
    preset = "dusk";
    tick();
    assert.equal(fog, "standard-fog");
    assert.equal(f.layers["3d-building"].color, RIDE_BUILDING_COLOR, "저녁에도 건물 외관은 유지");
    preset = "day";
    terrain = {};
    tick();
    assert.equal(f.layers[RIDE_WINDOW_LAYER], undefined);
    terrain = null;
    tick();
    scenery.setActive(false);
    assert.equal(fog, "standard-fog");
    assert.equal(f.layers["3d-building"].color, "original");
  } finally {
    Object.assign(globals, saved);
  }
});

test("SDK 버전이 다르거나 시야 확장을 끄면 아무것도 하지 않는다", () => {
  const f = buildingFixture();
  for (const [version, viewDistanceM] of [["3.24.0", 1000], ["3.23.1", 0]] as const) {
    installRideScenery(Object.assign({}, f.map, { version }) as never, { viewDistanceM, token: "t" }).setActive(true);
  }
  assert.equal(f.layers["3d-building"].color, "original");
});

test("시험 패널의 「안개 끔」은 하늘색은 두고 먼 곳을 덮지 않는다", async () => {
  const { rideFog } = await import("../../src/lib/map/rideScenery.ts");
  const on = rideFog(6.27, 1000), off = rideFog(6.27, 1000, false);
  assert.match(String(off.color), /, 0\)$/);
  assert.equal(off["horizon-blend"], 0);
  assert.deepEqual({ ...off, color: on.color, "horizon-blend": on["horizon-blend"] }, on);
});

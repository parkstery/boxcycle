import assert from "node:assert/strict";
import { test } from "node:test";
import { createRideBuildings, RIDE_BUILDING_COLOR, RIDE_WINDOW_LAYER } from "../../src/lib/map/rideBuildings.ts";
import { installRideQuality, parseRideQuality, RIDE_QUALITY_LEVELS, RideQualityGovernor, rideQualityText } from "../../src/lib/map/rideQuality.ts";

const last = RIDE_QUALITY_LEVELS.length - 1;
function run(g: RideQualityGovernor, seconds: number, loopFps: number, mapFps = loopFps): void {
  for (let i = 0; i < seconds; i++) g.note({ loopFps, mapFps });
}

test("줄이는 순서는 나무 → 창문이고 단계마다 나빠지기만 한다", () => {
  assert.deepEqual(RIDE_QUALITY_LEVELS[0], { label: "전체", maxTrees: 900, windows: true });
  for (let i = 1; i <= last; i++) {
    const a = RIDE_QUALITY_LEVELS[i - 1], b = RIDE_QUALITY_LEVELS[i];
    assert.ok(b.maxTrees <= a.maxTrees && (a.windows || !b.windows));
    assert.ok(b.maxTrees < a.maxTrees || a.windows !== b.windows);
  }
  assert.equal(RIDE_QUALITY_LEVELS.findIndex((l) => !l.windows), last, "창문은 마지막");
});

test("출발 8초는 세지 않고, 24FPS 미만이 5초 이어져야 한 단계 내린다", () => {
  const g = new RideQualityGovernor();
  run(g, 8, 10);
  assert.equal(g.level, 0);
  run(g, 4, 20);
  assert.equal(g.level, 0);
  run(g, 1, 25);
  run(g, 4, 20);
  assert.equal(g.level, 0, "이어지지 않으면 다시 센다");
  run(g, 1, 20);
  assert.equal(g.level, 1);
  run(g, 4 + 4, 20);
  assert.equal(g.level, 1, "바꾼 직후 4초는 세지 않는다");
  run(g, 1, 20);
  assert.equal(g.level, 2);
  run(g, 100, 10);
  assert.equal(g.level, last, "마지막 단계에서 멈춘다");
});

test("24~28FPS 사이에서는 그대로 있고, 28FPS 이상 20초면 한 단계 올린다", () => {
  const g = new RideQualityGovernor(2);
  run(g, 8, 60);
  run(g, 200, 26);
  assert.equal(g.level, 2);
  run(g, 19, 40);
  assert.equal(g.level, 2);
  run(g, 1, 40);
  assert.equal(g.level, 1);
  run(g, 4 + 20, 40);
  assert.equal(g.level, 0);
});

test("일시정지로 지도가 쉬면 느린 것도 여유로운 것도 아니다", () => {
  const g = new RideQualityGovernor(1);
  run(g, 300, 60, 2);
  assert.equal(g.level, 1);
});

test("올리자마자 다시 느려지면 다음 올리기를 두 배로 기다려 왕복하지 않는다", () => {
  const g = new RideQualityGovernor(1);
  run(g, 8 + 20, 40);
  assert.equal(g.level, 0);
  run(g, 4 + 5, 20);
  assert.equal(g.level, 1);
  run(g, 4 + 39, 40);
  assert.equal(g.level, 1, "20초가 아니라 40초");
  run(g, 1, 40);
  assert.equal(g.level, 0);
  // 1시간을 이 조건으로 왕복해도 바뀌는 횟수가 적다.
  let changes = 0, level = g.level;
  for (let s = 0; s < 3600; s++) {
    g.note(g.level === 0 ? { loopFps: 20, mapFps: 20 } : { loopFps: 40, mapFps: 40 });
    if (g.level !== level) { changes += 1; level = g.level; }
  }
  assert.ok(changes <= 30, `한 시간 ${changes}회`);
});

test("탭을 가렸다 돌아오면 앞의 느린 초를 이어 세지 않는다", () => {
  const g = new RideQualityGovernor();
  run(g, 8 + 4, 20);
  g.interrupt();
  run(g, 4 + 4, 20);
  assert.equal(g.level, 0);
  run(g, 1, 20);
  assert.equal(g.level, 1);
});

test("?ridequality 는 0~3 만 고정한다", () => {
  assert.equal(parseRideQuality(""), null);
  for (const n of [0, 1, 2, 3]) assert.equal(parseRideQuality(`?ridequality=${n}`), n);
  for (const bad of ["4", "-1", "x", "", "1.5", "03"]) assert.equal(parseRideQuality(`?ridequality=${bad}`), null);
});

test("주행 중에만 재고, 다음 주행은 맞춘 단계에서 시작하며, 고정하면 재지 않는다", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = { window: globals.window, document: globals.document };
  let frame: ((now: number) => void) | null = null;
  let now = performance.now();
  globals.window = { requestAnimationFrame: (fn: (n: number) => void) => { frame = fn; return 1; }, cancelAnimationFrame: () => { frame = null; } };
  globals.document = { addEventListener() {}, removeEventListener() {} };
  let onRender: (() => void) | null = null;
  const map = { on: (_e: string, fn: () => void) => { onRender = fn; }, off: () => { onRender = null; } };
  const seen: string[] = [];
  const draw = (seconds: number, fps: number) => {
    for (let i = 0; i < seconds * fps; i++) { now += 1000 / fps; onRender?.(); frame?.(now); }
  };
  try {
    const q = installRideQuality(map as never, { fixedLevel: null, onLevel: (l) => seen.push(l.label) });
    assert.equal(frame, null);
    q.setActive(true);
    now = performance.now();
    assert.deepEqual(seen, ["전체"]);
    draw(16, 12);
    assert.deepEqual(seen, ["전체", "나무 1/2"]);
    assert.equal(rideQualityText(), "나무 1/2");
    q.setActive(true);
    assert.equal(seen.length, 2, "두 번 켜도 한 번만");
    q.setActive(false);
    assert.equal(frame, null);
    assert.equal(onRender, null);
    q.setActive(true);
    assert.equal(seen.at(-1), "나무 1/2");
    q.setActive(false);

    const fixed = installRideQuality(map as never, { fixedLevel: last, onLevel: (l) => seen.push(l.label) });
    fixed.setActive(true);
    assert.equal(frame, null);
    assert.equal(seen.at(-1), RIDE_QUALITY_LEVELS[last].label);
    assert.match(rideQualityText(), /고정/);
  } finally {
    Object.assign(globals, saved);
  }
});

test("창문을 끄면 건물 색은 남고 원래 필터로 돌아가며, 다시 켜면 창문이 돌아온다", () => {
  const FILTER = ["all", "original"];
  const layers: Record<string, { color?: unknown; filter?: unknown }> = { "3d-building": { color: "original", filter: FILTER } };
  const images = new Map<string, unknown>(), copies = new Map<string, unknown>();
  const fragment = {
    _layers: layers,
    getPaintProperty: (id: string) => layers[id].color, setPaintProperty: (id: string, _n: string, v: unknown) => { layers[id].color = v; },
    getFilter: (id: string) => layers[id].filter, setFilter: (id: string, f: unknown) => { layers[id].filter = f; },
    addLayer: (s: { id: string; filter: unknown }) => { layers[s.id] = { filter: s.filter }; }, removeLayer: (id: string) => { delete layers[id]; },
    getImage: (r: { name: string }) => copies.get(r.name), addImage: (r: { name: string }, v: unknown) => { copies.set(r.name, v); }, removeImage: (r: { name: string }) => { copies.delete(r.name); },
  };
  const map = {
    style: { fragments: [{ style: fragment }], mergeLayers() {}, listImages: () => [...images.keys()].map((name) => ({ name })), getImage: (r: { name: string }) => images.get(r.name) },
    transform: { tileZoom: 22 }, _update() {}, getCenter: () => ({ lng: 127, lat: 37 }),
    hasImage: (n: string) => images.has(n), removeImage: (n: string) => images.delete(n), addImage: (n: string) => { images.set(n, {}); },
  };
  const b = createRideBuildings(map as never, (() => ({})) as never);
  b.apply();
  assert.ok(layers[RIDE_WINDOW_LAYER]);
  b.setWindows(false);
  b.apply();
  assert.equal(layers[RIDE_WINDOW_LAYER], undefined);
  assert.equal(layers["3d-building"].filter, FILTER);
  assert.equal(layers["3d-building"].color, RIDE_BUILDING_COLOR);
  b.setWindows(true);
  b.apply();
  assert.ok(layers[RIDE_WINDOW_LAYER]);
  b.restore();
  assert.equal(layers["3d-building"].color, "original");
  assert.equal(layers["3d-building"].filter, FILTER);
});

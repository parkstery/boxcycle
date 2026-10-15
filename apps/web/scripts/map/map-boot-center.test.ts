import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { LOCAL_FIRST_REGION_STORAGE_KEY } from "../../src/lib/geo/localFirstRegion.ts";
import {
  MAP_FALLBACK_CENTER,
  MAP_FALLBACK_ZOOM,
  resolveMapBootCenter,
} from "../../src/lib/map/mapBootCenter.ts";
import { loadRideSessions, saveRideSessions } from "../../src/lib/ride/rideSessionsStorage.ts";

const ROME: [number, number] = [12.4922, 41.8902];
const SEOUL_END: [number, number] = [127.035, 37.505];

type MemStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  readonly length: number;
  writes: number;
};

function installStorage(getItemImpl?: (key: string) => string | null): MemStorage {
  const mem = new Map<string, string>();
  let writes = 0;
  const storage: MemStorage = {
    getItem: (key) => (getItemImpl ? getItemImpl(key) : (mem.get(key) ?? null)),
    setItem: (key, value) => {
      writes += 1;
      mem.set(key, value);
    },
    removeItem: (key) => {
      mem.delete(key);
    },
    clear: () => {
      mem.clear();
    },
    key: (index) => [...mem.keys()][index] ?? null,
    get length() {
      return mem.size;
    },
    get writes() {
      return writes;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

let geoCalls = 0;

function installGeolocationSpy(): void {
  geoCalls = 0;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      geolocation: {
        getCurrentPosition: () => {
          geoCalls += 1;
        },
        watchPosition: () => {
          geoCalls += 1;
        },
      },
    },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "navigator");
});

function assertRome(boot = resolveMapBootCenter()): void {
  assert.equal(boot.source, "fallback");
  assert.equal(boot.zoom, MAP_FALLBACK_ZOOM);
  assert.equal(boot.zoom, 15);
  assert.deepEqual(boot.center, ROME);
  assert.deepEqual(MAP_FALLBACK_CENTER, ROME);
  assert.equal(geoCalls, 0);
}

test("저장이 없으면 콜로세움 주변 줌 15", () => {
  const storage = installStorage();
  installGeolocationSpy();
  assertRome();
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(LOCAL_FIRST_REGION_STORAGE_KEY), null);
});

test("과거 서울 주행이 저장돼 있어도 콜로세움 주변 줌 15", () => {
  const storage = installStorage();
  installGeolocationSpy();
  saveRideSessions(
    [
      {
        id: "seoul-past",
        endedAt: "2026-10-01T00:00:00.000Z",
        elapsedSec: 600,
        distanceMeters: 5000,
        avgSpeedKmh: 18,
        caloriesEstimate: null,
        routeDistanceMeters: 5000,
        routeDurationSec: 700,
        sessionStartLngLat: [126.978, 37.5665],
        sessionEndLngLat: SEOUL_END,
      },
    ],
    { uid: "guest" } as never,
  );
  const loaded = loadRideSessions();
  assert.equal(loaded.length, 1);
  assert.deepEqual(loaded[0]?.sessionEndLngLat, SEOUL_END);
  assertRome();
  assert.equal(storage.getItem(LOCAL_FIRST_REGION_STORAGE_KEY), null);
});

test("잘못된 지역 저장은 콜로세움 주변 줌 15", () => {
  installStorage();
  installGeolocationSpy();
  const invalid = [
    "{",
    JSON.stringify({ name: "서울", lngLat: [127.035, 37.505], zoom: 14, source: "ip" }),
    JSON.stringify({ name: " ", lngLat: [12.4922, 41.8902], zoom: 15, source: "search" }),
    JSON.stringify({ name: "로마", lngLat: [Number.NaN, 41.89], zoom: 15, source: "geolocation" }),
    JSON.stringify({ name: "로마", lngLat: [12.49], zoom: 15, source: "search" }),
  ];
  for (const raw of invalid) {
    localStorage.setItem(LOCAL_FIRST_REGION_STORAGE_KEY, raw);
    assertRome();
  }
});

test("유효한 search/geolocation 지역은 좌표와 줌을 유지한다", () => {
  installStorage();
  installGeolocationSpy();
  const cases = [
    {
      name: "테베레",
      lngLat: [12.48, 41.89] as [number, number],
      zoom: 12,
      source: "search" as const,
    },
    {
      name: "마포구",
      lngLat: [126.9, 37.55] as [number, number],
      zoom: 16.5,
      source: "geolocation" as const,
    },
  ];
  for (const region of cases) {
    localStorage.setItem(
      LOCAL_FIRST_REGION_STORAGE_KEY,
      JSON.stringify({ ...region, at: "2026-10-15T00:00:00.000Z" }),
    );
    const boot = resolveMapBootCenter();
    assert.equal(boot.source, "localFirst");
    assert.deepEqual(boot.center, region.lngLat);
    assert.equal(boot.zoom, region.zoom);
    assert.notEqual(boot.center, region.lngLat);
    assert.equal(geoCalls, 0);
  }
});

test("저장소 접근이 거부되면 콜로세움 주변 줌 15", () => {
  installStorage(() => {
    throw new Error("storage denied");
  });
  installGeolocationSpy();
  assertRome();
});

test("반환 좌표를 바꿔도 폴백 상수는 그대로다", () => {
  installStorage();
  installGeolocationSpy();
  const boot = resolveMapBootCenter();
  assert.notEqual(boot.center, MAP_FALLBACK_CENTER);
  boot.center[0] = 0;
  boot.center[1] = 0;
  assert.deepEqual(MAP_FALLBACK_CENTER, ROME);
  assertRome();

  localStorage.setItem(
    LOCAL_FIRST_REGION_STORAGE_KEY,
    JSON.stringify({
      name: "콜로세움",
      lngLat: [12.5, 41.89],
      zoom: 14,
      source: "search",
      at: "2026-10-15T00:00:00.000Z",
    }),
  );
  const regional = resolveMapBootCenter();
  regional.center[0] = 1;
  const again = resolveMapBootCenter();
  assert.deepEqual(again.center, [12.5, 41.89]);
  assert.equal(again.zoom, 14);
  assert.deepEqual(MAP_FALLBACK_CENTER, ROME);
});

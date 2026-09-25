// 표고 호출 구조 축소 계약(`RIDE-ELEVATION-QUOTA-1` D2).
// 「도로의 고도는 변하지 않는다」 — 경로 하나당 외부 질의는 평생 한 번이어야 한다.
// Firestore 없이, 주입되는 저장소 인터페이스만 가짜로 갈아끼워 순서를 고정한다.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  clearRouteElevationCache,
  fetchRouteElevationProfile,
  routeElevationCacheKey,
  routeElevationSignature,
  type SharedElevationStore,
} from "../../src/lib/route/fetchRouteElevations.ts";
import type { LineStringGeometry } from "../../src/lib/geo/geo.ts";

function installFakeSessionStorage() {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { sessionStorage?: Storage }).sessionStorage = new Proxy(store as unknown as Storage, {
    ownKeys: () => [...map.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}

function lineOf(points: [number, number][]): LineStringGeometry {
  return { type: "LineString", coordinates: points };
}

const geometry = lineOf(
  Array.from({ length: 20 }, (_, i) => [126.978 + i * 0.001, 37.5665 + i * 0.001] as [number, number]),
);

let fetchCalls = 0;
const realFetch = globalThis.fetch;

function stubFetch() {
  fetchCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls += 1;
    const lat = new URL(String(input)).searchParams.get("latitude") ?? "";
    const n = lat.split(",").length;
    return new Response(JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 40 + i) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

/** 경로 키 → 값. 실제 Firestore 문서 한 개에 해당한다. */
function fakeStore(seed: Record<string, number[]> = {}) {
  const docs = new Map<string, number[]>(Object.entries(seed));
  const reads: string[] = [];
  const writes: string[] = [];
  const store: SharedElevationStore = {
    async read(key) {
      reads.push(key);
      return docs.get(key) ?? null;
    },
    async write(key, values) {
      writes.push(key);
      docs.set(key, values);
    },
  };
  return { store, docs, reads, writes };
}

beforeEach(() => {
  installFakeSessionStorage();
  clearRouteElevationCache();
  stubFetch();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("경로당 1회 — 공유 저장소", () => {
  it("저장소에 이미 있으면 외부 API 를 부르지 않는다", async () => {
    const key = routeElevationCacheKey(geometry);
    const stored = Array.from({ length: 72 }, (_, i) => 100 + i * 0.5);
    const { store, reads } = fakeStore({ [key]: stored });

    const profile = await fetchRouteElevationProfile(geometry, store);

    assert.equal(fetchCalls, 0, "저장소에 값이 있는데 Open-Meteo 를 불렀다");
    assert.deepEqual(reads, [key]);
    assert.deepEqual(profile.values, stored);
    assert.equal(
      profile.sampledCoords.length,
      stored.length,
      "샘플 좌표는 저장된 값 수에 맞춰 기하에서 다시 계산해야 한다",
    );
  });

  it("처음 달리는 경로만 질의하고, 다음 사람을 위해 남긴다", async () => {
    const { store, docs, writes } = fakeStore();

    const first = await fetchRouteElevationProfile(geometry, store);
    assert.equal(fetchCalls, 1, "첫 주행자는 실제로 질의해야 한다");
    assert.deepEqual(writes, [routeElevationCacheKey(geometry)]);
    assert.deepEqual(docs.get(routeElevationCacheKey(geometry)), first.values);

    // 두 번째 주행자 — 다른 탭이므로 세션 캐시는 비어 있다.
    installFakeSessionStorage();
    stubFetch();
    const second = await fetchRouteElevationProfile(geometry, store);
    assert.equal(fetchCalls, 0, "이미 저장된 경로인데 또 질의했다");
    assert.deepEqual(second.values, first.values);
  });

  it("저장소가 죽어도 주행은 계속된다", async () => {
    const broken: SharedElevationStore = {
      read: () => Promise.reject(new Error("permission denied")),
      write: () => Promise.reject(new Error("permission denied")),
    };

    const profile = await fetchRouteElevationProfile(geometry, broken);

    assert.equal(fetchCalls, 1, "저장소 실패 시 외부 질의로 넘어가야 한다");
    assert.ok(profile.values.length >= 2);
  });

  it("저장소를 주입하지 않으면 예전대로 동작한다", async () => {
    const profile = await fetchRouteElevationProfile(geometry);
    assert.equal(fetchCalls, 1);
    assert.ok(profile.values.length >= 2);
  });
});

describe("공유 키는 경로를 진짜로 구분한다", () => {
  it("시종점·좌표 수가 같아도 중간이 다르면 다른 키다", () => {
    const straight = lineOf([
      [126.978, 37.5665],
      [126.98, 37.568],
      [126.982, 37.5695],
    ]);
    const detour = lineOf([
      [126.978, 37.5665],
      [126.99, 37.58], // 중간만 다르다
      [126.982, 37.5695],
    ]);

    assert.equal(
      routeElevationSignature(straight),
      routeElevationSignature(detour),
      "전제 확인 — 기존 routeSig 는 이 둘을 구분하지 못한다",
    );
    assert.notEqual(
      routeElevationCacheKey(straight),
      routeElevationCacheKey(detour),
      "공유 저장소 키가 다른 경로를 같은 것으로 봤다 — 남의 표고를 받아가게 된다",
    );
  });

  it("같은 기하는 항상 같은 키다", () => {
    const a = lineOf([
      [126.978, 37.5665],
      [126.98, 37.568],
    ]);
    const b = lineOf([
      [126.978, 37.5665],
      [126.98, 37.568],
    ]);
    assert.equal(routeElevationCacheKey(a), routeElevationCacheKey(b));
    assert.match(routeElevationCacheKey(a), /^v1-2-[0-9a-f]{16}$/);
  });

  it("좌표가 2개 미만이면 키가 없다(저장소를 건드리지 않는다)", () => {
    assert.equal(routeElevationCacheKey(null), "");
    assert.equal(routeElevationCacheKey(lineOf([[126.978, 37.5665]])), "");
  });
});

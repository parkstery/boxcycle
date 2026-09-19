// 표고 한도 소진 재발 방지 계약(`RIDE-ELEVATION-QUOTA-1` B·C).
//   B. 같은 경로를 다시 열면 Open-Meteo 를 **다시 부르지 않는다**(routeSig 세션 캐시).
//   C. 429 는 다른 실패와 **구분된다**(UI 가 코드 회귀로 오인하지 않게).
// 브라우저 없이 fetch·sessionStorage 만 갈아끼워 순수 규칙으로 검증한다.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  ElevationQuotaError,
  clearRouteElevationCache,
  fetchElevationsForCoords,
  fetchRouteElevationProfile,
  isElevationQuotaError,
  readRouteElevationCache,
  routeElevationSignature,
  writeRouteElevationCache,
} from "../../src/lib/fetchRouteElevations.ts";
import type { LineStringGeometry } from "../../src/lib/geo.ts";

/** sessionStorage 최소 대역 — 라이브러리는 전역 `sessionStorage` 만 본다. */
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
  // `Object.keys(store)` 가 저장된 키를 돌려주도록 프록시로 감싼다(clearRouteElevationCache 가 쓴다).
  const proxied = new Proxy(store as unknown as Storage, {
    ownKeys: () => [...map.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
  (globalThis as { sessionStorage?: Storage }).sessionStorage = proxied;
  return map;
}

/** 20개 좌표의 직선 경로 — 실제 호출은 전부 가짜 fetch 가 받는다. */
const geometry: LineStringGeometry = {
  type: "LineString",
  coordinates: Array.from({ length: 20 }, (_, i) => [126.978 + i * 0.001, 37.5665 + i * 0.001]),
};

let fetchCalls = 0;
const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string) => Response) {
  fetchCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls += 1;
    return handler(String(input));
  }) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function elevationsFor(url: string): Response {
  const lat = new URL(url).searchParams.get("latitude") ?? "";
  const n = lat.split(",").length;
  return jsonResponse({ elevation: Array.from({ length: n }, (_, i) => 40 + i) });
}

beforeEach(() => {
  installFakeSessionStorage();
  clearRouteElevationCache();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("B. routeSig 세션 캐시", () => {
  it("같은 경로를 두 번 열어도 Open-Meteo 는 한 번만 부른다", async () => {
    stubFetch(elevationsFor);

    const first = await fetchRouteElevationProfile(geometry);
    assert.equal(fetchCalls, 1, "첫 로드는 실제로 질의해야 한다");
    assert.ok(first.values.length >= 2);

    const second = await fetchRouteElevationProfile(geometry);
    assert.equal(fetchCalls, 1, "두 번째 로드가 또 질의했다 — 캐시가 안 걸렸다");
    assert.deepEqual(second.values, first.values);
    assert.deepEqual(second.sampledCoords, first.sampledCoords);
  });

  it("다른 경로는 캐시를 공유하지 않는다", async () => {
    stubFetch(elevationsFor);
    await fetchRouteElevationProfile(geometry);

    const other: LineStringGeometry = {
      type: "LineString",
      coordinates: geometry.coordinates.map(([lng, lat]) => [lng + 1, lat + 1]),
    };
    assert.notEqual(routeElevationSignature(other), routeElevationSignature(geometry));

    await fetchRouteElevationProfile(other);
    assert.equal(fetchCalls, 2, "경로가 다른데 캐시가 재사용됐다");
  });

  it("축퇴 방어 — 형태가 깨진 캐시는 없는 것으로 친다", () => {
    const sig = routeElevationSignature(geometry);
    sessionStorage.setItem(`rtw.routeElevation.v1:${sig}`, JSON.stringify({ values: [1], sampledCoords: [] }));
    assert.equal(readRouteElevationCache(sig), null, "값 1개짜리 캐시가 통과했다");

    // 좌표 수와 값 수가 어긋난 것도 거부한다.
    writeRouteElevationCache(sig, { values: [1, 2, 3], sampledCoords: [[1, 2]] });
    assert.equal(readRouteElevationCache(sig), null, "길이가 어긋난 캐시가 저장됐다");
  });

  it("sessionStorage 가 없어도 로드는 성공한다", async () => {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
    stubFetch(elevationsFor);
    const profile = await fetchRouteElevationProfile(geometry);
    assert.ok(profile.values.length >= 2);
  });
});

describe("C. 429 는 다른 실패와 구분된다", () => {
  it("429 는 ElevationQuotaError 로 떨어진다", async () => {
    stubFetch(() =>
      jsonResponse({ reason: "Daily API request limit exceeded. Please try again tomorrow.", error: true }, 429),
    );

    const error = await fetchElevationsForCoords([
      [126.978, 37.5665],
      [126.979, 37.5666],
    ]).then(
      () => null,
      (e: unknown) => e,
    );

    assert.ok(isElevationQuotaError(error), "429 가 일반 실패로 뭉개졌다");
    assert.ok(error instanceof ElevationQuotaError);
  });

  it("500 은 한도 초과가 아니다", async () => {
    stubFetch(() => jsonResponse({}, 500));

    const error = await fetchElevationsForCoords([
      [126.978, 37.5665],
      [126.979, 37.5666],
    ]).then(
      () => null,
      (e: unknown) => e,
    );

    assert.ok(error instanceof Error);
    assert.equal(isElevationQuotaError(error), false, "일반 서버 오류가 한도 초과로 표시된다");
  });

  it("실패는 캐시에 남지 않는다 — 한도가 풀리면 다시 시도한다", async () => {
    stubFetch(() => jsonResponse({ error: true }, 429));
    await fetchRouteElevationProfile(geometry).catch(() => null);

    stubFetch(elevationsFor);
    const profile = await fetchRouteElevationProfile(geometry);
    assert.equal(fetchCalls, 1, "한도 해제 후 재시도가 일어나지 않았다");
    assert.ok(profile.values.length >= 2);
  });
});

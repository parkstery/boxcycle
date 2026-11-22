// 경로 거리 부족 안내 — 최소 거리(0.1 km 올림)와 판정 계약(순수 함수) + App 연결 계약.
import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  INTERVAL_ROUTE_BASIS_KMH,
  intervalMinRouteKm,
  intervalRouteHintRouteKey,
  resolveIntervalBasisKmh,
  resolveIntervalRouteShortfall,
} from "../../src/lib/route/intervalRouteDistance.ts";

const read = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

describe("M0 · 시험 자가 검산", () => {
  it("기준 속도는 25 이고 함수가 그 상수를 돌려준다", () => {
    assert.equal(INTERVAL_ROUTE_BASIS_KMH, 25);
    assert.equal(resolveIntervalBasisKmh(), INTERVAL_ROUTE_BASIS_KMH);
  });
});

describe("최소 경로 거리 — 0.1 km 올림", () => {
  it("15분 6.3 · 30분 12.5 · 10분 4.2", () => {
    assert.equal(intervalMinRouteKm(900), 6.3); // 6.25 올림
    assert.equal(intervalMinRouteKm(1800), 12.5); // 딱 떨어지면 그대로
    assert.equal(intervalMinRouteKm(600), 4.2); // 4.1666 올림
  });
  it("기준 속도를 바꾸면 함께 바뀐다(주입)", () => {
    assert.equal(intervalMinRouteKm(900, 20), 5);
    assert.equal(intervalMinRouteKm(900, 30), 7.5);
  });
  it("잘못된 입력은 0", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(intervalMinRouteKm(bad), 0);
    assert.equal(intervalMinRouteKm(900, 0), 0);
  });
});

describe("거리 부족 판정 — 화면에 보이는 숫자 기준", () => {
  it("6.3 km 경로는 짧지 않고 6.29 km 는 짧다(15분)", () => {
    assert.equal(resolveIntervalRouteShortfall({ remainingMeters: 6300, intervalSec: 900 }).short, false);
    assert.equal(resolveIntervalRouteShortfall({ remainingMeters: 6290, intervalSec: 900 }).short, true);
    // 6.25 km(올림 전 값)로 맞춘 경로도 화면의 6.3 보다 짧으므로 짧다.
    assert.equal(resolveIntervalRouteShortfall({ remainingMeters: 6250, intervalSec: 900 }).short, true);
  });
  it("짧다고 판정한 경로는 최소 거리보다 작은 숫자로 보인다", () => {
    const r = resolveIntervalRouteShortfall({ remainingMeters: 6290, intervalSec: 900 });
    assert.deepEqual([r.minKm, r.routeKm, r.basisKmh], [6.3, 6.2, 25]);
    const four = resolveIntervalRouteShortfall({ remainingMeters: 4200, intervalSec: 900 });
    assert.deepEqual([four.short, four.minKm, four.routeKm], [true, 6.3, 4.2]);
  });
  it("0·음수·NaN 입력은 short:false", () => {
    for (const bad of [0, -5, Number.NaN]) {
      assert.equal(resolveIntervalRouteShortfall({ remainingMeters: bad, intervalSec: 900 }).short, false);
      assert.equal(resolveIntervalRouteShortfall({ remainingMeters: 4000, intervalSec: bad }).short, false);
    }
  });
  it("0.1 km 경계 전수 — 5초 단위 인터벌 1분~2시간에서 최소 거리 경로는 짧지 않고 10 m 모자라면 짧다", () => {
    for (let sec = 60; sec <= 7200; sec += 5) {
      const minKm = intervalMinRouteKm(sec);
      const atMin = Math.round(minKm * 1000);
      assert.equal(resolveIntervalRouteShortfall({ remainingMeters: atMin, intervalSec: sec }).short, false, `${sec}s at ${minKm}`);
      assert.equal(resolveIntervalRouteShortfall({ remainingMeters: atMin - 10, intervalSec: sec }).short, true, `${sec}s below ${minKm}`);
      // 올림이므로 최소 거리는 25 km/h 로 인터벌 시간 이상을 달린다.
      assert.ok((minKm / 25) * 3600 >= sec - 1e-6, `${sec}s covers`);
      assert.ok(((minKm - 0.1) / 25) * 3600 < sec, `${sec}s is the smallest 0.1 step`);
    }
  });
});

describe("경로 키", () => {
  it("경로 없음은 null, 끝점·거리가 바뀌면 다른 키", () => {
    assert.equal(intervalRouteHintRouteKey(null, 0), null);
    assert.equal(intervalRouteHintRouteKey({ coordinates: [[127, 37]] }, 10), null);
    const a = intervalRouteHintRouteKey({ coordinates: [[127, 37], [127.01, 37.01]] }, 4000);
    assert.equal(a, intervalRouteHintRouteKey({ coordinates: [[127, 37], [127.01, 37.01]] }, 4000.2));
    assert.notEqual(a, intervalRouteHintRouteKey({ coordinates: [[127, 37], [127.02, 37.01]] }, 4000));
    assert.notEqual(a, intervalRouteHintRouteKey({ coordinates: [[127, 37], [127.01, 37.01]] }, 7000));
  });
});

describe("기준 속도는 한 곳 — 안내·시작 경고·간편 인터벌이 같은 함수를 쓴다", () => {
  const app = read("../../src/App.tsx");
  const quick = read("../../src/lib/ride/quickIntervalRoute.ts");
  const hook = read("../../src/hooks/useIntervalRouteHint.ts");
  const hint = read("../../src/components/ride/IntervalRouteHint.tsx");
  it("주행 시작 경고는 resolveIntervalRouteShortfall 로 판정하고 그 기준 속도를 보여 준다", () => {
    assert.match(app, /resolveIntervalRouteShortfall\(\{ remainingMeters, intervalSec: getRideIntervalTotalSec\(rideIntervalConfig\) \}\)/);
    assert.match(app, /speedKmh: shortfall\.basisKmh/);
    // 예전 기준(내 평균·없으면 20)이 시작 경고로 돌아오지 않는다.
    assert.doesNotMatch(app, /isRouteShorterThanInterval|resolveUserAverageKmh|DISTANCE_AUTO_ROUTE_FALLBACK_KMH/);
  });
  it("안내 훅·간편 인터벌도 같은 모듈에서 기준을 받는다", () => {
    assert.match(hook, /resolveIntervalRouteShortfall/);
    assert.match(quick, /resolveIntervalBasisKmh\(\)/);
  });
  it("25 를 직접 적은 곳이 없다(안내창·훅·App 의 인터벌 판정)", () => {
    assert.doesNotMatch(hint, /\b25\b/);
    assert.doesNotMatch(hook, /\b25\b/);
    assert.match(hint, /시속 \{basisKmh\} km 기준/);
  });
  it("App 은 간편 인터벌 탐색 중·설정 창 열림을 훅에 넘긴다", () => {
    assert.match(app, /quickSearching: quickInterval\.phase === "searching" \|\| quickInterval\.phase === "pick_start"/);
    assert.match(app, /deferred: rideIntervalSettingsOpen \|\| intervalRouteConfirmation !== null/);
    assert.match(app, /idle: rideStatus === "idle"/);
  });
});

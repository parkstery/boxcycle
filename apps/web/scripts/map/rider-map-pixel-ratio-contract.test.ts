import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getRiderMapMaxPixelRatio,
  installRiderMapPixelRatioCap,
  parseRiderMapMaxPixelRatio,
  resetRiderMapPixelRatioCapForTests,
  resolveRiderMapPixelRatio,
  RIDER_MAP_MAX_PIXEL_RATIO,
} from "../../src/lib/map/rtwMapConfig.ts";

type FakeWindow = {
  devicePixelRatio: number;
  location: { search: string };
};

function useFakeWindow(dpr: number, search: string): FakeWindow {
  const fake: FakeWindow = { devicePixelRatio: dpr, location: { search } };
  (globalThis as { window?: unknown }).window = fake;
  resetRiderMapPixelRatioCapForTests();
  return fake;
}

afterEach(() => {
  resetRiderMapPixelRatioCapForTests();
  Reflect.deleteProperty(globalThis, "window");
});

describe("지도 렌더 해상도 상한", () => {
  it("상수는 2", () => {
    assert.equal(RIDER_MAP_MAX_PIXEL_RATIO, 2);
  });

  it("DPR 1 → 1, 1.25 → 1.25, 3 → 2 (DPR ≤ 2 는 그대로)", () => {
    assert.equal(resolveRiderMapPixelRatio(1), 1);
    assert.equal(resolveRiderMapPixelRatio(1.25), 1.25);
    assert.equal(resolveRiderMapPixelRatio(2), 2);
    assert.equal(resolveRiderMapPixelRatio(3), 2);
  });

  it("쿼리 4 → DPR 3 이면 3", () => {
    assert.equal(parseRiderMapMaxPixelRatio("?maxdpr=4"), 4);
    assert.equal(resolveRiderMapPixelRatio(3, parseRiderMapMaxPixelRatio("?maxdpr=4")), 3);
  });

  it("잘못된 쿼리 → 상수", () => {
    for (const search of [
      "",
      "?foo=1",
      "?maxdpr=",
      "?maxdpr=abc",
      "?maxdpr=0",
      "?maxdpr=-1",
      "?maxdpr=0.5",
      "?maxdpr=5",
      "?maxdpr=99",
      "?maxdpr=NaN",
      "?maxdpr=Infinity",
    ]) {
      assert.equal(parseRiderMapMaxPixelRatio(search), 2, search);
    }
    assert.equal(parseRiderMapMaxPixelRatio(null), 2);
    assert.equal(parseRiderMapMaxPixelRatio(undefined), 2);
  });

  it("잘못된 상한·DPR 입력은 상수·1 로 복귀", () => {
    assert.equal(resolveRiderMapPixelRatio(3, Number.NaN), 2);
    assert.equal(resolveRiderMapPixelRatio(3, 0), 2);
    assert.equal(resolveRiderMapPixelRatio(3, 99), 2);
    assert.equal(resolveRiderMapPixelRatio(Number.NaN), 1);
    assert.equal(resolveRiderMapPixelRatio(0), 1);
  });

  it("?maxdpr= 는 페이지 수명 동안 한 번만 읽는다", () => {
    const fake = useFakeWindow(3, "?maxdpr=4");
    assert.equal(getRiderMapMaxPixelRatio(), 4);
    fake.location.search = "";
    assert.equal(getRiderMapMaxPixelRatio(), 4);
    resetRiderMapPixelRatioCapForTests();
    assert.equal(getRiderMapMaxPixelRatio(), 2);
  });

  it("설치는 JS 관측 DPR 을 min(실측, 상한) 으로 고정한다", () => {
    const fake = useFakeWindow(3, "");
    assert.equal(installRiderMapPixelRatioCap(), 2);
    assert.equal(fake.devicePixelRatio, 2);
    // 두 번 불러도 실측 스냅샷이 유지된다
    assert.equal(installRiderMapPixelRatioCap(), 2);
    assert.equal(fake.devicePixelRatio, 2);
  });

  it("브라우저 접근자가 있으면 배율 변화(확대·축소·모니터 이동)를 따라간다", () => {
    // 실제 브라우저처럼 devicePixelRatio 가 프로토타입 접근자인 창
    let live = 3;
    const proto = {};
    Object.defineProperty(proto, "devicePixelRatio", { configurable: true, get: () => live });
    const fake = Object.create(proto) as { devicePixelRatio: number; location: { search: string } };
    fake.location = { search: "" };
    (globalThis as { window?: unknown }).window = fake;
    resetRiderMapPixelRatioCapForTests();
    assert.equal(installRiderMapPixelRatioCap(), 2);
    assert.equal(fake.devicePixelRatio, 2);
    live = 1.25; // PC 브라우저 축소·다른 모니터
    assert.equal(fake.devicePixelRatio, 1.25);
    live = 1.75;
    assert.equal(fake.devicePixelRatio, 1.75);
    live = 4;
    assert.equal(fake.devicePixelRatio, 2);
  });
});

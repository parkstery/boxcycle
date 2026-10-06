import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RIDE_END_NORTH_UP_DURATION_MS,
  shouldEaseNorthUpOnRideActiveChange,
  isSameRouteLine,
} from "../../src/lib/map/rideEndNorthUp.ts";

/**
 * 주행 종료 정북 복귀 — 언제 ease 를 켤지 순수 판정.
 * rideActive = running|paused. idle 로 떨어질 때만 true.
 */
describe("shouldEaseNorthUpOnRideActiveChange", () => {
  it("종료(running/paused → idle): true", () => {
    assert.equal(shouldEaseNorthUpOnRideActiveChange(true, false), true);
  });

  it("일시정지·재개·주행 유지: false", () => {
    assert.equal(shouldEaseNorthUpOnRideActiveChange(true, true), false);
  });

  it("시작(idle → running): false", () => {
    assert.equal(shouldEaseNorthUpOnRideActiveChange(false, true), false);
  });

  it("idle 유지: false", () => {
    assert.equal(shouldEaseNorthUpOnRideActiveChange(false, false), false);
  });
});

describe("RIDE_END_NORTH_UP_DURATION_MS", () => {
  it("500~800ms", () => {
    assert.ok(RIDE_END_NORTH_UP_DURATION_MS >= 500);
    assert.ok(RIDE_END_NORTH_UP_DURATION_MS <= 800);
  });
});

describe("isSameRouteLine", () => {
  it("같은 참조·같은 끝점: true", () => {
    const g = {
      type: "LineString" as const,
      coordinates: [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
    };
    assert.equal(isSameRouteLine(g, g), true);
    assert.equal(
      isSameRouteLine(g, {
        type: "LineString",
        coordinates: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
      }),
      true,
    );
  });

  it("길이·끝점 다르면 false", () => {
    const a = {
      type: "LineString" as const,
      coordinates: [
        [1, 2],
        [5, 6],
      ],
    };
    assert.equal(
      isSameRouteLine(a, {
        type: "LineString",
        coordinates: [
          [1, 2],
          [9, 9],
        ],
      }),
      false,
    );
    assert.equal(isSameRouteLine(a, null), false);
  });
});

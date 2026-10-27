import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextRideUserZoomInDistanceM,
  nextRideUserZoomOutDistanceM,
} from "../../src/lib/camera/rideUserZoom";

describe("HUD 지도 축소 — 500m 임의 제한 없음 (2026-10-27 Chief)", () => {
  it("500m에서도 축소가 계속되어 625m가 된다", () => {
    assert.equal(nextRideUserZoomOutDistanceM(500), 625);
  });

  it("1000m 프리셋에서도 축소가 계속된다", () => {
    assert.equal(nextRideUserZoomOutDistanceM(1000), 1250);
  });

  it("축소 뒤 확대는 반대 비율로 돌아온다", () => {
    const farther = nextRideUserZoomOutDistanceM(500);
    assert.equal(nextRideUserZoomInDistanceM(farther), 500);
  });
});

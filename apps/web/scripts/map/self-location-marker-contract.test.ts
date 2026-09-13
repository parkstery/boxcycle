// Self-location marker — class·bearing 계약. live nametag·peer 와 분리.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SELF_LOCATION_HOST_CLASS,
  SELF_LOCATION_MARKER_CLASS,
  normalizeBearingDeg,
  updateSelfLocationMarkerBearing,
  viewportBearingDeg,
} from "../../src/lib/mapSelfLocationMarker.ts";

describe("mapSelfLocationMarker — 계약", () => {
  it("class 가 live nametag·peer 와 겹치지 않는다", () => {
    assert.equal(SELF_LOCATION_HOST_CLASS, "map-view__self-location-host");
    assert.equal(SELF_LOCATION_MARKER_CLASS, "map-view__self-location-marker");
    assert.ok(!SELF_LOCATION_HOST_CLASS.includes("rider-nametag"));
    assert.ok(!SELF_LOCATION_HOST_CLASS.includes("peer"));
  });

  it("bearing 갱신 — 유효 각도면 표시, null 이면 숨김", () => {
    const bearingEl = { style: { opacity: "", transform: "" } } as HTMLDivElement;
    updateSelfLocationMarkerBearing(bearingEl, 90);
    assert.equal(bearingEl.style.opacity, "1");
    assert.match(bearingEl.style.transform, /rotate\(90deg\)/);
    updateSelfLocationMarkerBearing(bearingEl, null);
    assert.equal(bearingEl.style.opacity, "0");
  });

  it("viewport 보정 — north-up 이면 지리 방위 그대로", () => {
    assert.equal(viewportBearingDeg(90, 0), 90);
    assert.equal(viewportBearingDeg(0, 0), 0);
  });

  it("viewport 보정 — 지도 bearing 만큼 빼서 화면 진행방향에 맞춘다", () => {
    assert.equal(viewportBearingDeg(90, 90), 0);
    assert.equal(viewportBearingDeg(0, 90), 270);
    assert.equal(viewportBearingDeg(10, 350), 20);
    assert.equal(normalizeBearingDeg(-90), 270);
  });
});

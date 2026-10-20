/**
 * MapView Mapbox 컨트롤 등록 계약 — 지구본·나침반(우상단) 제거 후 축척·고도는 유지.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const mapViewSrc = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/components/map/MapView.tsx"),
  "utf8",
);

test("MapView는 우상단 지구본·나침반 컨트롤을 등록하지 않는다", () => {
  assert.doesNotMatch(mapViewSrc, /MapZoomGlobeControl/);
  assert.doesNotMatch(mapViewSrc, /NavigationControl/);
  assert.doesNotMatch(mapViewSrc, /addControl\([^)]*["']top-right["']/);
});

test("MapView는 하단 축척·고도 컨트롤을 등록한다", () => {
  assert.match(mapViewSrc, /createFixedScaleBoxControl\(\)/);
  assert.match(mapViewSrc, /new MapCameraAltitudeControl\(\)/);
  assert.match(mapViewSrc, /addControl\(createFixedScaleBoxControl\(\),\s*["']bottom-right["']\)/);
  assert.match(mapViewSrc, /addControl\(new MapCameraAltitudeControl\(\),\s*["']bottom-right["']\)/);
});

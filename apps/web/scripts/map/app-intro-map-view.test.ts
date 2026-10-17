import assert from "node:assert/strict";
import test from "node:test";
import { createAppIntroMapView } from "../../src/lib/map/appIntroMapView.ts";

const COLOSSEUM_LNG = 12.4922;
const COLOSSEUM_LAT = 41.8902;

test("인트로 카메라는 콜로세움을 화면 너비 70%에 둔다", () => {
  const width = 800;
  const view = createAppIntroMapView(width);
  assert.equal(view.zoom, 16);
  assert.equal(view.lngLat[1], COLOSSEUM_LAT);
  const worldPx = 512 * 2 ** view.zoom;
  const shiftPx = ((COLOSSEUM_LNG - view.lngLat[0]) * worldPx) / 360;
  const screenX = width / 2 + shiftPx;
  assert.ok(Math.abs(screenX / width - 0.7) < 0.001);
});

test("너비가 없으면 800px 기준으로 프레이밍한다", () => {
  assert.deepEqual(createAppIntroMapView(Number.NaN), createAppIntroMapView(800));
  assert.deepEqual(createAppIntroMapView(0), createAppIntroMapView(800));
});

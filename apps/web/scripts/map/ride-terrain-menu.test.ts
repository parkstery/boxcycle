import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { MapCameraAltitudeControl } from "../../src/components/map/MapCameraAltitudeControl.ts";
import { rideTerrainMenuVisible } from "../../src/lib/map/rtwMapConfig.ts";

test("주행 카메라 메뉴의 「3D 뷰」는 숨기고 ?ride3d=1 에서만 보인다", () => {
  for (const off of ["", "?ride3d=0", "?ride3d", "?fps=1", null]) assert.equal(rideTerrainMenuVisible(off), false, String(off));
  assert.equal(rideTerrainMenuVisible("?fps=1&ride3d=1"), true);
  // 실제 화면 연결 — 함수를 넘기지 않아야 메뉴에서 사라진다.
  const app = fs.readFileSync(fileURLToPath(new URL("../../src/App.tsx", import.meta.url)), "utf8");
  assert.match(app, /onEnable3D: RIDE_TERRAIN_MENU \? setEnable3D : undefined/);
  assert.match(app, /RIDE_TERRAIN_MENU = rideTerrainMenuVisible\(/);
});

test("지형이 꺼지면 「높이」(지면 기준), 켜지면 「고도」(해수면 기준)로 보인다", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = globals.document;
  const made: Array<{ attrs: Record<string, string>; title?: string; textContent?: string }> = [];
  globals.document = {
    createElement: () => {
      const el = { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; }, appendChild() {}, remove() {} };
      made.push(el);
      return el;
    },
  };
  let terrain: unknown = null;
  let update: () => void = () => {};
  const map = {
    getTerrain: () => terrain,
    getFreeCameraOptions: () => ({ position: { toAltitude: () => 1.5 } }),
    on: (_e: string, fn: () => void) => { update = fn; }, off() {},
  };
  try {
    const control = new MapCameraAltitudeControl();
    control.onAdd(map as never);
    const label = made[1];
    assert.equal(label.textContent, "높이 1.5 m");
    assert.equal(label.attrs["aria-label"], "카메라 높이(지면 기준)");
    terrain = {};
    update();
    assert.equal(label.attrs["aria-label"], "카메라 고도(해수면 기준)");
    assert.equal(label.title, "카메라 고도(해수면 기준)");
    assert.equal(label.textContent, "고도 1.5 m");
    terrain = null;
    update();
    assert.equal(label.attrs["aria-label"], "카메라 높이(지면 기준)");
    assert.equal(label.textContent, "높이 1.5 m");
    control.onRemove();
  } finally {
    globals.document = saved;
  }
});

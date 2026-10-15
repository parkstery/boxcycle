/**
 * rider14 상체 흔들림 (W1).
 * 실행: npm run test:rider-preserve (PowerShell, apps/web)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Material, Mesh, type Object3D } from "three";
import { PreservedRiderRig } from "../../src/lib/riderPrototype/preservedRiderRig";
import { getRiderModelProfile } from "../../src/lib/riderPrototype/riderModelProfile";
import { computeRiderSway, RiderSwayEnvelope } from "../../src/lib/riderPrototype/riderSway";
import {
  attachPaletteStubMap,
  loadPreservedTestGlb,
  loadPreservedTestGuides,
  meshNameOf,
} from "./rider-glb-test-loader";

const S5_ID = "20260921-041426-cd81398e";
const RIDER14_ID = "20261015-212136-df8de090";

/** 뷰어 `updateSway` 를 UI 기본값(어깨 0.5°·자전거 0.4°·bob 2 mm·lag −60°·무릎 반대 끔)으로 고정해 다시 적은 식. */
function viewerSway(phaseRev: number, crankPhaseR: number, envelope: number): {
  shaderRollRad: number;
  bobM: number;
  bikeRollRad: number;
} {
  const sign = 1;
  const a = phaseRev * 2 * Math.PI;
  const lag = -60 * Math.PI / 180;
  const wave = Math.cos(a - crankPhaseR - lag);
  const shoulder = 0.5 * Math.PI / 180;
  const bike = 0.4 * Math.PI / 180;
  const bob = 2 / 1000;
  const bikeRollRad = -sign * bike * wave * envelope;
  const bodyRollRad = sign * shoulder * wave * envelope;
  return {
    shaderRollRad: (bodyRollRad - bikeRollRad),
    bobM: -bob * (0.5 + 0.5 * Math.cos(2 * (a - crankPhaseR))) * envelope,
    bikeRollRad,
  };
}

function assertClose(
  actual: { shaderRollRad: number; bobM: number; bikeRollRad: number },
  expected: { shaderRollRad: number; bobM: number; bikeRollRad: number },
): void {
  assert.ok(Math.abs(actual.shaderRollRad - expected.shaderRollRad) < 1e-12, `shader ${actual.shaderRollRad} vs ${expected.shaderRollRad}`);
  assert.ok(Math.abs(actual.bobM - expected.bobM) < 1e-12, `bob ${actual.bobM} vs ${expected.bobM}`);
  assert.ok(Math.abs(actual.bikeRollRad - expected.bikeRollRad) < 1e-12, `bike ${actual.bikeRollRad} vs ${expected.bikeRollRad}`);
}

function materialsOf(root: Object3D): Material[] {
  const seen = new Set<Material>();
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of list) {
      if (material) seen.add(material);
    }
  });
  return [...seen];
}

describe("computeRiderSway", () => {
  const crankPhaseR = 0.37;

  it("위상 0·45·…·315° 가 뷰어 식과 1e-12 이내", () => {
    for (let deg = 0; deg < 360; deg += 45) {
      const phaseRev = deg / 360;
      assertClose(
        computeRiderSway(phaseRev, crankPhaseR, 1),
        viewerSway(phaseRev, crankPhaseR, 1),
      );
      assertClose(
        computeRiderSway(phaseRev, crankPhaseR, 0.5),
        viewerSway(phaseRev, crankPhaseR, 0.5),
      );
    }
  });

  it("envelope 0 이면 세 값이 모두 0", () => {
    const z = computeRiderSway(0.3, crankPhaseR, 0);
    assert.equal(z.shaderRollRad, 0);
    assert.equal(z.bobM, 0);
    assert.equal(z.bikeRollRad, 0);
  });

  it("기본값 극값: |bikeRoll| 0.4°, |shaderRoll| 0.9°, bob −2 mm … 0", () => {
    const lag = -60 * Math.PI / 180;
    const crank = 0.2;
    const at = (a: number) => computeRiderSway(a / (2 * Math.PI), crank, 1);
    const wave1 = at(crank + lag);
    const waveNeg = at(crank + lag + Math.PI);
    assert.ok(Math.abs(Math.abs(wave1.bikeRollRad) * 180 / Math.PI - 0.4) < 1e-12);
    assert.ok(Math.abs(Math.abs(waveNeg.bikeRollRad) * 180 / Math.PI - 0.4) < 1e-12);
    assert.ok(Math.abs(Math.abs(wave1.shaderRollRad) * 180 / Math.PI - 0.9) < 1e-12);
    assert.ok(Math.abs(Math.abs(waveNeg.shaderRollRad) * 180 / Math.PI - 0.9) < 1e-12);
    const bobMin = at(crank);
    const bobMax = at(crank + Math.PI / 2);
    assert.ok(Math.abs(bobMin.bobM - (-0.002)) < 1e-12);
    assert.ok(Math.abs(bobMax.bobM - 0) < 1e-12);
  });
});

describe("RiderSwayEnvelope", () => {
  it("위상이 계속 바뀌면 2 s 후 1 에 가깝다", () => {
    const env = new RiderSwayEnvelope();
    let phase = 0;
    let value = env.update("a", phase, 0, true);
    assert.equal(value, 0, "새 id 는 0");
    for (let t = 20; t <= 2000; t += 20) {
      phase += 0.01;
      value = env.update("a", phase, t, true);
    }
    assert.ok(value > 0.99, `moving ${value}`);
  });

  it("멈추면 300 ms 유지 뒤 0 으로 내려가고, 목표 0 이 된 뒤 2 s 면 0.01 미만", () => {
    const env = new RiderSwayEnvelope();
    let phase = 0;
    env.update("a", phase, 0, true);
    let value = 0;
    for (let t = 20; t <= 2000; t += 20) {
      phase += 0.01;
      value = env.update("a", phase, t, true);
    }
    assert.ok(value > 0.99);
    let at2s = value;
    for (let t = 2020; t <= 4000; t += 20) {
      at2s = env.update("a", phase, t, true);
    }
    // 마지막 위상 변화(t=2000) 후 300 ms 는 목표 1. 순수 감쇠는 1.7 s → 약 0.014.
    assert.ok(at2s < 0.015, `stop 2.0s ${at2s}`);
    assert.ok(at2s > 0.01, `hold window still visible ${at2s}`);
    let at23 = at2s;
    for (let t = 4020; t <= 4300; t += 20) {
      at23 = env.update("a", phase, t, true);
    }
    assert.ok(at23 < 0.01, `stop 2.3s ${at23}`);
  });

  it("enabled=false 면 위상이 바뀌어도 2 s 후 0.01 미만", () => {
    const env = new RiderSwayEnvelope();
    let phase = 0;
    env.update("a", phase, 0, true);
    for (let t = 20; t <= 2000; t += 20) {
      phase += 0.01;
      env.update("a", phase, t, true);
    }
    let value = 1;
    for (let t = 2020; t <= 4000; t += 20) {
      phase += 0.01;
      value = env.update("a", phase, t, false);
    }
    assert.ok(value < 0.01, `disabled ${value}`);
  });

  it("새 id 는 0 이고 prune 은 그 id 만 지운다", () => {
    const env = new RiderSwayEnvelope();
    assert.equal(env.update("fresh", 1, 0, true), 0);
    let phaseA = 0;
    let phaseB = 3;
    env.update("a", phaseA, 0, true);
    env.update("b", phaseB, 0, true);
    let a = 0;
    for (let t = 20; t <= 2000; t += 20) {
      phaseA += 0.01;
      phaseB += 0.02;
      a = env.update("a", phaseA, t, true);
      env.update("b", phaseB, t, true);
    }
    assert.ok(a > 0.99);
    env.prune(new Set(["a"]));
    assert.ok(env.update("a", phaseA, 2000, true) > 0.99);
    assert.equal(env.update("b", phaseB, 2000, true), 0);
    env.prune(new Set());
    assert.equal(env.update("a", phaseA + 1, 2100, true), 0);
  });
});

describe("rig sway shader", async () => {
  const s5Scene = await loadPreservedTestGlb(S5_ID);
  const r14Loaded = await loadPreservedTestGlb(RIDER14_ID);

  it("rider14 장면의 static__Palette 만 _sway 10792", () => {
    let palette = 0;
    r14Loaded.scene.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const sway = item.geometry.getAttribute("_sway");
      if (meshNameOf(item) === "static__Palette") {
        palette += 1;
        assert.ok(sway, "static__Palette _sway");
        assert.equal(sway.count, 10792);
      } else {
        assert.equal(sway, undefined, meshNameOf(item));
      }
    });
    assert.equal(palette, 1);
  });

  const s5 = new PreservedRiderRig(
    s5Scene.scene,
    loadPreservedTestGuides(S5_ID),
    getRiderModelProfile("s5"),
  );
  attachPaletteStubMap(r14Loaded.scene);
  const r14 = new PreservedRiderRig(
    r14Loaded.scene,
    loadPreservedTestGuides(RIDER14_ID),
    getRiderModelProfile("rider14"),
  );

  it("bake 후에도 static__Palette 의 _sway 만 남는다", () => {
    let palette = 0;
    r14.object.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const sway = item.geometry.getAttribute("_sway");
      if (item.name === "static__Palette") {
        palette += 1;
        assert.ok(sway);
        assert.equal(sway.count, 10792);
      } else {
        assert.equal(sway, undefined, item.name);
      }
    });
    assert.equal(palette, 1);
  });

  it("s5 는 셰이더를 설치하지 않는다", () => {
    assert.equal(s5.supportsSway, false);
    const materials = materialsOf(s5.object);
    assert.ok(materials.length > 0);
    for (const material of materials) {
      assert.equal(material.onBeforeCompile, Material.prototype.onBeforeCompile);
      assert.equal(material.customProgramCacheKey, Material.prototype.customProgramCacheKey);
    }
  });

  it("rider14 셰이더 주입·균일 변수·캐시 키", () => {
    assert.equal(r14.supportsSway, true);
    assert.equal(getRiderModelProfile("rider14").supportsSway, true);
    assert.equal(getRiderModelProfile("s5").supportsSway, false);
    const materials = materialsOf(r14.object);
    assert.equal(materials.length, 1);
    const material = materials[0]!;
    assert.equal(material.customProgramCacheKey(), "rider-sway-v1");
    r14.setSway({ shaderRollRad: 0.0123, bobM: -0.002 });
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: "#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>",
    };
    material.onBeforeCompile(shader as never);
    assert.match(shader.vertexShader, /#include <common>/);
    assert.match(shader.vertexShader, /attribute float _sway/);
    assert.match(shader.vertexShader, /uniform float uSwayRoll/);
    assert.match(shader.vertexShader, /uniform float uSwayBob/);
    assert.match(shader.vertexShader, /uniform vec3 uSwayPivot/);
    assert.match(shader.vertexShader, /#include <beginnormal_vertex>/);
    assert.match(shader.vertexShader, /objectNormal = vec3\(objectNormal\.x, objectNormal\.y \* swC - objectNormal\.z \* swS, objectNormal\.y \* swS \+ objectNormal\.z \* swC\)/);
    assert.match(shader.vertexShader, /#include <begin_vertex>/);
    assert.match(shader.vertexShader, /transformed\.y \+= uSwayBob \* _sway/);
    assert.equal(shader.uniforms.uSwayRoll?.value, 0.0123);
    assert.equal(shader.uniforms.uSwayBob?.value, -0.002);
    const pivot = shader.uniforms.uSwayPivot?.value as { x: number; y: number; z: number };
    assert.equal(pivot.x, -0.2);
    assert.equal(pivot.y, 1);
    assert.equal(pivot.z, 0);
    r14.setSway({ shaderRollRad: 0, bobM: 0 });
    assert.equal(shader.uniforms.uSwayRoll?.value, 0);
    assert.equal(shader.uniforms.uSwayBob?.value, 0);
  });

  it("setSway 는 CPU 다리 정점·강체 행렬을 바꾸지 않는다", () => {
    r14.setPhase(0.25);
    const leg = (() => {
      let found: Mesh | null = null;
      r14.object.traverse((item) => {
        if (item instanceof Mesh && item.name === "legR__Material_5") found = item;
      });
      assert.ok(found);
      return found;
    })();
    const position = leg.geometry.getAttribute("position");
    const x = position.getX(0);
    const crank = r14.object.getObjectByName("preserved-crank");
    assert.ok(crank);
    const before = crank.matrix.elements.slice();
    r14.setSway({ shaderRollRad: 0.2, bobM: -0.002 });
    assert.equal(position.getX(0), x);
    assert.deepEqual(Array.from(crank.matrix.elements), before);
    r14.setSway({ shaderRollRad: 0, bobM: 0 });
    const phase = r14.crankPhaseR;
    r14.setPhase(0.8);
    assert.equal(r14.crankPhaseR, phase);
  });
});

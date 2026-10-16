/**
 * G1 — 다리 DQS GPU 스키닝.
 * 리그 수학은 바꾸지 않으므로, 순수 JS 함수(`skinVertexDQ`)가 CPU 경로와
 * 같은 값을 내는지(8위상·다리 6메시 전 정점), GLSL 이 같은 식인지,
 * `?skin=gpu` 리그 배선(좌·우 복제 머티리얼·유니폼·캐시 키·폴백)이
 * 기대대로인지를 본다. 기존 `rider14-equivalence.test.ts` 는 손대지 않는다.
 *
 * 실행: npm run test:rider-preserve (PowerShell, apps/web)
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BufferAttribute, DataTexture, Mesh, MeshStandardMaterial, type Material, type Object3D } from "three";
import { PreservedRiderRig } from "../../src/lib/riderPrototype/preservedRiderRig.ts";
import {
  packSkinDQ,
  RIDER_SKIN_COMMON_GLSL,
  RIDER_SKIN_NORMAL_CHUNK,
  RIDER_SKIN_VERTEX_CHUNK,
  skinVertexDQ,
} from "../../src/lib/riderPrototype/riderGpuSkin.ts";
import {
  noteEffectiveRiderSkinMode,
  readEffectiveRiderSkinMode,
  readRiderSkinModeSearch,
  resetRiderSkinModeForTests,
} from "../../src/lib/riderPrototype/riderSkinMode.ts";
import { getRiderModelProfile } from "../../src/lib/riderPrototype/riderModelProfile.ts";
import { RiderPaletteKit } from "../../src/lib/riderPrototype/riderPaletteKit.ts";
import {
  attachPaletteStubMap,
  loadPreservedTestGlb,
  loadPreservedTestGuides,
} from "./rider-glb-test-loader.ts";

const RIDER14_ID = "20261015-212136-df8de090";
const S5_ID = "20260921-041426-cd81398e";

const PHASES_DEG = [0, 45, 90, 135, 180, 225, 270, 315];
const POS_TOL_M = 1e-5;
const NORMAL_TOL_DEG = 0.1;

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

function paletteMaterialsOf(root: Object3D): MeshStandardMaterial[] {
  return materialsOf(root).filter(
    (material): material is MeshStandardMaterial =>
      material instanceof MeshStandardMaterial &&
      typeof material.userData?.palette === "object" &&
      material.userData.palette !== null,
  );
}

function legMeshesOf(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((item) => {
    if (item instanceof Mesh && /^leg[RL]__/.test(item.name)) out.push(item);
  });
  return out;
}

async function buildRider14(options?: { skinMode?: "cpu" | "gpu" }): Promise<PreservedRiderRig> {
  const { scene } = await loadPreservedTestGlb(RIDER14_ID);
  attachPaletteStubMap(scene);
  return new PreservedRiderRig(scene, loadPreservedTestGuides(RIDER14_ID), getRiderModelProfile("rider14"), options);
}

describe("skin mode switch", () => {
  it("?skin=gpu 만 gpu, 나머지는 전부 cpu(기본 cpu)", () => {
    assert.equal(readRiderSkinModeSearch(""), "cpu");
    assert.equal(readRiderSkinModeSearch("?skin=cpu"), "cpu");
    assert.equal(readRiderSkinModeSearch("?skin=gpu"), "gpu");
    assert.equal(readRiderSkinModeSearch("?skin=GPU"), "cpu");
    assert.equal(readRiderSkinModeSearch("?foo=1&skin=gpu"), "gpu");
    assert.equal(readRiderSkinModeSearch("???"), "cpu");
  });

  it("effective 기본 cpu · note/read", () => {
    resetRiderSkinModeForTests();
    assert.equal(readEffectiveRiderSkinMode(), "cpu");
    noteEffectiveRiderSkinMode("gpu");
    assert.equal(readEffectiveRiderSkinMode(), "gpu");
    resetRiderSkinModeForTests();
    assert.equal(readEffectiveRiderSkinMode(), "cpu");
  });
});

describe("packSkinDQ", () => {
  it("4 본 DQ 를 uSkinDQ[8] 레이아웃([2b] 실수부·[2b+1] 쌍대부)으로 싣는다", () => {
    const dq = [0, 1, 2, 3].map((b) => Float64Array.from([b + 0.1, b + 0.2, b + 0.3, b + 0.4, b + 1.1, b + 1.2, b + 1.3, b + 1.4]));
    const out = new Float32Array(32);
    packSkinDQ(dq, out);
    for (let bone = 0; bone < 4; bone++) {
      for (let k = 0; k < 4; k++) {
        assert.equal(out[bone * 8 + k], Math.fround(dq[bone]![k]!));
        assert.equal(out[bone * 8 + 4 + k], Math.fround(dq[bone]![4 + k]!));
      }
    }
  });
});

describe("GLSL single source", () => {
  it("공통 선언·두 청크가 같은 헬퍼를 쓰고 스킨→흔들림 순서 계약을 지킨다", () => {
    assert.match(RIDER_SKIN_COMMON_GLSL, /attribute vec4 skinWeight;/);
    assert.match(RIDER_SKIN_COMMON_GLSL, /uniform vec4 uSkinDQ\[8\];/);
    assert.match(RIDER_SKIN_COMMON_GLSL, /cross\(q\.xyz, v\) \+ q\.w \* v/);
    assert.match(RIDER_SKIN_COMMON_GLSL, /cross\(q\.xyz, c\)/);
    assert.match(RIDER_SKIN_COMMON_GLSL, /q\.w \* e\.xyz - e\.w \* q\.xyz/);
    assert.match(RIDER_SKIN_NORMAL_CHUNK, /rtwSkinBlend\(skinWeight, rtwQ, rtwE\);/);
    assert.match(RIDER_SKIN_NORMAL_CHUNK, /objectNormal = rtwSkinNormal\(objectNormal, rtwQ\);/);
    assert.match(RIDER_SKIN_VERTEX_CHUNK, /rtwSkinBlend\(skinWeight, rtwQ, rtwE\);/);
    assert.match(RIDER_SKIN_VERTEX_CHUNK, /transformed = rtwSkinPosition\(transformed, rtwQ, rtwE\);/);
  });
});

describe("skinVertexDQ = CPU path", () => {
  let rig: PreservedRiderRig;
  before(async () => {
    resetRiderSkinModeForTests();
    rig = await buildRider14();
    assert.equal(rig.skinModeValue, "cpu");
  });
  after(() => {
    rig.dispose();
    resetRiderSkinModeForTests();
  });

  it("8위상·다리 6메시 전 정점: 위치 ≤ 1e-5 m · 법선 ≤ 0.1°", () => {
    const rows: { phaseDeg: number; worstPosM: number; worstNormalDeg: number; worstMesh: string }[] = [];
    for (const deg of PHASES_DEG) {
      const phaseRev = deg / 360;
      rig.setPhase(phaseRev);
      let worstPos = 0;
      let worstNormal = 0;
      let worstMesh = "";
      for (const side of ["R", "L"] as const) {
        const dq = rig.skinDQForTests(side, phaseRev);
        for (const draw of rig.legDrawsForTests(side)) {
          const position = draw.mesh.geometry.getAttribute("position") as BufferAttribute;
          const normal = draw.mesh.geometry.getAttribute("normal") as BufferAttribute;
          for (let i = 0; i < position.count; i++) {
            const rest: [number, number, number] = [
              draw.restPosition[i * 3]!,
              draw.restPosition[i * 3 + 1]!,
              draw.restPosition[i * 3 + 2]!,
            ];
            const restN: [number, number, number] = [
              draw.restNormal[i * 3]!,
              draw.restNormal[i * 3 + 1]!,
              draw.restNormal[i * 3 + 2]!,
            ];
            const w: [number, number, number, number] = [
              draw.weights[i * 4]!,
              draw.weights[i * 4 + 1]!,
              draw.weights[i * 4 + 2]!,
              draw.weights[i * 4 + 3]!,
            ];
            const got = skinVertexDQ(rest, restN, w, dq);
            const pos = Math.hypot(
              got.position[0] - position.getX(i),
              got.position[1] - position.getY(i),
              got.position[2] - position.getZ(i),
            );
            if (pos > worstPos) {
              worstPos = pos;
              worstMesh = draw.name;
            }
            // 방향만 비교한다 — 저장된 법선은 float32 라 길이가 1±1e-7 로
            // 흔들리고, 그 길이 오차를 각도로 재면(acos 특성상) 부풀려진다.
            // 동등성 시험(`legDelta`)도 같은 방식으로 정규화 후 비교한다.
            const sx = normal.getX(i);
            const sy = normal.getY(i);
            const sz = normal.getZ(i);
            const sl = Math.hypot(sx, sy, sz) || 1;
            const dot = (got.normal[0] * sx + got.normal[1] * sy + got.normal[2] * sz) / sl;
            const angle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
            if (angle > worstNormal) {
              worstNormal = angle;
              worstMesh = draw.name;
            }
          }
        }
      }
      rows.push({ phaseDeg: deg, worstPosM: worstPos, worstNormalDeg: worstNormal, worstMesh });
    }
    console.table(rows.map((r) => ({
      phaseDeg: r.phaseDeg,
      worstPosM: r.worstPosM.toExponential(3),
      worstNormalDeg: r.worstNormalDeg.toExponential(3),
      worstMesh: r.worstMesh,
    })));
    for (const r of rows) {
      assert.ok(r.worstPosM <= POS_TOL_M, `phase ${r.phaseDeg}° pos ${r.worstPosM} (${r.worstMesh})`);
      assert.ok(r.worstNormalDeg <= NORMAL_TOL_DEG, `phase ${r.phaseDeg}° normal ${r.worstNormalDeg}° (${r.worstMesh})`);
    }
  });

  it("CPU 모드 rig 는 머티리얼 1개·스킨 주입 없음(기존 배선 그대로)", () => {
    assert.equal(materialsOf(rig.object).length, 1);
    assert.equal(paletteMaterialsOf(rig.object).length, 1);
    for (const mesh of legMeshesOf(rig.object)) {
      assert.equal(mesh.geometry.getAttribute("skinWeight")?.itemSize, 4);
    }
  });
});

describe("gpu rig wiring", () => {
  let rig: PreservedRiderRig;
  before(async () => {
    resetRiderSkinModeForTests();
    rig = await buildRider14({ skinMode: "gpu" });
    assert.equal(rig.skinModeValue, "gpu");
    assert.equal(readEffectiveRiderSkinMode(), "gpu");
  });
  after(() => {
    try {
      rig.dispose();
    } catch {
      /* before 실패 시에는 할 일 없음 */
    }
    resetRiderSkinModeForTests();
  });

  it("팔레트 머티리얼 3개(공용 + 다리 좌·우 복제), 캐시 키 구분", () => {
    const palettes = paletteMaterialsOf(rig.object);
    assert.equal(palettes.length, 3);
    const keys = new Map<Material, string>();
    for (const material of materialsOf(rig.object)) {
      keys.set(material, material.customProgramCacheKey());
    }
    const legKeys = new Set<string>();
    for (const mesh of legMeshesOf(rig.object)) {
      const material = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material!;
      legKeys.add(keys.get(material)!);
    }
    assert.deepEqual([...legKeys].sort(), ["rider-sway-v1:skin-gpu"]);
    const staticMesh = (() => {
      let found: Mesh | null = null;
      rig.object.traverse((item) => {
        if (item instanceof Mesh && item.name === "static__Palette") found = item;
      });
      assert.ok(found);
      return found;
    })();
    const staticMaterial = Array.isArray(staticMesh.material) ? staticMesh.material[0]! : staticMesh.material!;
    assert.equal(keys.get(staticMaterial), "rider-sway-v1");
    // 좌·우 다리는 서로 다른 머티리얼(유니폼이 다르다)
    const matR = (() => {
      let found: Material | null = null;
      rig.object.traverse((item) => {
        if (item instanceof Mesh && item.name === "legR__Material_5") {
          found = Array.isArray(item.material) ? item.material[0]! : item.material!;
        }
      });
      return found;
    })();
    const matL = (() => {
      let found: Material | null = null;
      rig.object.traverse((item) => {
        if (item instanceof Mesh && item.name === "legL__Material_5") {
          found = Array.isArray(item.material) ? item.material[0]! : item.material!;
        }
      });
      return found;
    })();
    assert.ok(matR && matL && matR !== matL);
    assert.ok(matR !== staticMaterial && matL !== staticMaterial);
  });

  it("다리 셰이더에 스킨+흔들림 주입, 정적 셰이더는 흔들림만", () => {
    const shaderOf = (material: Material) => {
      const shader = {
        uniforms: {} as Record<string, { value: unknown }>,
        vertexShader: "#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>",
      };
      material.onBeforeCompile(shader as never);
      return shader;
    };
    let legMat: Material | null = null;
    rig.object.traverse((item) => {
      if (item instanceof Mesh && item.name === "legR__Material_5") {
        legMat = Array.isArray(item.material) ? item.material[0]! : item.material!;
      }
    });
    assert.ok(legMat);
    const leg = shaderOf(legMat);
    assert.match(leg.vertexShader, /attribute vec4 skinWeight;/);
    assert.match(leg.vertexShader, /uniform vec4 uSkinDQ\[8\];/);
    assert.match(leg.vertexShader, /objectNormal = rtwSkinNormal\(objectNormal, rtwQ\);/);
    assert.match(leg.vertexShader, /transformed = rtwSkinPosition\(transformed, rtwQ, rtwE\);/);
    // 스킨 다음에 흔들림(스킨 결과에 흔들림이 얹힌다)
    assert.ok(leg.vertexShader.indexOf("rtwSkinPosition") < leg.vertexShader.indexOf("uSwayBob * _sway"));
    assert.ok(leg.vertexShader.indexOf("rtwSkinNormal") < leg.vertexShader.indexOf("objectNormal = vec3(objectNormal.x,"));
    assert.ok(leg.uniforms.uSkinDQ, "uSkinDQ uniform");
    assert.ok(leg.uniforms.uSwayRoll, "uSwayRoll uniform");
    let staticMat: Material | null = null;
    rig.object.traverse((item) => {
      if (item instanceof Mesh && item.name === "static__Palette") {
        staticMat = Array.isArray(item.material) ? item.material[0]! : item.material!;
      }
    });
    assert.ok(staticMat);
    const stat = shaderOf(staticMat);
    assert.doesNotMatch(stat.vertexShader, /uSkinDQ/);
    assert.match(stat.vertexShader, /transformed\.y \+= uSwayBob \* _sway/);
  });

  it("GPU 모드 setPhase: 버퍼는 휴지 그대로, uSkinDQ 만 바뀐다", () => {
    rig.setPhase(0.1);
    const snap = (mesh: Mesh) => {
      const position = mesh.geometry.getAttribute("position") as BufferAttribute;
      const out = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        out[i * 3] = position.getX(i);
        out[i * 3 + 1] = position.getY(i);
        out[i * 3 + 2] = position.getZ(i);
      }
      return out;
    };
    const legs = legMeshesOf(rig.object);
    assert.ok(legs.length === 6);
    const before = legs.map(snap);
    // uSkinDQ 스냅샷
    let legMat: Material | null = null;
    rig.object.traverse((item) => {
      if (item instanceof Mesh && item.name === "legR__Material_5") {
        legMat = Array.isArray(item.material) ? item.material[0]! : item.material!;
      }
    });
    assert.ok(legMat);
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: "#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>",
    };
    legMat.onBeforeCompile(shader as never);
    const dqValue = shader.uniforms.uSkinDQ?.value as Float32Array;
    assert.ok(dqValue instanceof Float32Array && dqValue.length === 32);
    const dqBefore = Float32Array.from(dqValue);
    rig.setPhase(0.6);
    const after = legs.map(snap);
    for (let m = 0; m < legs.length; m++) {
      assert.deepEqual(after[m], before[m], `${legs[m]!.name} buffer touched in gpu mode`);
    }
    let changed = 0;
    for (let k = 0; k < 32; k++) if (dqValue[k] !== dqBefore[k]) changed++;
    assert.ok(changed > 0, "uSkinDQ not updated");
    // 휴지값과 바이트 동일
    for (const side of ["R", "L"] as const) {
      for (const draw of rig.legDrawsForTests(side)) {
        const position = draw.mesh.geometry.getAttribute("position") as BufferAttribute;
        for (let i = 0; i < position.count; i++) {
          assert.equal(position.getX(i), draw.restPosition[i * 3]);
          assert.equal(position.getY(i), draw.restPosition[i * 3 + 1]);
          assert.equal(position.getZ(i), draw.restPosition[i * 3 + 2]);
        }
      }
    }
  });

  it("setSkinMode cpu↔gpu: 버퍼 복원·유니폼·effective", () => {
    rig.setSkinMode("cpu");
    assert.equal(rig.skinModeValue, "cpu");
    assert.equal(readEffectiveRiderSkinMode(), "cpu");
    let differs = 0;
    let checked = 0;
    for (const side of ["R", "L"] as const) {
      for (const draw of rig.legDrawsForTests(side)) {
        const position = draw.mesh.geometry.getAttribute("position") as BufferAttribute;
        for (let i = 0; i < position.count; i++) {
          checked++;
          if (
            position.getX(i) !== draw.restPosition[i * 3] ||
            position.getY(i) !== draw.restPosition[i * 3 + 1] ||
            position.getZ(i) !== draw.restPosition[i * 3 + 2]
          ) {
            differs++;
          }
        }
      }
    }
    assert.ok(checked > 0 && differs > 0, "cpu skin missing");
    rig.setSkinMode("gpu");
    assert.equal(rig.skinModeValue, "gpu");
    assert.equal(readEffectiveRiderSkinMode(), "gpu");
    for (const side of ["R", "L"] as const) {
      for (const draw of rig.legDrawsForTests(side)) {
        const position = draw.mesh.geometry.getAttribute("position") as BufferAttribute;
        for (let i = 0; i < position.count; i++) {
          assert.equal(position.getX(i), draw.restPosition[i * 3]);
        }
      }
    }
  });

  it("복제 머티리얼에도 키트 map 교체가 전부 적용된다", () => {
    const palettes = paletteMaterialsOf(rig.object);
    assert.equal(palettes.length, 3);
    const kit = RiderPaletteKit.ofMaterialForTests(palettes[0]!);
    assert.ok(kit);
    for (const material of palettes) {
      assert.equal(RiderPaletteKit.ofMaterialForTests(material), kit);
    }
    const stub = new DataTexture(new Uint8Array(128 * 16 * 4), 128, 16);
    kit.injectKitTextureForTests("pacer", stub);
    rig.setVisualKind("pacer");
    for (const material of palettes) assert.equal(material.map, stub);
    rig.setVisualKind("self");
    rig.dispose();
  });
  resetRiderSkinModeForTests();
});

describe("s5 + gpu request", () => {
  it("s5 는 cpu 유지·복제 없음·skinWeight 없음", async () => {
    resetRiderSkinModeForTests();
    const { scene } = await loadPreservedTestGlb(S5_ID);
    const rig = new PreservedRiderRig(scene, loadPreservedTestGuides(S5_ID), getRiderModelProfile("s5"), {
      skinMode: "gpu",
    });
    assert.equal(rig.skinModeValue, "cpu");
    rig.setPhase(0.25);
    rig.object.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      assert.equal(item.geometry.getAttribute("skinWeight"), undefined, item.name);
    });
    rig.dispose();
    resetRiderSkinModeForTests();
  });
});

/**
 * rider14 모델 프로필 시험 (P2a).
 *
 * 실행: node --experimental-strip-types --test scripts/rider-preserve/rider-model-profile.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Mesh } from "three";
import { PreservedRiderRig } from "../../src/lib/riderPrototype/preservedRiderRig.ts";
import {
  getRiderModelProfile,
  type BakedMesh,
  type RiderRigGroup,
} from "../../src/lib/riderPrototype/riderModelProfile.ts";
import {
  attachPaletteStubMap,
  loadPreservedTestGlb,
  loadPreservedTestGuides,
  meshNameOf,
} from "./rider-glb-test-loader.ts";

const RIDER14_ID = "20261015-212136-df8de090";
const S5_ID = "20260921-041426-cd81398e";

const RIDER14_EXPECTED_COUNTS: Record<RiderRigGroup, number> = {
  static: 1,
  legR: 3,
  legL: 3,
  wheelRear: 1,
  wheelFront: 1,
  crank: 1,
  pedalR: 1,
  pedalL: 1,
  footR: 1,
  footL: 1,
  bike: 0,
};

const RIDER14_PEDAL_BIND = {
  R: [0.107228, 0.131265, 0.073889],
  L: [-0.107228, 0.402735, -0.073889],
} as const;

function collectMeshes(scene: import("three").Object3D): Mesh[] {
  const out: Mesh[] = [];
  scene.traverse((item) => {
    if (item instanceof Mesh) out.push(item);
  });
  return out;
}

function toBaked(meshes: readonly Mesh[]): BakedMesh[] {
  return meshes.map((mesh) => ({ name: meshNameOf(mesh), mesh, geometry: mesh.geometry }));
}

function closeTo(actual: readonly number[], expected: readonly number[], eps: number): boolean {
  return (
    actual.length === expected.length &&
    actual.every((v, i) => Math.abs(v - expected[i]!) <= eps)
  );
}

describe("rider-model-profile", () => {
  it("rider14 GLB: 메시 14개, 그룹 분포가 기대와 같다", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER14_ID);
    const profile = getRiderModelProfile("rider14");
    const meshes = collectMeshes(scene);
    assert.equal(meshes.length, 14);
    const counts = {} as Record<string, number>;
    for (const mesh of meshes) {
      const group = profile.groupOf(meshNameOf(mesh));
      counts[group] = (counts[group] ?? 0) + 1;
    }
    for (const [group, want] of Object.entries(RIDER14_EXPECTED_COUNTS)) {
      assert.equal(counts[group] ?? 0, want, `group ${group}`);
    }
    assert.equal(Object.keys(counts).length, 10);
  });

  it("rider14 pedalBind R/L 이 extras 값과 같다(±1e-6)", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER14_ID);
    const profile = getRiderModelProfile("rider14");
    const baked = toBaked(collectMeshes(scene));
    assert.ok(closeTo(profile.pedalBind(baked, "R"), RIDER14_PEDAL_BIND.R, 1e-6));
    assert.ok(closeTo(profile.pedalBind(baked, "L"), RIDER14_PEDAL_BIND.L, 1e-6));
  });

  it("rider14 guide 키 2개, thighOnly 2개, sock 2개", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER14_ID);
    const profile = getRiderModelProfile("rider14");
    const meshes = collectMeshes(scene);
    let guideR = 0;
    let guideL = 0;
    let thighOnly = 0;
    let sock = 0;
    for (const mesh of meshes) {
      const name = meshNameOf(mesh);
      // 리그(`guideWeights`)는 다리 쪽과 같은 side 로만 조회하므로 시험도 그에 맞춘다.
      if (name.startsWith("legR__")) {
        if (profile.guideKeyOf(name, "R", mesh) !== null) guideR++;
      } else if (name.startsWith("legL__")) {
        if (profile.guideKeyOf(name, "L", mesh) !== null) guideL++;
      } else {
        assert.equal(profile.guideKeyOf(name, "R", mesh), null, `guide R of ${name}`);
        assert.equal(profile.guideKeyOf(name, "L", mesh), null, `guide L of ${name}`);
      }
      if (profile.isThighOnly(name)) thighOnly++;
      if (profile.isSock(name)) sock++;
    }
    assert.equal(guideR, 1);
    assert.equal(guideL, 1);
    assert.equal(profile.guideKeyOf("legR__Material_5", "R"), "Right continuous knee skin");
    assert.equal(profile.guideKeyOf("legL__Material_5", "L"), "Left continuous knee skin");
    assert.equal(thighOnly, 2);
    assert.equal(sock, 2);
  });

  it("rider14: 모르는 접두사는 예외, pedalBind extras 없으면 예외", async () => {
    const profile = getRiderModelProfile("rider14");
    assert.throws(() => profile.groupOf("unknown__X"), /Unknown rider14 rig group prefix/);
    const { scene } = await loadPreservedTestGlb(RIDER14_ID);
    const clone = scene.clone(true);
    const cloned: Mesh[] = [];
    clone.traverse((item) => {
      if (item instanceof Mesh) {
        delete (item.userData as { pedalBind?: unknown }).pedalBind;
        cloned.push(item);
      }
    });
    assert.throws(() => profile.pedalBind(toBaked(cloned), "R"), /pedalBind/);
    assert.throws(() => profile.pedalBind(toBaked(cloned), "L"), /pedalBind/);
  });

  it("s5 GLB: 옮기기 전(734af62) 그룹 판정과 같다 + pedalBind 1e-9", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const fixture = JSON.parse(
      fs.readFileSync(path.join(here, "fixtures", "s5-groups.json"), "utf8"),
    ) as {
      sourceRev: string;
      meshCount: number;
      counts: Record<string, number>;
      groups: Record<string, string>;
      pedalBind: { R: number[]; L: number[] };
    };
    assert.equal(fixture.sourceRev, "734af62");
    const { scene, stripped } = await loadPreservedTestGlb(S5_ID);
    assert.equal(stripped, false);
    const profile = getRiderModelProfile("s5");
    const meshes = collectMeshes(scene);
    assert.equal(meshes.length, fixture.meshCount);
    const counts = {} as Record<string, number>;
    for (const mesh of meshes) {
      const name = meshNameOf(mesh);
      const group = profile.groupOf(name);
      assert.equal(group, fixture.groups[name], `group of ${name}`);
      counts[group] = (counts[group] ?? 0) + 1;
    }
    assert.deepEqual(counts, fixture.counts);
    // 옮기기 전 코드와 같은 bake(clone + matrixWorld 적용) 위에서 비교한다.
    scene.updateMatrixWorld(true);
    const baked = meshes.map((mesh) => {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      return { name: meshNameOf(mesh), mesh, geometry };
    });
    assert.ok(closeTo(profile.pedalBind(baked, "R"), fixture.pedalBind.R, 1e-9));
    assert.ok(closeTo(profile.pedalBind(baked, "L"), fixture.pedalBind.L, 1e-9));
  });

  it("두 GLB 모두 리그 생성 + setPhase(0.25) 후 다리 정점이 유한값", async () => {
    for (const id of [S5_ID, RIDER14_ID] as const) {
      const { scene } = await loadPreservedTestGlb(id);
      if (id === RIDER14_ID) {
        // Node 에서는 팔레트 PNG 를 복원하지 못해 시험 로더가 텍스처 참조를 제거한다.
        // rig 생성(팔레트 머티리얼 1개 확인)까지만 검증하므로 최소 stub map 을 붙인다.
        // 실제 칸 색칠은 rider-palette-kit.test.ts 에서 순수 함수로 검증한다.
        attachPaletteStubMap(scene);
      }
      const profile = getRiderModelProfile(id === RIDER14_ID ? "rider14" : "s5");
      const guides = loadPreservedTestGuides(id);
      const rig = new PreservedRiderRig(scene, guides, profile);
      rig.setPhase(0.25);
      let checked = 0;
      rig.object.traverse((item) => {
        if (!(item instanceof Mesh)) return;
        const position = item.geometry.getAttribute("position");
        for (let i = 0; i < position.count; i++) {
          assert.ok(
            Number.isFinite(position.getX(i)) &&
              Number.isFinite(position.getY(i)) &&
              Number.isFinite(position.getZ(i)),
            `${id} ${item.name} vertex ${i}`,
          );
          checked++;
        }
      });
      assert.ok(checked > 0, `${id}: no vertices checked`);
      rig.dispose();
    }
  });
});

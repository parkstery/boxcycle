/**
 * Float32 bake 시험 (P2a).
 *
 * meshopt + `KHR_mesh_quantization` GLB 의 position/normal 은 정규화 정수라서
 * 그대로 `applyMatrix4`·DQS `setXYZ` 를 하면 값이 깨진다. `bakeFloat32Attributes`
 * 로 먼저 Float32 로 바꾸는 것을 고정한다.
 *
 * 실행: node --experimental-strip-types --test scripts/rider-preserve/rider-float32-bake.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, Vector3 } from "three";
import {
  bakeFloat32Attributes,
  PreservedRiderRig,
} from "../../src/lib/riderPrototype/preservedRiderRig.ts";
import { getRiderModelProfile } from "../../src/lib/riderPrototype/riderModelProfile.ts";
import {
  attachPaletteStubMap,
  loadPreservedTestGlb,
  loadPreservedTestGuides,
  meshNameOf,
} from "./rider-glb-test-loader.ts";

const RIDER14_ID = "20261015-212136-df8de090";

function denormalized(attribute: BufferAttribute, index: number): [number, number, number] {
  return [attribute.getX(index), attribute.getY(index), attribute.getZ(index)];
}

describe("rider-float32-bake", () => {
  it("정규화 Int16 position → bake + 행렬 결과가 기대 미터값과 1e-5 이내, Float32Array", () => {
    const raw = new Int16Array([16384, -32768, 0, 32767, 0, -16384]);
    const geometry = new BufferGeometry();
    const source = new BufferAttribute(raw, 3, true);
    const expectedDenorm = [denormalized(source, 0), denormalized(source, 1)];
    geometry.setAttribute("position", source);
    geometry.setAttribute("normal", new BufferAttribute(new Int8Array([127, 0, 0, 0, 127, 0]), 3, true));
    bakeFloat32Attributes(geometry);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    assert.ok(position.array instanceof Float32Array);
    assert.ok(normal.array instanceof Float32Array);
    const matrix = new Matrix4().makeScale(2, 2, 2).setPosition(1, -0.5, 0.25);
    geometry.applyMatrix4(matrix);
    for (let i = 0; i < 2; i++) {
      const d = expectedDenorm[i]!;
      const expected = [d[0] * 2 + 1, d[1] * 2 - 0.5, d[2] * 2 + 0.25];
      assert.ok(Math.abs(position.getX(i) - expected[0]) <= 1e-5, `x[${i}]`);
      assert.ok(Math.abs(position.getY(i) - expected[1]) <= 1e-5, `y[${i}]`);
      assert.ok(Math.abs(position.getZ(i) - expected[2]) <= 1e-5, `z[${i}]`);
    }
  });

  it("이미 비정규화 Float32 면 그대로 둔다", () => {
    const geometry = new BufferGeometry();
    const position = new BufferAttribute(new Float32Array([1, 2, 3]), 3);
    geometry.setAttribute("position", position);
    bakeFloat32Attributes(geometry);
    assert.equal(geometry.getAttribute("position"), position);
  });

  it("rider14 다리 메시: bake 월드 좌표 = 변환 없이(getX+matrixWorld) 계산한 값 1e-6 이내", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER14_ID);
    scene.updateMatrixWorld(true);
    const target = "legR__Material_5";
    let mesh: Mesh | null = null;
    scene.traverse((item) => {
      if (item instanceof Mesh && meshNameOf(item) === target) mesh = item;
    });
    assert.ok(mesh, `${target} not found`);
    const source = (mesh as Mesh).geometry.getAttribute("position");
    const matrixWorld = (mesh as Mesh).matrixWorld.clone();
    assert.ok(!(source.array instanceof Float32Array) || source.normalized, "precondition");
    const baked = (mesh as Mesh).geometry.clone();
    bakeFloat32Attributes(baked);
    assert.ok(baked.getAttribute("position").array instanceof Float32Array);
    baked.applyMatrix4(matrixWorld);
    const actual = baked.getAttribute("position");
    const point = new Vector3();
    for (let i = 0; i < source.count; i++) {
      point.set(source.getX(i), source.getY(i), source.getZ(i)).applyMatrix4(matrixWorld);
      assert.ok(Math.abs(actual.getX(i) - point.x) <= 1e-6, `x[${i}]`);
      assert.ok(Math.abs(actual.getY(i) - point.y) <= 1e-6, `y[${i}]`);
      assert.ok(Math.abs(actual.getZ(i) - point.z) <= 1e-6, `z[${i}]`);
    }
  });

  it("변환 없이 applyMatrix4 하면 값이 깨진다(three 정규화 속성 동작이 바뀌면 이 단언이 실패한다)", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Int16Array([16384, 0, 0]), 3, true));
    geometry.applyMatrix4(new Matrix4().makeScale(3, 1, 1));
    const broken = geometry.getAttribute("position").getX(0);
    assert.ok(
      Math.abs(broken - 1.5) > 0.1,
      `three normalized applyMatrix4 behavior changed: got ${broken}, want corruption vs 1.5`,
    );
  });

  it("rider14 GLB 전체를 rig 로 bake 해도 정점·법선이 모두 Float32 비정규화다", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER14_ID);
    attachPaletteStubMap(scene);
    const guides = loadPreservedTestGuides(RIDER14_ID);
    const rig = new PreservedRiderRig(scene, guides, getRiderModelProfile("rider14"));
    let meshes = 0;
    rig.object.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      meshes++;
      for (const key of ["position", "normal"] as const) {
        const attribute = item.geometry.getAttribute(key);
        assert.ok(attribute.array instanceof Float32Array, `${item.name}.${key}`);
        assert.equal(attribute.normalized, false, `${item.name}.${key}`);
      }
    });
    assert.equal(meshes, 14);
    rig.dispose();
  });
});

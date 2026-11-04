/**
 * RIDER15-P2 — 표준 Three.js SkinnedMesh 최소 스파이크.
 *
 * 제품 GLB·rider14 리그·Mapbox 레이어를 건드리지 않고, 다음만 증명한다.
 * 1) 본 계층과 skinIndex/skinWeight가 SkinnedMesh에서 변형을 만든다.
 * 2) 한 메시 안에서 어깨/팔처럼 두 본이 공존할 수 있다.
 * 3) 본 회전은 메시 버퍼를 직접 다시 굽지 않고 적용된다.
 *
 * 실행:
 * node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs \
 *   --test scripts/rider-preserve/rider-standard-skin-spike.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from "three";

function buildFixture(): { mesh: SkinnedMesh; upper: Bone; forearm: Bone } {
  // 두 정점은 상완, 두 정점은 전완에 대응하는 최소 띠다.
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [0, 0, 0, 1, 1, 0, 2, 1, 0, 0, 1, 0],
      3,
    ),
  );
  geometry.setAttribute(
    "skinIndex",
    new Uint16BufferAttribute(
      [0, 0, 0, 0, 1, 0, 2, 0, 1, 0, 0, 0],
      4,
    ),
  );
  geometry.setAttribute(
    "skinWeight",
    new Float32BufferAttribute(
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      4,
    ),
  );

  const root = new Bone();
  root.name = "chest";
  const upper = new Bone();
  upper.name = "shoulder_L";
  upper.position.x = 1;
  const forearm = new Bone();
  forearm.name = "elbow_L";
  forearm.position.x = 1;
  root.add(upper);
  upper.add(forearm);

  const skeleton = new Skeleton([root, upper, forearm]);
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
  mesh.add(root);
  mesh.bind(skeleton);
  mesh.updateMatrixWorld(true);
  return { mesh, upper, forearm };
}

function transformedVertex(mesh: SkinnedMesh, index: number): Vector3 {
  const out = new Vector3();
  mesh.applyBoneTransform(index, out.fromBufferAttribute(mesh.geometry.getAttribute("position"), index));
  return out;
}

test("standard skin fixture deforms one mesh through shoulder and elbow bones", () => {
  const { mesh, upper, forearm } = buildFixture();
  const restUpper = transformedVertex(mesh, 1);
  const restForearm = transformedVertex(mesh, 2);

  upper.rotation.z = Math.PI / 2;
  forearm.rotation.z = Math.PI / 2;
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();

  const posedUpper = transformedVertex(mesh, 1);
  const posedForearm = transformedVertex(mesh, 2);

  assert.notDeepEqual(posedUpper.toArray(), restUpper.toArray());
  assert.notDeepEqual(posedForearm.toArray(), restForearm.toArray());
  assert.ok(Number.isFinite(posedUpper.x) && Number.isFinite(posedForearm.y));
});

test("standard skin keeps geometry buffers unchanged while bones move", () => {
  const { mesh, upper } = buildFixture();
  const position = mesh.geometry.getAttribute("position");
  const before = Array.from(position.array as ArrayLike<number>);
  const versionBefore = position.version;

  upper.rotation.z = Math.PI / 3;
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();
  void transformedVertex(mesh, 2);

  assert.deepEqual(Array.from(position.array as ArrayLike<number>), before);
  assert.equal(position.version, versionBefore);
});


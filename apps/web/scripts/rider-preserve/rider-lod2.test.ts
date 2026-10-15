/**
 * rider14 LOD2 스테이징·정적 메시·선택 규칙 (L1).
 *
 * 실행: npm run test:rider-preserve (PowerShell, apps/web)
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { Box3, DataTexture, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { BufferGeometry } from "three";
import { shouldUseRiderLod2 } from "../../src/lib/rider/riderDetailLod.ts";
import { PreservedRiderRig } from "../../src/lib/riderPrototype/preservedRiderRig.ts";
import { PreservedRiderStatic } from "../../src/lib/riderPrototype/preservedRiderStatic.ts";
import { getRiderModelProfile } from "../../src/lib/riderPrototype/riderModelProfile.ts";
import { RiderPaletteKit } from "../../src/lib/riderPrototype/riderPaletteKit.ts";
import {
  attachPaletteStubMap,
  loadPreservedTestGlb,
  loadPreservedTestGuides,
  testCandidateDir,
} from "./rider-glb-test-loader.ts";

const RIDER14_ID = "20261015-212136-df8de090";
const LOD2_SHA256 = "14c5956eb3a461e87c1e86df095be877e9e2645cbd3216ea55a0e8d3f5c10668";
const LOD2_FILE = "rider-lod2.glb";
const BBOX_TOLERANCE_M = 0.05;

function sha256(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function meshesOf(root: { traverse: (fn: (item: unknown) => void) => void }): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((item) => {
    if (item instanceof Mesh) found.push(item);
  });
  return found;
}

function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  const count = index ? index.count : geometry.getAttribute("position").count;
  return count / 3;
}

describe("rider14 LOD2", () => {
  it("스테이징: rider-lod2.glb SHA 와 candidate.json 필드", () => {
    const dir = testCandidateDir(RIDER14_ID);
    const glbPath = path.join(dir, LOD2_FILE);
    assert.equal(sha256(glbPath), LOD2_SHA256);
    const candidate = JSON.parse(fs.readFileSync(path.join(dir, "candidate.json"), "utf8")) as {
      files: { lod2?: string };
      lod2SourceSha256?: string;
      lod2StagedSha256?: string;
    };
    assert.equal(candidate.files.lod2, LOD2_FILE);
    assert.equal(candidate.lod2SourceSha256, LOD2_SHA256);
    assert.equal(candidate.lod2StagedSha256, LOD2_SHA256);
  });

  it("정적 메시: 1메시·삼각형 5648·정점 6644·Float32, bbox 가 LOD0 phase 0 과 축당 5 cm 이내", async () => {
    const lod0 = await loadPreservedTestGlb(RIDER14_ID);
    attachPaletteStubMap(lod0.scene);
    const rig = new PreservedRiderRig(
      lod0.scene,
      loadPreservedTestGuides(RIDER14_ID),
      getRiderModelProfile("rider14"),
    );
    const lod2 = await loadPreservedTestGlb(RIDER14_ID, LOD2_FILE);
    attachPaletteStubMap(lod2.scene);
    const staticRider = new PreservedRiderStatic(lod2.scene, getRiderModelProfile("rider14"));
    try {
      const meshes = meshesOf(staticRider.object);
      assert.equal(meshes.length, 1);
      const mesh = meshes[0]!;
      const position = mesh.geometry.getAttribute("position");
      const normal = mesh.geometry.getAttribute("normal");
      assert.equal(position.count, 6644);
      assert.equal(triangleCount(mesh.geometry), 5648);
      for (const [key, attribute] of [["position", position], ["normal", normal]] as const) {
        assert.ok(attribute.array instanceof Float32Array, key);
        assert.equal(attribute.normalized, false, key);
      }
      rig.setPhase(0);
      rig.object.updateMatrixWorld(true);
      staticRider.object.updateMatrixWorld(true);
      const rigBox = new Box3().setFromObject(rig.object);
      const lod2Box = new Box3().setFromObject(staticRider.object);
      assert.ok(rigBox.getSize(new Vector3()).length() > 0.5, "rig bbox is empty");
      for (const edge of ["min", "max"] as const) {
        for (const axis of ["x", "y", "z"] as const) {
          const delta = Math.abs(lod2Box[edge][axis] - rigBox[edge][axis]);
          assert.ok(
            delta <= BBOX_TOLERANCE_M,
            `${edge}.${axis} delta ${delta} m (lod2 ${lod2Box[edge][axis]} vs rig ${rigBox[edge][axis]})`,
          );
        }
      }
    } finally {
      rig.dispose();
      staticRider.dispose();
    }
  });

  it("키트: peer 는 주입한 키트 텍스처, self 는 원본 map", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER14_ID, LOD2_FILE);
    attachPaletteStubMap(scene);
    const staticRider = new PreservedRiderStatic(scene, getRiderModelProfile("rider14"));
    try {
      const mesh = meshesOf(staticRider.object)[0];
      assert.ok(mesh, "lod2 mesh missing");
      const material = mesh.material;
      assert.ok(material instanceof MeshStandardMaterial, "palette material");
      const originalMap = material.map;
      assert.ok(originalMap, "stub map missing");
      const kit = RiderPaletteKit.ofMaterialForTests(material);
      assert.ok(kit, "kit instance missing");
      const kitTexture = new DataTexture(new Uint8Array(128 * 16 * 4), 128, 16);
      kit.injectKitTextureForTests("peer", kitTexture);
      staticRider.setVisualKind("peer");
      assert.equal(material.map, kitTexture);
      assert.notEqual(material.map, originalMap);
      staticRider.setVisualKind("self");
      assert.equal(material.map, originalMap);
    } finally {
      staticRider.dispose();
    }
  });

  it("shouldUseRiderLod2 진리표", () => {
    assert.equal(shouldUseRiderLod2(false, false), false);
    assert.equal(shouldUseRiderLod2(false, true), false);
    assert.equal(shouldUseRiderLod2(true, false), true);
    assert.equal(shouldUseRiderLod2(true, true), false);
  });

  it("dispose 가 지오메트리·텍스처 dispose 이벤트를 낸다", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER14_ID, LOD2_FILE);
    attachPaletteStubMap(scene);
    const staticRider = new PreservedRiderStatic(scene, getRiderModelProfile("rider14"));
    const mesh = meshesOf(staticRider.object)[0];
    assert.ok(mesh, "lod2 mesh missing");
    const material = mesh.material as MeshStandardMaterial;
    const originalMap = material.map;
    assert.ok(originalMap, "stub map missing");
    const kit = RiderPaletteKit.ofMaterialForTests(material);
    assert.ok(kit, "kit instance missing");
    const kitTexture = new DataTexture(new Uint8Array(128 * 16 * 4), 128, 16);
    kit.injectKitTextureForTests("peer", kitTexture);
    staticRider.setVisualKind("peer");
    let geometryDisposes = 0;
    let originalDisposes = 0;
    let kitDisposes = 0;
    mesh.geometry.addEventListener("dispose", () => {
      geometryDisposes += 1;
    });
    originalMap.addEventListener("dispose", () => {
      originalDisposes += 1;
    });
    kitTexture.addEventListener("dispose", () => {
      kitDisposes += 1;
    });
    staticRider.dispose();
    assert.equal(geometryDisposes, 1);
    assert.equal(originalDisposes, 1);
    assert.equal(kitDisposes, 1);
  });
});

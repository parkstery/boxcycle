/**
 * 시험 전용 GLB 로더 (`scripts/rider-preserve/` 단위 시험용).
 *
 * 제품 코드(`riderPreservedLayer.ts`)와 같은 방식(`GLTFLoader.parse` +
 * `setMeshoptDecoder(MeshoptDecoder)`)으로 연다. rider14 GLB 의 팔레트 PNG 는
 * Node 의 이미지 로더에서 실패해 parse 자체가 예외로 끝나므로, 그때만
 * `images/textures/samplers` 와 머티리얼의 텍스처 참조를 지운 사본으로
 * 다시 parse 한다(노드명·extras·정점 속성은 그대로 유지된다).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataTexture, Mesh, MeshStandardMaterial } from "three";
import type { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { PreservedGuideData } from "../../src/lib/riderPrototype/preservedRiderRig.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

export function testCandidateDir(candidateId: string): string {
  return path.resolve(here, "..", "..", "public", "rider", "preserved", "candidates", candidateId);
}

type GlbJson = {
  images?: unknown;
  textures?: unknown;
  samplers?: unknown;
  materials?: Array<{
    pbrMetallicRoughness?: { baseColorTexture?: unknown; metallicRoughnessTexture?: unknown };
    normalTexture?: unknown;
    occlusionTexture?: unknown;
    emissiveTexture?: unknown;
  }>;
};

/** 텍스처 참조를 지운 GLB 사본을 만든다(이진 청크는 손대지 않는다). */
export function stripGlbTextures(buf: Buffer): Buffer {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const jsonLen = view.getUint32(12, true);
  const json = JSON.parse(
    Buffer.from(buf.buffer, buf.byteOffset + 20, jsonLen).toString("utf8"),
  ) as GlbJson;
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const material of json.materials ?? []) {
    if (material.pbrMetallicRoughness) {
      delete material.pbrMetallicRoughness.baseColorTexture;
      delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
  }
  const rewritten = Buffer.from(JSON.stringify(json), "utf8");
  const pad = (4 - (rewritten.length % 4)) % 4;
  const padded = Buffer.concat([rewritten, Buffer.alloc(pad, 0x20)]);
  let bin = Buffer.alloc(0);
  let off = 12 + 8 + jsonLen;
  off += (4 - (jsonLen % 4)) % 4;
  if (off + 8 <= buf.length) {
    const binLen = buf.readUInt32LE(off);
    if (buf.readUInt32LE(off + 4) === 0x004e4942) bin = buf.subarray(off + 8, off + 8 + binLen);
  }
  const total = 12 + 8 + padded.length + 8 + bin.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(padded.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(out, 20);
  const binAt = 20 + padded.length;
  out.writeUInt32LE(bin.length, binAt);
  out.writeUInt32LE(0x004e4942, binAt + 4);
  Buffer.from(bin).copy(out, binAt + 8);
  return out;
}

export type TestGlb = {
  scene: import("three").Object3D;
  stripped: boolean;
};

export async function loadPreservedTestGlb(candidateId: string, fileName = "rider.glb"): Promise<TestGlb> {
  const raw = fs.readFileSync(path.join(testCandidateDir(candidateId), fileName));
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const slice = (b: Buffer): ArrayBuffer =>
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  try {
    const gltf = await loader.parseAsync(slice(raw), "");
    return { scene: gltf.scene, stripped: false };
  } catch (error) {
    console.warn(
      `[rider-test] ${candidateId}/${fileName}: parse with images failed (${error instanceof Error ? error.message : String(error)}), retrying with textures stripped`,
    );
    const gltf = await loader.parseAsync(slice(stripGlbTextures(raw)), "");
    for (const material of collectMaterials(gltf.scene)) {
      if (material.map === null) {
        console.warn(`[rider-test] ${candidateId}/${fileName}: texture is null after strip fallback (allowed)`);
        break;
      }
    }
    return { scene: gltf.scene, stripped: true };
  }
}

function collectMaterials(root: import("three").Object3D): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of list) {
      if (material instanceof MeshStandardMaterial) out.push(material);
    }
  });
  return out;
}

export function loadPreservedTestGuides(candidateId: string): PreservedGuideData {
  return JSON.parse(
    fs.readFileSync(path.join(testCandidateDir(candidateId), "guide-weights.json"), "utf8"),
  ) as PreservedGuideData;
}

export function meshNameOf(object: import("three").Object3D): string {
  const authored = (object.userData as { name?: unknown }).name;
  return typeof authored === "string" && authored ? authored : object.name;
}

/**
 * Node 에서는 팔레트 PNG 를 복원하지 못해 `loadPreservedTestGlb` 가 텍스처 참조를
 * 제거하므로 rider14 팔레트 머티리얼의 `map` 은 null 이다. rig 생성(팔레트 머티리얼
 * 1개 확인)까지만 검증하는 시험은 이 stub 으로 최소 크기의 map 을 붙인다.
 * 실제 칸 색칠은 `rider-palette-kit.test.ts` 에서 순수 함수로 검증한다.
 */
export function attachPaletteStubMap(scene: Object3D, width = 128, height = 16): void {
  scene.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of list) {
      const target = material as unknown as { map?: unknown; userData?: { palette?: unknown } };
      if (target?.userData?.palette != null && target.map == null) {
        target.map = new DataTexture(new Uint8Array(width * height * 4), width, height);
      }
    }
  });
}

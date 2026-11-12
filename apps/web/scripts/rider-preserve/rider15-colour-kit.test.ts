/**
 * rider15 컬러 키트 시험 (S4) — 근거리 팔레트 UV·페인트, LOD2 정점색.
 *
 * 실행: node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs \
 *   --test scripts/rider-preserve/rider15-colour-kit.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DataTexture, Mesh } from "three";
import type { BufferAttribute, Object3D } from "three";
import { PreservedRiderStatic } from "../../src/lib/riderPrototype/preservedRiderStatic.ts";
import { Rider15Rig } from "../../src/lib/riderPrototype/rider15Rig.ts";
import {
  getRiderModelProfile,
  RIDER15_BIKE_PALETTE_MATERIAL,
  RIDER15_PALETTE_SLOTS,
  RIDER15_RIDER_PALETTE_MATERIAL,
} from "../../src/lib/riderPrototype/riderModelProfile.ts";
import { RiderPaletteKit, type PaletteMaterial } from "../../src/lib/riderPrototype/riderPaletteKit.ts";
import {
  linearToSrgb8,
  paintPaletteKit,
  paletteSlotRects,
  RIDER_VISUAL_KIT_PACER,
  RIDER_VISUAL_KIT_PEER,
  type PaletteSlot,
} from "../../src/lib/riderPrototype/riderVisualKit.ts";
import {
  RIDER15_LOD2_HELMET_RGB,
  RIDER15_LOD2_JERSEY_MIN_Y,
  RIDER15_LOD2_JERSEY_RGB,
} from "../../src/lib/riderPrototype/riderVertexColorKit.ts";
import {
  attachRider15PaletteStubMaps,
  loadPreservedTestGlb,
  meshNameOf,
} from "./rider-glb-test-loader.ts";

const RIDER15_ID = "20261111-025600-ad1d669d";
const LOD2_FILE = "rider-lod2.glb";
const PALETTE_W = 64;
const PALETTE_H = 1024;
const JERSEY_MESHES = ["P51_Body", "P74_Jersey_Collar", "P79_Skinned"] as const;

function collectMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((item) => {
    if (item instanceof Mesh) out.push(item);
  });
  return out;
}

function meshesNamed(root: Object3D, name: string): Mesh[] {
  return collectMeshes(root).filter(
    (mesh) => mesh.name === name || meshNameOf(mesh) === name,
  );
}

function materialByPrefix(root: Object3D, prefix: string): PaletteMaterial {
  const found: PaletteMaterial[] = [];
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of list) {
      if (!material) continue;
      const target = material as PaletteMaterial;
      if (!(target.name ?? "").startsWith(prefix)) continue;
      if (!target.map) continue;
      if (!found.includes(target)) found.push(target);
    }
  });
  assert.equal(found.length, 1, `material ${prefix} count`);
  return found[0]!;
}

/** glTF 규약대로 u·v 를 wrap 해 64×1024 텍셀로 접는다(flip 없음). */
function texelOf(uv: { getX(i: number): number; getY(i: number): number }, index: number): {
  column: number;
  row: number;
} {
  const u = uv.getX(index);
  const v = uv.getY(index);
  const wrappedU = u - Math.floor(u);
  const wrappedV = v - Math.floor(v);
  return {
    column: Math.min(PALETTE_W - 1, Math.floor(wrappedU * PALETTE_W)),
    row: Math.min(PALETTE_H - 1, Math.floor(wrappedV * PALETTE_H)),
  };
}

function inRects(texel: { column: number; row: number }, rects: readonly PaletteSlot[]): boolean {
  return rects.some(
    (rect) =>
      texel.column >= rect.x && texel.column < rect.x + rect.w &&
      texel.row >= rect.y && texel.row < rect.y + rect.h,
  );
}

function pixelOf(pixels: Uint8Array, x: number, y: number): number[] {
  const at = (y * PALETTE_W + x) * 4;
  return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!, pixels[at + 3]!];
}

function colorBytes(attribute: BufferAttribute): Uint8Array {
  const itemSize = attribute.itemSize;
  const length = attribute.count * itemSize;
  const array = attribute.array as unknown;
  if (
    (array instanceof Uint8Array || array instanceof Uint8ClampedArray) &&
    array.length === length
  ) {
    return Uint8Array.from(array);
  }
  const out = new Uint8Array(length);
  for (let i = 0; i < attribute.count; i++) {
    const at = i * itemSize;
    out[at] = Math.round(attribute.getX(i) * 255);
    if (itemSize > 1) out[at + 1] = Math.round(attribute.getY(i) * 255);
    if (itemSize > 2) out[at + 2] = Math.round(attribute.getZ(i) * 255);
    if (itemSize > 3) out[at + 3] = Math.round(attribute.getW(i) * 255);
  }
  return out;
}

function vertexBytes(bytes: Uint8Array, index: number, itemSize: number): number[] {
  const at = index * itemSize;
  return Array.from(bytes.subarray(at, at + itemSize));
}

describe("rider15-colour-kit", () => {
  it("근거리 UV: 텍셀 기준 저지·헬멧 슬롯과 바이크 0", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER15_ID);
    const jerseyRects = paletteSlotRects(RIDER15_PALETTE_SLOTS.jersey);
    const helmetRects = paletteSlotRects(RIDER15_PALETTE_SLOTS.helmet);

    let jerseyColumn0 = 0;
    let jerseySlot = 0;
    for (const name of JERSEY_MESHES) {
      const meshes = meshesNamed(scene, name);
      assert.ok(meshes.length > 0, `missing mesh ${name}`);
      for (const mesh of meshes) {
        const uv = mesh.geometry.getAttribute("uv");
        assert.ok(uv, `${meshNameOf(mesh)} has no uv`);
        for (let i = 0; i < uv.count; i++) {
          const texel = texelOf(uv, i);
          if (texel.column === 0) jerseyColumn0++;
          if (inRects(texel, jerseyRects)) jerseySlot++;
        }
      }
    }
    assert.equal(jerseyColumn0, 524, `jersey column 0 vertices ${jerseyColumn0}`);

    const p51 = meshesNamed(scene, "P51_Body");
    assert.ok(p51.length > 0, "missing mesh P51_Body");
    let p51Column62 = 0;
    let p51Column62Orange = 0;
    for (const mesh of p51) {
      const uv = mesh.geometry.getAttribute("uv");
      assert.ok(uv, "P51_Body has no uv");
      for (let i = 0; i < uv.count; i++) {
        const texel = texelOf(uv, i);
        if (texel.column !== 62) continue;
        p51Column62++;
        if (texel.row < 512) p51Column62Orange++;
      }
    }
    // column 62 전체 916. 상단(주황) 개수는 색 기준 216과 비교하려고 로그한다.
    assert.equal(p51Column62, 916, `P51_Body column 62 vertices ${p51Column62}`);
    assert.ok(p51Column62Orange > 0, "P51_Body column 62 has no orange-half vertices");
    assert.ok(p51Column62Orange < p51Column62, "P51_Body column 62 has no shorts-half vertices");
    assert.equal(jerseySlot, 524 + p51Column62Orange, `jersey slot vertices ${jerseySlot}`);
    console.log("[rider15-colour-kit] jersey slot", {
      column0: jerseyColumn0,
      column62: p51Column62,
      column62OrangeHalf: p51Column62Orange,
      slotTotal: jerseySlot,
    });

    const heads = meshesNamed(scene, "P78_Head");
    assert.ok(heads.length > 0, "missing mesh P78_Head");
    const headColumns = new Array<number>(PALETTE_W).fill(0);
    let headColumn1 = 0;
    let headColumn63Shell = 0;
    let helmetSlot = 0;
    for (const head of heads) {
      const uv = head.geometry.getAttribute("uv");
      assert.ok(uv, "P78_Head has no uv");
      for (let i = 0; i < uv.count; i++) {
        const texel = texelOf(uv, i);
        headColumns[texel.column] = headColumns[texel.column]! + 1;
        if (texel.column === 1) headColumn1++;
        if (texel.column === 63 && (texel.row < 435 || texel.row >= 589)) headColumn63Shell++;
        if (inRects(texel, helmetRects)) helmetSlot++;
      }
    }
    console.log("[rider15-colour-kit] P78_Head per-column", headColumns);
    console.log("[rider15-colour-kit] P78_Head helmet slot", {
      column1: headColumn1,
      column63Shell: headColumn63Shell,
      column63Total: headColumns[63],
      slotTotal: helmetSlot,
    });
    assert.equal(headColumns[2], 0, "P78_Head column 2 must be unused");
    assert.equal(headColumn1, 86, `P78_Head column 1 vertices ${headColumn1}`);
    assert.equal(headColumns[63], 262, `P78_Head column 63 vertices ${headColumns[63]}`);
    assert.equal(
      headColumn63Shell,
      213,
      `P78_Head column 63 shell vertices ${headColumn63Shell}`,
    );
    assert.equal(helmetSlot, 86 + 213, `helmet slot vertices ${helmetSlot}`);

    const bike: Mesh[] = [];
    for (const mesh of collectMeshes(scene)) {
      const authored = meshNameOf(mesh);
      const names = [mesh.name, authored];
      if (
        names.some((name) => name.startsWith("P67_")) ||
        names.includes("P78_CleatsAndPedals")
      ) {
        bike.push(mesh);
      }
    }
    assert.ok(bike.length > 0, "bike meshes missing");
    for (const mesh of bike) {
      const uv = mesh.geometry.getAttribute("uv");
      assert.ok(uv, `${meshNameOf(mesh)} has no uv`);
      for (let i = 0; i < uv.count; i++) {
        const texel = texelOf(uv, i);
        assert.ok(
          !inRects(texel, jerseyRects) && !inRects(texel, helmetRects),
          `${meshNameOf(mesh)} samples palette slot ${texel.column},${texel.row}`,
        );
      }
    }
  });

  it("paintPaletteKit(rider15 칸): 슬롯 사각형만 칠하고 나머지는 바이트 동일(peer·pacer)", () => {
    assert.deepEqual(RIDER15_PALETTE_SLOTS, {
      jersey: [
        { x: 0, y: 0, w: 1, h: 1024 },
        { x: 62, y: 0, w: 1, h: 512 },
      ],
      helmet: [
        { x: 1, y: 0, w: 1, h: 1024 },
        { x: 63, y: 0, w: 1, h: 435 },
        { x: 63, y: 589, w: 1, h: 435 },
      ],
    });
    const jerseyRects = paletteSlotRects(RIDER15_PALETTE_SLOTS.jersey);
    const helmetRects = paletteSlotRects(RIDER15_PALETTE_SLOTS.helmet);
    const slotArea = [...jerseyRects, ...helmetRects].reduce((sum, rect) => sum + rect.w * rect.h, 0);
    assert.equal(slotArea, 3430, "slot rectangle area");
    for (const kind of ["peer", "pacer"] as const) {
      const input = new Uint8Array(PALETTE_W * PALETTE_H * 4).fill(7);
      const before = Uint8Array.from(input);
      const out = paintPaletteKit(input, PALETTE_W, PALETTE_H, RIDER15_PALETTE_SLOTS, kind);
      assert.deepEqual(input, before, "input mutated");
      const kit = kind === "peer" ? RIDER_VISUAL_KIT_PEER : RIDER_VISUAL_KIT_PACER;
      const jersey = [
        linearToSrgb8(kit.jersey.r),
        linearToSrgb8(kit.jersey.g),
        linearToSrgb8(kit.jersey.b),
        255,
      ];
      const helmet = [
        linearToSrgb8(kit.helmet.r),
        linearToSrgb8(kit.helmet.g),
        linearToSrgb8(kit.helmet.b),
        255,
      ];
      let changed = 0;
      for (let y = 0; y < PALETTE_H; y++) {
        for (let x = 0; x < PALETTE_W; x++) {
          const texel = { column: x, row: y };
          const got = pixelOf(out, x, y);
          if (inRects(texel, jerseyRects)) {
            assert.deepEqual(got, jersey, `${kind} jersey (${x},${y})`);
            changed++;
          } else if (inRects(texel, helmetRects)) {
            assert.deepEqual(got, helmet, `${kind} helmet (${x},${y})`);
            changed++;
          } else {
            assert.deepEqual(got, [7, 7, 7, 7], `${kind} outside (${x},${y})`);
          }
        }
      }
      assert.equal(changed, slotArea);
      // 헬멧 라임 줄무늬·어두운 벤트, 반바지 반쪽, 프레임 오렌지는 그대로다.
      for (let y = 435; y <= 588; y++) {
        assert.deepEqual(pixelOf(out, 63, y), [7, 7, 7, 7], `${kind} column 63 row ${y}`);
      }
      for (let y = 512; y < PALETTE_H; y++) {
        assert.deepEqual(pixelOf(out, 62, y), [7, 7, 7, 7], `${kind} column 62 row ${y}`);
      }
      for (let y = 0; y < PALETTE_H; y++) {
        assert.deepEqual(pixelOf(out, 20, y), [7, 7, 7, 7], `${kind} column 20 row ${y}`);
      }
    }
  });

  it("근거리 rig: peer 는 map·emissiveMap 공유 키트 텍스처, self 복원, dispose 해제", async () => {
    const { scene, animations } = await loadPreservedTestGlb(RIDER15_ID);
    attachRider15PaletteStubMaps(scene);
    const rig = new Rider15Rig({ scene, animations }, getRiderModelProfile("rider15"));
    try {
      const bike = materialByPrefix(rig.object, RIDER15_BIKE_PALETTE_MATERIAL);
      const rider = materialByPrefix(rig.object, RIDER15_RIDER_PALETTE_MATERIAL);
      const originalBikeMap = bike.map;
      const originalRiderMap = rider.map;
      const originalRiderEmissive = rider.emissiveMap;
      assert.ok(originalBikeMap, "bike stub map missing");
      assert.ok(originalRiderMap, "rider stub map missing");
      assert.equal(originalRiderEmissive, originalRiderMap, "rider emissiveMap must share map");

      const kit = RiderPaletteKit.ofMaterialForTests(rider);
      assert.ok(kit, "rider15 palette kit missing");
      const kitTexture = new DataTexture(
        new Uint8Array(PALETTE_W * PALETTE_H * 4),
        PALETTE_W,
        PALETTE_H,
      );
      kit.injectKitTextureForTests("peer", kitTexture);

      rig.setVisualKind("peer");
      assert.equal(rider.map, kitTexture);
      assert.equal(rider.emissiveMap, kitTexture);
      assert.equal(bike.map, kitTexture);
      // 같은 kind 재적용은 새 텍스처를 만들지 않는다.
      rig.setVisualKind("peer");
      assert.equal(rider.map, kitTexture);

      rig.setVisualKind("self");
      assert.equal(rider.map, originalRiderMap);
      assert.equal(rider.emissiveMap, originalRiderEmissive);
      assert.equal(bike.map, originalBikeMap);

      rig.setVisualKind("peer");
      let originalDisposes = 0;
      let kitDisposes = 0;
      originalRiderMap.addEventListener("dispose", () => {
        originalDisposes += 1;
      });
      kitTexture.addEventListener("dispose", () => {
        kitDisposes += 1;
      });
      rig.dispose();
      assert.equal(originalDisposes, 1, "original palette dispose count");
      assert.equal(kitDisposes, 1, "kit texture dispose count");
      assert.equal(rider.map, originalRiderMap, "dispose restores original map");
    } finally {
      rig.dispose();
    }
  });

  it("LOD2: 저지 250–320·헬멧 78, 프레임 바이트 불변, self 원본 복원", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER15_ID, LOD2_FILE);
    const staticRider = new PreservedRiderStatic(scene, getRiderModelProfile("rider15"));
    try {
      const meshes = collectMeshes(staticRider.object);
      assert.equal(meshes.length, 1, "LOD2 mesh count");
      const mesh = meshes[0]!;
      const position = mesh.geometry.getAttribute("position");
      const color = mesh.geometry.getAttribute("color");
      assert.ok(position, "LOD2 position missing");
      assert.ok(color, "LOD2 color missing");
      assert.equal(color.itemSize, 4);
      assert.equal(color.normalized, true);
      const original = colorBytes(color as BufferAttribute);

      const jersey: number[] = [];
      const frame: number[] = [];
      const helmet: number[] = [];
      for (let i = 0; i < position.count; i++) {
        const [r, g, b] = vertexBytes(original, i, color.itemSize);
        if (
          r === RIDER15_LOD2_JERSEY_RGB.r &&
          g === RIDER15_LOD2_JERSEY_RGB.g &&
          b === RIDER15_LOD2_JERSEY_RGB.b
        ) {
          if (position.getY(i) >= RIDER15_LOD2_JERSEY_MIN_Y) jersey.push(i);
          else frame.push(i);
        } else if (
          r === RIDER15_LOD2_HELMET_RGB.r &&
          g === RIDER15_LOD2_HELMET_RGB.g &&
          b === RIDER15_LOD2_HELMET_RGB.b
        ) {
          helmet.push(i);
        }
      }
      assert.ok(frame.length > 0, "frame orange vertices missing");
      assert.ok(
        jersey.length >= 250 && jersey.length <= 320,
        `jersey vertex count ${jersey.length}`,
      );
      assert.equal(helmet.length, 78, `helmet vertex count ${helmet.length}`);

      staticRider.setVisualKind("peer");
      const peerAttribute = mesh.geometry.getAttribute("color");
      assert.ok(peerAttribute);
      const peer = colorBytes(peerAttribute as BufferAttribute);
      const peerJersey = [
        Math.round(RIDER_VISUAL_KIT_PEER.jersey.r * 255),
        Math.round(RIDER_VISUAL_KIT_PEER.jersey.g * 255),
        Math.round(RIDER_VISUAL_KIT_PEER.jersey.b * 255),
      ];
      const peerHelmet = [
        Math.round(RIDER_VISUAL_KIT_PEER.helmet.r * 255),
        Math.round(RIDER_VISUAL_KIT_PEER.helmet.g * 255),
        Math.round(RIDER_VISUAL_KIT_PEER.helmet.b * 255),
      ];
      for (const i of frame) {
        assert.deepEqual(vertexBytes(peer, i, color.itemSize), vertexBytes(original, i, color.itemSize), `frame ${i}`);
      }
      for (const i of jersey) {
        assert.deepEqual(
          vertexBytes(peer, i, color.itemSize),
          [...peerJersey, original[i * color.itemSize + 3]!],
          `jersey ${i}`,
        );
      }
      for (const i of helmet) {
        assert.deepEqual(
          vertexBytes(peer, i, color.itemSize),
          [...peerHelmet, original[i * color.itemSize + 3]!],
          `helmet ${i}`,
        );
      }
      const painted = new Set([...jersey, ...helmet]);
      for (let i = 0; i < position.count; i++) {
        if (painted.has(i)) continue;
        assert.deepEqual(
          vertexBytes(peer, i, color.itemSize),
          vertexBytes(original, i, color.itemSize),
          `unpainted ${i}`,
        );
      }

      // 한 kind 는 한 배열만 쓴다 — 같은 kind 재적용은 같은 속성 객체다.
      staticRider.setVisualKind("pacer");
      const pacerAttribute = mesh.geometry.getAttribute("color");
      assert.notEqual(pacerAttribute, peerAttribute);
      staticRider.setVisualKind("peer");
      assert.equal(mesh.geometry.getAttribute("color"), peerAttribute);

      staticRider.setVisualKind("self");
      assert.equal(mesh.geometry.getAttribute("color"), color);
      assert.deepEqual(
        colorBytes(mesh.geometry.getAttribute("color") as BufferAttribute),
        original,
      );
    } finally {
      staticRider.dispose();
    }
  });
});

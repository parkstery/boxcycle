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

const RIDER15_ID = "20261127-160608-8767e93a";
const LOD2_FILE = "rider-lod2.glb";
const PALETTE_W = 64;
const PALETTE_H = 1024;

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
  it("근거리 UV: 라이더 색상 슬롯을 사용하고 바이크는 슬롯을 사용하지 않는다", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER15_ID);
    const jerseyRects = paletteSlotRects(RIDER15_PALETTE_SLOTS.jersey);
    const helmetRects = paletteSlotRects(RIDER15_PALETTE_SLOTS.helmet);
    const riders = collectMeshes(scene).filter((mesh) => meshNameOf(mesh).startsWith("P176_Rider"));
    const bikes = meshesNamed(scene, "P177_Bike");
    assert.ok(riders.length > 0, "rider meshes missing");
    assert.equal(bikes.length, 1, "bike mesh count");
    let jersey = 0;
    let helmet = 0;
    for (const mesh of [...riders, ...bikes]) {
      const uv = mesh.geometry.getAttribute("uv");
      assert.ok(uv, `${meshNameOf(mesh)} has no uv`);
      for (let i = 0; i < uv.count; i++) {
        const texel = texelOf(uv, i);
        const j = inRects(texel, jerseyRects);
        const h = inRects(texel, helmetRects);
        if (bikes.includes(mesh)) assert.ok(!j && !h, "bike uses rider colour slot");
        else { if (j) jersey++; if (h) helmet++; }
      }
    }
    assert.ok(jersey > 0, "jersey slot unused");
    assert.ok(helmet > 0, "helmet slot unused");
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

  it("근거리 rig: 모든 팔레트 재질에 색상을 적용하고 원본 복원", async () => {
    const { scene, animations } = await loadPreservedTestGlb(RIDER15_ID);
    attachRider15PaletteStubMaps(scene);
    const rig = new Rider15Rig({ scene, animations }, getRiderModelProfile("rider15"));
    try {
      const materials = [...new Set(collectMeshes(rig.object).flatMap((mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material]))] as PaletteMaterial[];
      const palette = materials.filter((material) => material.name.startsWith(RIDER15_BIKE_PALETTE_MATERIAL));
      assert.ok(palette.length > 0, "palette materials missing");
      const originals = palette.map((material) => material.map);
      const kit = RiderPaletteKit.ofMaterialForTests(palette[0]!);
      assert.ok(kit, "rider15 palette kit missing");
      const kitTexture = new DataTexture(
        new Uint8Array(PALETTE_W * PALETTE_H * 4),
        PALETTE_W,
        PALETTE_H,
      );
      kit.injectKitTextureForTests("peer", kitTexture);

      rig.setVisualKind("peer");
      for (const material of palette) assert.equal(material.map, kitTexture);
      rig.setVisualKind("self");
      palette.forEach((material, i) => assert.equal(material.map, originals[i]));
      rig.setVisualKind("peer");
      let kitDisposes = 0;
      kitTexture.addEventListener("dispose", () => { kitDisposes++; });
      rig.dispose();
      assert.equal(kitDisposes, 1, "kit texture dispose count");
      palette.forEach((material, i) => assert.equal(material.map, originals[i]));
    } finally {
      rig.dispose();
    }
  });

  it("LOD2: 저지·헬멧 색상, 프레임 바이트 불변, self 원본 복원", async () => {
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
      assert.equal(helmet.length, 127, `helmet vertex count ${helmet.length}`);

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

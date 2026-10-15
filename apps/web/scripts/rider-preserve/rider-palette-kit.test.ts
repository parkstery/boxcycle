/**
 * rider14 팔레트 컬러 키트 시험 (P2b).
 *
 * 실행: npm run test:rider-preserve (또는
 * node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs \
 *   --test scripts/rider-preserve/rider-palette-kit.test.ts)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { DataTexture, Mesh, MeshStandardMaterial } from "three";
import {
  linearToSrgb8,
  paintPaletteKit,
  readPaletteSlots,
  RIDER_VISUAL_KIT_PACER,
  RIDER_VISUAL_KIT_PEER,
  RIDER_VISUAL_KIT_SELF,
  type PaletteSlots,
} from "../../src/lib/riderPrototype/riderVisualKit.ts";
import { PreservedRiderRig } from "../../src/lib/riderPrototype/preservedRiderRig.ts";
import { getRiderModelProfile } from "../../src/lib/riderPrototype/riderModelProfile.ts";
import { RiderPaletteKit } from "../../src/lib/riderPrototype/riderPaletteKit.ts";
import type { RiderVisualKind } from "../../src/lib/riderPrototype/iso2dMarker.ts";
import {
  attachPaletteStubMap,
  loadPreservedTestGlb,
  loadPreservedTestGuides,
} from "./rider-glb-test-loader.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const RIDER14_ID = "20261015-212136-df8de090";
const RIDER14_GLB = path.join(
  here, "..", "..", "public", "rider", "preserved", "candidates", RIDER14_ID, "rider.glb",
);

const PALETTE_W = 128;
const PALETTE_H = 16;
const SELF_SRGB: [number, number, number, number] = [255, 128, 0, 255];

function kitOf(kind: RiderVisualKind) {
  if (kind === "peer") return RIDER_VISUAL_KIT_PEER;
  if (kind === "pacer") return RIDER_VISUAL_KIT_PACER;
  return RIDER_VISUAL_KIT_SELF;
}

/** GLB JSON 청크를 파싱한다(이진 청크는 손대지 않는다). */
function readGlbJson(glbPath: string): {
  materials: Array<{ name?: string; extras?: Record<string, unknown> }>;
  images: Array<{ name?: string; mimeType?: string; bufferView?: number }>;
  bufferViews: Array<{ byteOffset?: number; byteLength: number }>;
} {
  const buf = fs.readFileSync(glbPath);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  assert.equal(view.getUint32(0, true), 0x46546c67, "not a GLB");
  const jsonLen = view.getUint32(12, true);
  return JSON.parse(Buffer.from(buf.buffer, buf.byteOffset + 20, jsonLen).toString("utf8")) as {
    materials: Array<{ name?: string; extras?: Record<string, unknown> }>;
    images: Array<{ name?: string; mimeType?: string; bufferView?: number }>;
    bufferViews: Array<{ byteOffset?: number; byteLength: number }>;
  };
}

/** bufferView 바이트를 BIN 청크에서 잘라낸다. */
function readBufferView(glbPath: string, jsonLen: number, byteOffset: number, byteLength: number): Buffer {
  const buf = fs.readFileSync(glbPath);
  let binAt = 12 + 8 + jsonLen;
  binAt += (4 - (jsonLen % 4)) % 4;
  const start = binAt + 8 + byteOffset;
  return Buffer.from(buf.subarray(start, start + byteLength));
}

function glbJsonLength(glbPath: string): number {
  const buf = fs.readFileSync(glbPath);
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(12, true);
}

/** 8비트 RGBA PNG 전용 작은 해독기. 필터 0–4(None·Sub·Up·Average·Paeth)를 처리한다. */
function decodePngRgba(png: Buffer): { width: number; height: number; pixels: Uint8Array } {
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "bad PNG signature",
  );
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (pos + 8 <= png.length) {
    const length = png.readUInt32BE(pos);
    const type = png.toString("ascii", pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, "only 8-bit PNG supported");
      assert.equal(data[9], 6, "only RGBA PNG supported");
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }
  assert.ok(width > 0 && height > 0, "missing IHDR");
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  assert.equal(raw.length, (stride + 1) * height, "unexpected IDAT size");
  const pixels = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  let at = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[at++];
    const row = raw.subarray(at, at + stride);
    at += stride;
    const out = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? out[i - 4]! : 0;
      const b = prev[i]!;
      const c = i >= 4 ? prev[i - 4]! : 0;
      let value = row[i]!;
      if (filter === 1) value = (value + a) & 255;
      else if (filter === 2) value = (value + b) & 255;
      else if (filter === 3) value = (value + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a);
        const pb = Math.abs(q - b);
        const pc = Math.abs(q - c);
        value = (value + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else if (filter !== 0) {
        throw new Error(`unknown PNG filter ${filter}`);
      }
      out[i] = value;
    }
    pixels.set(out, y * stride);
    prev = out;
  }
  return { width, height, pixels: Uint8Array.from(pixels) };
}

function pixelOf(pixels: Uint8Array, width: number, x: number, y: number): number[] {
  const at = (y * width + x) * 4;
  return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!, pixels[at + 3]!];
}

describe("rider-palette-kit", () => {
  it("linearToSrgb8: 0→0, 1→255, self 녹색 0.21586…→128, 0.0031308 경계 양쪽", () => {
    assert.equal(linearToSrgb8(0), 0);
    assert.equal(linearToSrgb8(1), 255);
    assert.equal(linearToSrgb8(0.2158605009317398), 128);
    const t = 0.0031308;
    const below = linearToSrgb8(t - 1e-7);
    const above = linearToSrgb8(t + 1e-7);
    assert.equal(below, Math.round(12.92 * (t - 1e-7) * 255));
    assert.equal(above, below, "sRGB 전달함수는 경계에서 연속이다");
    assert.equal(linearToSrgb8(-0.5), 0);
    assert.equal(linearToSrgb8(2), 255);
  });

  it("paintPaletteKit: 두 칸 64픽셀씩만 바뀌고 나머지 1,920픽셀 바이트 동일, 입력 불변", () => {
    const slots: PaletteSlots = {
      helmet: { x: 0, y: 0, w: 8, h: 8 },
      jersey: { x: 8, y: 0, w: 8, h: 8 },
    };
    const input = new Uint8Array(PALETTE_W * PALETTE_H * 4).fill(7);
    const before = Uint8Array.from(input);
    const out = paintPaletteKit(input, PALETTE_W, PALETTE_H, slots, "peer");
    assert.notEqual(out, input as unknown as object);
    assert.deepEqual(input, before);
    assert.equal(out.length, PALETTE_W * PALETTE_H * 4);
    const expected = {
      helmet: [
        linearToSrgb8(RIDER_VISUAL_KIT_PEER.helmet.r),
        linearToSrgb8(RIDER_VISUAL_KIT_PEER.helmet.g),
        linearToSrgb8(RIDER_VISUAL_KIT_PEER.helmet.b),
        255,
      ],
      jersey: [
        linearToSrgb8(RIDER_VISUAL_KIT_PEER.jersey.r),
        linearToSrgb8(RIDER_VISUAL_KIT_PEER.jersey.g),
        linearToSrgb8(RIDER_VISUAL_KIT_PEER.jersey.b),
        255,
      ],
    };
    let changedPixels = 0;
    for (let y = 0; y < PALETTE_H; y++) {
      for (let x = 0; x < PALETTE_W; x++) {
        const inHelmet = x < 8 && y < 8;
        const inJersey = x >= 8 && x < 16 && y < 8;
        const got = pixelOf(out, PALETTE_W, x, y);
        if (inHelmet) {
          assert.deepEqual(got, expected.helmet, `helmet (${x},${y})`);
          changedPixels++;
        } else if (inJersey) {
          assert.deepEqual(got, expected.jersey, `jersey (${x},${y})`);
          changedPixels++;
        } else {
          assert.deepEqual(got, [7, 7, 7, 7], `outside (${x},${y})`);
        }
      }
    }
    assert.equal(changedPixels, 128);
  });

  it("self/peer/pacer 각 칸 색 = 키트 선형값의 linearToSrgb8", () => {
    const slots: PaletteSlots = {
      helmet: { x: 0, y: 0, w: 8, h: 8 },
      jersey: { x: 8, y: 0, w: 8, h: 8 },
    };
    for (const kind of ["self", "peer", "pacer"] as const) {
      const kit = kitOf(kind);
      const out = paintPaletteKit(new Uint8Array(PALETTE_W * PALETTE_H * 4), PALETTE_W, PALETTE_H, slots, kind);
      assert.deepEqual(pixelOf(out, PALETTE_W, 0, 0), [
        linearToSrgb8(kit.helmet.r),
        linearToSrgb8(kit.helmet.g),
        linearToSrgb8(kit.helmet.b),
        255,
      ], `${kind} helmet`);
      assert.deepEqual(pixelOf(out, PALETTE_W, 15, 7), [
        linearToSrgb8(kit.jersey.r),
        linearToSrgb8(kit.jersey.g),
        linearToSrgb8(kit.jersey.b),
        255,
      ], `${kind} jersey`);
    }
  });

  it("rider14 GLB JSON 의 palette.colorSlots → readPaletteSlots 통과, 형식 틀린 입력 3종 → 예외", () => {
    const json = readGlbJson(RIDER14_GLB);
    const paletteMaterial = json.materials.find((m) => {
      const palette = (m.extras as { palette?: unknown } | undefined)?.palette;
      return typeof palette === "object" && palette !== null;
    });
    assert.ok(paletteMaterial, "palette extras material missing");
    const slots = readPaletteSlots(paletteMaterial.extras);
    assert.deepEqual(slots, {
      helmet: { x: 0, y: 0, w: 8, h: 8 },
      jersey: { x: 8, y: 0, w: 8, h: 8 },
    });
    assert.throws(() => readPaletteSlots(null), /userData/);
    assert.throws(() => readPaletteSlots({}), /palette extras/);
    assert.throws(
      () => readPaletteSlots({ palette: { colorSlots: { helmet: { x: 0, y: 0, w: 8 } } } }),
      /jersey|slot/,
    );
  });

  it("내장 palette_basecolor PNG 해독 → helmet·jersey 칸이 paint(…, self) 결과와 바이트 동일", () => {
    const jsonLen = glbJsonLength(RIDER14_GLB);
    const json = readGlbJson(RIDER14_GLB);
    const imageIndex = json.images.findIndex((image) => image.name === "palette_basecolor");
    assert.ok(imageIndex >= 0, "palette_basecolor image missing");
    const viewIndex = json.images[imageIndex]!.bufferView;
    assert.ok(typeof viewIndex === "number", "palette_basecolor has no bufferView");
    const view = json.bufferViews[viewIndex]!;
    const png = readBufferView(RIDER14_GLB, jsonLen, view.byteOffset ?? 0, view.byteLength);
    const decoded = decodePngRgba(png);
    assert.equal(decoded.width, PALETTE_W);
    assert.equal(decoded.height, PALETTE_H);
    const slots = readPaletteSlots(
      json.materials.find((m) => {
        const palette = (m.extras as { palette?: unknown } | undefined)?.palette;
        return typeof palette === "object" && palette !== null;
      })!.extras,
    );
    // 원본 칸이 이미 self 색이므로, self 로 칠한 결과와 바이트가 같아야 한다.
    // 즉 self 에서는 원본 map 을 그대로 써도 된다.
    for (const [x, y] of [[0, 0], [7, 0], [0, 7], [7, 7], [8, 0], [15, 0], [8, 7], [15, 7]]) {
      assert.deepEqual(pixelOf(decoded.pixels, PALETTE_W, x as number, y as number), [...SELF_SRGB]);
    }
    const painted = paintPaletteKit(decoded.pixels, PALETTE_W, PALETTE_H, slots, "self");
    for (const key of ["helmet", "jersey"] as const) {
      const slot = slots[key];
      for (let y = slot.y; y < slot.y + slot.h; y++) {
        for (let x = slot.x; x < slot.x + slot.w; x++) {
          assert.deepEqual(
            pixelOf(painted, PALETTE_W, x, y),
            pixelOf(decoded.pixels, PALETTE_W, x, y),
            `${key} (${x},${y})`,
          );
        }
      }
    }
  });

  it("P2b 보정: pacer 적용 상태 rig dispose → 원본 map·키트 텍스처가 각각 dispose 1회", async () => {
    const { scene } = await loadPreservedTestGlb(RIDER14_ID);
    attachPaletteStubMap(scene);
    const guides = loadPreservedTestGuides(RIDER14_ID);
    const rig = new PreservedRiderRig(scene, guides, getRiderModelProfile("rider14"));
    try {
      let paletteMaterial: MeshStandardMaterial | null = null;
      rig.object.traverse((item) => {
        if (!(item instanceof Mesh) || paletteMaterial) return;
        const list = Array.isArray(item.material) ? item.material : [item.material];
        for (const material of list) {
          if (
            material instanceof MeshStandardMaterial &&
            typeof material.userData?.palette === "object" &&
            material.userData.palette !== null
          ) {
            paletteMaterial = material;
          }
        }
      });
      assert.ok(paletteMaterial, "palette material missing in rig");
      const material = paletteMaterial as MeshStandardMaterial;
      const originalMap = material.map;
      assert.ok(originalMap, "stub map missing");
      const kit = RiderPaletteKit.ofMaterialForTests(material);
      assert.ok(kit, "kit instance missing for palette material");
      // DataTexture 키트 생성은 브라우저 캔버스가 필요하므로 stub 을 주입한다.
      // 미리 들어 있으면 apply 가 새로 만들지 않는다(앱 동작 불변).
      const kitTexture = new DataTexture(new Uint8Array(PALETTE_W * PALETTE_H * 4), PALETTE_W, PALETTE_H);
      kit.injectKitTextureForTests("pacer", kitTexture);
      rig.setVisualKind("pacer");
      assert.equal(material.map, kitTexture);
      let originalDisposes = 0;
      let kitDisposes = 0;
      originalMap.addEventListener("dispose", () => {
        originalDisposes++;
      });
      kitTexture.addEventListener("dispose", () => {
        kitDisposes++;
      });
      rig.dispose();
      assert.equal(originalDisposes, 1, "original map dispose count");
      assert.equal(kitDisposes, 1, "kit texture dispose count");
    } finally {
      // dispose 가 끝난 rig 재해제는 무해해야 한다(이중 해제 누적 방지 확인).
      rig.dispose();
    }
  });
});

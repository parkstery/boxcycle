import { Color, Mesh, type Material, type Object3D } from "three";
import type { RiderVisualKind } from "./iso2dMarker";

/** preserved GLB 의 자기 라이더 기본색 — 제품 GLB `Helmet | matte orange shell` / `Rider | orange jersey` 와 동일 */
export const RIDER_VISUAL_KIT_SELF = {
  helmet: { r: 1, g: 0.2158605009317398, b: 0 },
  jersey: { r: 1, g: 0.2158605009317398, b: 0 },
} as const;

/**
 * 동행 구분색 — `iso-peer-*.svg` 가 이미 쓰는 teal 팔레트를 재사용한다.
 * (자기 라이더 오렌지와 한눈에 구분; `--rtw-trace` 골드는 자기 헬멧과 너무 가까워 제외)
 */
export const RIDER_VISUAL_KIT_PEER = {
  helmet: { r: 0x13 / 255, g: 0x4e / 255, b: 0x4a / 255 },
  jersey: { r: 0x0f / 255, g: 0x76 / 255, b: 0x6e / 255 },
} as const;

/** 페이서 — 동행 teal·자기 오렌지와 구분되는 흐린 슬레이트 */
export const RIDER_VISUAL_KIT_PACER = {
  helmet: { r: 0.45, g: 0.5, b: 0.56 },
  jersey: { r: 0.35, g: 0.4, b: 0.48 },
} as const;

type RiderKit = typeof RIDER_VISUAL_KIT_SELF | typeof RIDER_VISUAL_KIT_PEER | typeof RIDER_VISUAL_KIT_PACER;

function kitFor(kind: RiderVisualKind): RiderKit {
  if (kind === "pacer") return RIDER_VISUAL_KIT_PACER;
  if (kind === "peer") return RIDER_VISUAL_KIT_PEER;
  return RIDER_VISUAL_KIT_SELF;
}

export const RIDER_HELMET_SHELL_MATERIAL_NAME = "Helmet | matte orange shell";
export const RIDER_JERSEY_MATERIAL_NAME = "Rider | orange jersey";

const scratch = new Color();

function paintMaterial(material: Material, rgb: { r: number; g: number; b: number }): void {
  if (!("color" in material) || !(material.color instanceof Color)) return;
  scratch.setRGB(rgb.r, rgb.g, rgb.b);
  if (!material.color.equals(scratch)) {
    material.color.copy(scratch);
    material.needsUpdate = true;
  }
}

function paintNamed(material: Material, kit: RiderKit): void {
  const name = material.name ?? "";
  if (name === RIDER_HELMET_SHELL_MATERIAL_NAME) paintMaterial(material, kit.helmet);
  else if (name === RIDER_JERSEY_MATERIAL_NAME) paintMaterial(material, kit.jersey);
}

/** presentation-only — 위치·자세·메시 구조는 건드리지 않고 헬멧·상의 baseColor 만 맞춘다. */
export function applyRiderVisualKit(root: Object3D, kind: RiderVisualKind): void {
  const kit = kitFor(kind);
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of list) {
      if (material) paintNamed(material, kit);
    }
  });
}

export function resolveRiderVisualKit(kind: RiderVisualKind) {
  return kitFor(kind);
}

/** 팔레트 baseColor 텍스처 안의 한 색 칸(좌상단 원점 픽셀 단위). */
export type PaletteSlot = { x: number; y: number; w: number; h: number };
/** rider14 `Rider palette` 머티리얼 extras `palette.colorSlots` — 헬멧·저지 칸. */
export type PaletteSlots = { helmet: PaletteSlot; jersey: PaletteSlot };

/** 선형 0–1 → sRGB 8비트. 표준 전달함수, 반올림, 0–255 클램프. */
export function linearToSrgb8(c: number): number {
  if (!Number.isFinite(c)) throw new Error(`linearToSrgb8: not finite (${String(c)})`);
  const clamped = Math.max(0, Math.min(1, c));
  const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(srgb * 255)));
}

function readSlot(slots: Record<string, unknown>, key: "helmet" | "jersey"): PaletteSlot {
  const raw = slots[key];
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`readPaletteSlots: missing slot "${key}"`);
  }
  const record = raw as Record<string, unknown>;
  const coords = ["x", "y", "w", "h"] as const;
  const out = {} as Record<(typeof coords)[number], number>;
  for (const field of coords) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`readPaletteSlots: slot "${key}.${field}" is not a finite number`);
    }
    out[field] = value;
  }
  if (!Number.isInteger(out.x) || !Number.isInteger(out.y) || !Number.isInteger(out.w) || !Number.isInteger(out.h)) {
    throw new Error(`readPaletteSlots: slot "${key}" must hold integers`);
  }
  if (out.x < 0 || out.y < 0 || out.w <= 0 || out.h <= 0) {
    throw new Error(`readPaletteSlots: slot "${key}" out of range`);
  }
  return { x: out.x, y: out.y, w: out.w, h: out.h };
}

/**
 * GLTF 머티리얼 `userData.palette.colorSlots` 를 읽는다.
 * 형식이 틀리면 예외 — 호출자는 칸 좌표를 하드코딩하지 않는다.
 */
export function readPaletteSlots(userData: unknown): PaletteSlots {
  if (typeof userData !== "object" || userData === null) {
    throw new Error("readPaletteSlots: userData is not an object");
  }
  const palette = (userData as Record<string, unknown>).palette;
  if (typeof palette !== "object" || palette === null) {
    throw new Error("readPaletteSlots: missing palette extras");
  }
  const slots = (palette as Record<string, unknown>).colorSlots;
  if (typeof slots !== "object" || slots === null) {
    throw new Error("readPaletteSlots: missing palette.colorSlots");
  }
  return {
    helmet: readSlot(slots as Record<string, unknown>, "helmet"),
    jersey: readSlot(slots as Record<string, unknown>, "jersey"),
  };
}

/**
 * 팔레트 픽셀에 키트 색을 칠한다. 입력은 복사만 하고, helmet·jersey 두 칸만
 * 칠한 RGBA 새 배열을 돌려준다(알파 255). 키트 RGB 는 선형값이므로 sRGB 로
 * 변환해 8비트로 쓴다. 좌표계는 원본 PNG·캔버스와 같은 좌상단 원점이다.
 */
export function paintPaletteKit(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  slots: PaletteSlots,
  kind: RiderVisualKind,
): Uint8Array {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`paintPaletteKit: bad size ${String(width)}x${String(height)}`);
  }
  if (pixels.length !== width * height * 4) {
    throw new Error(`paintPaletteKit: pixel length ${pixels.length} != ${width}x${height}x4`);
  }
  for (const key of ["helmet", "jersey"] as const) {
    const slot = slots[key];
    if (slot.x + slot.w > width || slot.y + slot.h > height) {
      throw new Error(`paintPaletteKit: slot "${key}" outside ${width}x${height}`);
    }
  }
  const kit = kitFor(kind);
  const out = new Uint8Array(pixels);
  const paint = (slot: PaletteSlot, rgb: { r: number; g: number; b: number }): void => {
    const r = linearToSrgb8(rgb.r);
    const g = linearToSrgb8(rgb.g);
    const b = linearToSrgb8(rgb.b);
    for (let y = slot.y; y < slot.y + slot.h; y++) {
      for (let x = slot.x; x < slot.x + slot.w; x++) {
        const at = (y * width + x) * 4;
        out[at] = r;
        out[at + 1] = g;
        out[at + 2] = b;
        out[at + 3] = 255;
      }
    }
  };
  paint(slots.helmet, kit.helmet);
  paint(slots.jersey, kit.jersey);
  return out;
}

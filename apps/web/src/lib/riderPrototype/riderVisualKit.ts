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

function paintNamed(
  material: Material,
  kit: typeof RIDER_VISUAL_KIT_SELF | typeof RIDER_VISUAL_KIT_PEER,
): void {
  const name = material.name ?? "";
  if (name === RIDER_HELMET_SHELL_MATERIAL_NAME) paintMaterial(material, kit.helmet);
  else if (name === RIDER_JERSEY_MATERIAL_NAME) paintMaterial(material, kit.jersey);
}

/** presentation-only — 위치·자세·메시 구조는 건드리지 않고 헬멧·상의 baseColor 만 맞춘다. */
export function applyRiderVisualKit(root: Object3D, kind: RiderVisualKind): void {
  const kit = kind === "peer" ? RIDER_VISUAL_KIT_PEER : RIDER_VISUAL_KIT_SELF;
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of list) {
      if (material) paintNamed(material, kit);
    }
  });
}

export function resolveRiderVisualKit(kind: RiderVisualKind) {
  return kind === "peer" ? RIDER_VISUAL_KIT_PEER : RIDER_VISUAL_KIT_SELF;
}

import { BufferAttribute } from "three";
import type { BufferGeometry, Mesh } from "three";
import type { RiderVisualKind } from "./iso2dMarker";
import { RIDER_VISUAL_KIT_PACER, RIDER_VISUAL_KIT_PEER } from "./riderVisualKit";

/** rider15 LOD2 원본 정점색(선형 값을 8비트로 저장한 값). */
export const RIDER15_LOD2_JERSEY_RGB = { r: 0xff, g: 0x37, b: 0x00 } as const;
export const RIDER15_LOD2_HELMET_RGB = { r: 0xd2, g: 0xd8, b: 0xde } as const;
/** LOD2 오렌지 정점에서 프레임(아래)과 저지(위)를 가르는 높이. */
export const RIDER15_LOD2_JERSEY_MIN_Y = 0.95;

type KitKind = "peer" | "pacer";

function toByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

/** 정규화 Uint8 색은 원본 바이트를 그대로, 그 외는 속성 getter 로 8비트화한다. */
function readColorBytes(attribute: BufferAttribute): Uint8Array {
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
    out[at] = toByte(attribute.getX(i));
    if (itemSize > 1) out[at + 1] = toByte(attribute.getY(i));
    if (itemSize > 2) out[at + 2] = toByte(attribute.getZ(i));
    if (itemSize > 3) out[at + 3] = toByte(attribute.getW(i));
  }
  return out;
}

/**
 * rider15 LOD2 처럼 텍스처 없이 정점색만 쓰는 메시의 키트.
 * kind 별 색 배열을 한 번만 만들어 두고 `color` 속성만 교체한다.
 * `self` 는 원본 속성 그대로다.
 * `RiderVisualKit`(riderModelProfile) 과 구조가 같다 — 순환을 피하려고 import 하지 않는다.
 */
export class RiderVertexColorKit {
  private readonly geometry: BufferGeometry;
  private readonly original: BufferAttribute;
  private readonly originalBytes: Uint8Array;
  private readonly position: BufferAttribute;
  private readonly itemSize: number;
  private readonly normalized: boolean;
  private readonly kits = new Map<KitKind, BufferAttribute>();
  private current: RiderVisualKind | null = null;

  constructor(mesh: Mesh) {
    const color = mesh.geometry.getAttribute("color") as BufferAttribute | undefined;
    const position = mesh.geometry.getAttribute("position") as BufferAttribute | undefined;
    if (!color) throw new Error("RiderVertexColorKit: color attribute missing");
    if (!position) throw new Error("RiderVertexColorKit: position attribute missing");
    if (color.itemSize < 3) throw new Error("RiderVertexColorKit: color itemSize < 3");
    if (position.count !== color.count) {
      throw new Error("RiderVertexColorKit: color/position vertex count mismatch");
    }
    this.geometry = mesh.geometry;
    this.original = color;
    this.originalBytes = readColorBytes(color);
    this.position = position;
    this.itemSize = color.itemSize;
    this.normalized = color.normalized;
  }

  apply(kind: RiderVisualKind): void {
    if (this.current === kind) return;
    if (kind === "self") {
      this.geometry.setAttribute("color", this.original);
    } else {
      let attribute = this.kits.get(kind);
      if (!attribute) {
        attribute = this.build(kind);
        this.kits.set(kind, attribute);
      }
      this.geometry.setAttribute("color", attribute);
    }
    this.current = kind;
  }

  dispose(): void {
    this.geometry.setAttribute("color", this.original);
    this.kits.clear();
    this.current = null;
  }

  private build(kind: KitKind): BufferAttribute {
    const kit = kind === "peer" ? RIDER_VISUAL_KIT_PEER : RIDER_VISUAL_KIT_PACER;
    const jersey: readonly [number, number, number] = [
      toByte(kit.jersey.r),
      toByte(kit.jersey.g),
      toByte(kit.jersey.b),
    ];
    const helmet: readonly [number, number, number] = [
      toByte(kit.helmet.r),
      toByte(kit.helmet.g),
      toByte(kit.helmet.b),
    ];
    const out = new Uint8Array(this.originalBytes);
    for (let i = 0; i < this.position.count; i++) {
      const at = i * this.itemSize;
      const r = out[at]!;
      const g = out[at + 1]!;
      const b = out[at + 2]!;
      let paint: readonly [number, number, number] | null = null;
      if (
        r === RIDER15_LOD2_HELMET_RGB.r &&
        g === RIDER15_LOD2_HELMET_RGB.g &&
        b === RIDER15_LOD2_HELMET_RGB.b
      ) {
        paint = helmet;
      } else if (
        r === RIDER15_LOD2_JERSEY_RGB.r &&
        g === RIDER15_LOD2_JERSEY_RGB.g &&
        b === RIDER15_LOD2_JERSEY_RGB.b &&
        this.position.getY(i) >= RIDER15_LOD2_JERSEY_MIN_Y
      ) {
        paint = jersey;
      }
      if (!paint) continue;
      out[at] = paint[0];
      out[at + 1] = paint[1];
      out[at + 2] = paint[2];
    }
    return new BufferAttribute(out, this.itemSize, this.normalized);
  }
}

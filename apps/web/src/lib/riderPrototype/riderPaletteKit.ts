import {
  DataTexture,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import type { Texture } from "three";
import type { RiderVisualKind } from "./iso2dMarker";
import { paintPaletteKit, readPaletteSlots, type PaletteSlots } from "./riderVisualKit";

/**
 * rider14 `Rider palette` 머티리얼의 baseColor 팔레트 텍스처에
 * self/peer/pacer 컬러 키트를 입힌다(계획 §5.5).
 *
 * - `self` 는 원본 map 그대로 쓴다(픽셀이 이미 self 색이므로 새로 만들지 않음).
 * - `peer`·`pacer` 는 처음 요청될 때 한 번만 만든다. 이후 `apply` 는 참조 교체뿐이라
 *   매 프레임 픽셀을 다시 쓰거나 텍스처를 새로 만들지 않는다.
 * - 브라우저 전용: 원본 `map.image` 를 캔버스에 그려 픽셀을 읽는다.
 */
export class RiderPaletteKit {
  private readonly material: MeshStandardMaterial;
  private readonly slots: PaletteSlots;
  private readonly originalMap: Texture;
  private readonly kits = new Map<"peer" | "pacer", DataTexture>();
  private current: RiderVisualKind | null = null;

  /** 시험용: rig 가 만든 키트 인스턴스를 머티리얼로 찾는다(앱 동작 불변). */
  private static readonly byMaterial = new WeakMap<object, RiderPaletteKit>();

  private constructor(material: MeshStandardMaterial, slots: PaletteSlots) {
    this.material = material;
    this.slots = slots;
    const map = material.map;
    if (!map) throw new Error("RiderPaletteKit: material.map is missing");
    this.originalMap = map;
    RiderPaletteKit.byMaterial.set(material, this);
  }

  /** 시험용: rig 가 만든 키트 인스턴스를 머티리얼로 찾는다. */
  static ofMaterialForTests(material: MeshStandardMaterial): RiderPaletteKit | undefined {
    return RiderPaletteKit.byMaterial.get(material);
  }

  /** map·`userData.palette` 가 없으면 예외. */
  static fromMaterial(material: MeshStandardMaterial): RiderPaletteKit {
    if (!material.map) throw new Error("RiderPaletteKit: material.map is missing");
    return new RiderPaletteKit(material, readPaletteSlots(material.userData));
  }

  /** `material.map` 만 교체한다. 같은 kind 면 아무것도 안 한다. */
  apply(kind: RiderVisualKind): void {
    if (this.current === kind) return;
    if (kind === "self") {
      this.material.map = this.originalMap;
    } else {
      let texture = this.kits.get(kind);
      if (!texture) {
        texture = this.buildKitTexture(kind);
        this.kits.set(kind, texture);
      }
      this.material.map = texture;
    }
    this.current = kind;
  }

  /**
   * 직접 만든 peer·pacer 텍스처만 dispose 한다(원본 map 은 rig 가 정리).
   * 먼저 `material.map` 을 원본으로 되돌린다 — 되돌리지 않으면 rig 의
   * 머티리얼 sweep 이 키트 텍스처만 보고 원본 map 을 해제하지 못한다(P2b 감리).
   */
  dispose(): void {
    this.material.map = this.originalMap;
    for (const texture of this.kits.values()) texture.dispose();
    this.kits.clear();
    this.current = null;
  }

  /**
   * 시험용: 키트 텍스처를 미리 넣어 둔다. `DataTexture` 키트 생성은 브라우저
   * 캔버스가 필요하므로 Node 시험에서는 stub 텍스처를 넣어 dispose 경로만
   * 검증한다. 미리 들어 있으면 `apply` 가 새로 만들지 않으므로 앱 동작 불변.
   */
  injectKitTextureForTests(kind: "peer" | "pacer", texture: DataTexture): void {
    this.kits.set(kind, texture);
  }

  private buildKitTexture(kind: "peer" | "pacer"): DataTexture {
    const source = this.originalMap;
    const image = source.image as unknown as CanvasImageSource & { width: number; height: number };
    const width = image?.width ?? 0;
    const height = image?.height ?? 0;
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      throw new Error("RiderPaletteKit: original map image has no size");
    }
    let pixels: Uint8ClampedArray;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("RiderPaletteKit: 2d context unavailable");
      context.drawImage(image, 0, 0);
      pixels = context.getImageData(0, 0, width, height).data;
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("RiderPaletteKit: 2d context unavailable");
      context.drawImage(image, 0, 0);
      pixels = context.getImageData(0, 0, width, height).data;
    }
    const rgba = paintPaletteKit(pixels, width, height, this.slots, kind);
    const texture = new DataTexture(rgba, width, height, RGBAFormat, UnsignedByteType);
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.wrapS = source.wrapS;
    texture.wrapT = source.wrapT;
    texture.needsUpdate = true;
    return texture;
  }
}

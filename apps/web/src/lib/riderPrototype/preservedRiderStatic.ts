/**
 * rider14 LOD2 정적 메시. 리그 없이 크랭크 0° 자세를 메시 하나로 그린다.
 * position·normal bake 는 리그와 같은 `bakeFloat32Attributes` 다.
 */
import { Group, Mesh, type Object3D } from "three";
import type { RiderVisualKind } from "./iso2dMarker";
import type { RiderModelProfile, RiderVisualKit } from "./riderModelProfile";
import { bakeFloat32Attributes } from "./preservedRiderRig";

function authoredMeshName(object: Object3D): string {
  const authored = object.userData.name;
  return typeof authored === "string" && authored ? authored : object.name;
}

export class PreservedRiderStatic {
  readonly object: Group;
  private readonly visualKit: RiderVisualKit;

  constructor(source: Object3D, profile: RiderModelProfile) {
    this.object = new Group();
    this.object.name = "preserved-rider-lod2";
    source.updateMatrixWorld(true);
    source.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const geometry = item.geometry.clone();
      bakeFloat32Attributes(geometry);
      geometry.applyMatrix4(item.matrixWorld);
      const clone = new Mesh(geometry, item.material);
      clone.name = authoredMeshName(item);
      Object.assign(clone.userData, item.userData);
      clone.castShadow = false;
      clone.receiveShadow = false;
      clone.frustumCulled = false;
      this.object.add(clone);
    });
    this.visualKit = profile.createVisualKit(this.object);
  }

  setVisualKind(kind: RiderVisualKind): void {
    this.visualKit.apply(kind);
  }

  /** 키트 → 지오메트리 → 머티리얼 → 텍스처. 리그 `dispose` 와 같은 순서. */
  dispose(): void {
    this.visualKit.dispose();
    const materials = new Set<unknown>();
    const textures = new Set<{ dispose: () => void }>();
    this.object.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      item.geometry.dispose();
      const list = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of list) materials.add(material);
    });
    for (const material of materials) {
      if (material && typeof material === "object") {
        for (const value of Object.values(material)) {
          if (
            value &&
            typeof value === "object" &&
            "isTexture" in value &&
            (value as { isTexture: unknown }).isTexture === true &&
            "dispose" in value
          ) {
            textures.add(value as { dispose: () => void });
          }
        }
        if ("dispose" in material) {
          (material as { dispose: () => void }).dispose();
        }
      }
    }
    for (const texture of textures) texture.dispose();
  }
}

/**
 * rider14 LOD2 정적 메시. 리그 없이 크랭크 0° 자세를 메시 하나로 그린다.
 * position·normal bake 는 리그와 같은 `bakeFloat32Attributes` 다.
 */
import { Group, Mesh, type Object3D } from "three";
import type { RiderVisualKind } from "./iso2dMarker";
import type { RiderModelProfile, RiderVisualKit } from "./riderModelProfile";
import { bakeFloat32Attributes, disposeRiderObject } from "./preservedRiderRig";

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

  /** 키트 → 지오메트리 → 머티리얼 → 텍스처. 리그 `dispose` 와 같은 순서(공통 `disposeRiderObject`). */
  dispose(): void {
    disposeRiderObject(this.object, this.visualKit);
  }
}

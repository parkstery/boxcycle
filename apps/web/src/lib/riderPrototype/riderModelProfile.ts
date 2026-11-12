import { BufferGeometry, Mesh, MeshStandardMaterial } from "three";
import type { Material, Object3D } from "three";
import type { RiderVisualKind } from "./iso2dMarker";
import { RiderPaletteKit, type PaletteMaterial } from "./riderPaletteKit";
import { RiderVertexColorKit } from "./riderVertexColorKit";
import { applyRiderVisualKit, type PaletteSlots } from "./riderVisualKit";

export type RiderModelProfileId = "s5" | "rider14" | "rider15";

export type RiderRigGroup =
  | "crank" | "pedalR" | "pedalL" | "footR" | "footL"
  | "legR" | "legL" | "wheelFront" | "wheelRear" | "bike" | "static";

export type BakedMesh = { name: string; mesh: Mesh; geometry: BufferGeometry };

/** 컬러 키트 핸들 — `setVisualKind` 경로에서 `material.color`·`map` 교체 방식을 가린다. */
export interface RiderVisualKit {
  apply(kind: RiderVisualKind): void;
  dispose(): void;
}

/** 메시 이름·`pedalBind`·가이드 가중치로 다리를 푸는 절차 리그 프로필. */
export interface RiderModelProfile {
  readonly kind: "procedural";
  readonly id: "s5" | "rider14";
  /** rider14 만 상체 흔들림 셰이더를 설치한다. s5 롤백은 false. */
  readonly supportsSway: boolean;
  groupOf(name: string): RiderRigGroup;
  pedalBind(baked: readonly BakedMesh[], side: "R" | "L"): [number, number, number];
  guideKeyOf(name: string, side: "R" | "L", mesh?: Mesh): string | null;
  isThighOnly(name: string): boolean;
  isSock(name: string): boolean;
  createVisualKit(root: Object3D): RiderVisualKit;
}

/** glTF 표준 스킨·`Ride_Hoods` 클립을 그대로 재생하는 rider15 프로필. */
export interface Rider15ModelProfile {
  readonly kind: "skinned";
  readonly id: "rider15";
  readonly supportsSway: false;
  readonly clipName: "Ride_Hoods";
  readonly wheelNodeNames: { readonly front: "P67_FrontWheel"; readonly rear: "P67_RearWheel" };
  /** 근거리는 팔레트 텍스처, LOD2 는 정점색 키트를 만든다. */
  createVisualKit(root: Object3D): RiderVisualKit;
}

export type AnyRiderModelProfile = RiderModelProfile | Rider15ModelProfile;

const S5_GROUPS: Record<string, readonly string[]> = {
  crank: ["Mesh_44", "Mesh_45", "Mesh_46", "Mesh_47", "Mesh_50", "Mesh_51", "Mesh_56"],
  pedalR: ["Mesh_48", "Mesh_49"],
  pedalL: ["Mesh_52", "Mesh_53"],
  footR: ["Mesh_157", "Mesh_158", "Mesh_159", "Mesh_160", "Mesh_161", "Mesh_162"],
  footL: ["Mesh_167", "Mesh_168", "Mesh_169", "Mesh_170", "Mesh_171", "Mesh_172"],
  legR: ["Right continuous knee skin", "Mesh_153", "Mesh_156"],
  legL: ["Left continuous knee skin", "Mesh_163", "Mesh_166"],
  wheelFront: ["Mesh_0", "Mesh_1", "Mesh_2", "Mesh_3", "Mesh_4", "Mesh_4.001"],
  wheelRear: [
    "Mesh_6", "Mesh_7", "Mesh_8", "Mesh_9", "Mesh_10", "Mesh_10.001", "Mesh_12",
    "Mesh_13", "Mesh_14", "Mesh_15", "Mesh_16", "Mesh_17", "Mesh_18", "Mesh_19",
    "Mesh_20", "Mesh_27", "Mesh_30",
  ],
};

const S5_GUIDE_MESH: Record<"R" | "L", string> = {
  R: "Right continuous knee skin",
  L: "Left continuous knee skin",
};

const s5Explicit = new Map<string, RiderRigGroup>();
for (const [group, names] of Object.entries(S5_GROUPS)) {
  for (const name of names) s5Explicit.set(name, group as RiderRigGroup);
}

function s5GroupOf(name: string): RiderRigGroup {
  const matched = s5Explicit.get(name);
  if (matched) return matched;
  if (/^Mesh_5(\.|$)/.test(name)) return "wheelFront";
  if (/^Mesh_11(\.|$)/.test(name)) return "wheelRear";
  if (/^(Mesh_(21|22|25|26|28|29|31|33|34|54|55)|Bicycle|Front brake|Rear brake|Handlebar|Compact stem|Stem faceplate|Left compact|Right compact|Left brake|Right brake|Left bar|Right bar|Left lever|Right lever)/.test(name)) return "bike";
  return "static";
}

function centerOfNamedMeshes(draws: readonly { name: string; geometry: BufferGeometry }[], name: string): [number, number, number] {
  let lowX = Infinity; let lowY = Infinity; let lowZ = Infinity;
  let highX = -Infinity; let highY = -Infinity; let highZ = -Infinity;
  let found = false;
  for (const draw of draws) {
    if (draw.name !== name) continue;
    found = true;
    const p = draw.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
      if (x < lowX) lowX = x;
      if (y < lowY) lowY = y;
      if (z < lowZ) lowZ = z;
      if (x > highX) highX = x;
      if (y > highY) highY = y;
      if (z > highZ) highZ = z;
    }
  }
  if (!found) throw new Error(`Missing approved pedal mesh ${name}`);
  return [(lowX + highX) / 2, (lowY + highY) / 2, (lowZ + highZ) / 2];
}

const s5Profile: RiderModelProfile = {
  kind: "procedural",
  id: "s5",
  supportsSway: false,
  groupOf: s5GroupOf,
  pedalBind(baked: readonly BakedMesh[], side: "R" | "L"): [number, number, number] {
    return centerOfNamedMeshes(baked, side === "R" ? "Mesh_48" : "Mesh_52");
  },
  guideKeyOf(name: string, side: "R" | "L"): string | null {
    return name === S5_GUIDE_MESH[side] ? S5_GUIDE_MESH[side] : null;
  },
  isThighOnly(name: string): boolean {
    return name === "Mesh_153" || name === "Mesh_163";
  },
  isSock(name: string): boolean {
    return name === "Mesh_156" || name === "Mesh_166" || /sock/i.test(name);
  },
  createVisualKit(root: Object3D): RiderVisualKit {
    return {
      apply: (kind: RiderVisualKind) => applyRiderVisualKit(root, kind),
      dispose: () => {},
    };
  },
};

const RIDER14_RIG_GROUPS: ReadonlySet<string> = new Set([
  "crank", "pedalR", "pedalL", "footR", "footL",
  "legR", "legL", "wheelFront", "wheelRear",
]);

const RIDER14_GUIDE_KEY: Record<"R" | "L", string> = {
  R: "Right continuous knee skin",
  L: "Left continuous knee skin",
};

function rider14GroupOf(name: string): RiderRigGroup {
  const prefix = name.split("__")[0] ?? "";
  if (prefix === "static" || prefix === "bike") return "static";
  if (RIDER14_RIG_GROUPS.has(prefix)) return prefix as RiderRigGroup;
  throw new Error(`Unknown rider14 rig group prefix: ${name}`);
}

type PedalBindExtras = { pedalBind?: unknown };

function rider14PedalBind(baked: readonly BakedMesh[], side: "R" | "L"): [number, number, number] {
  const group = `pedal${side}`;
  const found: [number, number, number][] = [];
  for (const entry of baked) {
    if (rider14GroupOf(entry.name) !== group) continue;
    const raw = (entry.mesh.userData as PedalBindExtras).pedalBind;
    if (raw === undefined) continue;
    if (
      !Array.isArray(raw) || raw.length !== 3 ||
      raw.some((n) => typeof n !== "number" || !Number.isFinite(n))
    ) {
      throw new Error(`Invalid pedalBind extras on ${entry.name}`);
    }
    found.push([raw[0] as number, raw[1] as number, raw[2] as number]);
  }
  if (found.length !== 1) {
    throw new Error(`Expected exactly one pedalBind in ${group}, found ${found.length}`);
  }
  return found[0]!;
}

type GuideMeshExtras = { guideMesh?: unknown };

function rider14GuideKeyOf(name: string, side: "R" | "L", mesh?: Mesh): string | null {
  const expected = name === `leg${side}__Material_5` ? RIDER14_GUIDE_KEY[side] : null;
  const extra = (mesh?.userData as GuideMeshExtras | undefined)?.guideMesh;
  if (extra !== undefined && extra !== null && extra !== expected) {
    throw new Error(`guideMesh extras mismatch on ${name}: ${String(extra)}`);
  }
  return expected;
}

const rider14Profile: RiderModelProfile = {
  kind: "procedural",
  id: "rider14",
  supportsSway: true,
  groupOf: rider14GroupOf,
  pedalBind: rider14PedalBind,
  guideKeyOf: rider14GuideKeyOf,
  isThighOnly(name: string): boolean {
    return /^leg[RL]__Rider_black_shorts$/.test(name);
  },
  isSock(name: string): boolean {
    return /^leg[RL]__Rider_black_socks$/.test(name);
  },
  createVisualKit(root: Object3D): RiderVisualKit {
    const seen = new Set<Material>();
    root.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const list = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of list) {
        if (material) seen.add(material);
      }
    });
    const paletteMaterials = [...seen].filter(
      (material): material is MeshStandardMaterial =>
        material instanceof MeshStandardMaterial &&
        typeof material.userData?.palette === "object" &&
        material.userData.palette !== null,
    );
    /*
     * CPU 모드 1개(공용 팔레트). GPU 스키닝에서는 리그가 다리 머티리얼을
     * 좌·우로 복제해 3개가 된다(복제본도 같은 팔레트·같은 map 공유).
     * 그 외 개수는 rig 배선이 어긋난 것이므로 그대로 예외를 낸다.
     */
    if (paletteMaterials.length !== 1 && paletteMaterials.length !== 3) {
      throw new Error(`Expected one palette material (or 3 with leg clones), found ${paletteMaterials.length}`);
    }
    const kit = RiderPaletteKit.fromMaterials(paletteMaterials);
    return {
      apply: (kind: RiderVisualKind) => kit.apply(kind),
      dispose: () => kit.dispose(),
    };
  },
};

/** rider15 근거리 팔레트의 칸 표 — GLB extras 대신 앱 코드에 둔다. */
export const RIDER15_PALETTE_SLOTS: PaletteSlots = {
  jersey: [
    { x: 0, y: 0, w: 1, h: 1024 },
    { x: 62, y: 0, w: 1, h: 512 },
  ],
  helmet: [
    { x: 1, y: 0, w: 1, h: 1024 },
    { x: 63, y: 0, w: 1, h: 435 },
    { x: 63, y: 589, w: 1, h: 435 },
  ],
};

/** rider15 근거리 GLB 머티리얼 이름 접두사. */
export const RIDER15_BIKE_PALETTE_MATERIAL = "P67 shared palette";
export const RIDER15_RIDER_PALETTE_MATERIAL = "P75 rider";
export const RIDER15_LOD2_MESH_NAME = "P79_LOD2";

function authoredName(object: Object3D): string {
  const authored = object.userData.name;
  return typeof authored === "string" && authored ? authored : object.name;
}

function rider15PaletteMaterials(root: Object3D): PaletteMaterial[] {
  const found = new Set<PaletteMaterial>();
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of list) {
      if (!material) continue;
      const name = material.name ?? "";
      if (
        !name.startsWith(RIDER15_BIKE_PALETTE_MATERIAL) &&
        !name.startsWith(RIDER15_RIDER_PALETTE_MATERIAL)
      ) {
        continue;
      }
      const palette = material as PaletteMaterial;
      if (!palette.map) continue;
      found.add(palette);
    }
  });
  return [...found];
}

/** LOD2 는 텍스처 없이 정점색만 쓴다 — 이름이 맞으면 그 메시 하나로 키트를 만든다. */
function rider15VertexColorMesh(root: Object3D): Mesh | null {
  const candidates: Mesh[] = [];
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    if (!item.geometry.getAttribute("color")) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    const vertexColored = list.some(
      (material) => material != null && (material as { vertexColors?: boolean }).vertexColors === true,
    );
    if (vertexColored) candidates.push(item);
  });
  const named = candidates.find((item) => authoredName(item) === RIDER15_LOD2_MESH_NAME);
  return named ?? (candidates.length === 1 ? candidates[0]! : null);
}

const rider15Profile: Rider15ModelProfile = {
  kind: "skinned",
  id: "rider15",
  supportsSway: false,
  clipName: "Ride_Hoods",
  wheelNodeNames: { front: "P67_FrontWheel", rear: "P67_RearWheel" },
  createVisualKit(root: Object3D): RiderVisualKit {
    const palette = rider15PaletteMaterials(root);
    if (palette.length > 0) {
      return RiderPaletteKit.fromMaterials(palette, RIDER15_PALETTE_SLOTS);
    }
    const vertexMesh = rider15VertexColorMesh(root);
    if (vertexMesh) return new RiderVertexColorKit(vertexMesh);
    throw new Error("rider15 visual kit target missing (palette or vertex colours)");
  },
};

export function getRiderModelProfile(id: "rider15"): Rider15ModelProfile;
export function getRiderModelProfile(id: "s5" | "rider14"): RiderModelProfile;
export function getRiderModelProfile(id: RiderModelProfileId): AnyRiderModelProfile;
export function getRiderModelProfile(id: RiderModelProfileId): AnyRiderModelProfile {
  if (id === "rider15") return rider15Profile;
  return id === "rider14" ? rider14Profile : s5Profile;
}

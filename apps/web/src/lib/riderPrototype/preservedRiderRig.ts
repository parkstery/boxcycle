import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InterleavedBufferAttribute,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import type { Material, WebGLProgramParametersWithUniforms } from "three";
import type { RiderVisualKind } from "./iso2dMarker";
import type { BakedMesh, RiderModelProfile, RiderVisualKit } from "./riderModelProfile";
import {
  packSkinDQ,
  RIDER_SKIN_COMMON_GLSL,
  RIDER_SKIN_NORMAL_CHUNK,
  RIDER_SKIN_VERTEX_CHUNK,
} from "./riderGpuSkin";
import {
  isGpuSkinCapable,
  noteEffectiveRiderSkinMode,
  readRequestedRiderSkinMode,
  type RiderSkinMode,
} from "./riderSkinMode";
import { RIDER_SWAY_DEFAULTS } from "./riderSway";

type Side = "R" | "L";
type Vec3 = [number, number, number];
type GuideRow = { p: Vec3; w: Record<string, number> };
export type PreservedGuideData = Record<string, GuideRow[]>;

/** `?skin=gpu` 로 리그가 여는 GPU 스키닝 옵션. 생략하면 쿼리 요청값(기본 cpu). */
export type PreservedRiderRigOptions = {
  skinMode?: RiderSkinMode;
};

/** 흔들림 셰이더 주입 조각 — 기존 주입 결과와 바이트 동일해야 한다(시험이 문자열로 본다). */
const SWAY_COMMON_SUFFIX =
  "attribute float _sway;\nuniform float uSwayRoll;\nuniform float uSwayBob;\nuniform vec3 uSwayPivot;";
const SWAY_NORMAL_SUFFIX =
  "float swR = uSwayRoll * _sway; float swC = cos(swR), swS = sin(swR);\nobjectNormal = vec3(objectNormal.x, objectNormal.y * swC - objectNormal.z * swS, objectNormal.y * swS + objectNormal.z * swC);";
const SWAY_VERTEX_SUFFIX =
  "{ vec3 q = transformed - uSwayPivot; transformed = uSwayPivot + vec3(q.x, q.y * swC - q.z * swS, q.y * swS + q.z * swC); transformed.y += uSwayBob * _sway; }";

/** GPU 스키닝 다리 머티리얼 프로그램 캐시 키 — 흔들림 키에 skin 구분을 더한다. */
const SKIN_GPU_CACHE_KEY = "rider-sway-v1:skin-gpu";

type LegDraw = {
  name: string;
  side: Side;
  mesh: Mesh;
  position: BufferAttribute;
  normal: BufferAttribute;
  restPosition: Float32Array;
  restNormal: Float32Array;
  arc: Float32Array;
  weights: Float32Array;
};

type LegPose = {
  thigh: Matrix4;
  shin: Matrix4;
  foot: Matrix4;
  footSkin: Matrix4;
};

const RIG = {
  hip: { R: [-0.182, 1.0257, 0.1013], L: [-0.182, 1.0257, -0.1013] },
  knee: { R: [0.0365, 0.6835, 0.0953], L: [0.1214, 0.7559, -0.1073] },
  ankle: { R: [0.0219, 0.2171, 0.0747], L: [-0.2281, 0.4482, -0.0703] },
  bb: [0, 0.267, 0] as Vec3,
  hubFront: [0.583, 0.336, 0] as Vec3,
  hubRear: [-0.412, 0.336, 0] as Vec3,
} as const;

const FOOT_PITCH_DEG: Record<Side, readonly number[]> = {
  R: [0, 0.5, -1.9, 1.7, 6.5, 9.4, 12.4, 15.4, 18.2, 20.6, 22.3, 23.3, 23.5, 22.9, 21.5, 19.6, 17.3, 14.7, 12, 9.3, 6.5, 4, 1.9, 0.5, 0],
  L: [0, -0.3, -1.2, -2.6, -4.3, -6.1, -8.2, -10.3, -12.5, -14.7, -16.7, -18.2, -19.1, -19.3, -21.7, -19.1, -15.2, -12.9, -10.3, -7.7, -5.2, -3, -1.4, -0.4, 0],
};

const GUIDE_GROUP: Record<Side, readonly [string, string]> = {
  R: ["Guide_Right_Thigh", "Guide_Right_Shin"],
  L: ["Guide_Left_Thigh", "Guide_Left_Shin"],
};

const v = (a: Vec3) => new Vector3(a[0], a[1], a[2]);
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function rotationAt(axis: Vec3, angle: number, pivot: Vec3): Matrix4 {
  const q = new Quaternion().setFromAxisAngle(v(axis).normalize(), angle);
  return new Matrix4()
    .makeTranslation(...pivot)
    .multiply(new Matrix4().makeRotationFromQuaternion(q))
    .multiply(new Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
}

function fromToAt(from: Vector3, to: Vector3, pivot: Vector3): Matrix4 {
  const q = new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  return new Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new Matrix4().makeRotationFromQuaternion(q))
    .multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
}

function solveIk(hip: Vector3, target: Vector3, femur: number, tibia: number, pole: Vector3): {
  knee: Vector3;
  ankle: Vector3;
} {
  const delta = target.clone().sub(hip);
  const dMin = Math.abs(femur - tibia) + 1e-4;
  const dMax = femur + tibia - 1e-4;
  const d = Math.max(dMin, Math.min(dMax, delta.length()));
  const u = delta.normalize();
  const n = new Vector3().crossVectors(u, pole);
  if (n.length() < 1e-5) n.set(0, 0, 1);
  n.normalize();
  const bend = new Vector3().crossVectors(n, u).normalize();
  const ca = Math.max(-1, Math.min(1, (femur * femur + d * d - tibia * tibia) / (2 * femur * d)));
  const angle = Math.acos(ca);
  return {
    knee: hip.clone().addScaledVector(u, femur * Math.cos(angle)).addScaledVector(bend, femur * Math.sin(angle)),
    ankle: hip.clone().addScaledVector(u, d),
  };
}

function matrixToDualQuaternion(matrix: Matrix4, out: Float64Array): void {
  const m = matrix.elements;
  const trace = m[0] + m[5] + m[10];
  let x: number;
  let y: number;
  let z: number;
  let w: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s; x = (m[6] - m[9]) / s; y = (m[8] - m[2]) / s; z = (m[1] - m[4]) / s;
  } else if (m[0] > m[5] && m[0] > m[10]) {
    const s = Math.sqrt(1 + m[0] - m[5] - m[10]) * 2;
    w = (m[6] - m[9]) / s; x = 0.25 * s; y = (m[4] + m[1]) / s; z = (m[8] + m[2]) / s;
  } else if (m[5] > m[10]) {
    const s = Math.sqrt(1 + m[5] - m[0] - m[10]) * 2;
    w = (m[8] - m[2]) / s; x = (m[4] + m[1]) / s; y = 0.25 * s; z = (m[9] + m[6]) / s;
  } else {
    const s = Math.sqrt(1 + m[10] - m[0] - m[5]) * 2;
    w = (m[1] - m[4]) / s; x = (m[8] + m[2]) / s; y = (m[9] + m[6]) / s; z = 0.25 * s;
  }
  const tx = m[12]; const ty = m[13]; const tz = m[14];
  out[0] = x; out[1] = y; out[2] = z; out[3] = w;
  out[4] = 0.5 * (tx * w + ty * z - tz * y);
  out[5] = 0.5 * (-tx * z + ty * w + tz * x);
  out[6] = 0.5 * (tx * y - ty * x + tz * w);
  out[7] = -0.5 * (tx * x + ty * y + tz * z);
}

function meshName(object: Object3D): string {
  const authored = object.userData.name;
  return typeof authored === "string" && authored ? authored : object.name;
}

/**
 * meshopt + `KHR_mesh_quantization` GLB 의 정규화 정수 `position`·`normal` 을
 * 비정규화 Float32 로 바꾼다. `getX/getY/getZ` 로 읽으므로 정규화 해제와
 * interleaved 를 모두 처리한다. 이미 비정규화 Float32 면 그대로 둔다.
 * `uv` 등 다른 속성은 건드리지 않는다.
 */
export function bakeFloat32Attributes(geometry: BufferGeometry): void {
  for (const key of ["position", "normal"] as const) {
    const attribute = geometry.getAttribute(key);
    if (!attribute) continue;
    if (attribute instanceof InterleavedBufferAttribute) {
      geometry.setAttribute(key, bakeAttributeToFloat32(attribute));
      continue;
    }
    if (attribute.array instanceof Float32Array && !attribute.normalized) continue;
    geometry.setAttribute(key, bakeAttributeToFloat32(attribute));
  }
}

function bakeAttributeToFloat32(
  attribute: BufferAttribute | InterleavedBufferAttribute,
): BufferAttribute {
  const out = new Float32Array(attribute.count * 3);
  for (let i = 0; i < attribute.count; i++) {
    out[i * 3] = attribute.getX(i);
    out[i * 3 + 1] = attribute.getY(i);
    out[i * 3 + 2] = attribute.getZ(i);
  }
  return new BufferAttribute(out, 3);
}

function footPitch(side: Side, crankAngle: number): number {
  const degrees = ((crankAngle * 180 / Math.PI) % 360 + 360) % 360;
  const index = Math.floor(degrees / 15);
  const t = (degrees - index * 15) / 15;
  const values = FOOT_PITCH_DEG[side];
  return (values[index]! + (values[index + 1]! - values[index]!) * t) * Math.PI / 180;
}

function segmentDistance(point: Vector3, a: Vector3, b: Vector3): number {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-9)));
  return point.distanceTo(a.clone().addScaledVector(ab, t));
}

function proceduralWeights(
  side: Side,
  draw: LegDraw,
  femur: number,
  tibia: number,
  sideMin: number,
  sideMax: number,
  profile: RiderModelProfile,
): Float32Array {
  const count = draw.arc.length;
  const out = new Float32Array(count * 4);
  if (profile.isThighOnly(draw.name)) {
    for (let i = 0; i < count; i++) out[i * 4 + 1] = 1;
    return out;
  }
  const isSock = profile.isSock(draw.name);
  const hip = v(RIG.hip[side] as Vec3);
  const knee = v(RIG.knee[side] as Vec3);
  const ankle = v(RIG.ankle[side] as Vec3);
  for (let i = 0; i < count; i++) {
    const s = draw.arc[i]!;
    let wThigh: number;
    let wShin: number;
    if (side === "L") {
      const point = new Vector3(draw.restPosition[i * 3], draw.restPosition[i * 3 + 1], draw.restPosition[i * 3 + 2]);
      const d1 = Math.max(segmentDistance(point, hip, knee), 1e-5);
      const d2 = Math.max(segmentDistance(point, knee, ankle), 1e-5);
      const a1 = d1 * d1; const a2 = d2 * d2;
      wShin = a1 / (a1 + a2); wThigh = 1 - wShin;
    } else {
      wShin = smooth((s - (femur - 0.045)) / 0.09);
      wThigh = 1 - wShin;
    }
    const foot = isSock ? 0 : smooth((s - (femur + tibia - 0.03)) / 0.06);
    const pelvis = 1 - smooth(s / 0.07);
    wThigh *= 1 - foot; wShin *= 1 - foot;
    const keep = 1 - pelvis;
    out[i * 4] = pelvis;
    out[i * 4 + 1] = wThigh * keep;
    out[i * 4 + 2] = wShin * keep;
    out[i * 4 + 3] = foot * keep;
  }
  void sideMin;
  void sideMax;
  return out;
}

function guideWeights(side: Side, draw: LegDraw, guides: PreservedGuideData, profile: RiderModelProfile): Float32Array | null {
  const guideMesh = profile.guideKeyOf(draw.name, side, draw.mesh);
  if (guideMesh === null) return null;
  const rows = guides[guideMesh];
  if (!rows) throw new Error(`Missing authored guide mesh ${guideMesh}`);
  const cell = 1e-4;
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const bins = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i]!.p;
    const k = key(Math.round(p[0] / cell), Math.round(p[1] / cell), Math.round(p[2] / cell));
    const bucket = bins.get(k) ?? [];
    bucket.push(i); bins.set(k, bucket);
  }
  const groups = GUIDE_GROUP[side];
  const out = new Float32Array(draw.arc.length * 4);
  let unmatched = 0;
  for (let i = 0; i < draw.arc.length; i++) {
    const px = draw.restPosition[i * 3]!;
    const py = draw.restPosition[i * 3 + 1]!;
    const pz = draw.restPosition[i * 3 + 2]!;
    const cx = Math.round(px / cell); const cy = Math.round(py / cell); const cz = Math.round(pz / cell);
    let best = -1; let bestDistance = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const index of bins.get(key(cx + dx, cy + dy, cz + dz)) ?? []) {
        const p = rows[index]!.p;
        const distance = Math.hypot(px - p[0], py - p[1], pz - p[2]);
        if (distance < bestDistance) { bestDistance = distance; best = index; }
      }
    }
    if (best < 0 || bestDistance > 2e-4) { unmatched++; continue; }
    const weights = rows[best]!.w;
    const thigh = weights[groups[0]] ?? 0;
    const shin = weights[groups[1]] ?? 0;
    const sum = thigh + shin;
    if (sum <= 0) { unmatched++; continue; }
    out[i * 4 + 1] = thigh / sum;
    out[i * 4 + 2] = shin / sum;
  }
  if (unmatched > 0) throw new Error(`Authored guide mapping failed for ${side}: ${unmatched}/${draw.arc.length}`);
  return out;
}

export class PreservedRiderRig {
  readonly object = new Group();
  private readonly transforms = new Map<string, Group>();
  private readonly legs: Record<Side, LegDraw[]> = { R: [], L: [] };
  private readonly pedalBind: Record<Side, Vec3>;
  private readonly crankPhase: Record<Side, number>;
  private readonly crankRadius: number;
  private readonly poles: Record<Side, Vector3>;
  private readonly visualKit: RiderVisualKit;
  private readonly swaySupported: boolean;
  private readonly swayUniforms: {
    uSwayRoll: { value: number };
    uSwayBob: { value: number };
    uSwayPivot: { value: Vector3 };
  } | null;
  private readonly dualQuaternions = [
    new Float64Array(8), new Float64Array(8), new Float64Array(8), new Float64Array(8),
  ];
  /**
   * GPU 스키닝 상태. `rider14 + ?skin=gpu + GPU 조건` 일 때만 `gpu`.
   * s5·LOD2 는 항상 cpu(영향 없음). 기본은 cpu.
   */
  private skinMode: RiderSkinMode = "cpu";
  /** GPU 스키닝이 허용되는 리그·기기인가(rider14 + 정점 유니폼·highp). 쿼리와 무관. */
  private readonly gpuSkinSupported: boolean;
  private lastPhaseRev = 0;
  /** 좌·우 다리 머티리얼 복제본(GPU 모드에서만, 서로 다른 `uSkinDQ`). */
  private readonly legSkinMaterial: Record<Side, Material | null> = { R: null, L: null };
  private readonly skinUniforms: Record<Side, { uSkinDQ: { value: Float32Array } } | null> = {
    R: null,
    L: null,
  };

  constructor(source: Object3D, guides: PreservedGuideData, profile: RiderModelProfile, options?: PreservedRiderRigOptions) {
    this.swaySupported = profile.supportsSway;
    if (profile.supportsSway) {
      const [x, y, z] = RIDER_SWAY_DEFAULTS.pivot;
      this.swayUniforms = {
        uSwayRoll: { value: 0 },
        uSwayBob: { value: 0 },
        uSwayPivot: { value: new Vector3(x, y, z) },
      };
    } else {
      this.swayUniforms = null;
    }
    this.object.name = "approved-preserved-rider";
    for (const name of ["crank", "pedalR", "pedalL", "footR", "footL", "wheelFront", "wheelRear"]) {
      const group = new Group();
      group.name = `preserved-${name}`;
      group.matrixAutoUpdate = false;
      this.transforms.set(name, group);
      this.object.add(group);
    }
    source.updateMatrixWorld(true);
    const baked: (BakedMesh & { group: string })[] = [];
    source.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const name = meshName(item);
      const geometry = item.geometry.clone();
      bakeFloat32Attributes(geometry);
      geometry.applyMatrix4(item.matrixWorld);
      const clone = new Mesh(geometry, item.material);
      clone.name = name;
      // 프로필이 읽는 노드 extras(`pedalBind`·`guideMesh`)는 원본 Mesh 의
      // userData 에 있으므로 baked/clone 으로 함께 옮긴다.
      Object.assign(clone.userData, item.userData);
      clone.castShadow = false;
      clone.receiveShadow = false;
      clone.frustumCulled = false;
      const group = profile.groupOf(name);
      (this.transforms.get(group) ?? this.object).add(clone);
      baked.push({ name, geometry, group, mesh: clone });
    });

    this.pedalBind = {
      R: profile.pedalBind(baked, "R"),
      L: profile.pedalBind(baked, "L"),
    };
    const bb = RIG.bb;
    this.crankPhase = {
      R: Math.atan2(this.pedalBind.R[1] - bb[1], this.pedalBind.R[0] - bb[0]),
      L: 0,
    };
    this.crankPhase.L = this.crankPhase.R + Math.PI;
    this.crankRadius = Math.hypot(this.pedalBind.R[0] - bb[0], this.pedalBind.R[1] - bb[1]);

    for (const side of ["R", "L"] as const) {
      for (const item of baked.filter((entry) => entry.group === `leg${side}`)) {
        const position = item.geometry.getAttribute("position") as BufferAttribute;
        const normal = item.geometry.getAttribute("normal") as BufferAttribute;
        const restPosition = new Float32Array(position.array as ArrayLike<number>);
        const restNormal = new Float32Array(normal.array as ArrayLike<number>);
        const arc = this.buildArc(side, restPosition);
        this.legs[side].push({
          name: item.name, side, mesh: item.mesh, position, normal, restPosition, restNormal, arc,
          weights: new Float32Array(arc.length * 4),
        });
      }
      const allArc = this.legs[side].flatMap((draw) => Array.from(draw.arc));
      const sideMin = Math.min(...allArc); const sideMax = Math.max(...allArc);
      const hip = v(RIG.hip[side] as Vec3); const knee = v(RIG.knee[side] as Vec3); const ankle = v(RIG.ankle[side] as Vec3);
      const femur = hip.distanceTo(knee); const tibia = knee.distanceTo(ankle);
      for (const draw of this.legs[side]) {
        draw.weights = guideWeights(side, draw, guides, profile) ?? proceduralWeights(side, draw, femur, tibia, sideMin, sideMax, profile);
      }
    }

    this.poles = { R: this.bindPole("R"), L: this.bindPole("L") };
    this.gpuSkinSupported = profile.id === "rider14" && isGpuSkinCapable();
    const requested = options?.skinMode ?? readRequestedRiderSkinMode();
    this.skinMode = requested === "gpu" && this.gpuSkinSupported ? "gpu" : "cpu";
    if (profile.id === "rider14") this.attachSkinWeights();
    if (this.skinMode === "gpu") this.ensureGpuSkinAssets();
    noteEffectiveRiderSkinMode(this.skinMode);
    this.visualKit = profile.createVisualKit(this.object);
    this.installSwayShader();
    this.setPhase(0);
  }

  get supportsSway(): boolean {
    return this.swaySupported;
  }

  /** 기존 private `crankPhase.R`. 흔들림 타이밍용. 계산은 바꾸지 않는다. */
  get crankPhaseR(): number {
    return this.crankPhase.R;
  }

  /** 셰이더 균일 변수만 바꾼다. `supportsSway` 가 false 면 아무것도 안 한다. */
  setSway(v: { shaderRollRad: number; bobM: number }): void {
    if (!this.swayUniforms) return;
    this.swayUniforms.uSwayRoll.value = v.shaderRollRad;
    this.swayUniforms.uSwayBob.value = v.bobM;
  }

  /** 헬멧·상의 컬러만 교체. 프로필별 키트(s5 이름 방식 / rider14 팔레트 방식)에 위임. */
  setVisualKind(kind: RiderVisualKind): void {
    this.visualKit.apply(kind);
  }

  /** 실제 스키닝 실행 위치. 생성 직후·폴백 후 perflab 이 읽는다. */
  get skinModeValue(): RiderSkinMode {
    return this.skinMode;
  }

  /**
   * 스키닝 실행 위치를 바꾼다. `gpu` 는 허용된 리그·기기에서만(아니면 cpu 유지).
   * 셰이더를 다시 컴파일하고(`needsUpdate`), 현재 위상을 새 위치에서 다시
   * 계산한다. 셰이더 컴파일 실패 폴백(레이어)도 이 진입점으로 내린다.
   */
  setSkinMode(mode: RiderSkinMode): void {
    const next = mode === "gpu" && this.gpuSkinSupported ? "gpu" : "cpu";
    if (next === this.skinMode && (next === "cpu" || this.skinUniforms.R !== null)) {
      noteEffectiveRiderSkinMode(this.skinMode);
      return;
    }
    if (next === "gpu") this.ensureGpuSkinAssets();
    this.skinMode = next;
    noteEffectiveRiderSkinMode(this.skinMode);
    if (next === "gpu") {
      // 셰이더가 `position`/`normal` 을 휴지 입력으로 쓰므로 CPU 값이 남아 있으면
      // 이중 변형이 된다. 휴지값을 되돌리고 재업로드한다.
      for (const side of ["R", "L"] as const) {
        for (const draw of this.legs[side]) {
          (draw.position.array as Float32Array).set(draw.restPosition);
          (draw.normal.array as Float32Array).set(draw.restNormal);
          draw.position.needsUpdate = true;
          draw.normal.needsUpdate = true;
        }
      }
    }
    const seen = new Set<Material>();
    this.object.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const list = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of list) {
        if (!material || seen.has(material)) continue;
        seen.add(material);
        material.needsUpdate = true;
      }
    });
    this.setPhase(this.lastPhaseRev);
  }

  /** 시험용: 현재 리그 수학(IK·DQ)으로 특정 위상의 부호 보정済み 4 본 DQ. 앱 동작 불변. */
  skinDQForTests(side: Side, phaseRev: number): Float64Array[] {
    const pose = this.solveLeg(side, phaseRev * Math.PI * 2);
    return this.poseDualQuaternions(pose).map((q) => Float64Array.from(q));
  }

  /** 시험용: 다리 메시 휴지값·가중치·현재 스킨 결과. 앱 동작 불변. */
  legDrawsForTests(side: Side): readonly {
    name: string;
    restPosition: Float32Array;
    restNormal: Float32Array;
    weights: Float32Array;
    mesh: Mesh;
  }[] {
    return this.legs[side];
  }

  setPhase(phaseRev: number): void {
    this.lastPhaseRev = phaseRev;
    const crankAngle = phaseRev * Math.PI * 2;
    const poses: Record<Side, LegPose> = {
      R: this.solveLeg("R", crankAngle),
      L: this.solveLeg("L", crankAngle),
    };
    this.updateSkin("R", poses.R);
    this.updateSkin("L", poses.L);
    this.setTransform("crank", rotationAt([0, 0, 1], -crankAngle, RIG.bb));
    for (const side of ["R", "L"] as const) {
      const pedal = this.pedalPosition(side, crankAngle);
      const bind = this.pedalBind[side];
      this.setTransform(`pedal${side}`, new Matrix4().makeTranslation(pedal.x - bind[0], pedal.y - bind[1], pedal.z - bind[2]));
      this.setTransform(`foot${side}`, poses[side].foot);
    }
    this.setTransform("wheelFront", rotationAt([0, 0, 1], -crankAngle * 3.2, RIG.hubFront));
    this.setTransform("wheelRear", rotationAt([0, 0, 1], -crankAngle * 3.2, RIG.hubRear));
  }

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

  private buildArc(side: Side, positions: Float32Array): Float32Array {
    const hip = v(RIG.hip[side] as Vec3); const knee = v(RIG.knee[side] as Vec3); const ankle = v(RIG.ankle[side] as Vec3);
    const thighAxis = knee.clone().sub(hip).normalize();
    const shinAxis = ankle.clone().sub(knee).normalize();
    const bisector = thighAxis.clone().add(shinAxis).normalize();
    const femur = hip.distanceTo(knee);
    const result = new Float32Array(positions.length / 3);
    for (let i = 0; i < result.length; i++) {
      const point = new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      const sigma = point.clone().sub(knee).dot(bisector);
      const thighS = point.clone().sub(hip).dot(thighAxis);
      const shinS = femur + point.clone().sub(knee).dot(shinAxis);
      const blend = smooth((sigma + 0.06) / 0.12);
      result[i] = Math.max(-0.05, Math.min(femur + knee.distanceTo(ankle) + 0.05, thighS * (1 - blend) + shinS * blend));
    }
    return result;
  }

  private bindPole(side: Side): Vector3 {
    const hip = v(RIG.hip[side] as Vec3); const knee = v(RIG.knee[side] as Vec3); const ankle = v(RIG.ankle[side] as Vec3);
    const axis = ankle.clone().sub(hip).normalize();
    const offset = knee.clone().sub(hip);
    const perpendicular = offset.clone().sub(axis.multiplyScalar(offset.dot(axis)));
    return perpendicular.length() < 1e-6 ? new Vector3(1, 0, 0) : perpendicular.normalize();
  }

  private pedalPosition(side: Side, crankAngle: number): Vector3 {
    const angle = this.crankPhase[side] - crankAngle;
    return new Vector3(
      RIG.bb[0] + this.crankRadius * Math.cos(angle),
      RIG.bb[1] + this.crankRadius * Math.sin(angle),
      this.pedalBind[side][2],
    );
  }

  private solveLeg(side: Side, crankAngle: number): LegPose {
    const hip = v(RIG.hip[side] as Vec3); const knee = v(RIG.knee[side] as Vec3); const ankle = v(RIG.ankle[side] as Vec3);
    const pedal = this.pedalPosition(side, crankAngle);
    const pitch = footPitch(side, crankAngle);
    const bindOffset = v(RIG.ankle[side] as Vec3).sub(v(this.pedalBind[side]));
    bindOffset.applyAxisAngle(new Vector3(0, 0, 1), pitch);
    const target = pedal.clone().add(bindOffset);
    const solved = solveIk(hip, target, hip.distanceTo(knee), knee.distanceTo(ankle), this.poles[side]);
    const thigh = fromToAt(knee.clone().sub(hip), solved.knee.clone().sub(hip), hip);
    const shin = new Matrix4()
      .makeTranslation(solved.knee.x - knee.x, solved.knee.y - knee.y, solved.knee.z - knee.z)
      .multiply(fromToAt(ankle.clone().sub(knee), solved.ankle.clone().sub(solved.knee), knee));
    const rotation = new Matrix4().makeRotationZ(pitch);
    const foot = new Matrix4().makeTranslation(target.x, target.y, target.z)
      .multiply(rotation)
      .multiply(new Matrix4().makeTranslation(-ankle.x, -ankle.y, -ankle.z));
    return { thigh, shin, foot, footSkin: foot.clone() };
  }

  private updateSkin(side: Side, pose: LegPose): void {
    const dq = this.poseDualQuaternions(pose);
    const uniforms = this.skinUniforms[side];
    if (this.skinMode === "gpu" && uniforms) {
      // GPU 모드: 정점 루프 대신 좌·우 `uSkinDQ` 만 갱신한다.
      // `position`/`normal` 은 휴지값 그대로라 버퍼 재업로드가 없다.
      packSkinDQ(dq, uniforms.uSkinDQ.value);
      return;
    }
    for (const draw of this.legs[side]) {
      for (let i = 0; i < draw.arc.length; i++) {
        let qx = 0; let qy = 0; let qz = 0; let qw = 0;
        let ex = 0; let ey = 0; let ez = 0; let ew = 0;
        for (let bone = 0; bone < 4; bone++) {
          const weight = draw.weights[i * 4 + bone]!;
          if (weight < 1e-6) continue;
          const q = dq[bone]!;
          qx += weight * q[0]!; qy += weight * q[1]!; qz += weight * q[2]!; qw += weight * q[3]!;
          ex += weight * q[4]!; ey += weight * q[5]!; ez += weight * q[6]!; ew += weight * q[7]!;
        }
        const inverse = 1 / (Math.hypot(qx, qy, qz, qw) || 1);
        qx *= inverse; qy *= inverse; qz *= inverse; qw *= inverse;
        ex *= inverse; ey *= inverse; ez *= inverse; ew *= inverse;
        const vx = draw.restPosition[i * 3]!; const vy = draw.restPosition[i * 3 + 1]!; const vz = draw.restPosition[i * 3 + 2]!;
        const cx = qy * vz - qz * vy + qw * vx;
        const cy = qz * vx - qx * vz + qw * vy;
        const cz = qx * vy - qy * vx + qw * vz;
        const x = vx + 2 * (qy * cz - qz * cy) + 2 * (qw * ex - ew * qx + qy * ez - qz * ey);
        const y = vy + 2 * (qz * cx - qx * cz) + 2 * (qw * ey - ew * qy + qz * ex - qx * ez);
        const z = vz + 2 * (qx * cy - qy * cx) + 2 * (qw * ez - ew * qz + qx * ey - qy * ex);
        draw.position.setXYZ(i, x, y, z);

        const nx0 = draw.restNormal[i * 3]!; const ny0 = draw.restNormal[i * 3 + 1]!; const nz0 = draw.restNormal[i * 3 + 2]!;
        const dx = qy * nz0 - qz * ny0 + qw * nx0;
        const dy = qz * nx0 - qx * nz0 + qw * ny0;
        const dz = qx * ny0 - qy * nx0 + qw * nz0;
        const nx = nx0 + 2 * (qy * dz - qz * dy);
        const ny = ny0 + 2 * (qz * dx - qx * dz);
        const nz = nz0 + 2 * (qx * dy - qy * dx);
        const length = Math.hypot(nx, ny, nz) || 1;
        draw.normal.setXYZ(i, nx / length, ny / length, nz / length);
      }
      draw.position.needsUpdate = true;
      draw.normal.needsUpdate = true;
    }
  }

  /**
   * 자세 행렬 4개 → 부호 보정済み 4 본 DQ. CPU 정점 루프와 GPU 유니폼 갱신이
   * 같은 값을 쓴다. 기존 `updateSkin` 앞부분과 같은 식이다.
   */
  private poseDualQuaternions(pose: LegPose): Float64Array[] {
    const matrices = [new Matrix4(), pose.thigh, pose.shin, pose.footSkin];
    const dq = this.dualQuaternions;
    for (let i = 0; i < 4; i++) matrixToDualQuaternion(matrices[i]!, dq[i]!);
    for (let bone = 1; bone < 4; bone++) {
      let dot = 0;
      for (let k = 0; k < 4; k++) dot += dq[0]![k]! * dq[bone]![k]!;
      if (dot < 0) for (let k = 0; k < 8; k++) dq[bone]![k] = -dq[bone]![k]!;
    }
    return dq;
  }

  /**
   * 다리 메시 지오메트리에 `skinWeight`(vec4) 속성을 단다.
   * CPU 모드에서는 셰이더가 읽지 않으므로 출력이 바뀌지 않는다.
   */
  private attachSkinWeights(): void {
    for (const side of ["R", "L"] as const) {
      for (const draw of this.legs[side]) {
        draw.mesh.geometry.setAttribute("skinWeight", new BufferAttribute(draw.weights.slice(), 4));
      }
    }
  }

  /**
   * GPU 스키닝 자산: 다리 머티리얼 좌·우 복제 + 좌·우 `uSkinDQ` 유니폼.
   * `position`/`normal` 은 휴지값 그대로 둔다(매 프레임 덮어쓰지 않음).
   */
  private ensureGpuSkinAssets(): void {
    for (const side of ["R", "L"] as const) {
      if (this.skinUniforms[side] && this.legSkinMaterial[side]) continue;
      const draws = this.legs[side];
      const base = draws[0]?.mesh.material;
      if (!base || Array.isArray(base)) throw new Error(`Missing leg base material for ${side}`);
      const clone = base.clone();
      for (const draw of draws) draw.mesh.material = clone;
      this.legSkinMaterial[side] = clone;
      this.skinUniforms[side] = { uSkinDQ: { value: new Float32Array(32) } };
    }
  }

  /** GPU 모드에서 스킨 셰이더를 입는 다리 머티리얼의 좌·우. CPU 모드에서는 null. */
  private skinSideOfMaterial(material: Material): Side | null {
    if (this.skinMode !== "gpu") return null;
    if (material === this.legSkinMaterial.R) return "R";
    if (material === this.legSkinMaterial.L) return "L";
    return null;
  }

  private skinCacheKeyFor(material: Material): string {
    return this.skinSideOfMaterial(material) ? SKIN_GPU_CACHE_KEY : "rider-sway-v1";
  }

  /**
   * 뷰어 `installSway` 와 같은 3곳(`common`·`beginnormal_vertex`·`begin_vertex`).
   * 속성 `_sway`. 균일 변수 객체는 리그가 소유하고 `setSway` 가 값만 바꾼다.
   * GPU 모드 다리 머티리얼에는 스킨 주입을 앞에 더하고 캐시 키를 구분한다.
   */
  private installSwayShader(): void {
    const uniforms = this.swayUniforms;
    if (!uniforms) return;
    const seen = new Set<Material>();
    this.object.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const list = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of list) {
        if (!material || seen.has(material)) continue;
        seen.add(material);
        material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
          // 컴파일 시점의 모드로 주입을 정한다 — `setSkinMode` 가 `needsUpdate` 로
          // 다시 컴파일하므로 모드 전환 후에도 어긋나지 않는다.
          const side = this.skinSideOfMaterial(material);
          const skin = side ? this.skinUniforms[side] : null;
          Object.assign(shader.uniforms, uniforms);
          if (skin) Object.assign(shader.uniforms, skin);
          shader.vertexShader = shader.vertexShader
            .replace(
              "#include <common>",
              `#include <common>\n${SWAY_COMMON_SUFFIX}${skin ? `\n${RIDER_SKIN_COMMON_GLSL}` : ""}`,
            )
            .replace(
              "#include <beginnormal_vertex>",
              `#include <beginnormal_vertex>\n${skin ? `${RIDER_SKIN_NORMAL_CHUNK}\n` : ""}${SWAY_NORMAL_SUFFIX}`,
            )
            .replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>\n${skin ? `${RIDER_SKIN_VERTEX_CHUNK}\n` : ""}${SWAY_VERTEX_SUFFIX}`,
            );
        };
        material.customProgramCacheKey = () => this.skinCacheKeyFor(material);
        material.needsUpdate = true;
      }
    });
  }

  private setTransform(name: string, matrix: Matrix4): void {
    const group = this.transforms.get(name);
    if (!group) return;
    group.matrix.copy(matrix);
    group.matrixWorldNeedsUpdate = true;
  }
}

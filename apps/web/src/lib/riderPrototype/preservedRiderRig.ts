import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
} from "three";

type Side = "R" | "L";
type Vec3 = [number, number, number];
type GuideRow = { p: Vec3; w: Record<string, number> };
export type PreservedGuideData = Record<string, GuideRow[]>;

type LegDraw = {
  name: string;
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
  groups: {
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
  },
} as const;

const FOOT_PITCH_DEG: Record<Side, readonly number[]> = {
  R: [0, 0.5, -1.9, 1.7, 6.5, 9.4, 12.4, 15.4, 18.2, 20.6, 22.3, 23.3, 23.5, 22.9, 21.5, 19.6, 17.3, 14.7, 12, 9.3, 6.5, 4, 1.9, 0.5, 0],
  L: [0, -0.3, -1.2, -2.6, -4.3, -6.1, -8.2, -10.3, -12.5, -14.7, -16.7, -18.2, -19.1, -19.3, -21.7, -19.1, -15.2, -12.9, -10.3, -7.7, -5.2, -3, -1.4, -0.4, 0],
};

const GUIDE_MESH: Record<Side, string> = {
  R: "Right continuous knee skin",
  L: "Left continuous knee skin",
};
const GUIDE_GROUP: Record<Side, readonly [string, string]> = {
  R: ["Guide_Right_Thigh", "Guide_Right_Shin"],
  L: ["Guide_Left_Thigh", "Guide_Left_Shin"],
};

const v = (a: Vec3) => new Vector3(a[0], a[1], a[2]);
const toTuple = (a: Vector3): Vec3 => [a.x, a.y, a.z];
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

function groupForName(name: string, explicit: ReadonlyMap<string, string>): string {
  const matched = explicit.get(name);
  if (matched) return matched;
  if (/^Mesh_5(\.|$)/.test(name)) return "wheelFront";
  if (/^Mesh_11(\.|$)/.test(name)) return "wheelRear";
  if (/^(Mesh_(21|22|25|26|28|29|31|33|34|54|55)|Bicycle|Front brake|Rear brake|Handlebar|Compact stem|Stem faceplate|Left compact|Right compact|Left brake|Right brake|Left bar|Right bar|Left lever|Right lever)/.test(name)) return "bike";
  return "static";
}

function centerOfNamedMeshes(draws: readonly { name: string; geometry: BufferGeometry }[], name: string): Vec3 {
  const low = new Vector3(Infinity, Infinity, Infinity);
  const high = new Vector3(-Infinity, -Infinity, -Infinity);
  let found = false;
  for (const draw of draws) {
    if (draw.name !== name) continue;
    found = true;
    const p = draw.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      low.min(new Vector3(p.getX(i), p.getY(i), p.getZ(i)));
      high.max(new Vector3(p.getX(i), p.getY(i), p.getZ(i)));
    }
  }
  if (!found) throw new Error(`Missing approved pedal mesh ${name}`);
  return toTuple(low.add(high).multiplyScalar(0.5));
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
): Float32Array {
  const count = draw.arc.length;
  const out = new Float32Array(count * 4);
  if (draw.name === "Mesh_153" || draw.name === "Mesh_163") {
    for (let i = 0; i < count; i++) out[i * 4 + 1] = 1;
    return out;
  }
  const isSock = draw.name === "Mesh_156" || draw.name === "Mesh_166" || /sock/i.test(draw.name);
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

function guideWeights(side: Side, draw: LegDraw, guides: PreservedGuideData): Float32Array | null {
  const guideMesh = GUIDE_MESH[side];
  if (draw.name !== guideMesh) return null;
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
  private readonly dualQuaternions = [
    new Float64Array(8), new Float64Array(8), new Float64Array(8), new Float64Array(8),
  ];

  constructor(source: Object3D, guides: PreservedGuideData) {
    this.object.name = "approved-preserved-rider";
    const explicit = new Map<string, string>();
    for (const [group, names] of Object.entries(RIG.groups)) for (const name of names) explicit.set(name, group);
    for (const name of ["crank", "pedalR", "pedalL", "footR", "footL", "wheelFront", "wheelRear"]) {
      const group = new Group();
      group.name = `preserved-${name}`;
      group.matrixAutoUpdate = false;
      this.transforms.set(name, group);
      this.object.add(group);
    }
    source.updateMatrixWorld(true);
    const baked: { name: string; geometry: BufferGeometry; group: string; mesh: Mesh }[] = [];
    source.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const name = meshName(item);
      const geometry = item.geometry.clone();
      geometry.applyMatrix4(item.matrixWorld);
      const clone = new Mesh(geometry, item.material);
      clone.name = name;
      clone.castShadow = false;
      clone.receiveShadow = false;
      clone.frustumCulled = false;
      const group = groupForName(name, explicit);
      (this.transforms.get(group) ?? this.object).add(clone);
      baked.push({ name, geometry, group, mesh: clone });
    });

    this.pedalBind = {
      R: centerOfNamedMeshes(baked, "Mesh_48"),
      L: centerOfNamedMeshes(baked, "Mesh_52"),
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
          name: item.name, mesh: item.mesh, position, normal, restPosition, restNormal, arc,
          weights: new Float32Array(arc.length * 4),
        });
      }
      const allArc = this.legs[side].flatMap((draw) => Array.from(draw.arc));
      const sideMin = Math.min(...allArc); const sideMax = Math.max(...allArc);
      const hip = v(RIG.hip[side] as Vec3); const knee = v(RIG.knee[side] as Vec3); const ankle = v(RIG.ankle[side] as Vec3);
      const femur = hip.distanceTo(knee); const tibia = knee.distanceTo(ankle);
      for (const draw of this.legs[side]) {
        draw.weights = guideWeights(side, draw, guides) ?? proceduralWeights(side, draw, femur, tibia, sideMin, sideMax);
      }
    }

    this.poles = { R: this.bindPole("R"), L: this.bindPole("L") };
    this.setPhase(0);
  }

  setPhase(phaseRev: number): void {
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
    const materials = new Set<unknown>();
    this.object.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      item.geometry.dispose();
      const list = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of list) materials.add(material);
    });
    for (const material of materials) {
      if (material && typeof material === "object" && "dispose" in material) {
        (material as { dispose: () => void }).dispose();
      }
    }
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
    const matrices = [new Matrix4(), pose.thigh, pose.shin, pose.footSkin];
    const dq = this.dualQuaternions;
    for (let i = 0; i < 4; i++) matrixToDualQuaternion(matrices[i]!, dq[i]!);
    for (let bone = 1; bone < 4; bone++) {
      let dot = 0;
      for (let k = 0; k < 4; k++) dot += dq[0]![k]! * dq[bone]![k]!;
      if (dot < 0) for (let k = 0; k < 8; k++) dq[bone]![k] = -dq[bone]![k]!;
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

  private setTransform(name: string, matrix: Matrix4): void {
    const group = this.transforms.get(name);
    if (!group) return;
    group.matrix.copy(matrix);
    group.matrixWorldNeedsUpdate = true;
  }
}

/**
 * Rider IK — 3D 2-Bone IK + Pole Vector (순수 JS, three 등 의존 없음).
 *
 * End Effector 정합만으론 부족하다(발/손 0mm 여도 팔·다리 모양이 부자연). 그래서:
 *  - **3D**: side view(XY)에서 풀고 Z 를 나중에 붙이지 않는다. root/target/pole 의 XYZ 로 푼다.
 *  - **Pole Vector**: 2-Bone IK 의 무한 해 중 팔꿈치/무릎이 향할 방향(pole)을 강제한다.
 *    arm → elbow 아래·바깥, leg → knee 아래·전방. bending plane = (root, target, pole).
 *
 * 좌표계: +x 전진, +y 위, +z 왼쪽. 뼈 rest = -Y(수직 아래). GLB 노드 회전은 rest(-Y)를
 *   계산된 뼈 방향으로 돌리는 quaternion → Mapbox model-rotation [pitch(x), roll(z), yaw(y)] deg.
 */

// ── 벡터 유틸 (배열 [x,y,z]) ──────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const L = len(a) || 1;
  return [a[0] / L, a[1] / L, a[2] / L];
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const RAD2DEG = 180 / Math.PI;

/**
 * 3D 2-Bone IK. root→target 을 boneA(root쪽)+boneB 로 도달, 관절은 pole 방향으로 굽힘.
 * @returns {{ joint:[x,y,z], boneADir:[x,y,z], boneBDir:[x,y,z], jointDeg:number, reached:boolean }}
 *   joint = 팔꿈치/무릎 world 위치, jointDeg = 관절 내각(0=신전, 클수록 굽음).
 */
export function solveIk3D(root, target, pole, boneA, boneB) {
  const toTarget = sub(target, root);
  let d = len(toTarget);
  const maxReach = boneA + boneB;
  const reached = d <= maxReach - 1e-4;
  d = clamp(d, Math.abs(boneA - boneB) + 1e-4, maxReach - 1e-4);
  const axis = norm(toTarget); // root→target 단위벡터

  // 코사인법칙: root 에서 관절까지 축방향 투영거리 a, 축수직 높이 h.
  const a = (boneA * boneA - boneB * boneB + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, boneA * boneA - a * a));

  // bending plane 의 축수직 방향 = pole 를 축에 수직화한 벡터.
  const toPole = sub(pole, root);
  let bendDir = sub(toPole, scale(axis, dot(toPole, axis)));
  if (len(bendDir) < 1e-6) {
    // pole 가 축과 평행 — 임의 수직축(위쪽 우선)로 폴백.
    const up = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    bendDir = sub(up, scale(axis, dot(up, axis)));
  }
  bendDir = norm(bendDir);

  const joint = add(add(root, scale(axis, a)), scale(bendDir, h));
  const boneADir = norm(sub(joint, root));
  const boneBDir = norm(sub(target, joint));

  const cosJoint = clamp(dot(boneADir, boneBDir), -1, 1);
  const jointDeg = Math.acos(cosJoint) * RAD2DEG; // 0=일직선(신전), 클수록 굽음

  return { joint, boneADir, boneBDir, jointDeg, reached };
}

/**
 * 뼈 rest 방향(-Y)을 dir 로 돌리는 회전을 **Mapbox model-rotation** 오일러(도)로.
 *
 * ⚠ **규약 (mapbox-gl 3.23.1 번들 `rotationYZX` :36044 실측)**
 * ```js
 * identity(out); rotateY(out, out, r[1]); rotateZ(out, out, r[2]); rotateX(out, out, r[0]);
 * //  →  R = Ry(r[1]) · Rz(r[2]) · Rx(r[0])
 * ```
 * 즉 배열은 **`[x, y, z]` 순서**이고 **적용 순서는 Y→Z→X** 다.
 * 예전 주석의 *"[pitch(x), roll(z), yaw(y)]"* 는 **틀렸고**, 그 전제로 `[ex, ez, ey]` 를
 * 반환해 **y·z 성분이 맞바뀌어 있었다.** 그 결과 팔·다리가 자기 rest 축(−Y) 둘레로
 * 헛돌아 **화면상 전혀 움직이지 않았다**(F15~F21 이 전부 이것이다).
 *
 * 그래서 XYZ 오일러를 뽑아 재배열하지 않고, **Mapbox 가 실제로 조립하는
 * `R = Ry(b)·Rz(c)·Rx(a)` 에서 직접 추출**한다:
 * ```
 * R[1][0] = sin c            → c = asin(R[1][0])
 * R[1][1] = cos c · cos a    → a = atan2(−R[1][2], R[1][1])
 * R[1][2] = −cos c · sin a
 * R[0][0] = cos b · cos c    → b = atan2(−R[2][0], R[0][0])
 * R[2][0] = −sin b · cos c
 * ```
 * 짐벌(|R[1][0]|≈1, cos c≈0)에서는 a·b 를 분리할 수 없으므로 b=0 으로 두고
 * `a = atan2(R[2][1], R[2][2])` 를 쓴다.
 *
 * 반환값은 반드시 **왕복 검산**하라 — `verify-node-rotation.mjs` 가 상시 게이트다.
 * IK 해의 `footErr/handErr 0mm` 는 **해의 오차**이지 전달된 회전각의 검산이 아니다.
 */
export function restToDirRotationDeg(dir) {
  const REST = [0, -1, 0];
  const to = norm(dir);
  const c = clamp(dot(REST, to), -1, 1);
  let axis = cross(REST, to);
  const s = len(axis);
  if (s < 1e-8) {
    // 평행(같은 방향) 또는 반대. 같으면 회전 0, 반대면 Z축 180°(Rz(180)·[0,−1,0] = [0,1,0]).
    return c > 0 ? [0, 0, 0] : [0, 0, 180];
  }
  axis = scale(axis, 1 / s);
  const angle = Math.atan2(s, c);
  // axis-angle → quaternion
  const half = angle / 2;
  const sinH = Math.sin(half);
  const qx = axis[0] * sinH;
  const qy = axis[1] * sinH;
  const qz = axis[2] * sinH;
  const qw = Math.cos(half);
  // quaternion → 회전행렬 R[행][열] (열벡터 규약: v' = R·v)
  const r00 = 1 - 2 * (qy * qy + qz * qz);
  const r10 = 2 * (qx * qy + qz * qw);
  const r20 = 2 * (qx * qz - qy * qw);
  const r11 = 1 - 2 * (qx * qx + qz * qz);
  const r12 = 2 * (qy * qz - qx * qw);
  const r21 = 2 * (qy * qz + qx * qw);
  const r22 = 1 - 2 * (qx * qx + qy * qy);
  // R = Ry(b)·Rz(c)·Rx(a) 에서 a(x)·b(y)·c(z) 추출
  const ez = Math.asin(clamp(r10, -1, 1));
  let ex, ey;
  if (Math.abs(r10) < 0.9999999) {
    ex = Math.atan2(-r12, r11);
    ey = Math.atan2(-r20, r00);
  } else {
    // 짐벌: cos c ≈ 0 이라 a·b 가 축퇴한다. b=0 으로 고정하고 a 를 나머지에서 얻는다.
    ex = Math.atan2(r21, r22);
    ey = 0;
  }
  // Mapbox model-rotation = [x, y, z] (적용 순서 Y→Z→X). **성분을 뒤바꾸지 마라.**
  return [ex * RAD2DEG, ey * RAD2DEG, ez * RAD2DEG];
}

// ── 행렬 ↔ Mapbox 오일러 (F26: 발목 상쇄 계산에 필요) ─────────────────────
// Mapbox `rotationYZX` 규약: **R = Ry(e[1]) · Rz(e[2]) · Rx(e[0])**, 배열은 [x, y, z].
// 아래 두 함수는 서로의 역이며, `restToDirRotationDeg` 와 같은 규약을 쓴다.

/** 3×3 회전행렬(행 우선, v' = R·v) → Mapbox 오일러 [x, y, z] (도) */
export function mat3ToMapboxEulerDeg(R) {
  const ez = Math.asin(clamp(R[1][0], -1, 1));
  let ex, ey;
  if (Math.abs(R[1][0]) < 0.9999999) {
    ex = Math.atan2(-R[1][2], R[1][1]);
    ey = Math.atan2(-R[2][0], R[0][0]);
  } else {
    // 짐벌: cos c ≈ 0 → a·b 축퇴. b=0 고정.
    ex = Math.atan2(R[2][1], R[2][2]);
    ey = 0;
  }
  return [ex * RAD2DEG, ey * RAD2DEG, ez * RAD2DEG];
}

const _mul3 = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const _Rx = (t) => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const _Ry = (t) => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const _Rz = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
const D2R = Math.PI / 180;

/** Mapbox 오일러 [x, y, z](도) → 3×3 회전행렬. `rotationYZX` 와 동일 순서로 조립. */
export function mapboxEulerDegToMat3(e) {
  return _mul3(_mul3(_Ry(e[1] * D2R), _Rz(e[2] * D2R)), _Rx(e[0] * D2R));
}

/** 회전행렬 곱 A·B */
export const mat3Mul = _mul3;
/** 회전행렬 전치(= 역행렬, 직교행렬이므로) */
export const mat3Transpose = (A) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => A[j][i]));

/**
 * 자식 뼈(관절) 로컬 회전 — 부모(상단뼈)가 이미 boneADir 로 회전한 좌표계에서,
 * 자식 rest(-Y)를 boneBDir 로 돌리는 로컬 회전. 부모 회전의 역을 boneBDir 에 적용 후 restToDir.
 */
export function childRotationDeg(parentDir, childDir) {
  // 부모를 -Y→parentDir 로 돌린 quaternion 의 역으로 childDir 를 부모 로컬로 가져온다.
  const REST = [0, -1, 0];
  const to = norm(parentDir);
  const c = clamp(dot(REST, to), -1, 1);
  let axis = cross(REST, to);
  const s = len(axis);
  let q;
  if (s < 1e-8) {
    q = c > 0 ? [0, 0, 0, 1] : [1, 0, 0, 0];
  } else {
    axis = scale(axis, 1 / s);
    const half = Math.atan2(s, c) / 2;
    const sinH = Math.sin(half);
    q = [axis[0] * sinH, axis[1] * sinH, axis[2] * sinH, Math.cos(half)];
  }
  // childDir 를 부모 로컬로: qInv * childDir
  const qInv = [-q[0], -q[1], -q[2], q[3]];
  const localChild = rotateVecByQuat(childDir, qInv);
  return restToDirRotationDeg(localChild);
}

function rotateVecByQuat(v, q) {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

export const _vec = { sub, add, scale, dot, len, norm, cross };

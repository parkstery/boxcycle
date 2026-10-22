/**
 * 다리 DQS 블렌딩 — CPU 루프와 정점 셰이더가 공유하는 "같은 수식".
 *
 * 리그 수학(IK·듀얼 쿼터니언·가중치)은 바꾸지 않는다. 여기서 하는 일은
 * `PreservedRiderRig.updateSkin` 안쪽 정점 루프(4 본 DQ 가중합 → 정규화 →
 * 위치·법선 블렌딩)를 줄 단위로 같은 순서·같은 상수로 옮기는 것뿐이다.
 *
 * - `skinVertexDQ`: 순수 JS 함수. 시험이 CPU 경로 출력과 직접 대조한다.
 * - `RIDER_SKIN_*_GLSL`: 같은 식의 GLSL. 수식은 이 파일 한 곳에만 둔다.
 * - `packSkinDQ`: 리그가 계산한 4 본 DQ 를 `uSkinDQ[8]` 레이아웃으로 싣는다.
 */

/** 4 본 × (실수부 xyzw, 쌍대부 xyzw). 리그 `dualQuaternions` 와 같은 순서. */
export type SkinBoneDQ = ReadonlyArray<ArrayLike<number>>;

export type SkinVertexResult = {
  position: [number, number, number];
  normal: [number, number, number];
};

/**
 * 평면 배열의 `index` 번째 휴지 정점 1개를 4 본 DQ 로 스킨해 `out[0..5]`(위치 xyz, 법선 xyz)에 쓴다.
 * `rest`·`normal` 은 정점당 3개, `weights` 는 정점당 4개. 리그 CPU 정점 루프가 할당 없이 쓰는 본체이고,
 * `updateSkin` 정점 루프와 같은 연산 순서·같은 임계값(`1e-6`)·같은 가드(`|| 1`)다.
 */
export function skinVertexDQInto(
  rest: ArrayLike<number>,
  normal: ArrayLike<number>,
  weights: ArrayLike<number>,
  index: number,
  dq: SkinBoneDQ,
  out: number[] | Float64Array,
): void {
  let qx = 0;
  let qy = 0;
  let qz = 0;
  let qw = 0;
  let ex = 0;
  let ey = 0;
  let ez = 0;
  let ew = 0;
  for (let bone = 0; bone < 4; bone++) {
    const weight = weights[index * 4 + bone]!;
    if (weight < 1e-6) continue;
    const q = dq[bone]!;
    qx += weight * q[0]!;
    qy += weight * q[1]!;
    qz += weight * q[2]!;
    qw += weight * q[3]!;
    ex += weight * q[4]!;
    ey += weight * q[5]!;
    ez += weight * q[6]!;
    ew += weight * q[7]!;
  }
  const inverse = 1 / (Math.hypot(qx, qy, qz, qw) || 1);
  qx *= inverse;
  qy *= inverse;
  qz *= inverse;
  qw *= inverse;
  ex *= inverse;
  ey *= inverse;
  ez *= inverse;
  ew *= inverse;
  const vx = rest[index * 3]!;
  const vy = rest[index * 3 + 1]!;
  const vz = rest[index * 3 + 2]!;
  const cx = qy * vz - qz * vy + qw * vx;
  const cy = qz * vx - qx * vz + qw * vy;
  const cz = qx * vy - qy * vx + qw * vz;
  const x = vx + 2 * (qy * cz - qz * cy) + 2 * (qw * ex - ew * qx + qy * ez - qz * ey);
  const y = vy + 2 * (qz * cx - qx * cz) + 2 * (qw * ey - ew * qy + qz * ex - qx * ez);
  const z = vz + 2 * (qx * cy - qy * cx) + 2 * (qw * ez - ew * qz + qx * ey - qy * ex);

  const nx0 = normal[index * 3]!;
  const ny0 = normal[index * 3 + 1]!;
  const nz0 = normal[index * 3 + 2]!;
  const dx = qy * nz0 - qz * ny0 + qw * nx0;
  const dy = qz * nx0 - qx * nz0 + qw * ny0;
  const dz = qx * ny0 - qy * nx0 + qw * nz0;
  const nx = nx0 + 2 * (qy * dz - qz * dy);
  const ny = ny0 + 2 * (qz * dx - qx * dz);
  const nz = nz0 + 2 * (qx * dy - qy * dx);
  const length = Math.hypot(nx, ny, nz) || 1;
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = nx / length;
  out[4] = ny / length;
  out[5] = nz / length;
}

/**
 * 휴지 정점 1개를 4 본 DQ 로 스킨한다. 본체는 `skinVertexDQInto`.
 */
export function skinVertexDQ(
  rest: ArrayLike<number>,
  normal: ArrayLike<number>,
  weights: ArrayLike<number>,
  dq: SkinBoneDQ,
): SkinVertexResult {
  const out = [0, 0, 0, 0, 0, 0];
  skinVertexDQInto(rest, normal, weights, 0, dq, out);
  return { position: [out[0]!, out[1]!, out[2]!], normal: [out[3]!, out[4]!, out[5]!] };
}

/**
 * 4 본 DQ → `uSkinDQ[8]` (`[2b]` 실수부, `[2b+1]` 쌍대부).
 * 부호 반전(`dot < 0` 반전)은 리그 `poseDualQuaternions` 에서 이미 끝난 뒤다.
 */
export function packSkinDQ(dq: SkinBoneDQ, out: Float32Array): void {
  for (let bone = 0; bone < 4; bone++) {
    const q = dq[bone]!;
    const at = bone * 8;
    out[at] = q[0]!;
    out[at + 1] = q[1]!;
    out[at + 2] = q[2]!;
    out[at + 3] = q[3]!;
    out[at + 4] = q[4]!;
    out[at + 5] = q[5]!;
    out[at + 6] = q[6]!;
    out[at + 7] = q[7]!;
  }
}

/**
 * 정점 셰이더 주입 — 위 `skinVertexDQ` 와 같은 식.
 * `c = q×v + w·v`, `p = v + 2·(q×c) + 2·(w·e − e_w·q + q×e)` 를 풀어 쓰면
 * CPU 식과 항 단위로 일치한다. 좌·우 팔레트가 다르므로 유니폼은 다리
 * 머티리얼(좌·우 복제)마다 따로 든다.
 */
export const RIDER_SKIN_COMMON_GLSL = [
  "attribute vec4 skinWeight;",
  "uniform vec4 uSkinDQ[8];",
  "void rtwSkinBlend(vec4 w, out vec4 q, out vec4 e) {",
  "  vec4 bq = w.x * uSkinDQ[0] + w.y * uSkinDQ[2] + w.z * uSkinDQ[4] + w.w * uSkinDQ[6];",
  "  vec4 be = w.x * uSkinDQ[1] + w.y * uSkinDQ[3] + w.z * uSkinDQ[5] + w.w * uSkinDQ[7];",
  "  float inv = 1.0 / max(length(bq), 1e-8);",
  "  q = bq * inv;",
  "  e = be * inv;",
  "}",
  "vec3 rtwSkinPosition(vec3 v, vec4 q, vec4 e) {",
  "  vec3 c = cross(q.xyz, v) + q.w * v;",
  "  return v + 2.0 * (cross(q.xyz, c) + (q.w * e.xyz - e.w * q.xyz) + cross(q.xyz, e.xyz));",
  "}",
  "vec3 rtwSkinNormal(vec3 n, vec4 q) {",
  "  vec3 d = cross(q.xyz, n) + q.w * n;",
  "  vec3 r = n + 2.0 * cross(q.xyz, d);",
  "  return r / max(length(r), 1e-8);",
  "}",
].join("\n");

/** `#include <beginnormal_vertex>` 뒤 — 흔들림 회전보다 먼저(스킨 결과에 흔들림). */
export const RIDER_SKIN_NORMAL_CHUNK = [
  "{ vec4 rtwQ; vec4 rtwE;",
  "  rtwSkinBlend(skinWeight, rtwQ, rtwE);",
  "  objectNormal = rtwSkinNormal(objectNormal, rtwQ); }",
].join("\n");

/** `#include <begin_vertex>` 뒤 — `transformed` 는 휴지값(GPU 모드에서 덮어쓰지 않음). */
export const RIDER_SKIN_VERTEX_CHUNK = [
  "{ vec4 rtwQ; vec4 rtwE;",
  "  rtwSkinBlend(skinWeight, rtwQ, rtwE);",
  "  transformed = rtwSkinPosition(transformed, rtwQ, rtwE); }",
].join("\n");

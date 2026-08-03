#!/usr/bin/env node
/**
 * verify-rider-pose-gate — 앱에 올리기 **전에** 라이더 자세를 수치로 전수 검증한다 (F23).
 *
 * F22 의 `verify-node-rotation`(회전각 왕복 검산)을 **포함**하고, 자세·해부학·계약까지 넓힌다.
 * 하나라도 실패하면 종료코드 1 — **앱에 올리지 마라.**
 *
 * | # | 검사 | 기준 | 막는 사고 |
 * |---|---|---|---|
 * | 1 | 회전각 왕복 (8노드 × 4위상) | < 1e−6 | 성분 뒤바뀜 → 팔다리 무회전(F15~F21) |
 * | 2 | 무릎 z | 전 위상 **고관절 안쪽** | 무릎이 바깥으로 꺾임(해부학 불가, 사용자 지적) |
 * | 3 | 다리 도달 | hip→발목 ≤ THIGH+SHIN | 발이 페달에서 떨어짐 |
 * | 4 | 팔 도달 | 어깨→후드 ≤ UPPER+FORE | 손이 후드에서 뜸 |
 * | 5 | GLB 노드 ↔ riderRig | `HIP_L`==`leg_l`.T · `SHOULDER_L`==`arm_l`.T | 앱 IK root 와 렌더 노드 불일치(F20) |
 * | 6 | 노드 rest | 라이더 9노드 rotation·scale 없음 | rest 가 오버라이드에 겹침(F19~F21) |
 * | 7 | 정점 수 | **본체** 불변(캡 별도) | exporter 정점 복제(F16) |
 * | 8 | 발바닥 법선 | 월드 수직에서 **≤ 2°** | 발이 페달면과 어긋남(F25 §4-2) |
 * | 9 | 발바닥 최저점 vs 페달 상면 | **±3mm** | 발이 페달에서 뜨거나 파고듦 |
 *
 * ⚠ 허용치를 늘려 통과시키지 마라. 실패는 FAIL 로 보고하는 것이 옳다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node verify-rider-pose-gate.mjs [--glb <path>] [--expect-elbow 113.7] [--verbose]
 *   기본 GLB = 제품 경로.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  hipOf,
  shoulderOf,
  hoodOf,
  ankleTargetWorld,
  pedalWorld,
  ANKLE_UP,
  THIGH_LEN,
  SHIN_LEN,
  UPPER_ARM_LEN,
  FOREARM_LEN,
  PELVIS_HALF_Z,
} from "../../src/lib/riderPrototype/riderRig.geometry.mjs";
import { solveIk3D, restToDirRotationDeg, childRotationDeg } from "../../src/lib/riderPrototype/riderIk.mjs";
// ⚠ pole 을 재현하지 않는다 — pose.mjs 의 것을 그대로 쓴다(복제하면 거짓 PASS).
import { _poles, resolveGlbPedalPose } from "../../src/lib/riderGlbPedalPose.pose.mjs";
import { mapboxEulerDegToMat3, mat3Mul } from "../../src/lib/riderPrototype/riderIk.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_GLB = path.resolve(HERE, "../../public/rider/prototype/rider-lowpoly.glb");
const PHASES = [0, 0.25, 0.5, 0.75];
const TOL = 1e-6;
const D2R = Math.PI / 180;
const REST = [0, -1, 0];
const RIDER_NODES = ["torso", "leg_l", "leg_l_shin", "leg_r", "leg_r_shin", "arm_l", "arm_l_fore", "arm_r", "arm_r_fore"];
/** 라이더 **본체** 정점(관절 캡 제외). 캡은 별도로 센다 — F25 */
const EXPECT_BODY_VERTS = 5513;

const mm = (v) => +(v * 1000).toFixed(2);
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const Rx = (t) => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const Ry = (t) => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const Rz = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
const mapboxRotation = (e) => mul(mul(Ry(e[1] * D2R), Rz(e[2] * D2R)), Rx(e[0] * D2R));
const applyM = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const { kneePole, elbowPole } = _poles;
/** 밑창 법선(발 로컬) — F31 부터 (0,−1,0) 고정(분해가 −Y 로 정렬한다). */
const SOLE_N = { l: [0, -1, 0], r: [0, -1, 0] };
/** ankle 노드 원점 → **밑창 평면** 수직거리(m). 면적 군집 실측 19.69mm, 좌우 편차 0.00mm.
 *  `ANKLE_UP = SOLE_PLANE + 10mm`(페달 반두께)의 그 값이다 — 게이트도 같은 대상을 재야 한다. */
const SOLE_PLANE_M = 0.01969;

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

// ── 노드 계층 합성 (F27 게이트 10) — Mapbox 규칙: global = parent × local, 뒤에 override ──
const m4mul = (a, b) => {
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let rw = 0; rw < 4; rw++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + rw] * b[c * 4 + k];
      r[c * 4 + rw] = s;
    }
  return r;
};
const m4ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** TRS → 열우선 4×4 */
function m4fromTRS(t, q, s) {
  const [x, y, z, w] = q ?? [0, 0, 0, 1];
  const sc = s ?? [1, 1, 1];
  const tt = t ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sc[0], 2 * (x * y + z * w) * sc[0], 2 * (x * z - y * w) * sc[0], 0,
    2 * (x * y - z * w) * sc[1], (1 - 2 * (x * x + z * z)) * sc[1], 2 * (y * z + x * w) * sc[1], 0,
    2 * (x * z + y * w) * sc[2], 2 * (y * z - x * w) * sc[2], (1 - 2 * (x * x + y * y)) * sc[2], 0,
    tt[0], tt[1], tt[2], 1,
  ];
}
/** Mapbox 오일러 → 열우선 4×4 (rotationYZX) */
function m4fromEuler(e) {
  const R = mapboxEulerDegToMat3(e);
  return [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, 0, 0, 0, 1];
}
/** 노드 world 회전(3×3, 행 우선) — 계층을 실제로 합성한다(crank matrix rest 포함) */
function nodeWorldRot(g, byName, name, overrides) {
  const m = nodeWorldMatrix(g, byName, name, overrides);
  // 열우선 4×4 에서 회전부 추출 → 행 우선 3×3 (스케일 없음 가정)
  return [
    [m[0], m[4], m[8]],
    [m[1], m[5], m[9]],
    [m[2], m[6], m[10]],
  ];
}

/** 노드 world 원점(m) — overrides = { 노드명: [x,y,z]deg } */
function nodeWorldOrigin(g, byName, name, overrides) {
  const m = nodeWorldMatrix(g, byName, name, overrides);
  return [m[12], m[13], m[14]];
}

/** 노드 world 4×4(열우선) */
function nodeWorldMatrix(g, byName, name, overrides) {
  const parent = new Map();
  g.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const chain = [];
  let i = byName.get(name);
  while (i !== undefined) {
    chain.unshift(i);
    i = parent.get(i);
  }
  let m = m4ident();
  for (const idx of chain) {
    const n = g.nodes[idx];
    m = m4mul(m, n.matrix ? n.matrix : m4fromTRS(n.translation, n.rotation, n.scale));
    const ov = overrides[n.name];
    if (ov) m = m4mul(m, m4fromEuler(ov));
  }
  return m;
}

/** 메시 정점(로컬, m)을 읽는다 — 발바닥 판정용 */
function readMeshVerts(p, meshIdx) {
  const buf = fs.readFileSync(p);
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString("utf8").replace(/\0+$/, ""));
    else if (type === 0x004e4942) bin = buf.subarray(off + 8, off + 8 + len);
    off += 8 + len;
  }
  const a = json.accessors[json.meshes[meshIdx].primitives[0].attributes.POSITION];
  const bv = json.bufferViews[a.bufferView];
  const st = bv.byteStride ?? 12;
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = [];
  for (let i = 0; i < a.count; i++) {
    const o = base + i * st;
    out.push([bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)]);
  }
  return out;
}

function parseGlbJson(p) {
  const buf = fs.readFileSync(p);
  let off = 12;
  let json = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString("utf8").replace(/\0+$/, ""));
    off += 8 + len;
  }
  return json;
}

function main() {
  const glbPath = arg("glb", DEFAULT_GLB);
  const expectElbow = arg("expect-elbow", null);
  const verbose = process.argv.includes("--verbose");
  const fails = [];
  const note = (ok, id, msg) => {
    console.log(`  ${ok ? "✔" : "✘"} [${id}] ${msg}`);
    if (!ok) fails.push(id);
  };
  console.log(`=== verify-rider-pose-gate ===\n  GLB: ${glbPath}\n`);

  // ── 1·2·3 다리 · 4 팔 (앱 IK) ───────────────────────────────────────────
  let worstRound = 0;
  let worstKneeOut = -Infinity;
  let worstLegReach = 0;
  const kneeRows = [];
  for (const phase of PHASES) {
    const crankRad = -phase * Math.PI * 2;
    for (const side of ["l", "r"]) {
      const hip = hipOf(side);
      const target = ankleTargetWorld(side, crankRad);
      const s = solveIk3D(hip, target, kneePole(side, hip), THIGH_LEN, SHIN_LEN);
      const Rp = mapboxRotation(restToDirRotationDeg(s.boneADir));
      worstRound = Math.max(worstRound, dist(applyM(Rp, REST), s.boneADir));
      const Rc = mul(Rp, mapboxRotation(childRotationDeg(s.boneADir, s.boneBDir)));
      worstRound = Math.max(worstRound, dist(applyM(Rc, REST), s.boneBDir));
      // 무릎 z: 좌(+z)는 hip 보다 작아야, 우(−z)는 hip 보다 커야 안쪽
      const kz = mm(s.joint[2]);
      const hz = mm(hip[2]);
      const outward = side === "l" ? kz - hz : hz - kz; // 양수면 바깥
      worstKneeOut = Math.max(worstKneeOut, outward);
      kneeRows.push({ phase, side, kz, hz, outward });
      worstLegReach = Math.max(worstLegReach, dist(hip, target) * 1000);
    }
  }
  let worstArmReach = 0;
  let elbowDeg = null;
  for (const side of ["l", "r"]) {
    const sh = shoulderOf(side);
    const hood = hoodOf(side);
    const s = solveIk3D(sh, hood, elbowPole(side, sh), UPPER_ARM_LEN, FOREARM_LEN);
    const Rp = mapboxRotation(restToDirRotationDeg(s.boneADir));
    worstRound = Math.max(worstRound, dist(applyM(Rp, REST), s.boneADir));
    const Rc = mul(Rp, mapboxRotation(childRotationDeg(s.boneADir, s.boneBDir)));
    worstRound = Math.max(worstRound, dist(applyM(Rc, REST), s.boneBDir));
    worstArmReach = Math.max(worstArmReach, dist(sh, hood) * 1000);
    elbowDeg = 180 - s.jointDeg;
  }

  note(worstRound < TOL, "1 회전각왕복", `최대 오차 ${worstRound.toExponential(2)} < ${TOL}`);

  if (verbose) {
    console.log("      무릎 z (mm) — 양수 outward = 고관절보다 바깥");
    for (const r of kneeRows)
      console.log(`        phase ${String(r.phase).padEnd(5)} ${r.side}  knee.z ${String(r.kz).padStart(7)}  hip.z ${String(r.hz).padStart(6)}  outward ${r.outward.toFixed(1).padStart(7)}`);
  }
  note(worstKneeOut < 0, "2 무릎안쪽", `최악 outward ${worstKneeOut.toFixed(1)}mm (음수여야 안쪽)`);

  const legMax = mm(THIGH_LEN) + mm(SHIN_LEN);
  note(worstLegReach <= legMax, "3 다리도달", `최대 hip→발목 ${worstLegReach.toFixed(1)}mm ≤ ${legMax.toFixed(1)}mm (여유 ${(legMax - worstLegReach).toFixed(1)})`);

  const armMax = mm(UPPER_ARM_LEN) + mm(FOREARM_LEN);
  let armMsg = `어깨→후드 ${worstArmReach.toFixed(1)}mm ≤ ${armMax.toFixed(1)}mm · 팔꿈치 내각 ${elbowDeg.toFixed(1)}°`;
  let armOk = worstArmReach <= armMax;
  if (expectElbow !== null) {
    const d = Math.abs(elbowDeg - Number(expectElbow));
    armMsg += ` (기대 ${expectElbow}°, 차 ${d.toFixed(1)}°)`;
    armOk = armOk && d < 1.0;
  }
  note(armOk, "4 팔도달", armMsg);

  // ── 5·6·7 GLB ───────────────────────────────────────────────────────────
  const g = parseGlbJson(glbPath);
  const byName = new Map();
  g.nodes.forEach((n, i) => n.name && byName.set(n.name, i));

  const anchorPairs = [
    ["leg_l", hipOf("l")],
    ["leg_r", hipOf("r")],
    ["arm_l", shoulderOf("l")],
    ["arm_r", shoulderOf("r")],
  ];
  let worstAnchor = 0;
  const anchorLines = [];
  for (const [name, want] of anchorPairs) {
    const i = byName.get(name);
    const t = (g.nodes[i]?.translation ?? [0, 0, 0]).map(mm);
    const w = want.map(mm);
    const d = Math.hypot(t[0] - w[0], t[1] - w[1], t[2] - w[2]);
    worstAnchor = Math.max(worstAnchor, d);
    anchorLines.push(`        ${name.padEnd(7)} GLB [${t.join(", ")}]  riderRig [${w.join(", ")}]  차 ${d.toFixed(2)}mm`);
  }
  if (verbose) anchorLines.forEach((l) => console.log(l));
  note(worstAnchor < 0.05, "5 앵커일치", `최대 차 ${worstAnchor.toFixed(3)}mm (GLB 노드 ↔ riderRig)`);

  const withRest = RIDER_NODES.filter((n) => {
    const nd = g.nodes[byName.get(n)];
    return !nd || nd.rotation || nd.scale || nd.matrix;
  });
  note(withRest.length === 0, "6 노드rest", withRest.length ? `rest 가 남은 노드: ${withRest.join(", ")}` : "라이더 9노드 전부 순수 translation");

  // ⚠ **본체와 캡을 분리해 센다**(F25). 관절 캡(`joint_cap_*`)이 붙으면 총합은 늘지만
  //   **본체 5,521 은 그대로여야 한다** — 캡 추가가 본체 메시를 건드리지 않았다는 증거다.
  const paletteMats = new Set();
  (g.materials ?? []).forEach((m, i) => {
    if (m.pbrMetallicRoughness?.baseColorTexture) paletteMats.add(i);
  });
  let bodyVerts = 0;
  let capVerts = 0;
  (g.meshes ?? []).forEach((m) =>
    m.primitives.forEach((p) => {
      if (!paletteMats.has(p.material)) return;
      const n = g.accessors[p.attributes.POSITION].count;
      if (m.name?.startsWith("joint_cap_")) capVerts += n;
      else bodyVerts += n;
    }),
  );
  note(
    bodyVerts === EXPECT_BODY_VERTS,
    "7 정점수",
    `본체 ${bodyVerts} (기대 ${EXPECT_BODY_VERTS}) + 캡 ${capVerts} = ${bodyVerts + capVerts}`,
  );

  // ── 8·9 발–페달 접지 (F26) ───────────────────────────────────────────────
  // ⚠ `pose.mjs` 의 값을 **import 해서** 판정한다. 재현하면 거짓 PASS 가 난다(F23 §1-1).
  //   world 회전 = R_leg · R_shin · R_ankle (라이더 노드는 rest 가 없어 순수 translation).
  const soleRows = [];
  let worstTiltDeg = 0;
  let worstGapMm = 0;
  const ankleMesh = {};
  for (const side of ["l", "r"]) {
    const ni = byName.get(`ankle_${side}`);
    if (ni !== undefined && g.nodes[ni].mesh !== undefined) {
      ankleMesh[side] = readMeshVerts(glbPath, g.nodes[ni].mesh);
    }
  }
  if (ankleMesh.l && ankleMesh.r) {
    for (const phase of PHASES) {
      for (const side of ["l", "r"]) {
        const p = resolveGlbPedalPose(phase);
        const legE = side === "l" ? p.legLRotationDeg : p.legRRotationDeg;
        const shinE = side === "l" ? p.legLShinRotationDeg : p.legRShinRotationDeg;
        const ankE = side === "l" ? p.ankleLRotationDeg : p.ankleRRotationDeg;
        const R = mat3Mul(
          mat3Mul(mapboxEulerDegToMat3(legE), mapboxEulerDegToMat3(shinE)),
          mapboxEulerDegToMat3(ankE),
        );
        // 발바닥 법선 — 발 로컬 −Y 를 world 로 보내 수직에서 벗어난 각을 잰다
        const nWorld = applyM(R, SOLE_N[side]);
        const tilt = (Math.acos(Math.max(-1, Math.min(1, -nWorld[1]))) * 180) / Math.PI;
        worstTiltDeg = Math.max(worstTiltDeg, tilt);
        // ⚠ **밑창 평면**을 잰다 — 메시 최저점이 아니다(F33).
        //   `ANKLE_UP = S + 10` 의 S 는 **밑창 평면**까지 거리(19.69mm)인데, 예전 게이트는
        //   **메시 최저점**(뒤꿈치·트레드 돌기, 23.2mm)을 재서 **정의가 다른 두 값을
        //   비교**했다. 그 3.5mm 차이는 오차가 아니라 정의 불일치였고, 가장 가까운
        //   카메라(1.0m)에서도 약 1픽셀이라 화면에 보이지 않는다. 반대로 최저점 기준으로
        //   `ANKLE_UP` 을 33.2 로 잡으면 **발바닥 면이 눈에 띄게 뜬다.**
        //   → 판정 대상을 `ANKLE_UP` 정의와 **일치**시킨다. 완화가 아니다.
        const target = ankleTargetWorld(side, -phase * Math.PI * 2);
        const lowest = target[1] + applyM(R, [0, -SOLE_PLANE_M, 0])[1];
        const pedalTopY = target[1] - ANKLE_UP + 0.01; // 페달축(발목 아래 ANKLE_UP) + 플랫폼 반두께
        // ⚠ ANKLE_UP 을 하드코딩하지 마라 — F32 에서 37.0→29.69 로 바뀌었는데 게이트가
        //   옛 값을 써서 gap 을 3.5mm 과대평가했다. SSoT 를 import 한다.
        const gap = (lowest - pedalTopY) * 1000;
        worstGapMm = Math.max(worstGapMm, Math.abs(gap));
        soleRows.push({ phase, side, tilt, gap });
      }
    }
    if (verbose) {
      console.log("      발바닥 (기울기 = 월드 수직에서 벗어난 각 · gap = 밑창 − 페달면)");
      for (const r of soleRows)
        console.log(
          `        phase ${String(r.phase).padEnd(5)} ${r.side}  기울기 ${r.tilt.toFixed(2).padStart(6)}°   gap ${r.gap.toFixed(1).padStart(7)}mm`,
        );
    }
    note(worstTiltDeg <= 2, "8 발바닥법선", `최악 기울기 ${worstTiltDeg.toFixed(2)}° ≤ 2°`);
    note(worstGapMm <= 3, "9 발접지", `최악 |밑창−페달면| ${worstGapMm.toFixed(1)}mm ≤ 3mm`);
  } else {
    note(false, "8·9 발접지", "ankle_l/ankle_r 노드 또는 메시가 없다");
  }

  // ── 10 페달 정합 (F27) ───────────────────────────────────────────────────
  // **렌더되는 페달**(GLB 노드 계층을 실제로 합성)과 **IK 가 겨냥하는 페달**(`pedalWorld`)을
  // 대조한다. 이 둘을 아무도 맞춰보지 않아 F18 이후 아홉 단계가 90° 어긋난 채 통과했다.
  // ⚠ `pedalWorld` 를 재현하지 마라 — import 한 값과 GLB 실물을 비교한다.
  let worstPedalMm = 0;
  const pedalRows = [];
  if (byName.has("pedal_l") && byName.has("pedal_r") && byName.has("crank")) {
    for (const phase of PHASES) {
      const p = resolveGlbPedalPose(phase);
      const ov = {
        crank: [0, 0, p.crankRotationDeg],
        pedal_l: p.pedalLRotationDeg,
        pedal_r: p.pedalRRotationDeg,
      };
      for (const side of ["l", "r"]) {
        const got = nodeWorldOrigin(g, byName, `pedal_${side}`, ov).map((v) => v * 1000);
        const want = pedalWorld(side, -phase * Math.PI * 2).map((v) => v * 1000);
        const d = Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]);
        worstPedalMm = Math.max(worstPedalMm, d);
        pedalRows.push({ phase, side, got, want, d });
      }
    }
    if (verbose) {
      console.log("      페달 world (GLB 노드 합성) vs pedalWorld()");
      for (const r of pedalRows)
        console.log(
          `        phase ${String(r.phase).padEnd(5)} ${r.side}  GLB [${r.got.map((v) => v.toFixed(1)).join(", ")}]  앱 [${r.want.map((v) => v.toFixed(1)).join(", ")}]  차 ${r.d.toFixed(2)}mm`,
        );
    }
    note(worstPedalMm <= 1, "10 페달정합", `최악 차 ${worstPedalMm.toFixed(2)}mm ≤ 1mm`);
  } else {
    note(false, "10 페달정합", "pedal_l/pedal_r/crank 노드가 없다");
  }

  // ── 11 페달 판 자세 (F29) ────────────────────────────────────────────────
  // ⚠ 게이트 10 은 **위치만** 봤다. 그래서 판이 다섯 단계 동안 수직으로 서 있었다.
  //   위치를 재는 게이트를 만들 때는 **자세도 함께 재라** — 그 교훈이 이 항목이다.
  //   판 로컬 법선은 실측값(0,1,0): 메시 70×20×50 에서 얇은 축 y, 최대 면적 면 3500mm².
  let worstPedalTilt = 0;
  if (byName.has("pedal_l") && byName.has("crank")) {
    for (const phase of PHASES) {
      const p = resolveGlbPedalPose(phase);
      const ov = {
        crank: [0, 0, p.crankRotationDeg],
        pedal_l: p.pedalLRotationDeg,
        pedal_r: p.pedalRRotationDeg,
      };
      for (const side of ["l", "r"]) {
        const R = nodeWorldRot(g, byName, `pedal_${side}`, ov);
        const n = applyM(R, [0, 1, 0]);
        const tilt = (Math.acos(Math.max(-1, Math.min(1, n[1]))) * 180) / Math.PI;
        worstPedalTilt = Math.max(worstPedalTilt, tilt);
      }
    }
    note(worstPedalTilt <= 2, "11 페달판자세", `최악 법선 기울기 ${worstPedalTilt.toFixed(2)}° ≤ 2°`);
  } else {
    note(false, "11 페달판자세", "pedal_*/crank 노드가 없다");
  }

  // ── 12 발끝 앙각 궤적 좌우 거울 대칭 (F33) ────────────────────────────────
  // ⚠ 감리도 개발팀장도 "좌우는 대칭일 것"이라고 **가정**했다가 사용자 지적을 세 번
  //   흘려보냈다. 분해가 한 위상(좌 BDC·우 TDC)에서 이뤄지면 두 발이 다른 각도로
  //   구워진다 — 실측 없이는 알 수 없다. 8위상 궤적을 직접 비교한다.
  //   왼발(phase p) 의 발끝 앙각 == 오른발(phase p+0.5) 의 앙각.
  let worstMirrorDeg = 0;
  const mirrorRows = [];
  if (ankleMesh.l && ankleMesh.r) {
    // 발끝 축 = 발 정점의 뒤꿈치(최소 x) → 발끝(최대 x) — **실측**한다
    const toeAxis = {};
    for (const side of ["l", "r"]) {
      const vs = ankleMesh[side];
      let lo = vs[0];
      let hi = vs[0];
      for (const v of vs) {
        if (v[0] < lo[0]) lo = v;
        if (v[0] > hi[0]) hi = v;
      }
      toeAxis[side] = {
        v: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
        lenMm: (hi[0] - lo[0]) * 1000,
        n: vs.length,
      };
    }
    const elev = (side, phase) => {
      const p = resolveGlbPedalPose(phase);
      const legE = side === "l" ? p.legLRotationDeg : p.legRRotationDeg;
      const shinE = side === "l" ? p.legLShinRotationDeg : p.legRShinRotationDeg;
      const ankE = side === "l" ? p.ankleLRotationDeg : p.ankleRRotationDeg;
      const R = mat3Mul(mat3Mul(mapboxEulerDegToMat3(legE), mapboxEulerDegToMat3(shinE)), mapboxEulerDegToMat3(ankE));
      const w = applyM(R, toeAxis[side].v);
      const L = Math.hypot(w[0], w[1], w[2]) || 1;
      return (Math.asin(Math.max(-1, Math.min(1, w[1] / L))) * 180) / Math.PI;
    };
    for (let k = 0; k < 8; k++) {
      const ph = k / 8;
      const el = elev("l", ph);
      const er = elev("r", (ph + 0.5) % 1);
      const d = Math.abs(el - er);
      worstMirrorDeg = Math.max(worstMirrorDeg, d);
      mirrorRows.push({ ph, el, er, d });
    }
    if (verbose) {
      console.log(
        `      발끝 축 실측  좌 ${toeAxis.l.lenMm.toFixed(0)}mm(${toeAxis.l.n}정점) · 우 ${toeAxis.r.lenMm.toFixed(0)}mm(${toeAxis.r.n}정점)`,
      );
      for (const r of mirrorRows)
        console.log(
          `        phase ${r.ph.toFixed(3)}  좌 ${r.el.toFixed(1).padStart(7)}°  우(p+0.5) ${r.er.toFixed(1).padStart(7)}°  차 ${r.d.toFixed(2)}°`,
        );
    }
    note(worstMirrorDeg <= 2, "12 좌우거울대칭", `발끝 앙각 최악 편차 ${worstMirrorDeg.toFixed(2)}° ≤ 2°`);
  } else {
    note(false, "12 좌우거울대칭", "ankle_l/ankle_r 메시가 없다");
  }

  console.log(`\n  ${12 - fails.length}/12 통과`);
  if (fails.length) {
    console.error(`\n✘ FAIL — [${fails.join("] [")}]  앱에 올리지 말고 보고하라.`);
    process.exit(1);
  }
  console.log("✔ PASS — 앱 확인으로 진행해도 된다 (그림 판정은 별개다).");
}

main();

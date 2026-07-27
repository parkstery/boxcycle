/**
 * Rider Candidate Builder — **연속형 사람 메시**(로프트 기반)의 자전거 없는 라이더 단독 후보.
 *
 * ⚠ 형상 원칙 (사용자 지시 2026-07-25): taperTube + blob 조립 폐기. 흉곽–쇄골–어깨,
 *   골반–고관절을 **연속 메시**로, 팔다리를 **다단 프로파일 인체 볼륨**으로 만든다.
 *   기법: 다단 단면 링(타원)을 축 경로를 따라 배치하고 index 삼각형으로 이어 매끄러운 표면 생성
 *   (구체 관절이 실루엣에 튀지 않음). 저폴리 유지하되 실루엣은 사람.
 *
 * ⚠ 인체 치수는 riderAnthropometry.json(고정 기준). 자전거 접촉점에서 역산하지 않는다.
 * ⚠ 제품 GLB 게이트: 후보 GLB 는 .out/candidates/<candidateId>/ 에만. 제품 파일 미변경.
 *
 * 좌표계: m, 지면 y=0, +x 전진, +y 위, +z 왼쪽. 중립 서있는 자세.
 * 실행: node scripts/build-rider-candidate.mjs
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {
  newCandidate,
  candidateFile,
  writeCandidateMeta,
  WEB_ROOT,
} from "./rider-preview/riderCandidate.mjs";
import {
  RIDER_BODY as B,
  GIRTH as R,
  UPPER_ARM_LEN,
  FOREARM_LEN,
  HAND_LEN,
  THIGH_LEN,
  SHANK_LEN,
  FOOT_LEN,
  FOOT_HEIGHT,
  NECK_LEN,
  HEAD_HEIGHT,
} from "../src/lib/riderPrototype/riderBody.mjs";

globalThis.window = globalThis;
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    const finish = (buf) => { this.result = buf; this.onloadend?.({ target: this }); this.onload?.({ target: this }); };
    if (blob instanceof ArrayBuffer) return void queueMicrotask(() => finish(blob));
    if (ArrayBuffer.isView(blob)) return void queueMicrotask(() => finish(blob.buffer));
    if (typeof blob?.arrayBuffer === "function") return void blob.arrayBuffer().then(finish);
    this.onerror?.(new Error("unsupported blob"));
  }
};

const COL = {
  jersey: 0x2563eb, jerseyDark: 0x1d4ed8,
  short: 0x1e293b, skin: 0xe8b98f, shoe: 0x111114,
};

const _matCache = new Map();
function mat(color, opts = {}) {
  const rough = opts.roughness ?? 0.82, metal = opts.metalness ?? 0;
  const key = `${color}|${rough}|${metal}`;
  let m = _matCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: false }); _matCache.set(key, m); }
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOFT — 다단 단면 링을 축 경로를 따라 이어 연속 표면. 인체 볼륨의 핵심.
//   sections: [{ center:[x,y,z], rx, rz, up?, [rot] }] — 각 링의 중심·좌우반경(rx)·앞뒤반경(rz).
//   축 방향은 인접 center 로 자동 계산. 링은 그 축에 수직한 평면의 타원.
//   ⚠ Mapbox model 레이어는 indices+UV 필요 → non-indexed 금지(정점격자+인덱스 삼각형).
// ═══════════════════════════════════════════════════════════════════════════
const RING_SEG = 14; // 링 둘레 분할(저폴리)
function loft(sections, color, opts = {}) {
  const n = sections.length;
  const cols = RING_SEG;
  const pos = [], uv = [], idx = [];

  // 각 섹션의 로컬 프레임(축 tangent + 좌우/앞뒤 basis) 계산.
  const centers = sections.map((s) => new THREE.Vector3(...s.center));
  for (let i = 0; i < n; i++) {
    // tangent = 인접 center 방향(끝은 한쪽만)
    const prev = centers[Math.max(0, i - 1)], next = centers[Math.min(n - 1, i + 1)];
    const tan = next.clone().sub(prev).normalize();
    // 좌우축(zAxis) = tangent 와 월드 up 의 외적을 기준으로. up 이 tangent 와 평행하면 x 로 폴백.
    const worldUp = Math.abs(tan.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(tan, worldUp).normalize(); // 좌우(z 성분 위주)
    const front = new THREE.Vector3().crossVectors(side, tan).normalize();    // 앞뒤
    const s = sections[i];
    for (let j = 0; j < cols; j++) {
      const a = (Math.PI * 2 * j) / cols;
      // 타원: side*rx*cos + front*rz*sin
      const p = centers[i].clone()
        .addScaledVector(side, Math.cos(a) * s.rx)
        .addScaledVector(front, Math.sin(a) * s.rz);
      pos.push(p.x, p.y, p.z);
      uv.push(i / (n - 1), j / cols);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * cols + j, b = i * cols + ((j + 1) % cols);
      const c = (i + 1) * cols + j, d = (i + 1) * cols + ((j + 1) % cols);
      idx.push(a, c, b, b, c, d);
    }
  }
  // 끝 캡(구멍 막기) — 첫·마지막 링 중심점으로 팬.
  const capStart = opts.capStart !== false, capEnd = opts.capEnd !== false;
  if (capStart) {
    const ci = pos.length / 3; pos.push(centers[0].x, centers[0].y, centers[0].z); uv.push(0, 0);
    for (let j = 0; j < cols; j++) idx.push(ci, (j + 1) % cols, j);
  }
  if (capEnd) {
    const ci = pos.length / 3; const c = centers[n - 1]; pos.push(c.x, c.y, c.z); uv.push(1, 1);
    const base = (n - 1) * cols;
    for (let j = 0; j < cols; j++) idx.push(ci, base + j, base + ((j + 1) % cols));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(color, opts));
}

/** 축(from→to) 위에 t(0~1)로 보간한 점 */
function lerp3(from, to, t) {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
}

/**
 * loftAxis — 각 섹션의 링 평면을 명시 축(ax: "y"|"z")에 수직하게 배치하는 로프트.
 *   ax="y": 링이 XZ 평면(수평, 팔·다리 단면). rx=좌우(x), rz=전후(z)... 가 아니라
 *           팔은 세로로 내려가므로 ax="y" → 링은 XZ 평면. rx→x, rz→z.
 *   ax="z": 링이 XY 평면(정면, 흉곽 옆면처럼 z축 방향으로 붙는 판). rx→y(상하), rz→x(전후).
 * 브릿지처럼 축이 z(흉곽옆)→y(팔)로 꺾일 때 링 뒤틀림을 막는다. index+uv 로 연속 표면.
 */
function loftAxis(sections, color, opts = {}) {
  const n = sections.length, cols = RING_SEG;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const s = sections[i];
    const c = new THREE.Vector3(...s.center);
    // 링 basis: ax 축에 수직한 두 방향.
    let u, v;
    if (s.ax === "z") { u = new THREE.Vector3(0, 1, 0); v = new THREE.Vector3(1, 0, 0); } // XY평면(상하·전후)
    else { u = new THREE.Vector3(1, 0, 0); v = new THREE.Vector3(0, 0, 1); }              // XZ평면(좌우·전후)
    for (let j = 0; j < cols; j++) {
      const a = (Math.PI * 2 * j) / cols;
      const p = c.clone().addScaledVector(u, Math.cos(a) * s.rx).addScaledVector(v, Math.sin(a) * s.rz);
      pos.push(p.x, p.y, p.z);
      uv.push(i / (n - 1), j / cols);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * cols + j, b = i * cols + ((j + 1) % cols);
      const cc = (i + 1) * cols + j, d = (i + 1) * cols + ((j + 1) % cols);
      idx.push(a, cc, b, b, cc, d);
    }
  }
  if (opts.capStart !== false) {
    const ci = pos.length / 3, c0 = sections[0].center; pos.push(...c0); uv.push(0, 0);
    for (let j = 0; j < cols; j++) idx.push(ci, (j + 1) % cols, j);
  }
  if (opts.capEnd !== false) {
    const ci = pos.length / 3, cN = sections[n - 1].center; pos.push(...cN); uv.push(1, 1);
    const base = (n - 1) * cols;
    for (let j = 0; j < cols; j++) idx.push(ci, base + j, base + ((j + 1) % cols));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(color, opts));
}

const COL_GLOVE = 0x18181c; // 사이클 장갑 — 짙은 회색/검정

/**
 * 사이클 장갑 손 — **하나의 축을 이루는 저폴리 테이퍼 로프트**(복싱 글러브 금지: 구체 쌓기 안 함).
 *   손목커프(굵음) → 납작 손바닥(폭 8~9cm) → 좁아지는 손가락 덩어리(손끝). 엄지는 작은 별도 돌출.
 *   전체 길이 ≤ HAND_LEN(18cm). 살색 기존 손 메시 없음(전완은 손목까지만, 손은 이 장갑이 전담).
 * @param side 'l'|'r' — 엄지 방향(안쪽). @param fL 전완 길이(손목 위치 y=-fL).
 */
function buildGloveHand(side, fL) {
  const g = new THREE.Group();
  g.name = `glove_${side}`;
  const wY = -fL;                     // 손목
  const palmHalf = 0.043;             // 손바닥 반폭 (폭 8.6cm)
  const palmDepth = 0.017;            // 손바닥 앞뒤 반두께(납작)
  // 하나의 축(손목→손끝, -Y) 로프트. rx=좌우(손바닥 폭), rz=앞뒤(납작).
  const hand = [
    { center: [0, wY + 0.010, 0], rx: R.wrist * 1.12, rz: R.wrist * 1.12 },        // 커프 상단
    { center: [0, wY - 0.010, 0], rx: R.wrist * 1.3, rz: R.wrist * 1.22 },         // 커프(가장 굵음)
    { center: [0.004, wY - 0.030, 0], rx: palmHalf * 0.88, rz: palmDepth * 1.1 },  // 손등/손목아래
    { center: [0.006, wY - HAND_LEN * 0.42, 0], rx: palmHalf, rz: palmDepth },     // 손바닥(가장 넓음, 납작)
    { center: [0.004, wY - HAND_LEN * 0.66, 0], rx: palmHalf * 0.9, rz: palmDepth * 0.95 }, // 손가락 시작
    { center: [0, wY - HAND_LEN * 0.9, 0], rx: palmHalf * 0.66, rz: palmDepth * 0.8 },     // 손가락 중간(좁아짐)
    { center: [-0.004, wY - HAND_LEN, 0], rx: palmHalf * 0.34, rz: palmDepth * 0.6 },      // 손끝(둥글게 마감)
  ];
  g.add(loft(hand, COL_GLOVE, { capStart: false, capEnd: true }));
  // 엄지 — 작은 별도 돌출. 손 안쪽(thumbZ), 손바닥 상부 옆. 짧은 테이퍼 로프트.
  const thumbZ = (side === "l" ? -1 : +1) * palmHalf * 0.85;
  const thumb = [
    { center: [0.004, wY - HAND_LEN * 0.34, thumbZ * 0.5], rx: 0.014, rz: 0.013 },
    { center: [0.008, wY - HAND_LEN * 0.28, thumbZ * 0.9], rx: 0.012, rz: 0.011 },
    { center: [0.012, wY - HAND_LEN * 0.2, thumbZ], rx: 0.008, rz: 0.008 },        // 엄지 끝
  ];
  g.add(loft(thumb, COL_GLOVE, { capStart: false, capEnd: true }));
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// buildRiderScene — 프리뷰·제품 GLB 공유 빌더. 연속형 사람 메시, 자전거 없음.
// ═══════════════════════════════════════════════════════════════════════════
export function buildRiderScene({ includeBike = false } = {}) {
  void includeBike;
  const root = new THREE.Group();
  root.name = "RiderBody";

  const gth = B.groundToHip;  // 고관절선 y
  const shY = B.shoulderY;    // 견봉선 y
  const tLen = shY - gth;

  // ── TORSO — 골반–복부–흉곽–어깨를 하나의 연속 로프트. 앞뒤(rz) 납작. ──
  // 각 링: [t(0=골반,1=어깨), rx(좌우반경), rz(앞뒤반경)]. 어깨선에서 좌우로 넓어짐.
  const torso = new THREE.Group();
  torso.name = "torso";
  const halfZ = B.CHEST_HALF_Z, chestX = B.CHEST_HALF_X, pelvisZ = B.PELVIS_HALF_Z, pelvisX = B.PELVIS_HALF_X;
  // 몸통 세로 로프트가 **어깨폭까지 포함**한다(별도 어깨 요크 없음 — 소매 뽕의 근본 원인 제거).
  // 상단을 어깨선(SHOULDER_HALF_Z)까지 좌우로 넓히되, 위로 솟지 않게 마지막 링을 살짝 낮춰 둥글게.
  const shZhalf = B.SHOULDER_HALF_Z;
  const torsoRings = [
    [-0.06, pelvisZ * 0.86, pelvisX * 0.82], // 골반 아래(빕숏 하단)
    [0.02, pelvisZ * 1.02, pelvisX * 0.95],  // 골반(넓음)
    [0.16, pelvisZ * 0.92, pelvisX * 0.86],  // 골반 상단
    [0.34, halfZ * 0.78, chestX * 0.82],     // 허리(잘록)
    [0.52, halfZ * 0.9, chestX * 0.92],      // 명치
    [0.70, halfZ * 1.02, chestX * 1.0],      // 흉곽(넓고 깊음)
    [0.84, shZhalf * 0.82, chestX * 0.9],    // 흉곽 상부(어깨쪽으로 넓어지기 시작)
    [0.94, shZhalf * 1.0, chestX * 0.82],    // 어깨선(좌우 최대 = 어깨너비, 앞뒤 유지)
    [1.0, shZhalf * 0.88, chestX * 0.68],    // 어깨 마감(견봉 위 — 살짝 좁혀 둥글게, 뿔 방지)
  ].map(([t, rx, rz]) => ({ center: [0, gth + t * tLen, 0], rx, rz }));
  torso.add(loft(torsoRings, COL.jersey, { capEnd: false }));
  root.add(torso);

  // ── NECK — 승모근에서 목으로. 어깨쪽 넓고 머리쪽 좁은 짧은 로프트. 하단이 몸통에 묻힘. ──
  const neckRings = [
    { center: [0, shY - 0.02, 0], rx: R.neckBot * 1.15, rz: R.neckBot * 1.1 },   // 승모근(묻힘)
    { center: [0.005, shY + NECK_LEN * 0.4, 0], rx: R.neckBot * 0.82, rz: R.neckBot * 0.82 },
    { center: [0.01, shY + NECK_LEN * 0.75, 0], rx: R.neckTop, rz: R.neckTop }, // 목 상단
  ];
  root.add(loft(neckRings, COL.skin, { capStart: false, capEnd: false }));

  // ── HEAD — 달걀형(턱 아래 좁고 정수리 넓음). 로프트 링. ──
  const headBotY = shY + NECK_LEN * 0.7;
  const headRings = [
    { center: [0.01, headBotY, 0], rx: R.headR * 0.55, rz: R.headR * 0.6 },        // 턱
    { center: [0.005, headBotY + HEAD_HEIGHT * 0.28, 0], rx: R.headR * 0.86, rz: R.headR * 0.95 }, // 광대
    { center: [0, headBotY + HEAD_HEIGHT * 0.6, 0], rx: R.headR, rz: R.headR },     // 관자
    { center: [-0.005, headBotY + HEAD_HEIGHT * 0.9, 0], rx: R.headR * 0.78, rz: R.headR * 0.82 }, // 정수리
  ];
  const head = new THREE.Group(); head.name = "head";
  head.add(loft(headRings, COL.skin, { capStart: false }));
  root.add(head);

  // ── B안: 통합 상체 — 어깨·쇄골·삼각근·겨드랑이를 하나의 연속 표면으로. ──
  //   핵심: 어깨→상완을 잇는 **숄더 브릿지 로프트**가 흉곽 옆면(큰 타원, 몸통에 붙음)에서 시작해
  //   삼각근→상완(팔 단면)으로 **월드공간 곡선 축**을 따라 테이퍼한다. 첫 링이 몸통 옆에 넓게
  //   붙으므로 겨드랑이가 채워지고 절단면·틈·뿔이 없다. 이 브릿지는 torso 그룹에 넣어 몸통과
  //   한 덩어리로 읽힌다. IK 팔 노드(arm_*)는 상완 끝에서 시작(외형은 이미 브릿지가 담당).
  const shYw = shY, gthw = gth;
  for (const side of ["l", "r"]) {
    const sign = side === "l" ? +1 : -1;
    const zc = sign * B.SHOULDER_HALF_Z;         // 어깨 z
    const upperColor = side === "l" ? COL.jersey : COL.jerseyDark;
    const uL = UPPER_ARM_LEN, fL = FOREARM_LEN;
    const shoulderPt = side === "l" ? B.SHOULDER_L : B.SHOULDER_R;

    // 숄더 브릿지 — 겨드랑이(흉곽옆)→삼각근 최대부→삼각근 하단→소매끝으로 **단면을 점진 축소**.
    // 어깨 위로 솟지 않고(지느러미 방지), 소매끝 실루엣에 턱이 없도록 촘촘한 중간 링을 둔다.
    // 소매끝 링(sleeveEndY·반경 sleeveEndR)을 상완 하부 로프트가 **동일 값으로** 이어받아 단차 제거.
    const chestSideY = shYw - R.chest * 0.6;
    const sleeveEndY = shYw - uL * 0.5;              // 소매 끝(상완 절반 지점)
    const sleeveEndR = R.upperArmTop * 0.98;         // 소매 끝 반경(맨살과 공유)
    const bridge = [
      // 흉곽 옆면(몸통에 붙는 큰 세로 타원) — 겨드랑이 앞뒤 덮음. z 를 몸통에 더 붙여 flare 방지.
      { center: [0, chestSideY, sign * (B.CHEST_HALF_Z * 0.62)], rx: R.chest * 0.66, rz: chestX * 0.92, ax: "z" },
      // 겨드랑이 안장(어깨 아래) — z 안쪽으로 당겨 소매가 어깨 밖으로 안 벌어지게
      { center: [0, shYw - R.shoulderDeltoid * 1.1, zc * 0.8], rx: R.shoulderDeltoid * 1.05, rz: R.shoulderDeltoid * 1.15, ax: "z" },
      // 삼각근 최대부 — z 를 어깨 위치보다 살짝 안쪽(flare 억제), 반경 축소
      { center: [shoulderPt[0], shYw - R.shoulderDeltoid * 1.6, zc * 0.92], rx: R.upperArmTop * 1.08, rz: R.upperArmTop * 1.1, ax: "y" },
      // 삼각근 하단
      { center: [shoulderPt[0], shYw - uL * 0.32, zc * 0.96], rx: R.upperArmTop * 1.02, rz: R.upperArmTop * 1.02, ax: "y" },
      // 소매 끝(맨살과 공유하는 경계 링 — 반경 일치로 실루엣 턱 제거)
      { center: [shoulderPt[0], sleeveEndY, zc * 0.98], rx: sleeveEndR, rz: sleeveEndR, ax: "y" },
    ];
    torso.add(loftAxis(bridge, upperColor, { capStart: false, capEnd: false }));

    // ── IK 팔 노드 — 소매끝(맨살 상완)에서 팔꿈치까지. 브릿지 소매끝 링과 동일 위치·반경으로 시작. ──
    const arm = new THREE.Group();
    arm.name = `arm_${side}`;
    arm.position.set(...shoulderPt);
    // 중립 자세: 팔을 바깥으로 살짝(6°) 벌려 손이 허벅지·팬츠와 안 겹치게. 소매끝(맨살·동일반경)
    // 경계는 색 없어 미세 어긋남이 실루엣에 안 드러남. RIDER_ONLY 프리뷰용.
    arm.rotation.z = sign * (6 * Math.PI) / 180;
    // 로컬 y: 소매끝(sleeveEndY - shYw) 에서 시작해 팔꿈치(-uL)까지. 반경 sleeveEndR → forearmTop 연속.
    const sleeveLocalY = sleeveEndY - shoulderPt[1]; // arm 로컬(어깨 원점) 기준 소매끝 y (음수)
    const midY = (sleeveLocalY + -uL) / 2;           // 소매끝~팔꿈치 중간
    const upperSkinRings = [
      { center: [0, sleeveLocalY, 0], rx: sleeveEndR, rz: sleeveEndR },              // 소매끝(브릿지와 동일 반경 — 턱 없음)
      { center: [0, midY, 0], rx: R.upperArmBot * 1.02, rz: R.upperArmBot * 1.0 },   // 상완 중간(연속 축소)
      { center: [0, -uL * 0.9, 0], rx: R.upperArmBot, rz: R.upperArmBot },
      { center: [0, -uL, 0], rx: R.forearmTop * 1.05, rz: R.forearmTop },            // 팔꿈치
    ];
    arm.add(loft(upperSkinRings, COL.skin, { capStart: false, capEnd: false }));
    // arm_fore 노드 — 팔꿈치 pivot(IK). 전완 로프트 + 장갑·손(fore 종속).
    const fore = new THREE.Group();
    fore.name = `arm_${side}_fore`;
    fore.position.set(0, -uL, 0);
    // 전완 — 팔꿈치→손목(맨살). 손목에서 장갑 커프로 이어짐.
    const foreRings = [
      { center: [0, 0, 0], rx: R.forearmTop * 1.05, rz: R.forearmTop },
      { center: [0, -fL * 0.3, 0], rx: R.forearmTop, rz: R.forearmTop },
      { center: [0, -fL * 0.75, 0], rx: R.forearmBot, rz: R.forearmBot },
      { center: [0, -fL, 0], rx: R.wrist, rz: R.wrist * 1.05 },                      // 손목
    ];
    fore.add(loft(foreRings, COL.skin, { capStart: false, capEnd: false }));
    // ── 사이클 장갑 + 손 — fore 종속(손 IK 접촉점은 [0,-fL,0] 유지, 장갑이 그 위에 얹힘). ──
    fore.add(buildGloveHand(side, fL));
    arm.add(fore);
    root.add(arm);
  }

  // ── 빕숏 — 허리·골반·둔부를 감싸는 몸통 + 좌우 바지통이 **가랑이에서 겹쳐** 하나로 읽힘. ──
  //   찢어짐 방지: 바지통 첫 링을 골반 몸통 안(위·안쪽)에서 시작해 팬츠 몸통과 크게 겹친다.
  //   (어깨 브릿지와 같은 원리 — 두 로프트를 한 점이 아니라 넓게 겹쳐 위상 틈 제거.)
  {
    const waistY = gth + tLen * 0.08;   // 저지 아래 허리
    const crotchY = gth - B.PELVIS_HALF_Z * 0.7; // 가랑이
    const pants = new THREE.Group(); pants.name = "bibShorts";
    // 팬츠 몸통: 허리→골반→둔부→가랑이. 둔부는 링 추가로 둥글게, 가랑이는 앞뒤(rz) 좁혀 사각 돌출 제거.
    const pantsBody = [
      { center: [0, waistY, 0], rx: B.PELVIS_HALF_Z * 1.0, rz: B.PELVIS_HALF_X * 0.9 },
      { center: [-0.004, gth + tLen * 0.02, 0], rx: B.PELVIS_HALF_Z * 1.12, rz: B.PELVIS_HALF_X * 1.0 }, // 골반(가장 넓음)
      { center: [-0.012, gth - 0.015, 0], rx: B.PELVIS_HALF_Z * 1.12, rz: B.PELVIS_HALF_X * 1.06 },      // 둔부 상부
      { center: [-0.012, gth - 0.05, 0], rx: B.PELVIS_HALF_Z * 1.05, rz: B.PELVIS_HALF_X * 1.02 },       // 둔부 하부(둥글게)
      { center: [-0.004, crotchY + 0.02, 0], rx: B.PELVIS_HALF_Z * 0.92, rz: B.PELVIS_HALF_X * 0.72 },   // 가랑이 위(앞뒤 좁힘)
      { center: [0, crotchY, 0], rx: B.PELVIS_HALF_Z * 0.82, rz: B.PELVIS_HALF_X * 0.55 },               // 가랑이(앞뒤 더 좁게 — 사각 돌출 제거)
    ];
    pants.add(loft(pantsBody, COL.short, { capStart: true, capEnd: false }));
    // 좌우 바지통 — 골반 몸통 **안쪽 위**(가랑이보다 위)에서 시작해 크게 겹침 → 바짓단(무릎 위 10cm).
    for (const side of ["l", "r"]) {
      const hipPt = side === "l" ? B.HIP_L : B.HIP_R;
      const cuffY = hipPt[1] - THIGH_LEN + 0.10;
      const legZ = hipPt[2];
      const legTube = [
        { center: [0, gth - 0.02, legZ * 0.55], rx: R.thighTop * 1.1, rz: R.thighTop * 1.12 },   // 골반 안(팬츠 몸통과 크게 겹침)
        { center: [0, crotchY - 0.02, legZ * 0.85], rx: R.thighTop * 1.06, rz: R.thighTop * 1.08 }, // 허벅지 상부
        { center: [0, (crotchY + cuffY) / 2, legZ], rx: R.thighTop * 1.02, rz: R.thighTop * 1.04 }, // 허벅지 중간
        { center: [0, cuffY, legZ], rx: R.thighBot * 1.14, rz: R.thighBot * 1.12 },                 // 바짓단
      ];
      pants.add(loft(legTube, COL.short, { capStart: false, capEnd: false }));
    }
    root.add(pants);
  }

  // ── LEG (좌우) — 맨살 허벅지(빕숏이 상부 덮음)→무릎→종아리→발. 다단 프로파일. ──
  for (const side of ["l", "r"]) {
    const hipPt = side === "l" ? B.HIP_L : B.HIP_R;
    const leg = new THREE.Group();
    leg.name = `leg_${side}`;
    leg.position.set(...hipPt);
    const tL = THIGH_LEN, sL = SHANK_LEN;
    // 허벅지 — 맨살(빕숏 바지통이 상부를 덮으므로 하부만 노출). 골반 뿌리는 팬츠가 담당.
    const thighRings = [
      { center: [0, -tL * 0.2, 0], rx: R.thighTop * 0.98, rz: R.thighTop * 1.02 },   // 바짓단 아래(맨살 시작)
      { center: [0.005, -tL * 0.45, 0], rx: R.thighTop * 0.92, rz: R.thighTop * 0.98 },
      { center: [0, -tL * 0.7, 0], rx: R.thighBot * 1.15, rz: R.thighBot * 1.12 },
      { center: [0, -tL, 0], rx: R.knee, rz: R.knee * 1.05 },                        // 무릎
    ];
    leg.add(loft(thighRings, COL.skin, { capStart: false, capEnd: false }));
    // leg_shin 노드 — 무릎 pivot(IK 대비). 종아리+발 로프트.
    const shin = new THREE.Group();
    shin.name = `leg_${side}_shin`;
    shin.position.set(0, -tL, 0);
    const shankRings = [
      { center: [0, R.knee * 0.8, 0], rx: R.knee * 0.98, rz: R.knee * 1.02 },         // 무릎 위(대퇴와 겹침)
      { center: [0, 0, 0], rx: R.knee, rz: R.knee * 1.05 },                           // 무릎
      { center: [-0.01, -sL * 0.28, 0], rx: R.shankTop, rz: R.shankTop * 1.05 },      // 장딴지 볼록(뒤)
      { center: [0, -sL * 0.7, 0], rx: R.shankBot * 1.15, rz: R.shankBot * 1.1 },
      { center: [0, -sL, 0], rx: R.ankle, rz: R.ankle * 1.1 },                        // 발목
    ];
    shin.add(loft(shankRings, COL.skin, { capStart: false, capEnd: false }));
    // 발 — 발목에서 앞으로 뻗는 로프트(발등→발끝). 발바닥이 지면.
    const footY = -sL;
    const footRings = [
      { center: [0, footY, 0], rx: R.ankle, rz: R.ankle * 1.1 },                      // 발목
      { center: [FOOT_LEN * 0.25, footY - FOOT_HEIGHT * 0.55, 0], rx: R.ankle * 1.1, rz: R.ankle * 1.5 }, // 발등
      { center: [FOOT_LEN * 0.7, footY - FOOT_HEIGHT * 0.7, 0], rx: R.ankle * 0.6, rz: R.ankle * 1.3 },   // 발끝
    ];
    shin.add(loft(footRings, COL.shoe, { capStart: false }));
    leg.add(shin);
    root.add(leg);
  }

  return root;
}

// ═══════════════════════════════════════════════════════════════════════════
// Export — 후보 GLB 를 .out/candidates/<candidateId>/ 에만 (제품 경로 밖).
// ═══════════════════════════════════════════════════════════════════════════
export async function buildCandidateGlb() {
  const c = newCandidate();
  const scene = buildRiderScene({ includeBike: false });
  const exporter = new GLTFExporter();
  const data = await exporter.parseAsync(scene, { binary: true });
  const buf = Buffer.from(data);
  const glbFile = candidateFile(c.candidateId, "candidate-rider", "glb");
  fs.writeFileSync(glbFile, buf);
  const glbHash = crypto.createHash("sha256").update(buf).digest("hex");
  const meta = {
    candidateId: c.candidateId,
    sourceHash: c.sourceHash,
    sourceHashFull: c.sourceHashFull,
    renderedHuman: c.renderedHuman,
    stage: "RIDER_ONLY",
    status: "UNAPPROVED",
    glbFile: path.basename(glbFile),
    glbHash,
    productPathTouched: false,
  };
  writeCandidateMeta(c.candidateId, meta);
  console.info(`[candidate] ${c.candidateId} → ${path.relative(WEB_ROOT, glbFile)} (${buf.length} bytes)`);
  console.info(`[candidate] sourceHash=${c.sourceHash} glbHash=${glbHash.slice(0, 8)} status=UNAPPROVED — 제품 경로 미변경`);
  return { ...c, glbFile, glbHash, meta };
}

if (process.argv[1]?.endsWith("build-rider-candidate.mjs")) {
  await buildCandidateGlb();
}

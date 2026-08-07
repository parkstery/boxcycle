#!/usr/bin/env node
/**
 * segment-penetration — **강체 세그먼트가 서로를 뚫고 나오는지** 재는 모듈 (F35 · 게이트 13).
 *
 * ── 왜 (사고 기록) ─────────────────────────────────────────────────────────
 * 사용자: *"페달을 돌릴 때 움직이는 허벅지의 상단은 엉덩이 뒷부분으로 튀어나가는
 * 형태로 표현되고 있다."* — `leg_*` 메시가 고관절(노드 원점)보다 **위로 96.8mm** 더
 * 뻗어 있고(168정점 · 그중 반바지색 67), 그 «스텁»이 페달링으로 회전하면서
 * 반바지 밖으로 드러난다. **프레임·안장 관통만 검사했고 「사지 ↔ 몸통」은 아무도
 * 보지 않았다.** 이 모듈이 그 감시자다.
 *
 * ── ⚠ 「보이는가」를 대리 지표로 재지 마라 — F35 에서 세 번 어긋났다 ──────
 * | 시도 | 왜 틀렸나 |
 * |---|---|
 * | 광선 짝수·홀수(parity) | `torso` 는 닫힌 메시가 아니고(경계 edge 108 · 비매니폴드 24) |
 * |  | 원본 V2 는 **살갗 위에 옷 껍질이 겹친 다층 메시**라 안쪽 껍질 내부가 «밖»으로 나온다 |
 * | 광선 탈출(escape ray) | 전 구면을 쓰면 **땅 밑에서 올려다보는 시선**까지 «보인다»로 센다 |
 * | 표면 거리 여유(inset) | 테두리 여유 5mm 를 빼다가 **눈에 띄는 초승달을 0 으로** 보고했다 |
 *
 * → **결국 눈이 보는 것은 픽셀이다.** 실제 게임 카메라 배율(3.9mm/px)·고도각으로
 *   오프스크린 래스터해 **문제 삼각형이 화면에 몇 픽셀 나오는지 직접 센다.**
 *   대리 지표가 아니라 그림이고, 사람이 보는 수와 같은 단위(픽셀)로 나온다.
 *
 * ── 무엇을 재나 ────────────────────────────────────────────────────────────
 * 강체 분해는 사지를 뼈 축으로 잘랐고, **관절 위쪽(로컬 y > 0)** 은 원래 부모 살 속에
 * 파묻혀 보이지 않아야 하는 «스텁»이다. 스텁이 화면에 나오면 실패.
 * 잘라낸 뒤 생긴 **절단 뚜껑**이 나오는 것도 «틈»이므로 함께 센다.
 *
 *   leg_*        허벅지 스텁이 골반·반바지 속에      (원본 스텁 168정점)
 *   leg_*_shin   정강이 스텁이 허벅지 속에            (원본 0정점 — 애초에 없다)
 *   arm_*        상완 스텁이 어깨 속에                (원본 27정점)
 *   arm_*_fore   전완 스텁이 팔꿈치 속에              (원본 20정점)
 *
 * ⚠ **`ankle_*` 는 대상이 아니다.** F31 이 발 메시를 «밑창 법선 = 로컬 −Y»로 정렬해
 * 놓아, `ankle_*` 의 로컬 y>0 은 «관절 위»가 아니라 **신발 윗면**이다(190정점,
 * y −23.2~+40.6). 보이는 게 정상이며, 같은 잣대를 대면 190/190 이 «관통»으로 잡힌다.
 * **축이 다른 세그먼트에 스텁 규칙을 쓰지 마라.**
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node segment-penetration.mjs [--glb <path>] [--phases 8] [--dump <dir>] [--quiet]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderOrtho, cameraBasis, writePNG, MM_PER_PX } from "./offscreen-raster.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_GLB = path.resolve(HERE, "../../public/rider/prototype/rider-lowpoly.glb");

/**
 * 시선 표본 — **실제 게임 카메라가 놓일 수 있는 각도만.**
 * `mapGlobeView.RIDE_CAMERA_PITCH_CLOSE = 80` 은 Mapbox pitch(수직 기준)라
 * 시선 고도각은 **90 − 80 = 10°**(준수평 GoPro 뷰). 여유를 둬 10·25·40° 를 본다.
 * ⚠ 카메라 프리셋을 세우면 이 목록도 올리고 **다시 재라.**
 */
export const CAM_ELEVS_DEG = [10, 25, 40];
/** 방위 표본 수 (전 방위 균등) */
export const CAM_AZIMUTHS = 12;
/** 라이더 세그먼트 — 가림은 **전체**가 한다(옷 밑단으로 시선이 새지 않게) */
export const RIDER_NODES = [
  "torso",
  "leg_l", "leg_l_shin", "ankle_l", "leg_r", "leg_r_shin", "ankle_r",
  "arm_l", "arm_l_fore", "arm_r", "arm_r_fore",
  "joint_cap_knee_l", "joint_cap_knee_r", "joint_cap_elbow_l", "joint_cap_elbow_r",
  "joint_cap_ankle_l", "joint_cap_ankle_r",
];
/** 스텁 검사 대상 (자식 → 부모). `ankle_*` 제외 — 머리말 참조 */
export const STUB_NODES = {
  leg: ["leg_l", "leg_r", "leg_l_shin", "leg_r_shin"],
  arm: ["arm_l", "arm_r", "arm_l_fore", "arm_r_fore"],
};

/**
 * 합격선 (F35 실측 기준선, 2026-08-08).
 *
 * - `LEG_STUB_MAX_PX = 0` — **이번 지시의 정본.** 허벅지 스텁은 한 픽셀도 보이면 안 된다
 *   (F34 제품: **909px**).
 * - `LEG_CAP_MAX_PX = 293` — 스텁을 잘라내면 **절단면**이 생기고, 반바지가 덮지 못하는
 *   고관절 뒤쪽에서 얇은 초승달로 보인다. **0 으로 만들 수 없다** — 절단 높이를
 *   −40~+20mm 로 훑어도 293~391px 사이일 뿐이고 최소가 +10mm 다(F35 §2-2).
 *   덮으려면 반바지 메시를 키워야 하는데 그건 이번 지시 범위 밖이다.
 *   → **커지지 않는지 감시**하는 기준선으로 둔다. 완화가 아니라 «해결 못 한 것을
 *   숨기지 않고 고정»하는 것이다.
 * - `ARM_STUB_MAX_PX = 211` — 팔에도 **같은 결함이 있다**(상완 27정점·전완 20정점).
 *   지시 §3 이 어깨 이음매를 금지해 손대지 않았다. **F36 이월** 기준선.
 */
export const LEG_STUB_MAX_PX = 0;
export const LEG_CAP_MAX_PX = 293;
export const ARM_STUB_MAX_PX = 211;

const TAG = { OTHER: 0, LEG_STUB: 1, LEG_CAP: 2, ARM_STUB: 3, ARM_CAP: 4 };
const TAG_COLOR = {
  0: [120, 128, 145], 1: [60, 255, 90], 2: [255, 0, 220], 3: [80, 200, 255], 4: [255, 170, 0],
};

const applyM = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ── GLB ────────────────────────────────────────────────────────────────────
export function loadGlb(p) {
  const buf = fs.readFileSync(p);
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), ty = buf.readUInt32LE(off + 4);
    const d = buf.subarray(off + 8, off + 8 + len);
    if (ty === 0x4e4f534a) json = JSON.parse(d.toString("utf8").replace(/\0+$/, ""));
    else if (ty === 0x004e4942) bin = d;
    off += 8 + len;
  }
  const byName = new Map();
  json.nodes.forEach((n, i) => n.name && byName.set(n.name, i));
  const readAcc = (i) => {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
    const comps = a.type === "VEC3" ? 3 : a.type === "VEC2" ? 2 : 1;
    const cs = a.componentType === 5126 || a.componentType === 5125 ? 4 : 2;
    const st = bv.byteStride ?? comps * cs;
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out = [];
    for (let k = 0; k < a.count; k++) {
      const q = base + k * st;
      if (comps === 3) out.push([bin.readFloatLE(q), bin.readFloatLE(q + 4), bin.readFloatLE(q + 8)]);
      else if (comps === 2) out.push([bin.readFloatLE(q), bin.readFloatLE(q + 4)]);
      else out.push(a.componentType === 5123 ? bin.readUInt16LE(q) : bin.readUInt32LE(q));
    }
    return out;
  };
  const meshOf = (name) => {
    const ni = byName.get(name);
    if (ni === undefined || json.nodes[ni].mesh === undefined) return null;
    const prim = json.meshes[json.nodes[ni].mesh].primitives[0];
    return {
      T: json.nodes[ni].translation ?? [0, 0, 0],
      pos: readAcc(prim.attributes.POSITION),
      uv: prim.attributes.TEXCOORD_0 !== undefined ? readAcc(prim.attributes.TEXCOORD_0) : null,
      idx: readAcc(prim.indices),
    };
  };
  return { json, bin, byName, readAcc, meshOf };
}

/**
 * 게이트 13 본체. `resolveGlbPedalPose`·`riderRig` 를 **import 해서** 쓴다
 * (재현하면 거짓 PASS 가 난다 — F23·F32).
 *
 * @returns {{leg:{stubPx:number,capPx:number,worst:object}, arm:{...}, stubTopMm:object}}
 */
export async function runSegmentPenetration(glbPath, { phases = 8, dumpDir = null, verbose = false } = {}) {
  const LIB = path.resolve(HERE, "../../src/lib");
  const url = (rel) => `file:///${path.resolve(LIB, rel).replace(/\\/g, "/")}`;
  const { resolveGlbPedalPose } = await import(url("riderGlbPedalPose.pose.mjs"));
  const { mapboxEulerDegToMat3, mat3Mul } = await import(url("riderPrototype/riderIk.mjs"));
  const { TORSO_ROTATION_DEG } = await import(url("riderPrototype/riderRig.geometry.mjs"));

  const { json, byName, meshOf } = loadGlb(glbPath);
  const parentOf = new Map();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)));
  const chainOf = (name) => { const c = []; let i = byName.get(name); while (i !== undefined) { c.unshift(i); i = parentOf.get(i); } return c; };
  const worldOf = (name, ov) => {
    let R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], T = [0, 0, 0];
    for (const idx of chainOf(name)) {
      const n = json.nodes[idx];
      T = addv(T, applyM(R, n.translation ?? [0, 0, 0]));
      if (ov[n.name]) R = mat3Mul(R, mapboxEulerDegToMat3(ov[n.name]));
    }
    return { R, T };
  };
  const ovOf = (phase) => {
    const p = resolveGlbPedalPose(phase);
    return {
      torso: TORSO_ROTATION_DEG,
      leg_l: p.legLRotationDeg, leg_l_shin: p.legLShinRotationDeg, ankle_l: p.ankleLRotationDeg,
      leg_r: p.legRRotationDeg, leg_r_shin: p.legRShinRotationDeg, ankle_r: p.ankleRRotationDeg,
      arm_l: p.armLRotationDeg, arm_l_fore: p.armLForeRotationDeg,
      arm_r: p.armRRotationDeg, arm_r_fore: p.armRForeRotationDeg,
    };
  };

  // 세그먼트별 «스텁 / 뚜껑» 삼각형 분류 (로컬 좌표라 위상과 무관 — 한 번만)
  const stubTopMm = {};
  const classify = {};
  for (const [group, names] of Object.entries(STUB_NODES)) {
    for (const name of names) {
      const m = meshOf(name);
      if (!m) continue;
      const yTop = Math.max(...m.pos.map((q) => q[1]));
      stubTopMm[name] = yTop * 1000;
      const kind = new Int8Array(m.idx.length / 3);
      for (let t = 0; t < m.idx.length; t += 3) {
        const v = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
        // ⚠ 뚜껑은 **부호 조건 없이** 먼저 판정한다. y>0 을 걸면 절단면을 관절 평면에
        //   정확히 놓았을 때(y == 0) 뚜껑이 통째로 빠지고, 관절 아래로 자르면 또 빠져
        //   **거짓 0px** 가 나온다. F35 에서 양방향으로 실제 발생했다.
        if (v.every((i) => yTop - m.pos[i][1] < 5e-4)) { kind[t / 3] = 2; continue; }
        if (v.every((i) => m.pos[i][1] > 0)) kind[t / 3] = 1;         // 관절 위 = 스텁
      }
      classify[name] = { kind, group };
    }
  }

  const cams = [];
  for (const el of CAM_ELEVS_DEG)
    for (let a = 0; a < CAM_AZIMUTHS; a++) cams.push({ az: (360 * a) / CAM_AZIMUTHS, el });

  const W = 320, H = 320;
  const worst = { leg: { stubPx: 0, capPx: 0, at: null }, arm: { stubPx: 0, capPx: 0, at: null } };
  if (dumpDir) fs.mkdirSync(dumpDir, { recursive: true });

  for (let k = 0; k < phases; k++) {
    const phase = k / phases;
    const ov = ovOf(phase);
    const tris = [];
    let hip = [0, 0, 0];
    for (const name of RIDER_NODES) {
      const m = meshOf(name);
      if (!m) continue;
      const w = worldOf(name, ov);
      if (name === "leg_l") hip = w.T.map((v) => v * 1000);
      const wp = m.pos.map((q) => addv(applyM(w.R, q), w.T).map((v) => v * 1000));
      const cl = classify[name];
      for (let t = 0; t < m.idx.length; t += 3) {
        const v = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
        let tag = TAG.OTHER;
        if (cl) {
          const kind = cl.kind[t / 3];
          if (kind === 1) tag = cl.group === "leg" ? TAG.LEG_STUB : TAG.ARM_STUB;
          else if (kind === 2) tag = cl.group === "leg" ? TAG.LEG_CAP : TAG.ARM_CAP;
        }
        tris.push({ v: [wp[v[0]], wp[v[1]], wp[v[2]]], tag });
      }
    }
    for (const cam of cams) {
      const basis = cameraBasis(cam.az, cam.el);
      const centerMm = [
        hip[0] * basis.right[0] + hip[1] * basis.right[1] + hip[2] * basis.right[2],
        hip[0] * basis.up[0] + hip[1] * basis.up[1] + hip[2] * basis.up[2],
      ];
      const { tagBuf, rgb } = renderOrtho({ W, H, tris, basis, centerMm, palette: dumpDir ? TAG_COLOR : null });
      const cnt = [0, 0, 0, 0, 0];
      for (let i = 0; i < tagBuf.length; i++) if (tagBuf[i] > 0) cnt[tagBuf[i]]++;
      for (const [g, sTag, cTag] of [["leg", TAG.LEG_STUB, TAG.LEG_CAP], ["arm", TAG.ARM_STUB, TAG.ARM_CAP]]) {
        if (cnt[sTag] > worst[g].stubPx || cnt[cTag] > worst[g].capPx) {
          if (cnt[sTag] > worst[g].stubPx) worst[g].stubPx = cnt[sTag];
          if (cnt[cTag] > worst[g].capPx) worst[g].capPx = cnt[cTag];
          worst[g].at = { phase, az: cam.az, el: cam.el };
        }
      }
      if (dumpDir && (cnt[TAG.LEG_STUB] || cnt[TAG.LEG_CAP]))
        writePNG(path.join(dumpDir, `p${String(Math.round(phase * 1000)).padStart(3, "0")}_az${cam.az}_el${cam.el}.png`), W, H, rgb);
    }
  }
  if (verbose) {
    console.log(`      카메라 ${cams.length}대(고도각 ${CAM_ELEVS_DEG.join("·")}° × 방위 ${CAM_AZIMUTHS}) × ${phases}위상 · ${MM_PER_PX}mm/px`);
    console.log(`      스텁 상단(로컬 y, 관절=0):  ${Object.entries(stubTopMm).map(([n, v]) => `${n} ${v.toFixed(1)}`).join(" · ")}`);
    for (const g of ["leg", "arm"])
      console.log(
        `      ${g === "leg" ? "다리" : "팔  "}  스텁 ${String(worst[g].stubPx).padStart(4)}px · 절단뚜껑 ${String(worst[g].capPx).padStart(4)}px` +
        (worst[g].at ? `   (최악 phase ${worst[g].at.phase.toFixed(3)} · 방위 ${worst[g].at.az}° · 고도 ${worst[g].at.el}°)` : ""),
      );
  }
  return { leg: worst.leg, arm: worst.arm, stubTopMm, cams: cams.length, phases };
}

// ── CLI ────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
  const res = await runSegmentPenetration(arg("glb", DEFAULT_GLB), {
    phases: Number(arg("phases", "8")),
    dumpDir: arg("dump", null),
    verbose: !process.argv.includes("--quiet"),
  });
  const ok = res.leg.stubPx <= LEG_STUB_MAX_PX && res.leg.capPx <= LEG_CAP_MAX_PX && res.arm.stubPx <= ARM_STUB_MAX_PX;
  console.log(
    `\n  ${ok ? "✔ PASS" : "✘ FAIL"} — 다리 스텁 ${res.leg.stubPx}/${LEG_STUB_MAX_PX}px · ` +
    `절단뚜껑 ${res.leg.capPx}/${LEG_CAP_MAX_PX}px · 팔 스텁 ${res.arm.stubPx}/${ARM_STUB_MAX_PX}px(F36 이월)`,
  );
  process.exit(ok ? 0 : 1);
}

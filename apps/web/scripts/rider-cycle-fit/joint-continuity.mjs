#!/usr/bin/env node
/**
 * joint-continuity — 관절이 **끊어져/잘록해 보이는지**를 픽셀로 잰다 (F36 · 게이트 14).
 *
 * ── 왜 (사용자 원문 2026-08-08) ────────────────────────────────────────────
 * *"무릎 관절 부분과 팔꿈치 쪽은 **끊어진 것처럼** 보이고, 관절 형태도 사람의 관절
 * 같지 않은 **로봇처럼** 보인다."*
 *
 * ── ⚠ 「끊어짐」은 구멍이 아니다 ───────────────────────────────────────────
 * 처음엔 «관절에 구멍(간극)이 있다»고 보고 축 방향 mm 를 쟀는데, 실측하니 구멍이
 * 아니라 **굵기가 끊기는 것**이었다:
 * ```
 *   허벅지 끝 단면  x폭   5 · z폭  40mm   ← 날처럼 납작하게 사라진다
 *   정강이 첫 링    x폭 107 · z폭  97mm   ← 갑자기 full 굵기로 시작
 *   그 사이 관절 중심에 타원체 1개        ← 공 하나
 * ```
 * **가늘어짐 → 공 → 굵어짐 = 로봇 관절.** 그러므로 재야 할 것은 구멍 넓이가 아니라
 * **실루엣 폭의 «잘록함»** 이다.
 *
 * ── 무엇을 재나 ────────────────────────────────────────────────────────────
 * 사지(부모+자식+캡)만 격리 렌더한 뒤, **관절 위치를 지나는 사지 축**을 따라가며
 * 축에 수직인 현(chord)의 실루엣 폭을 잰다.
 * ```
 *   잘록함(px) = max over t in 관절±35mm of  ( min(W(t−δ), W(t+δ)) − W(t) )   δ=12mm
 *   단절(px)   = 관절 ±35mm 안에서 폭이 0 인 구간 길이   ← 진짜로 끊긴 경우
 * ```
 *
 * ⚠ **«세그먼트 정상폭 − 관절 최소폭» 으로 재면 안 된다.** 사지는 관절로 갈수록
 * 원래 가늘어지므로(허벅지 97mm → 무릎 54mm) 그 방식은 **정상적인 테이퍼를 결함으로
 * 센다.** 실측: 양단 캡을 달아 그림이 확실히 좋아졌는데 그 지표는 45px → 44px 로
 * 거의 안 움직였다. 결함은 «가늘다»가 아니라 «**주변보다 움푹 들어갔다**» 이므로
 * **국소 오목함(local dip)** 으로 잰다.
 * 배율은 게임 카메라 **3.9mm/px**(`offscreen-raster.MM_PER_PX`). 사람이 보는 단위다.
 *
 * ⚠ 사지만 격리해 잰다 — 몸통·자전거가 뒤에 있으면 실루엣 경계가 흐려진다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node joint-continuity.mjs [--glb <path>] [--phases 8] [--scale 1] [--verbose]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderOrtho, cameraBasis, MM_PER_PX } from "./offscreen-raster.mjs";
import { loadGlb } from "./segment-penetration.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_GLB = path.resolve(HERE, "../../public/rider/prototype/rider-lowpoly.glb");

/** [관절 이름, 부모 노드, 자식 노드] — 자식 노드의 원점이 곧 관절이다 */
export const JOINT_SEGS = [
  ["무릎 L", "leg_l", "leg_l_shin"],
  ["무릎 R", "leg_r", "leg_r_shin"],
  ["팔꿈치 L", "arm_l", "arm_l_fore"],
  ["팔꿈치 R", "arm_r", "arm_r_fore"],
];
/** 관절 주변 이 반경(mm) 안이 «관절부» */
export const JOINT_BAND_MM = 35;
/** 세그먼트 «정상 굵기» 를 재는 구간(mm) */
export const SEG_BAND_MM = [40, 70];
/** 국소 오목함을 재는 비교 거리(mm) — 관절 폭을 좌우 ±이 거리와 비교한다 */
export const DIP_DELTA_MM = 12;
/** 합격선 — F36 실측 기준선으로 잡는다(§ REPORT) */
export const PINCH_MAX_PX = 0;
export const BREAK_MAX_PX = 0;

const applyM = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0);

export async function runJointContinuity(glbPath, { phases = 8, scale = 1, verbose = false } = {}) {
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
  /** 노드와 그 자식 캡들의 월드 삼각형 (캡은 세그먼트의 일부로 본다) */
  const trisOf = (name, ov) => {
    const out = [];
    const walk = (nm) => {
      const m = meshOf(nm);
      const w = worldOf(nm, ov);
      if (m) {
        const wp = m.pos.map((q) => addv(applyM(w.R, q), w.T).map((v) => v * 1000));
        for (let t = 0; t < m.idx.length; t += 3) out.push({ v: [wp[m.idx[t]], wp[m.idx[t + 1]], wp[m.idx[t + 2]]], tag: 0 });
      }
      const ni = byName.get(nm);
      for (const c of json.nodes[ni]?.children ?? []) {
        const cn = json.nodes[c].name;
        if (cn?.startsWith("joint_cap")) walk(cn);
      }
    };
    walk(name);
    return out;
  };

  const mmPerPx = MM_PER_PX / scale;
  const rows = [];
  for (let k = 0; k < phases; k++) {
    const phase = k / phases;
    const ov = ovOf(phase);
    for (const [label, parent, child] of JOINT_SEGS) {
      const tris = [...trisOf(parent, ov), ...trisOf(child, ov)];
      if (!tris.length) continue;
      const jw = worldOf(child, ov).T.map((v) => v * 1000);          // 관절 월드 위치
      // 사지 축 = 부모 원점 → 자식 원점 → 손자 원점 방향의 평균 (관절을 지나는 굽은 축)
      const pw = worldOf(parent, ov).T.map((v) => v * 1000);
      const gcName = json.nodes[byName.get(child)]?.children?.map((i) => json.nodes[i].name).find((n) => n && !n.startsWith("joint_cap"));
      const gw = gcName ? worldOf(gcName, ov).T.map((v) => v * 1000) : jw.map((v, i) => v + (jw[i] - pw[i]));
      // 두 방위에서 본다 — 한쪽에서 겹쳐 가려질 수 있다
      for (const az of [90, 270, 150, 210]) {
        const basis = cameraBasis(az, 10);
        const proj = (p) => [
          p[0] * basis.right[0] + p[1] * basis.right[1] + p[2] * basis.right[2],
          p[0] * basis.up[0] + p[1] * basis.up[1] + p[2] * basis.up[2],
        ];
        const J = proj(jw), P = proj(pw), G = proj(gw);
        const W = 260, H = 260;
        const { tagBuf } = renderOrtho({ W, H, tris, basis, centerMm: J, mmPerPx });
        const px = (p) => [W / 2 + (p[0] - J[0]) / mmPerPx, H / 2 - (p[1] - J[1]) / mmPerPx];
        const solid = (x, y) => x >= 0 && x < W && y >= 0 && y < H && tagBuf[(y | 0) * W + (x | 0)] >= 0;
        /** 관절에서 t(mm) 만큼 «부모 쪽(음수)/자식 쪽(양수)» 지점의 축 방향 */
        const axisAt = (t) => {
          const a = t < 0 ? px(P) : px(G);
          const j = px(J);
          const d = [a[0] - j[0], a[1] - j[1]];
          const L = Math.hypot(d[0], d[1]) || 1;
          return { dir: [d[0] / L, d[1] / L], j };
        };
        /** 축 위 t(mm) 지점에서 축에 수직인 현의 실루엣 폭(px) */
        const widthAt = (t) => {
          const { dir, j } = axisAt(t);
          const stepPx = Math.abs(t) / mmPerPx;
          const cx = j[0] + dir[0] * stepPx, cy = j[1] + dir[1] * stepPx;
          const nx = -dir[1], ny = dir[0];
          let w = 0;
          for (let s = -60; s <= 60; s++) if (solid(cx + nx * s, cy + ny * s)) w++;
          return w;
        };
        // 축을 따라 폭 프로파일을 만든 뒤 **국소 오목함**을 찾는다
        const step = 2; // mm
        const prof = new Map();
        const D = DIP_DELTA_MM;
        for (let t = -JOINT_BAND_MM - D; t <= JOINT_BAND_MM + D; t += step) prof.set(Math.round(t), widthAt(t));
        // ⚠ 키를 «step 배수로 반올림» 하지 마라 — 표본이 홀수(−47,−45,…)인데
        //   `Math.round(t/2)*2` 는 짝수로 보내 **전부 miss → 폭 0 → 거짓 «단절 74px»** 이 났다.
        const at = (t) => prof.get(Math.round(t)) ?? 0;
        let pinch = 0, wMin = Infinity, breakPx = 0, pinchAt = 0;
        for (let t = -JOINT_BAND_MM; t <= JOINT_BAND_MM; t += step) {
          const w = at(t);
          if (w < wMin) wMin = w;
          if (w === 0) breakPx += step / mmPerPx;
          const dip = Math.min(at(t - D), at(t + D)) - w;
          if (dip > pinch) { pinch = dip; pinchAt = t; }
        }
        const Wpar = median([...prof.entries()].filter(([t]) => t <= -20).map(([, w]) => w));
        const Wchi = median([...prof.entries()].filter(([t]) => t >= 20).map(([, w]) => w));
        { let solidPx = 0; for (let i = 0; i < tagBuf.length; i++) if (tagBuf[i] >= 0) solidPx++;
          rows.push({ phase, label, az, Wpar, Wchi, wMin, pinch, pinchAt, breakPx: Math.round(breakPx), solidPx, prof: [...prof.entries()] }); }
      }
    }
  }
  const agg = {};
  for (const r of rows) {
    const a = (agg[r.label] ??= { pinch: 0, breakPx: 0, at: null });
    if (r.pinch > a.pinch) { a.pinch = r.pinch; a.at = r; }
    if (r.breakPx > a.breakPx) a.breakPx = r.breakPx;
  }
  if (verbose) {
    console.log(`      배율 ${mmPerPx.toFixed(2)}mm/px · ${phases}위상 × 방위 4`);
    for (const [label, a] of Object.entries(agg))
      console.log(
        `      ${label.padEnd(8)} 잘록함 ${String(a.pinch).padStart(3)}px · 단절 ${String(a.breakPx).padStart(3)}px` +
        (a.at ? `   (최악 phase ${a.at.phase.toFixed(3)} 방위 ${a.at.az}° · 관절에서 ${a.at.pinchAt}mm · 폭 ${a.at.wMin}px)` : ""),
      );
  }
  const worstPinch = Math.max(...Object.values(agg).map((a) => a.pinch), 0);
  const worstBreak = Math.max(...Object.values(agg).map((a) => a.breakPx), 0);
  return { rows, agg, worstPinch, worstBreak };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
  const res = await runJointContinuity(arg("glb", DEFAULT_GLB), {
    phases: Number(arg("phases", "8")),
    scale: Number(arg("scale", "1")),
    verbose: true,
  });
  if (process.argv.includes("--debug")) {
    for (const x of res.rows) if (x.solidPx < 500) console.log(`    [빈 렌더] ${x.label} phase ${x.phase} 방위 ${x.az}° solid ${x.solidPx}px`);
    const r = res.rows.find((x) => x.label === "무릎 L") ?? res.rows[0];
    console.log(`\n  [debug] ${r.label} · phase ${r.phase} · 방위 ${r.az}° · 렌더 solid ${r.solidPx}px`);
    console.log("    폭 프로파일(관절에서 mm : px)  " + r.prof.map(([t, w]) => `${t}:${w}`).join(" "));
  }
  console.log(`\n  최악 잘록함 ${res.worstPinch}px · 최악 단절 ${res.worstBreak}px`);
  process.exit(res.worstPinch <= PINCH_MAX_PX && res.worstBreak <= BREAK_MAX_PX ? 0 : 1);
}

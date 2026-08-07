#!/usr/bin/env node
/**
 * clip-node-mesh — 노드 메시를 **로컬 평면에서 잘라내고 절단면을 막는다** (F35).
 *
 * ── 왜 ─────────────────────────────────────────────────────────────────────
 * 강체 분해는 사지를 뼈 축으로 잘랐는데, `leg_*` 메시가 고관절(노드 원점)보다
 * **위로 96.8mm** 더 뻗어 있다(168정점 · 그중 반바지색 67). 원래 골반 살 속에
 * 파묻혀 보이지 않아야 할 «스텁»인데, 페달링으로 회전하면서 **반바지 밖으로
 * 드러난다**(실측: 8위상 전부에서 51~55정점 노출 · 최대 42.3mm).
 * 사용자: *"허벅지의 상단은 엉덩이 뒷부분으로 튀어나가는 형태로 표현되고 있다."*
 *
 * → 스텁을 잘라낸다. **원래 안 보여야 할 부분이라 잘라도 잃을 것이 없다.**
 *
 * ── 어떻게 ─────────────────────────────────────────────────────────────────
 * 정점을 «지우는» 방식은 삼각형 경계가 톱니처럼 남는다. **평면 클리핑**을 한다:
 *   - 세 정점 전부 남는 삼각형 → 그대로
 *   - 전부 잘리는 삼각형       → 버림
 *   - 걸친 삼각형             → 평면 위에 새 정점을 만들어 다시 삼각형화
 *     (edge 마다 새 정점을 **한 번만** 만들어 절단 링이 벌어지지 않게 한다)
 * 그 뒤 생긴 경계 루프마다 **중심 팬으로 뚜껑**을 덮는다 — 백페이스 컬링에서
 * 속이 뚫려 보이지 않도록. 뚜껑 UV 는 링 정점 중 **최빈 UV** 를 그대로 쓴다
 * (평균을 내면 팔레트 텍셀 경계를 넘어 엉뚱한 색이 된다).
 *
 * ⚠ 메시는 **껍질이 여러 개**다(예: `leg_l` = 살 720삼각형 + 반바지 304삼각형).
 *   경계 루프도 껍질마다 생기므로 루프를 **전부** 덮어야 한다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node clip-node-mesh.mjs <in.glb> <out.glb> --nodes leg_l,leg_r --below-y 0.020
 *   (--below-y = 이 로컬 y **이하만 남긴다**, 단위 m)
 */
import fs from "node:fs";
import path from "node:path";

const GLB_MAGIC = 0x46546c67, CHUNK_JSON = 0x4e4f534a, CHUNK_BIN = 0x004e4942;

function parseGlb(buf) {
  let off = 12, json = null, bin = Buffer.alloc(0);
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), ty = buf.readUInt32LE(off + 4);
    const d = buf.subarray(off + 8, off + 8 + len);
    if (ty === CHUNK_JSON) json = JSON.parse(d.toString("utf8").replace(/\0+$/, ""));
    else if (ty === CHUNK_BIN) bin = d;
    off += 8 + len;
  }
  return { json, bin };
}
function writeGlb(json, bin) {
  let j = Buffer.from(JSON.stringify(json), "utf8");
  const jp = (4 - (j.length % 4)) % 4;
  if (jp) j = Buffer.concat([j, Buffer.alloc(jp, 0x20)]);
  let b = bin;
  const bp = (4 - (b.length % 4)) % 4;
  if (bp) b = Buffer.concat([b, Buffer.alloc(bp)]);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.writeUInt32LE(CHUNK_JSON, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(b.length, 0); bh.writeUInt32LE(CHUNK_BIN, 4);
  const body = Buffer.concat([jh, j, bh, b]);
  const h = Buffer.alloc(12);
  h.writeUInt32LE(GLB_MAGIC, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([h, body]);
}
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };

/** 평면 y = Y 아래만 남기고 클리핑. 반환 {pos, uv, nrm, idx, cutVerts} */
function clipBelowY(pos, uv, nrm, idx, Y) {
  const keep = pos.map((p) => p[1] <= Y);
  const newPos = pos.map((p) => [...p]);
  const newUv = uv ? uv.map((p) => [...p]) : null;
  const newNrm = nrm ? nrm.map((p) => [...p]) : null;
  const edgeCut = new Map(); // "a_b" → 새 정점 인덱스 (edge 당 한 번만)
  const cutOn = (a, b) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (edgeCut.has(k)) return edgeCut.get(k);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const t = (Y - pos[lo][1]) / (pos[hi][1] - pos[lo][1]);
    const lerp = (A, B, n) => Array.from({ length: n }, (_, i) => A[i] + (B[i] - A[i]) * t);
    const ni = newPos.push(lerp(pos[lo], pos[hi], 3)) - 1;
    newPos[ni][1] = Y; // 수치 오차 제거 — 절단 링은 정확히 평면 위
    if (newUv) newUv.push(lerp(uv[lo], uv[hi], 2));
    if (newNrm) newNrm.push(lerp(nrm[lo], nrm[hi], 3));
    edgeCut.set(k, ni);
    return ni;
  };
  const out = [];
  let dropped = 0, clipped = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]];
    const k = v.map((i) => keep[i]);
    const nk = k.filter(Boolean).length;
    if (nk === 3) { out.push(...v); continue; }
    if (nk === 0) { dropped++; continue; }
    clipped++;
    // 남는 정점이 앞에 오도록 회전 (winding 보존)
    let r = 0;
    if (nk === 1) { while (!k[r]) r++; } else { while (!(k[r] && !k[(r + 2) % 3])) r++; }
    const a = v[r], b = v[(r + 1) % 3], c = v[(r + 2) % 3];
    if (nk === 1) {
      // a 만 남음 → a, ab, ca
      out.push(a, cutOn(a, b), cutOn(c, a));
    } else {
      // a,b 남음 (c 잘림) → a, b, bc  +  a, bc, ca
      const bc = cutOn(b, c), ca = cutOn(c, a);
      out.push(a, b, bc, a, bc, ca);
    }
  }
  return { pos: newPos, uv: newUv, nrm: newNrm, idx: out, dropped, clipped, cutVerts: [...edgeCut.values()] };
}

/** 열린 경계 루프마다 중심 팬 뚜껑을 덮는다 (법선이 +Y 를 향하도록) */
function capBoundary(pos, uv, nrm, idx, Y) {
  const wid = new Map();
  const rid = pos.map((p) => {
    const k = p.map((v) => Math.round(v * 1e6)).join(",");
    if (!wid.has(k)) wid.set(k, wid.size);
    return wid.get(k);
  });
  const anyOf = new Array(wid.size);
  rid.forEach((r, i) => { if (anyOf[r] === undefined) anyOf[r] = i; });
  const ec = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const v = [rid[idx[t]], rid[idx[t + 1]], rid[idx[t + 2]]];
    for (const [a, b] of [[v[0], v[1]], [v[1], v[2]], [v[2], v[0]]]) {
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      ec.set(k, (ec.get(k) ?? 0) + 1);
    }
  }
  const adj = new Map();
  for (const [k, c] of ec) {
    if (c !== 1) continue;
    const [a, b] = k.split("_").map(Number);
    // 절단 평면 위의 루프만 덮는다 (원래 있던 다른 구멍은 건드리지 않는다)
    if (Math.abs(pos[anyOf[a]][1] - Y) > 1e-6 || Math.abs(pos[anyOf[b]][1] - Y) > 1e-6) continue;
    (adj.get(a) ?? adj.set(a, []).get(a)).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)).push(a);
  }
  const seen = new Set();
  const loops = [];
  for (const s of adj.keys()) {
    if (seen.has(s)) continue;
    const loop = [];
    let cur = s, prev = -1;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur); loop.push(cur);
      const nb = (adj.get(cur) ?? []).filter((x) => x !== prev && !seen.has(x));
      prev = cur; cur = nb[0];
    }
    if (loop.length >= 3) loops.push(loop);
  }
  let added = 0;
  for (const loop of loops) {
    const ptsIdx = loop.map((r) => anyOf[r]);
    const c = [0, 1, 2].map((k) => ptsIdx.reduce((s, i) => s + pos[i][k], 0) / ptsIdx.length);
    c[1] = Y;
    // 중심 주변 각도로 정렬 (경계 추적 순서가 뒤엉킨 경우 대비)
    const ang = (i) => Math.atan2(pos[i][2] - c[2], pos[i][0] - c[0]);
    ptsIdx.sort((a, b) => ang(a) - ang(b));
    // 뚜껑 UV = 링 정점 중 **최빈 UV** (평균은 팔레트 텍셀을 벗어난다)
    let cu = [0, 0];
    if (uv) {
      const tally = new Map();
      for (const i of ptsIdx) { const k = uv[i].join(","); tally.set(k, (tally.get(k) ?? 0) + 1); }
      cu = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
    }
    const ci = pos.push(c) - 1;
    if (uv) uv.push(cu);
    if (nrm) nrm.push([0, 1, 0]);
    for (let i = 0; i < ptsIdx.length; i++) {
      const a = ptsIdx[i], b = ptsIdx[(i + 1) % ptsIdx.length];
      // 법선이 +Y 가 되도록: (c→a)×(c→b) 의 y 부호로 판정
      const u = [pos[a][0] - c[0], 0, pos[a][2] - c[2]];
      const w = [pos[b][0] - c[0], 0, pos[b][2] - c[2]];
      const cy = u[2] * w[0] - u[0] * w[2]; // (u×w).y
      if (cy > 0) idx.push(ci, a, b); else idx.push(ci, b, a);
      added++;
    }
  }
  return { loops: loops.length, tris: added };
}

/** 쓰이지 않는 정점 제거 */
function compact(pos, uv, nrm, idx) {
  const used = new Map();
  const nidx = idx.map((i) => {
    if (!used.has(i)) used.set(i, used.size);
    return used.get(i);
  });
  const order = [...used.entries()].sort((a, b) => a[1] - b[1]).map(([o]) => o);
  return {
    pos: order.map((i) => pos[i]),
    uv: uv ? order.map((i) => uv[i]) : null,
    nrm: nrm ? order.map((i) => nrm[i]) : null,
    idx: nidx,
  };
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  const names = (arg("nodes", "") || "").split(",").filter(Boolean);
  const Y = Number(arg("below-y", "NaN"));
  if (!inPath || !outPath || !names.length || Number.isNaN(Y)) {
    console.error("사용법: node clip-node-mesh.mjs <in.glb> <out.glb> --nodes leg_l,leg_r --below-y 0.020");
    process.exit(2);
  }
  const src = fs.readFileSync(inPath);
  const { json, bin } = parseGlb(src);
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
  const chunks = [bin];
  let binLen = bin.length;
  const pad4 = () => { const p = (4 - (binLen % 4)) % 4; if (p) { chunks.push(Buffer.alloc(p)); binLen += p; } };
  pad4();
  const addAcc = (rows, comps, ctype, target) => {
    const bytes = ctype === 5123 ? 2 : 4;
    const buf = Buffer.alloc(rows.length * comps * bytes);
    let o = 0;
    for (const row of rows) for (const v of (comps === 1 ? [row] : row)) {
      if (ctype === 5126) buf.writeFloatLE(v, o);
      else if (ctype === 5125) buf.writeUInt32LE(v, o);
      else buf.writeUInt16LE(v, o);
      o += bytes;
    }
    const byteOffset = binLen;
    chunks.push(buf); binLen += buf.length; pad4();
    const bvIdx = json.bufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length, ...(target ? { target } : {}) }) - 1;
    const acc = { bufferView: bvIdx, componentType: ctype, count: rows.length, type: comps === 1 ? "SCALAR" : comps === 2 ? "VEC2" : "VEC3" };
    if (comps === 3) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const r of rows) for (let k = 0; k < 3; k++) { if (r[k] < mn[k]) mn[k] = r[k]; if (r[k] > mx[k]) mx[k] = r[k]; }
      acc.min = mn; acc.max = mx;
    }
    return json.accessors.push(acc) - 1;
  };

  console.log(`=== 로컬 평면 클리핑 — y ≤ ${(Y * 1000).toFixed(1)}mm 만 남긴다 ===`);
  for (const name of names) {
    const ni = byName.get(name);
    if (ni === undefined || json.nodes[ni].mesh === undefined) {
      console.error(`✘ FAIL — 노드 "${name}" 또는 메시가 없다`);
      process.exit(1);
    }
    const prim = json.meshes[json.nodes[ni].mesh].primitives[0];
    const pos0 = readAcc(prim.attributes.POSITION);
    const uv0 = prim.attributes.TEXCOORD_0 !== undefined ? readAcc(prim.attributes.TEXCOORD_0) : null;
    const nrm0 = prim.attributes.NORMAL !== undefined ? readAcc(prim.attributes.NORMAL) : null;
    const idx0 = readAcc(prim.indices);
    const above = pos0.filter((p) => p[1] > Y).length;
    const yMax = Math.max(...pos0.map((p) => p[1])) * 1000;

    const c = clipBelowY(pos0, uv0, nrm0, idx0, Y);
    const cap = capBoundary(c.pos, c.uv, c.nrm, c.idx, Y);
    const f = compact(c.pos, c.uv, c.nrm, c.idx);

    prim.attributes.POSITION = addAcc(f.pos, 3, 5126, 34962);
    if (f.nrm) prim.attributes.NORMAL = addAcc(f.nrm, 3, 5126, 34962);
    if (f.uv) prim.attributes.TEXCOORD_0 = addAcc(f.uv, 2, 5126, 34962);
    prim.indices = addAcc(f.idx, 1, f.pos.length > 65535 ? 5125 : 5123, 34963);

    console.log(
      `  ${name.padEnd(8)} 정점 ${String(pos0.length).padStart(5)} → ${String(f.pos.length).padStart(5)}` +
      `   삼각형 ${String(idx0.length / 3).padStart(5)} → ${String(f.idx.length / 3).padStart(5)}` +
      `   잘린 정점 ${String(above).padStart(3)} (원래 y 최대 +${yMax.toFixed(1)}mm)` +
      `   버린 삼각형 ${c.dropped} · 걸친 삼각형 ${c.clipped} · 뚜껑 ${cap.loops}루프 ${cap.tris}삼각형`,
    );
  }
  const merged = Buffer.concat(chunks);
  json.buffers = [{ byteLength: merged.length }];
  const out = writeGlb(json, merged);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, out);
  console.log(`\n  ${inPath} (${src.length}B) → ${outPath} (${out.length}B)`);
  console.log("✔ 클리핑 완료 (노드·계층·머티리얼 불변).");
}

main();

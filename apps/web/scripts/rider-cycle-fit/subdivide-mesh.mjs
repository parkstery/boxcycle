#!/usr/bin/env node
/**
 * subdivide-mesh — 지정 노드 메시를 **Loop 세분화**해 삼각형을 잘게·둥글게 만든다 (F34).
 *
 * ── 왜 ─────────────────────────────────────────────────────────────────────
 * 사용자: *"갑옷처럼 투박한 엉덩이와 허벅지"*
 *
 * 실측 — 허벅지 삼각형이 몸통의 **3.2배**다:
 * ```
 *   torso   삼각형 3,794   삼각형당   427mm²   한 변 ≈ 31.4mm
 *   leg_l   삼각형   256   삼각형당 1,383mm²   한 변 ≈ 56.5mm  → 화면 약 14픽셀
 * ```
 * **14픽셀짜리 평면 조각이 이어진 것이 "갑옷"이다.** 원본 V2 가 반바지에 가려지는
 * 허벅지에 폴리곤을 아낀 저폴리 모델인데, 강체 분해로 노출되며 거칢이 드러났다.
 *
 * ── ⚠ 선형 세분화만 하면 각짐이 그대로다 ──────────────────────────────────
 * 삼각형을 4개로 쪼개기만 하면 실루엣이 그대로라 **하나도 안 매끄러워진다.**
 * **Loop 세분화**는 새 정점을 이웃 평균 쪽으로 당겨 실제로 곡면을 만든다:
 * ```
 *   edge 정점   3/8·(양끝) + 1/8·(양옆 대향점)
 *   기존 정점   (1−n·β)·자기 + β·Σ이웃      β = (1/n)(5/8 − (3/8 + 1/4·cos(2π/n))²)
 * ```
 * 경계 edge(구멍 테두리)는 `1/2·(양끝)`, 경계 정점은 `3/4·자기 + 1/8·(양 경계 이웃)`.
 *
 * UV·NORMAL 은 새 정점에서 **선형 보간**한다(팔레트는 텍셀 단색이라 문제없다).
 * NORMAL 은 세분화 후 **면 법선으로 재계산**해 매끄럽게 만든다.
 *
 * ⚠ 정점 수가 약 4배가 된다. **예산을 확인하고 대상을 좁혀라.**
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node subdivide-mesh.mjs <in.glb> <out.glb> --nodes leg_l,leg_r [--iters 1]
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function parseGlb(buf) {
  let off = 12;
  let json = null;
  let bin = Buffer.alloc(0);
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const d = buf.subarray(off + 8, off + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(d.toString("utf8").replace(/\0+$/, ""));
    else if (type === CHUNK_BIN) bin = d;
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
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(j.length, 0);
  jh.writeUInt32LE(CHUNK_JSON, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(b.length, 0);
  bh.writeUInt32LE(CHUNK_BIN, 4);
  const body = Buffer.concat([jh, j, bh, b]);
  const h = Buffer.alloc(12);
  h.writeUInt32LE(GLB_MAGIC, 0);
  h.writeUInt32LE(2, 4);
  h.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([h, body]);
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

/** `--colors` 로 좁힌 대상 팔레트 색 집합(없으면 노드 전체) */
let COLORS = null;

// ── 팔레트 색으로 영역을 고른다 (F34 §2-2) ────────────────────────────────
/** 최소 PNG 디코더 (8bit, non-interlaced) — 팔레트 아틀라스만 읽으면 된다 */
function decodePNG(png) {
  let p = 8, W = 0, H = 0, ct = 0;
  const idat = [];
  while (p < png.length) {
    const len = png.readUInt32BE(p);
    const ty = png.subarray(p + 4, p + 8).toString("ascii");
    const d = png.subarray(p + 8, p + 8 + len);
    if (ty === "IHDR") { W = d.readUInt32BE(0); H = d.readUInt32BE(4); ct = d[9]; }
    else if (ty === "IDAT") idat.push(d);
    else if (ty === "IEND") break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const stride = W * ch;
  const out = Buffer.alloc(H * stride);
  let ptr = 0;
  for (let y = 0; y < H; y++) {
    const f = raw[ptr++];
    const line = raw.subarray(ptr, ptr + stride);
    ptr += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[x] = v;
    }
  }
  return { W, H, ch, stride, data: out };
}

let _pal = null;
/** 삼각형 **무게중심 UV** 의 팔레트 색이 `colors` 에 있으면 선택 — 삼각형당 boolean */
function selectByColor(json, bin, prim, uv, idx, colors) {
  if (!_pal) {
    const im = json.images.findIndex((x) => /basecolor/i.test(x.name ?? ""));
    const bv = json.bufferViews[json.images[im].bufferView];
    _pal = decodePNG(bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength));
  }
  const hexAt = (u, v) => {
    const x = Math.min(_pal.W - 1, Math.max(0, Math.floor(u * _pal.W)));
    const y = Math.min(_pal.H - 1, Math.max(0, Math.floor(v * _pal.H)));
    const o = y * _pal.stride + x * _pal.ch;
    return [_pal.data[o], _pal.data[o + 1], _pal.data[o + 2]].map((c) => c.toString(16).padStart(2, "0")).join("");
  };
  const sel = [];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const cu = (uv[a][0] + uv[b][0] + uv[c][0]) / 3;
    const cv = (uv[a][1] + uv[b][1] + uv[c][1]) / 3;
    sel.push(colors.has(hexAt(cu, cv)));
  }
  return sel;
}

/**
 * Loop 세분화 1단계 — {pos, uv, idx} → 같은 형식.
 *
 * `sel`(삼각형당 boolean) 을 주면 **그 삼각형들만** 4분할한다(F34 §2-2 부분 세분화).
 * 부분 세분화의 함정은 **T-junction** — 쪼갠 쪽 모서리에 새 정점이 생기는데 이웃
 * 비대상 삼각형은 그대로라 렌더에서 실틈이 벌어진다. 두 겹으로 막는다:
 *   ① 선택 **경계** edge 는 Loop 가중치(3/8·1/8)를 쓰지 않고 **정확히 중점**으로 두고,
 *      그 양 끝점도 이동시키지 않는다 → 새 정점이 원래 선분 위에 정확히 놓인다
 *   ② 그래도 남는 T-vertex 는 이웃 비대상 삼각형을 **부채꼴 분할**해 없앤다
 *      (새 정점을 만들지 않으므로 정점 예산에 영향 없음)
 */
function loopSubdivide(pos, uv, idx, sel = null) {
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const nTri = idx.length / 3;
  const isSel = (t) => (sel ? sel[t] : true);
  // 1) edge → 인접 삼각형의 대향 정점 수집 (토폴로지는 **전체** 메시에서)
  const edgeOpp = new Map();
  const edgeSelCount = new Map(); // edge 를 공유하는 **대상** 삼각형 수
  const neigh = pos.map(() => new Set());
  /** 비대상 삼각형에 물린 정점 — 움직이면 이음매가 벌어진다 */
  const frozen = pos.map(() => false);
  for (let t = 0; t < nTri; t++) {
    const [a, b, c] = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]];
    if (!isSel(t)) for (const v of [a, b, c]) frozen[v] = true;
    for (const [u, v, w] of [[a, b, c], [b, c, a], [c, a, b]]) {
      const k = key(u, v);
      (edgeOpp.get(k) ?? edgeOpp.set(k, []).get(k)).push(w);
      if (isSel(t)) edgeSelCount.set(k, (edgeSelCount.get(k) ?? 0) + 1);
      neigh[u].add(v);
      neigh[v].add(u);
    }
  }
  // 2) 새 edge 정점 — **대상 삼각형의 edge 에만** 만든다
  const edgeMid = new Map();
  const newPos = pos.map((p) => [...p]);
  const newUv = uv ? uv.map((p) => [...p]) : null;
  for (const [k, opp] of edgeOpp) {
    const nSel = edgeSelCount.get(k) ?? 0;
    if (nSel === 0) continue; // 선택 밖 edge — 쪼개지 않는다
    const [a, b] = k.split("_").map(Number);
    // 양쪽 모두 대상이고 메시 내부일 때만 Loop 가중치. 그 외(선택 경계·메시 경계)는 중점
    const interior = opp.length >= 2 && nSel >= 2;
    const p = interior
      ? [0, 1, 2].map((i) => (3 / 8) * (pos[a][i] + pos[b][i]) + (1 / 8) * (pos[opp[0]][i] + pos[opp[1]][i]))
      : [0, 1, 2].map((i) => 0.5 * (pos[a][i] + pos[b][i]));
    const ni = newPos.push(p) - 1;
    if (newUv) newUv.push([0, 1].map((i) => 0.5 * (uv[a][i] + uv[b][i])));
    edgeMid.set(k, ni);
  }
  // 3) 기존 정점 이동 (메시 경계는 3/4 + 1/8·1/8, 선택 경계는 고정)
  const boundaryNbr = pos.map(() => []);
  for (const [k, opp] of edgeOpp) {
    if (opp.length >= 2) continue;
    const [a, b] = k.split("_").map(Number);
    boundaryNbr[a].push(b);
    boundaryNbr[b].push(a);
  }
  for (let v = 0; v < pos.length; v++) {
    if (frozen[v]) continue; // 선택 밖과 맞닿은 정점 — 건드리면 틈이 생긴다
    if (boundaryNbr[v].length >= 2) {
      const [p, q] = boundaryNbr[v];
      newPos[v] = [0, 1, 2].map((i) => 0.75 * pos[v][i] + 0.125 * (pos[p][i] + pos[q][i]));
      continue;
    }
    const nb = [...neigh[v]];
    const n = nb.length;
    if (n < 3) continue;
    const t = 3 / 8 + 0.25 * Math.cos((2 * Math.PI) / n);
    const beta = (1 / n) * (5 / 8 - t * t);
    const sum = [0, 0, 0];
    for (const u of nb) for (let i = 0; i < 3; i++) sum[i] += pos[u][i];
    newPos[v] = [0, 1, 2].map((i) => (1 - n * beta) * pos[v][i] + beta * sum[i]);
  }
  // 4) 대상은 4분할, 비대상은 물린 중점 수만큼 부채꼴 분할(T-junction 제거)
  const newIdx = [];
  let fanned = 0;
  for (let t = 0; t < nTri; t++) {
    const [a, b, c] = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]];
    const ab = edgeMid.get(key(a, b)), bc = edgeMid.get(key(b, c)), ca = edgeMid.get(key(c, a));
    if (isSel(t)) {
      newIdx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      continue;
    }
    const m = [ab, bc, ca].filter((x) => x !== undefined).length;
    if (m === 0) { newIdx.push(a, b, c); continue; }
    fanned++;
    if (m === 3) { newIdx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); continue; }
    if (m === 1) {
      // 중점 하나 → 2분할. 중점이 걸린 edge 의 대향 정점으로 잇는다
      if (ab !== undefined) newIdx.push(a, ab, c, ab, b, c);
      else if (bc !== undefined) newIdx.push(b, bc, a, bc, c, a);
      else newIdx.push(c, ca, b, ca, a, b);
      continue;
    }
    // m === 2 → 3분할. 중점이 **없는** edge 의 양끝을 기준으로 자른다
    if (ab === undefined) newIdx.push(c, ca, bc, ca, a, b, ca, b, bc);
    else if (bc === undefined) newIdx.push(a, ab, ca, ab, b, c, ab, c, ca);
    else newIdx.push(b, bc, ab, bc, c, a, bc, a, ab);
  }
  return { pos: newPos, uv: newUv, idx: newIdx, fanned, selTris: sel ? sel.filter(Boolean).length : nTri };
}

/** 면 법선 평균으로 정점 법선 재계산 — 이것이 "매끄럽게" 의 실체다 */
function recomputeNormals(pos, idx) {
  const n = pos.map(() => [0, 0, 0]);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const u = [0, 1, 2].map((i) => pos[b][i] - pos[a][i]);
    const v = [0, 1, 2].map((i) => pos[c][i] - pos[a][i]);
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const k of [a, b, c]) for (let i = 0; i < 3; i++) n[k][i] += f[i];
  }
  return n.map((v) => {
    const L = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / L, v[1] / L, v[2] / L];
  });
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  const names = (arg("nodes", "") || "").split(",").filter(Boolean);
  const iters = Number(arg("iters", "1"));
  const colorArg = arg("colors", "");
  COLORS = colorArg ? new Set(colorArg.split(",").map((s) => s.trim().replace(/^#/, "").toLowerCase())) : null;
  if (!inPath || !outPath || !names.length) {
    console.error("사용법: node subdivide-mesh.mjs <in.glb> <out.glb> --nodes leg_l,leg_r [--iters 1] [--colors 8c050a,...]");
    process.exit(2);
  }
  const src = fs.readFileSync(inPath);
  const { json, bin } = parseGlb(src);
  const byName = new Map();
  json.nodes.forEach((n, i) => n.name && byName.set(n.name, i));

  const readAcc = (i) => {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
    const comps = a.type === "VEC3" ? 3 : a.type === "VEC2" ? 2 : 1;
    const cs = a.componentType === 5126 ? 4 : a.componentType === 5125 ? 4 : 2;
    const st = bv.byteStride ?? comps * cs;
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out = [];
    for (let k = 0; k < a.count; k++) {
      const p = base + k * st;
      if (comps === 3) out.push([bin.readFloatLE(p), bin.readFloatLE(p + 4), bin.readFloatLE(p + 8)]);
      else if (comps === 2) out.push([bin.readFloatLE(p), bin.readFloatLE(p + 4)]);
      else out.push(a.componentType === 5123 ? bin.readUInt16LE(p) : bin.readUInt32LE(p));
    }
    return out;
  };

  const chunks = [bin];
  let binLen = bin.length;
  const pad4 = () => { const p = (4 - (binLen % 4)) % 4; if (p) { chunks.push(Buffer.alloc(p)); binLen += p; } };
  pad4();
  const addAcc = (rows, comps, ctype, target) => {
    const bytes = ctype === 5126 ? 4 : ctype === 5125 ? 4 : 2;
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

  const triStat = (pos, idx) => {
    let A = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const a = pos[idx[t]], b = pos[idx[t + 1]], c = pos[idx[t + 2]];
      const u = [0, 1, 2].map((i) => b[i] - a[i]), v = [0, 1, 2].map((i) => c[i] - a[i]);
      A += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    }
    const tris = idx.length / 3;
    const per = (A * 1e6) / tris;
    return { tris, per, side: Math.sqrt((per * 4) / Math.sqrt(3)) };
  };

  console.log(`=== Loop 세분화 ${iters}단계 (새 정점을 이웃 평균으로 당겨 실제로 둥글게) ===`);
  let addedVerts = 0;
  for (const name of names) {
    const ni = byName.get(name);
    if (ni === undefined || json.nodes[ni].mesh === undefined) {
      console.error(`✘ FAIL — 노드 "${name}" 또는 메시가 없다`);
      process.exit(1);
    }
    const prim = json.meshes[json.nodes[ni].mesh].primitives[0];
    let pos = readAcc(prim.attributes.POSITION);
    let uv = prim.attributes.TEXCOORD_0 !== undefined ? readAcc(prim.attributes.TEXCOORD_0) : null;
    let idx = readAcc(prim.indices);
    const before = triStat(pos, idx);
    const v0 = pos.length;
    let selInfo = "";
    for (let k = 0; k < iters; k++) {
      // 색 필터는 **원본 UV 기준 1회차에만** — 세분화 후에는 UV 보간으로 경계가 흐려진다
      const sel = k === 0 && COLORS ? selectByColor(json, bin, prim, uv, idx, COLORS) : null;
      const r = loopSubdivide(pos, uv, idx, sel);
      if (k === 0 && sel) {
        const b4 = triStat(pos, idx.filter((_, i) => sel[Math.floor(i / 3)]));
        selInfo = `   [영역 ${r.selTris}/${sel.length}삼각형 · 부채꼴보정 ${r.fanned}개 · 영역 한 변 ${b4.side.toFixed(1)}mm →`;
      }
      pos = r.pos; uv = r.uv; idx = r.idx;
    }
    const nrm = recomputeNormals(pos, idx);
    const after = triStat(pos, idx);
    if (selInfo && COLORS) {
      const selNow = selectByColor(json, bin, prim, uv, idx, COLORS);
      selInfo += ` ${triStat(pos, idx.filter((_, i) => selNow[Math.floor(i / 3)])).side.toFixed(1)}mm]`;
    }
    addedVerts += pos.length - v0;
    prim.attributes.POSITION = addAcc(pos, 3, 5126, 34962);
    prim.attributes.NORMAL = addAcc(nrm, 3, 5126, 34962);
    if (uv) prim.attributes.TEXCOORD_0 = addAcc(uv, 2, 5126, 34962);
    prim.indices = addAcc(idx, 1, pos.length > 65535 ? 5125 : 5123, 34963);
    console.log(
      `  ${name.padEnd(9)} 정점 ${String(v0).padStart(5)} → ${String(pos.length).padStart(6)}` +
        `   삼각형 ${String(before.tris).padStart(5)} → ${String(after.tris).padStart(6)}` +
        `   한 변 ${before.side.toFixed(1)}mm → **${after.side.toFixed(1)}mm**` +
        selInfo,
    );
  }

  const merged = Buffer.concat(chunks);
  json.buffers = [{ byteLength: merged.length }];
  const out = writeGlb(json, merged);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, out);
  console.log(`\n  정점 증가 +${addedVerts}   ${inPath} (${src.length}B) → ${outPath} (${out.length}B)`);
  console.log("✔ 세분화 완료 (노드·계층·머티리얼 불변).");
}

main();

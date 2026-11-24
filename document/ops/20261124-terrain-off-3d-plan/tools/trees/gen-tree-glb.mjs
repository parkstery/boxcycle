// 저용량 나무 GLB 생성(외부 자산 없음). 사용: node gen-tree-glb.mjs <출력 폴더>
// 단위 m, +Y 위(glTF). 면마다 법선을 따로 둔 로우폴리, 재질 2개(줄기·잎).
import fs from 'node:fs';
import path from 'node:path';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };

class Mesh {
  pos = []; nor = [];
  tri(a, b, c, smooth) {
    const n = norm(cross(sub(b, a), sub(c, a)));
    [a, b, c].forEach((p, i) => { this.pos.push(...p); this.nor.push(...(smooth ? smooth[i] : n)); });
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  get count() { return this.pos.length / 3; }
}

/** 위로 갈수록 가늘어지는 기둥. */
function trunk(m, from, to, r0, r1, sides = 6) {
  const ring = (p, r) => Array.from({ length: sides }, (_, i) => { const a = (i / sides) * Math.PI * 2; return [p[0] + Math.cos(a) * r, p[1], p[2] + Math.sin(a) * r]; });
  const A = ring(from, r0), B = ring(to, r1);
  for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; m.quad(A[j], A[i], B[i], B[j]); }
}

const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return { v, f };
})();
function subdivide({ v, f }) {
  const V = v.map((x) => [...x]), F = [], key = new Map();
  const mid = (a, b) => { const k = a < b ? `${a},${b}` : `${b},${a}`; if (!key.has(k)) { key.set(k, V.length); V.push(norm([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2])); } return key.get(k); };
  for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); F.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
  return { v: V, f: F };
}
const ICO1 = subdivide(ICO);

/** 잎 덩어리. rough=표면 들쭉날쭉, smooth=둥근 음영. */
function blob(m, c, rx, ry, rz, { seed = 1, rough = 0.12, smooth = false, fine = false } = {}) {
  const { v, f } = fine ? ICO1 : ICO, r = rng(seed);
  const P = v.map((p) => { const k = 1 + (r() - 0.5) * 2 * rough; return [c[0] + p[0] * rx * k, c[1] + p[1] * ry * k, c[2] + p[2] * rz * k]; });
  for (const t of f) m.tri(P[t[0]], P[t[1]], P[t[2]], smooth ? t.map((i) => v[i]) : null);
}
function cone(m, y0, y1, r, sides, seed, rough = 0.12) {
  const q = rng(seed); const base = Array.from({ length: sides }, (_, i) => { const a = (i / sides) * Math.PI * 2; const k = r * (1 + (q() - 0.5) * 2 * rough); return [Math.cos(a) * k, y0 + (q() - 0.5) * 0.3, Math.sin(a) * k]; });
  for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; m.tri(base[j], base[i], [0, y1, 0]); m.tri(base[i], base[j], [0, y0 + 0.25, 0]); }
}

export const SPECIES = {
  // A: 둥근 덩어리 — Mapbox 나무와 어울리는 부드러운 음영
  'round-broad': () => { const t = new Mesh(), l = new Mesh(); trunk(t, [0, 0, 0], [0, 4.2, 0], 0.24, 0.15); blob(l, [0, 5.9, 0], 2.7, 2.4, 2.7, { smooth: true, fine: true, rough: 0.05, seed: 3 }); blob(l, [1.2, 5.0, 0.6], 1.6, 1.4, 1.6, { smooth: true, rough: 0.05, seed: 5 }); blob(l, [-1.1, 5.2, -0.7], 1.7, 1.4, 1.6, { smooth: true, rough: 0.05, seed: 8 }); return { t, l, leaf: '#94c47c', bark: '#9c8875' }; },
  'round-tall': () => { const t = new Mesh(), l = new Mesh(); trunk(t, [0, 0, 0], [0, 3.6, 0], 0.2, 0.13); blob(l, [0, 6.4, 0], 1.7, 3.6, 1.7, { smooth: true, fine: true, rough: 0.05, seed: 11 }); return { t, l, leaf: '#a9c977', bark: '#8f7d6a' }; },
  'round-conifer': () => { const t = new Mesh(), l = new Mesh(); trunk(t, [0, 0, 0], [0, 2, 0], 0.2, 0.16); cone(l, 1.5, 6, 2.1, 10, 1, 0.04); cone(l, 4, 9, 1.5, 10, 2, 0.04); return { t, l, leaf: '#74a877', bark: '#7d6a58' }; },
  // B: 각진 로우폴리 — 면이 살아 있는 조형
  'facet-broad': () => { const t = new Mesh(), l = new Mesh(); trunk(t, [0, 0, 0], [0.1, 3.2, 0], 0.26, 0.17, 5); trunk(t, [0.1, 3.1, 0], [1.1, 4.7, 0.4], 0.14, 0.08, 4); trunk(t, [0.1, 3.1, 0], [-0.9, 4.8, -0.4], 0.14, 0.08, 4); blob(l, [0, 6.4, 0], 2.3, 1.9, 2.3, { rough: 0.2, seed: 21 }); blob(l, [1.5, 5.1, 0.6], 1.7, 1.3, 1.6, { rough: 0.2, seed: 22 }); blob(l, [-1.4, 5.3, -0.6], 1.7, 1.4, 1.6, { rough: 0.2, seed: 23 }); blob(l, [0.2, 5.0, -1.5], 1.4, 1.1, 1.3, { rough: 0.2, seed: 24 }); return { t, l, leaf: '#86b96f', bark: '#7c6754' }; },
  'facet-tall': () => { const t = new Mesh(), l = new Mesh(); trunk(t, [0, 0, 0], [0, 3.2, 0], 0.22, 0.15, 5); blob(l, [0, 4.8, 0], 1.6, 2.0, 1.6, { rough: 0.18, seed: 31 }); blob(l, [0.1, 7.2, 0.1], 1.4, 2.0, 1.4, { rough: 0.18, seed: 32 }); blob(l, [0, 9.2, 0], 0.9, 1.4, 0.9, { rough: 0.18, seed: 33 }); return { t, l, leaf: '#b5c66e', bark: '#82705c' }; },
  'facet-conifer': () => { const t = new Mesh(), l = new Mesh(); trunk(t, [0, 0, 0], [0, 2, 0], 0.22, 0.17, 5); cone(l, 1.3, 4.6, 2.4, 7, 41, 0.18); cone(l, 3.2, 7, 1.9, 7, 42, 0.18); cone(l, 5.4, 9.6, 1.3, 7, 43, 0.18); return { t, l, leaf: '#699c6d', bark: '#6f5c4b' }; },
  // 공용 관목
  shrub: () => { const t = new Mesh(), l = new Mesh(); trunk(t, [0, 0, 0], [0, 0.4, 0], 0.08, 0.06, 4); blob(l, [0, 0.65, 0], 0.8, 0.6, 0.75, { rough: 0.18, seed: 51 }); blob(l, [0.5, 0.5, 0.3], 0.5, 0.42, 0.5, { rough: 0.18, seed: 52 }); return { t, l, leaf: '#8dba76', bark: '#7c6754' }; },
};

const lin = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
export function writeGlb({ t, l, leaf, bark }) {
  const parts = [[t, bark], [l, leaf]], bufs = [], views = [], acc = [], prims = []; let off = 0;
  const push = (arr, Type = Float32Array, target = 34962) => {
    let b = Buffer.from(new Type(arr).buffer);
    const byteLength = b.length;
    b = Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
    views.push({ buffer: 0, byteOffset: off, byteLength, target });
    bufs.push(b); off += b.length;
    return views.length - 1;
  };
  parts.forEach(([m], i) => {
    const xs = [0, 1, 2].map((k) => m.pos.filter((_, j) => j % 3 === k));
    acc.push({ bufferView: push(m.pos), componentType: 5126, count: m.count, type: 'VEC3', min: xs.map((a) => Math.min(...a)), max: xs.map((a) => Math.max(...a)) });
    acc.push({ bufferView: push(m.nor), componentType: 5126, count: m.count, type: 'VEC3' });
    // Mapbox 모델 로더는 색인이 있어야 그린다.
    acc.push({ bufferView: push(Array.from({ length: m.count }, (_, k) => k), Uint16Array, 34963), componentType: 5123, count: m.count, type: 'SCALAR' });
    prims.push({ attributes: { POSITION: i * 3, NORMAL: i * 3 + 1 }, indices: i * 3 + 2, material: i, mode: 4 });
  });
  const json = { asset: { version: '2.0', generator: 'spinatlas-tree' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: prims }],
    materials: parts.map(([, c]) => ({ pbrMetallicRoughness: { baseColorFactor: [...lin(c), 1], metallicFactor: 0, roughnessFactor: 1 } })),
    accessors: acc, bufferViews: views, buffers: [{ byteLength: off }] };
  let j = Buffer.from(JSON.stringify(json)); j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(bufs), head = Buffer.alloc(12), h1 = Buffer.alloc(8), h2 = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + j.length + bin.length, 8);
  h1.writeUInt32LE(j.length, 0); h1.writeUInt32LE(0x4e4f534a, 4); h2.writeUInt32LE(bin.length, 0); h2.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, h1, j, h2, bin]);
}

if (process.argv[2]) {
  fs.mkdirSync(process.argv[2], { recursive: true });
  for (const [id, make] of Object.entries(SPECIES)) {
    const s = make(), glb = writeGlb(s);
    fs.writeFileSync(path.join(process.argv[2], `${id}.glb`), glb);
    console.log(id, (s.t.count + s.l.count) / 3, 'tri', glb.length, 'bytes');
  }
}

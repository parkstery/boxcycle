#!/usr/bin/env node
/**
 * add-joint-caps — 무릎·팔꿈치에 **관절 캡**(저폴리 타원체)을 붙인다 (F25).
 *
 * ── 왜 ─────────────────────────────────────────────────────────────────────
 * 사용자 지적(2026-08-03): *"무릎과 팔꿈치가 없는 것처럼 보인다."*
 *
 * V2 강체 분해는 **본체만 잘라 붙였고 관절 채움이 없다.** 옛 절차적 라이더는
 * 관절마다 구형 캡을 자식으로 달고 있었다(무릎 86mm · 팔꿈치 60mm).
 *
 * 제품 GLB 실측 — 관절 주변이 실제로 비어 있다:
 * ```
 * 무릎   허벅지 메시 끝 = 무릎에서 22.6mm 위 · 정강이 메시 시작 = 무릎에서 39.6mm 아래
 *        →  62.2mm 구간이 완전히 빈다
 * 팔꿈치 상완 끝 = 74.3mm 위 · 전완 시작 = 63.9mm 위  →  10.4mm 빈다
 * ```
 * 그래서 두 세그먼트가 각도로 만나 실루엣에 꺾인 자국만 남고 막대처럼 보인다.
 * 이것은 강체 분해 이음매(표면 연속성)와 **다른 문제** — 관절 부피 자체가 없다.
 *
 * ── 크기 산정 근거 (본체 단면 실측) ────────────────────────────────────────
 * ```
 * 무릎   허벅지 하단 반경 평균 46.9 / 정강이 상단 51.2  → 반경 [48, 48, 46]
 * 팔꿈치 상완 하단 40.3 / 전완 상단 41.0                → 반경 [26, 40, 46]
 *        ⚠ 팔 단면은 타원이다(x 폭 48 · z 폭 95). 구를 쓰면 앞뒤로 튀어나온다
 * ```
 * **캡이 살보다 크면 혹처럼 튀고 작으면 안 가려진다.** 렌더로 확인할 것.
 *
 * ── 어디에 붙이는가 ────────────────────────────────────────────────────────
 * `leg_*_shin` / `arm_*_fore` 노드의 **로컬 원점 (0,0,0) = 정확히 관절 위치**다.
 * 그 노드의 **자식**으로 붙이면 관절 회전을 그대로 따라간다.
 *
 * 색: 팔레트 머티리얼을 그대로 쓰고 UV 를 피부 텍셀 `(0.0625, 0.5)` = `#bc9179`
 * 한 점으로 찍는다(F20 remap 후 세트 0 기준). 무릎·팔꿈치 모두 맨살이다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node add-joint-caps.mjs <in.glb> <out.glb>
 *   캡 노드 이름은 `joint_cap_*` — 게이트가 본체 정점과 분리해 세는 근거다.
 */
import fs from "node:fs";
import path from "node:path";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** 피부 텍셀 — 팔레트 아틀라스(128×16)의 `#bc9179` */
const SKIN_UV = [0.0625, 0.5];
/** 저폴리 해상도 — 정점 예산을 크게 쓰지 않는다 */
const LON = 8;
const LAT = 6;

/** 붙일 곳: [부모 노드, 캡 이름, 반경(mm) x/y/z] */
const CAPS = [
  ["leg_l_shin", "joint_cap_knee_l", [48, 48, 46]],
  ["leg_r_shin", "joint_cap_knee_r", [48, 48, 46]],
  ["arm_l_fore", "joint_cap_elbow_l", [26, 40, 46]],
  ["arm_r_fore", "joint_cap_elbow_r", [26, 40, 46]],
];

function parseGlb(buf) {
  let off = 12;
  let json = null;
  let bin = Buffer.alloc(0);
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(data.toString("utf8").replace(/\0+$/, ""));
    else if (type === CHUNK_BIN) bin = data;
    off += 8 + len;
  }
  return { json, bin };
}

function writeGlb(json, bin) {
  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jp = (4 - (jsonBuf.length % 4)) % 4;
  if (jp) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jp, 0x20)]);
  const parts = [];
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(CHUNK_JSON, 4);
  parts.push(jh, jsonBuf);
  let b = bin;
  const bp = (4 - (b.length % 4)) % 4;
  if (bp) b = Buffer.concat([b, Buffer.alloc(bp)]);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(b.length, 0);
  bh.writeUInt32LE(CHUNK_BIN, 4);
  parts.push(bh, b);
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(12);
  h.writeUInt32LE(GLB_MAGIC, 0);
  h.writeUInt32LE(2, 4);
  h.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([h, body]);
}

/** 저폴리 타원체 — 반경 r(m, [x,y,z]) */
function buildEllipsoid(r) {
  const pos = [];
  const nrm = [];
  const uv = [];
  for (let i = 0; i <= LAT; i++) {
    const phi = (i / LAT) * Math.PI; // 0..π
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    for (let j = 0; j <= LON; j++) {
      const th = (j / LON) * Math.PI * 2;
      const n = [sp * Math.cos(th), cp, sp * Math.sin(th)];
      pos.push([n[0] * r[0], n[1] * r[1], n[2] * r[2]]);
      // 타원체 법선 = (nx/rx, ny/ry, nz/rz) 정규화
      const g = [n[0] / r[0], n[1] / r[1], n[2] / r[2]];
      const L = Math.hypot(g[0], g[1], g[2]) || 1;
      nrm.push([g[0] / L, g[1] / L, g[2] / L]);
      uv.push(SKIN_UV);
    }
  }
  const idx = [];
  const rowLen = LON + 1;
  for (let i = 0; i < LAT; i++) {
    for (let j = 0; j < LON; j++) {
      const a = i * rowLen + j;
      const b = a + rowLen;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { pos, nrm, uv, idx };
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error("사용법: node add-joint-caps.mjs <in.glb> <out.glb>");
    process.exit(2);
  }
  const src = fs.readFileSync(inPath);
  const { json, bin } = parseGlb(src);
  const byName = new Map();
  json.nodes.forEach((n, i) => n.name && byName.set(n.name, i));

  // 이미 붙어 있으면 중복 생성하지 않는다(재실행 안전)
  const existing = json.nodes.filter((n) => n.name?.startsWith("joint_cap_"));
  if (existing.length) {
    console.error(`✘ FAIL — 이미 관절 캡 ${existing.length}개가 있다. 원본 GLB 로 다시 실행하라`);
    process.exit(1);
  }
  // 팔레트 머티리얼(baseColorTexture 를 쓰는 것) 재사용
  const matIdx = (json.materials ?? []).findIndex((m) => m.pbrMetallicRoughness?.baseColorTexture);
  if (matIdx < 0) {
    console.error("✘ FAIL — 팔레트 머티리얼을 찾지 못했다");
    process.exit(1);
  }

  const chunks = [bin];
  let binLen = bin.length;
  const pad4 = () => {
    const p = (4 - (binLen % 4)) % 4;
    if (p) {
      chunks.push(Buffer.alloc(p));
      binLen += p;
    }
  };
  pad4();

  /** Float32 VEC3/VEC2 또는 Uint16 SCALAR 를 bin 에 넣고 accessor 인덱스 반환 */
  const addAccessor = (rows, comps, componentType, target) => {
    const bytes = componentType === 5126 ? 4 : 2;
    const buf = Buffer.alloc(rows.length * comps * bytes);
    let o = 0;
    for (const row of rows) {
      const vals = comps === 1 ? [row] : row;
      for (const v of vals) {
        if (componentType === 5126) buf.writeFloatLE(v, o);
        else buf.writeUInt16LE(v, o);
        o += bytes;
      }
    }
    const byteOffset = binLen;
    chunks.push(buf);
    binLen += buf.length;
    pad4();
    const bvIdx = json.bufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length, ...(target ? { target } : {}) }) - 1;
    const acc = {
      bufferView: bvIdx,
      componentType,
      count: rows.length,
      type: comps === 1 ? "SCALAR" : comps === 2 ? "VEC2" : "VEC3",
    };
    if (comps === 3) {
      const mn = [Infinity, Infinity, Infinity];
      const mx = [-Infinity, -Infinity, -Infinity];
      for (const row of rows)
        for (let k = 0; k < 3; k++) {
          if (row[k] < mn[k]) mn[k] = row[k];
          if (row[k] > mx[k]) mx[k] = row[k];
        }
      acc.min = mn;
      acc.max = mx;
    }
    return json.accessors.push(acc) - 1;
  };

  let capVerts = 0;
  console.log("=== 관절 캡 추가 (본체 메시·노드 불변) ===");
  for (const [parent, capName, rMm] of CAPS) {
    const pi = byName.get(parent);
    if (pi === undefined) {
      console.error(`✘ FAIL — 부모 노드 "${parent}" 없음`);
      process.exit(1);
    }
    const r = rMm.map((v) => v / 1000);
    const { pos, nrm, uv, idx } = buildEllipsoid(r);
    const mesh = {
      name: capName,
      primitives: [
        {
          attributes: {
            POSITION: addAccessor(pos, 3, 5126, 34962),
            NORMAL: addAccessor(nrm, 3, 5126, 34962),
            TEXCOORD_0: addAccessor(uv, 2, 5126, 34962),
          },
          indices: addAccessor(idx, 1, 5123, 34963),
          material: matIdx,
        },
      ],
    };
    const meshIdx = json.meshes.push(mesh) - 1;
    // 관절 위치 = 부모 노드의 로컬 원점. translation 없이 자식으로 붙인다.
    const nodeIdx = json.nodes.push({ name: capName, mesh: meshIdx }) - 1;
    json.nodes[pi].children = [...(json.nodes[pi].children ?? []), nodeIdx];
    capVerts += pos.length;
    console.log(
      `  ${capName.padEnd(20)} → ${parent.padEnd(11)} 자식   반경 [${rMm.join(", ")}]mm  정점 ${pos.length} · 삼각형 ${idx.length / 3}`,
    );
  }

  const merged = Buffer.concat(chunks);
  json.buffers = [{ byteLength: merged.length }];
  const out = writeGlb(json, merged);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, out);

  // 본체 / 캡 분리 집계 — 게이트가 같은 규약으로 센다
  const capMeshNames = new Set(CAPS.map(([, n]) => n));
  const paletteMats = new Set();
  json.materials.forEach((m, i) => {
    if (m.pbrMetallicRoughness?.baseColorTexture) paletteMats.add(i);
  });
  let body = 0;
  let caps = 0;
  json.meshes.forEach((m) =>
    m.primitives.forEach((p) => {
      if (!paletteMats.has(p.material)) return;
      const n = json.accessors[p.attributes.POSITION].count;
      if (capMeshNames.has(m.name)) caps += n;
      else body += n;
    }),
  );
  console.log(`\n  본체 정점 ${body} (불변이어야 한다) · 캡 정점 ${caps} · 합 ${body + caps}`);
  console.log(`${inPath} (${src.length}B) → ${outPath} (${out.length}B)`);
  if (caps !== capVerts) {
    console.error("✘ FAIL — 캡 정점 집계 불일치");
    process.exit(1);
  }
  console.log("✔ 캡 4개 추가 완료 (Blender·메시 재분해 없음).");
}

main();

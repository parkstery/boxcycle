#!/usr/bin/env node
/**
 * add-joint-caps-v2 — 관절 캡을 **세그먼트 끝마다** 단다 (F36).
 *
 * ── 왜 (사용자 원문 2026-08-08) ────────────────────────────────────────────
 * *"무릎 관절 부분과 팔꿈치 쪽은 **끊어진 것처럼** 보이고, 관절 형태도 사람의 관절
 * 같지 않은 **로봇처럼** 보인다."*
 *
 * F25 의 `add-joint-caps.mjs` 는 **관절 중심에 타원체 1개**를 자식 노드에만 달았다.
 * 현 제품 GLB 실측 — 그것으로는 못 메운다:
 * ```
 *   무릎 L  허벅지 끝 = 관절 +22.6mm · 정강이 시작 = 관절 −39.6mm  →  **공백 62.2mm**
 *   무릎 R  허벅지 끝 = 관절 −12.6mm · 정강이 시작 = 관절 −39.6mm  →  **공백 27.0mm**
 *   허벅지 끝 단면 x폭 5 · z폭 40mm   ↔   정강이 첫 링 x폭 107 · z폭 97mm
 * ```
 * **허벅지는 날처럼 납작하게 사라지고, 공 하나가 놓이고, 정강이가 갑자기 굵게 시작한다.**
 * 그것이 「로봇 관절」의 정체다 — 축 방향 공백만의 문제가 아니라 **굵기가 끊기는** 문제다.
 *
 * → **부모 끝 + 자식 끝 두 개**를 각각 그 지점의 세그먼트 굵기로 달아 겹치게 한다.
 *   부모 캡은 부모와 함께, 자식 캡은 자식과 함께 돈다 — 구부려도 이음매가 유지된다.
 *
 * ⚠ **캡이 사지보다 굵으면 혹이 된다.** 반경은 그 지점 세그먼트 단면에서 재고,
 *   **픽셀로 실루엣 폭을 확인**하라(`segment-penetration.mjs` 와 같은 규약).
 *
 * ⚠ **`ankle_*` 캡은 건드리지 않는다** — F31~F33 확정값(접지)에 얽혀 있다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node add-joint-caps-v2.mjs <in.glb> <out.glb> [--joints knee_l,knee_r,elbow_l,elbow_r]
 *   (기본 = 4관절 전부. `--joints knee_l` 로 한 관절만 시험할 수 있다)
 */
import fs from "node:fs";
import path from "node:path";

const GLB_MAGIC = 0x46546c67, CHUNK_JSON = 0x4e4f534a, CHUNK_BIN = 0x004e4942;
/** 피부 텍셀 — 팔레트 아틀라스의 `#bc9179` (F20 remap 후 세트 0 기준) */
const SKIN_UV = [0.0625, 0.5];
const LON = 10, LAT = 7;

/**
 * 관절별 캡 2개.
 *   parent = [노드, 로컬 y(mm), 반경 x/y/z(mm)]   자식 = 같은 형식(자식 로컬 기준)
 * 반경은 **현 제품 GLB 단면 실측**에서 왔다(§ 머리말). y반경은 두 캡이 겹치도록 잡는다.
 */
export const JOINTS = {
  knee_l: {
    parent: ["leg_l", -356, [35, 40, 50]],       // 허벅지 끝(y −355.8) — 끝이 날처럼 얇아 knee 실굵기로 채운다
    child: ["leg_l_shin", -40, [53, 40, 48]],    // 정강이 첫 링(y −39.6) x폭107/z폭97 → r 53/48
  },
  knee_r: {
    parent: ["leg_r", -391, [35, 40, 50]],       // leg_r 은 메시가 35mm 더 내려온다(좌우 비대칭, HANDOFF)
    child: ["leg_r_shin", -40, [53, 40, 48]],
  },
  elbow_l: {
    parent: ["arm_l", -275, [28, 35, 48]],
    child: ["arm_l_fore", 40, [28, 35, 48]],
  },
  elbow_r: {
    parent: ["arm_r", -275, [28, 35, 48]],
    child: ["arm_r_fore", 40, [28, 35, 48]],
  },
};

function parseGlb(buf) {
  let off = 12, json = null, bin = Buffer.alloc(0);
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
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
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.writeUInt32LE(CHUNK_JSON, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(b.length, 0); bh.writeUInt32LE(CHUNK_BIN, 4);
  const body = Buffer.concat([jh, j, bh, b]);
  const h = Buffer.alloc(12);
  h.writeUInt32LE(GLB_MAGIC, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([h, body]);
}
function buildEllipsoid(r) {
  const pos = [], nrm = [], uv = [];
  for (let i = 0; i <= LAT; i++) {
    const phi = (i / LAT) * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi);
    for (let j = 0; j <= LON; j++) {
      const th = (j / LON) * Math.PI * 2;
      const n = [sp * Math.cos(th), cp, sp * Math.sin(th)];
      pos.push([n[0] * r[0], n[1] * r[1], n[2] * r[2]]);
      const g = [n[0] / r[0], n[1] / r[1], n[2] / r[2]];
      const L = Math.hypot(g[0], g[1], g[2]) || 1;
      nrm.push([g[0] / L, g[1] / L, g[2] / L]);
      uv.push(SKIN_UV);
    }
  }
  const idx = [], rowLen = LON + 1;
  for (let i = 0; i < LAT; i++)
    for (let j = 0; j < LON; j++) {
      const a = i * rowLen + j, b = a + rowLen;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  return { pos, nrm, uv, idx };
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  const ji = process.argv.indexOf("--joints");
  const want = ji >= 0 ? process.argv[ji + 1].split(",") : Object.keys(JOINTS);
  if (!inPath || !outPath) {
    console.error("사용법: node add-joint-caps-v2.mjs <in.glb> <out.glb> [--joints knee_l,...]");
    process.exit(2);
  }
  const src = fs.readFileSync(inPath);
  const { json, bin } = parseGlb(src);
  const byName = new Map();
  json.nodes.forEach((n, i) => n.name && byName.set(n.name, i));
  const matIdx = (json.materials ?? []).findIndex((m) => m.pbrMetallicRoughness?.baseColorTexture);
  if (matIdx < 0) { console.error("✘ FAIL — 팔레트 머티리얼 없음"); process.exit(1); }

  const chunks = [bin];
  let binLen = bin.length;
  const pad4 = () => { const p = (4 - (binLen % 4)) % 4; if (p) { chunks.push(Buffer.alloc(p)); binLen += p; } };
  pad4();
  const addAcc = (rows, comps, ctype, target) => {
    const bytes = ctype === 5126 ? 4 : 2;
    const buf = Buffer.alloc(rows.length * comps * bytes);
    let o = 0;
    for (const row of rows) for (const v of (comps === 1 ? [row] : row)) {
      if (ctype === 5126) buf.writeFloatLE(v, o); else buf.writeUInt16LE(v, o);
      o += bytes;
    }
    const byteOffset = binLen;
    chunks.push(buf); binLen += buf.length; pad4();
    const bv = json.bufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length, ...(target ? { target } : {}) }) - 1;
    const acc = { bufferView: bv, componentType: ctype, count: rows.length, type: comps === 1 ? "SCALAR" : comps === 2 ? "VEC2" : "VEC3" };
    if (comps === 3) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const r of rows) for (let k = 0; k < 3; k++) { if (r[k] < mn[k]) mn[k] = r[k]; if (r[k] > mx[k]) mx[k] = r[k]; }
      acc.min = mn; acc.max = mx;
    }
    return json.accessors.push(acc) - 1;
  };

  /** 옛 중심 캡 제거 — 같은 관절에 두 세대가 겹치면 혹이 된다 */
  const OLD = { knee_l: "joint_cap_knee_l", knee_r: "joint_cap_knee_r", elbow_l: "joint_cap_elbow_l", elbow_r: "joint_cap_elbow_r" };
  let removed = 0;
  for (const j of want) {
    const nm = OLD[j];
    const ni = byName.get(nm);
    if (ni === undefined) continue;
    // 노드를 지우면 인덱스가 밀린다 → 메시만 떼어 «빈 노드»로 만든다(인덱스 안정)
    delete json.nodes[ni].mesh;
    json.nodes[ni].name = `${nm}_removed`;
    removed++;
  }

  console.log(`=== 관절 캡 v2 — 세그먼트 끝마다 (대상 ${want.join(", ")}) ===`);
  if (removed) console.log(`  옛 중심 캡 ${removed}개 제거`);
  let added = 0, capVerts = 0;
  for (const j of want) {
    const spec = JOINTS[j];
    if (!spec) { console.error(`✘ FAIL — 알 수 없는 관절 "${j}"`); process.exit(1); }
    for (const side of ["parent", "child"]) {
      const [node, yMm, rMm] = spec[side];
      const pi = byName.get(node);
      if (pi === undefined) { console.error(`✘ FAIL — 노드 "${node}" 없음`); process.exit(1); }
      const { pos, nrm, uv, idx } = buildEllipsoid(rMm.map((v) => v / 1000));
      const name = `joint_cap2_${j}_${side}`;
      const mesh = {
        name,
        primitives: [{
          attributes: { POSITION: addAcc(pos, 3, 5126, 34962), NORMAL: addAcc(nrm, 3, 5126, 34962), TEXCOORD_0: addAcc(uv, 2, 5126, 34962) },
          indices: addAcc(idx, 1, 5123, 34963),
          material: matIdx,
        }],
      };
      const meshIdx = json.meshes.push(mesh) - 1;
      const nodeIdx = json.nodes.push({ name, mesh: meshIdx, translation: [0, yMm / 1000, 0] }) - 1;
      json.nodes[pi].children = [...(json.nodes[pi].children ?? []), nodeIdx];
      capVerts += pos.length;
      added++;
      console.log(`  ${name.padEnd(28)} → ${node.padEnd(11)} y ${String(yMm).padStart(5)}mm  반경 [${rMm.join(", ")}]mm  정점 ${pos.length}`);
    }
  }
  const merged = Buffer.concat(chunks);
  json.buffers = [{ byteLength: merged.length }];
  const out = writeGlb(json, merged);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, out);
  console.log(`\n  캡 ${added}개 · 정점 +${capVerts}   ${inPath} (${src.length}B) → ${outPath} (${out.length}B)`);
  console.log("✔ 완료 (본체 메시·노드 계약 불변).");
}

main();

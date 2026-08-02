#!/usr/bin/env node
/**
 * merge-rider-into-cycle — 라이더 9노드를 **새로 구운 자전거 GLB** 에 이식한다 (F23).
 *
 * ── 왜 ─────────────────────────────────────────────────────────────────────
 * 제품 GLB 는 **자전거 + 라이더가 한 파일**이다. `geometry.json` 이 바뀌면
 * (F23: `saddleHeight`) 자전거를 다시 구워야 하는데, 그러면 라이더가 딸려오지 않는다.
 * V2 라이더는 Blender 강체 분해 산출물이라 생성기가 만들어내지 못한다.
 *
 * 그래서 **자전거만 다시 굽고**(`RTW_RIDER=0`), 기존 GLB 에서 라이더 노드 서브트리를
 * 리소스째 옮겨 붙인다. **정점을 다시 굽지 않는다** — 바이너리를 그대로 복사한다.
 *
 * ── 무엇을 하는가 ──────────────────────────────────────────────────────────
 * rider GLB 에서 아래를 cycle GLB 로 append 하며 인덱스를 재매핑한다:
 *   노드 9개(루트 5 + 자식 4) · 그 메시 · accessor · bufferView · 머티리얼 · 텍스처 ·
 *   이미지 · 샘플러. bin 청크는 두 버퍼를 이어 붙이고 `byteOffset` 을 shift 한다.
 *
 * - 라이더 루트 5개를 cycle 의 **scene root(`RiderBike`)** 자식으로 넣는다
 * - `crank` 는 **cycle 쪽 것을 쓴다**(자전거 생성기 산출). rider 쪽 crank 는 가져오지 않는다
 * - 노드 이름·translation·계층을 그대로 보존한다 → 앱 계약(노드 10개)이 유지된다
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node merge-rider-into-cycle.mjs <cycle.glb> <rider.glb> <out.glb>
 */
import fs from "node:fs";
import path from "node:path";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** 옮길 라이더 노드 — 루트 5개(자식은 계층 따라 자동) */
const RIDER_ROOTS = ["torso", "leg_l", "leg_r", "arm_l", "arm_r"];

function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error("GLB magic 불일치");
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

function main() {
  const [cyclePath, riderPath, outPath] = process.argv.slice(2);
  if (!cyclePath || !riderPath || !outPath) {
    console.error("사용법: node merge-rider-into-cycle.mjs <cycle.glb> <rider.glb> <out.glb>");
    process.exit(2);
  }
  const cSrc = fs.readFileSync(cyclePath);
  const rSrc = fs.readFileSync(riderPath);
  const C = parseGlb(cSrc);
  const R = parseGlb(riderPath === cyclePath ? cSrc : rSrc);

  const cj = C.json;
  const rj = R.json;
  // rider bin 은 **참조되는 bufferView 만** 새로 복사한다.
  // 통째로 이어붙이면 rider GLB 안의 자전거 데이터까지 딸려와 파일이 2배가 된다.
  const pad = (4 - (C.bin.length % 4)) % 4;
  const binChunks = [C.bin, Buffer.alloc(pad)];
  let binLen = C.bin.length + pad;
  /** rider bufferView 데이터를 새 bin 에 복사하고 새 byteOffset 을 돌려준다 */
  const copyBufferViewData = (i) => {
    const bv = rj.bufferViews[i];
    const start = bv.byteOffset ?? 0;
    const slice = R.bin.subarray(start, start + bv.byteLength);
    const at = binLen;
    binChunks.push(slice);
    binLen += slice.length;
    const p = (4 - (binLen % 4)) % 4;
    if (p) {
      binChunks.push(Buffer.alloc(p));
      binLen += p;
    }
    return at;
  };

  cj.bufferViews ??= [];
  cj.accessors ??= [];
  cj.meshes ??= [];
  cj.materials ??= [];
  cj.textures ??= [];
  cj.images ??= [];
  cj.samplers ??= [];

  // ── 라이더 노드 수집(루트 + 자손) ──────────────────────────────────────
  const rByName = new Map();
  rj.nodes.forEach((n, i) => n.name && rByName.set(n.name, i));
  const missing = RIDER_ROOTS.filter((n) => !rByName.has(n));
  if (missing.length) {
    console.error(`✘ FAIL — rider GLB 에 노드 없음: ${missing.join(", ")}`);
    process.exit(1);
  }
  const wanted = [];
  const visit = (i) => {
    wanted.push(i);
    for (const c of rj.nodes[i].children ?? []) visit(c);
  };
  RIDER_ROOTS.forEach((n) => visit(rByName.get(n)));

  // ── 리소스 재매핑 (필요한 것만 append) ────────────────────────────────
  const bvMap = new Map();
  const accMap = new Map();
  const meshMap = new Map();
  const matMap = new Map();
  const texMap = new Map();
  const imgMap = new Map();
  const smpMap = new Map();

  const addBufferView = (i) => {
    if (bvMap.has(i)) return bvMap.get(i);
    const bv = { ...rj.bufferViews[i], buffer: 0, byteOffset: copyBufferViewData(i) };
    const ni = cj.bufferViews.push(bv) - 1;
    bvMap.set(i, ni);
    return ni;
  };
  const addAccessor = (i) => {
    if (accMap.has(i)) return accMap.get(i);
    const a = { ...rj.accessors[i] };
    if (a.bufferView !== undefined) a.bufferView = addBufferView(a.bufferView);
    const ni = cj.accessors.push(a) - 1;
    accMap.set(i, ni);
    return ni;
  };
  const addSampler = (i) => {
    if (i === undefined) return undefined;
    if (smpMap.has(i)) return smpMap.get(i);
    const ni = cj.samplers.push({ ...rj.samplers[i] }) - 1;
    smpMap.set(i, ni);
    return ni;
  };
  const addImage = (i) => {
    if (imgMap.has(i)) return imgMap.get(i);
    const im = { ...rj.images[i] };
    if (im.bufferView !== undefined) im.bufferView = addBufferView(im.bufferView);
    const ni = cj.images.push(im) - 1;
    imgMap.set(i, ni);
    return ni;
  };
  const addTexture = (i) => {
    if (texMap.has(i)) return texMap.get(i);
    const t = { ...rj.textures[i] };
    if (t.source !== undefined) t.source = addImage(t.source);
    if (t.sampler !== undefined) t.sampler = addSampler(t.sampler);
    const ni = cj.textures.push(t) - 1;
    texMap.set(i, ni);
    return ni;
  };
  const remapTexRef = (ref) => (ref ? { ...ref, index: addTexture(ref.index) } : ref);
  const addMaterial = (i) => {
    if (matMap.has(i)) return matMap.get(i);
    const m = JSON.parse(JSON.stringify(rj.materials[i]));
    const p = m.pbrMetallicRoughness;
    if (p) {
      if (p.baseColorTexture) p.baseColorTexture = remapTexRef(p.baseColorTexture);
      if (p.metallicRoughnessTexture) p.metallicRoughnessTexture = remapTexRef(p.metallicRoughnessTexture);
    }
    for (const k of ["normalTexture", "occlusionTexture", "emissiveTexture"]) if (m[k]) m[k] = remapTexRef(m[k]);
    const ni = cj.materials.push(m) - 1;
    matMap.set(i, ni);
    return ni;
  };
  const addMesh = (i) => {
    if (meshMap.has(i)) return meshMap.get(i);
    const src = rj.meshes[i];
    const mesh = {
      name: src.name,
      primitives: src.primitives.map((p) => {
        const np = { ...p, attributes: {} };
        for (const [k, v] of Object.entries(p.attributes)) np.attributes[k] = addAccessor(v);
        if (p.indices !== undefined) np.indices = addAccessor(p.indices);
        if (p.material !== undefined) np.material = addMaterial(p.material);
        return np;
      }),
    };
    const ni = cj.meshes.push(mesh) - 1;
    meshMap.set(i, ni);
    return ni;
  };

  // ── 노드 append (계층 재구성) ─────────────────────────────────────────
  const nodeMap = new Map();
  for (const i of wanted) nodeMap.set(i, cj.nodes.length + wanted.indexOf(i));
  for (const i of wanted) {
    const src = rj.nodes[i];
    const n = { name: src.name };
    if (src.translation) n.translation = [...src.translation];
    if (src.rotation) n.rotation = [...src.rotation];
    if (src.scale) n.scale = [...src.scale];
    if (src.matrix) n.matrix = [...src.matrix];
    if (src.mesh !== undefined) n.mesh = addMesh(src.mesh);
    if (src.children) n.children = src.children.map((c) => nodeMap.get(c));
    cj.nodes.push(n);
  }

  // scene root 에 라이더 루트를 자식으로
  const rootIdx = cj.scenes[cj.scene ?? 0].nodes[0];
  const root = cj.nodes[rootIdx];
  root.children ??= [];
  for (const name of RIDER_ROOTS) root.children.push(nodeMap.get(rByName.get(name)));

  // buffer 길이 갱신 (참조된 bufferView 만 담긴 새 bin)
  const mergedBin = Buffer.concat(binChunks);
  cj.buffers = [{ byteLength: mergedBin.length }];

  const out = writeGlb(cj, mergedBin);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, out);

  // ── 검증 ──────────────────────────────────────────────────────────────
  const contract = ["crank", "torso", "leg_l", "leg_l_shin", "leg_r", "leg_r_shin", "arm_l", "arm_l_fore", "arm_r", "arm_r_fore"];
  const have = contract.filter((n) => cj.nodes.some((x) => x.name === n));
  let riderVerts = 0;
  const paletteMats = new Set();
  cj.materials.forEach((m, i) => {
    if (m.pbrMetallicRoughness?.baseColorTexture) paletteMats.add(i);
  });
  cj.meshes.forEach((m) =>
    m.primitives.forEach((p) => {
      if (paletteMats.has(p.material)) riderVerts += cj.accessors[p.attributes.POSITION].count;
    }),
  );
  console.log(`=== 병합 ===`);
  console.log(`  cycle  ${cyclePath} (${cSrc.length}B)`);
  console.log(`  rider  ${riderPath} (${rSrc.length}B)  ← 노드 ${wanted.length}개 이식`);
  console.log(`  out    ${outPath} (${out.length}B)`);
  console.log(`  앱 계약 노드 ${have.length}/10 : ${have.join(" ")}`);
  console.log(`  라이더 정점 ${riderVerts} · 전체 노드 ${cj.nodes.length} · 머티리얼 ${cj.materials.length} · 이미지 ${cj.images.length}`);
  if (have.length !== 10) {
    console.error(`✘ FAIL — 앱 계약 노드 누락: ${contract.filter((n) => !have.includes(n)).join(", ")}`);
    process.exit(1);
  }
  console.log("✔ 병합 완료 (정점 재굽기 없음 — 바이너리 그대로 복사).");
}

main();

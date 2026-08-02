#!/usr/bin/env node
/**
 * remap-palette-uv — 팔레트 머티리얼의 UV 세트를 TEXCOORD_1 → TEXCOORD_0 으로 재지정한다 (F20).
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────────────
 * V2 라이더 GLB 는 팔레트 아틀라스를 **UV 세트 1**(`TEXCOORD_1`)에 굽고, 머티리얼도
 * `baseColorTexture.texCoord = 1` 로 정직하게 선언한다. Blender 는 이 선언을 지키므로
 * 프리뷰가 정상이었다.
 *
 * 그러나 **mapbox-gl 3.23.1 은 `TEXCOORD_0` 만 읽는다**(번들 실측: `TEXCOORD_0` 참조 2건,
 * `TEXCOORD_1` 참조 0건 — glTF material 의 `texCoord` 지정을 무시한다).
 * 그 결과 앱은 팔레트용이 아닌 세트 0 을 읽었고, 라이더 메시 대부분이 세트 0 에서
 * UV(0,1) 한 점에 몰려 있어 그 텍셀 색 `#bc9179`(피부색) 단색으로 보였다.
 *   leg_l·leg_r 141정점 **전부** · torso 2,899 중 1,420 · arm_l 166 중 90.
 *
 * ── 무엇을 하는가 ──────────────────────────────────────────────────────────
 * **accessor 인덱스만 재지정한다. 버퍼를 다시 쓰지 않는다.**
 * 따라서 정점 수·좌표·노멀·파일 내 바이너리는 전혀 변하지 않는다. Blender 도 필요 없다.
 *
 *   attributes.TEXCOORD_0 ← attributes.TEXCOORD_1   (인덱스 재지정)
 *   attributes.TEXCOORD_1 삭제
 *   material.pbrMetallicRoughness.{baseColor,metallicRoughness}Texture.texCoord → 0
 *
 * 원래 세트 0 accessor 는 참조되지 않은 채 남는다(버퍼 불변 원칙). 이는 의도된 것이다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node apps/web/scripts/rider-cycle-fit/remap-palette-uv.mjs <in.glb> <out.glb>
 *
 * GLB 를 다시 구울 때마다 이 후처리를 반드시 다시 통과시켜라 — 재굽기 산출물은
 * 항상 `texCoord: 1` 상태로 나온다.
 */
import fs from "node:fs";
import path from "node:path";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** GLB → { json, bin } */
function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error("GLB magic 불일치 — glTF-binary 가 아니다");
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(data.toString("utf8").replace(/\0+$/, ""));
    else if (type === CHUNK_BIN) bin = data;
    off += 8 + len;
  }
  if (!json) throw new Error("JSON chunk 없음");
  return { json, bin };
}

/** { json, bin } → GLB */
function writeGlb(json, bin) {
  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]); // space
  const chunks = [];
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);
  chunks.push(jsonHeader, jsonBuf);
  if (bin) {
    let binBuf = bin;
    const binPad = (4 - (binBuf.length % 4)) % 4;
    if (binPad) binBuf = Buffer.concat([binBuf, Buffer.alloc(binPad, 0)]);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binBuf.length, 0);
    binHeader.writeUInt32LE(CHUNK_BIN, 4);
    chunks.push(binHeader, binBuf);
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([header, body]);
}

/** accessor 의 VEC2 float UV 를 읽어 고유 텍셀 분포를 센다(검증 로그용). */
function uvHistogram(json, bin, accessorIdx) {
  const a = json.accessors[accessorIdx];
  const bv = json.bufferViews[a.bufferView];
  const stride = bv.byteStride ?? 8;
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const hist = new Map();
  for (let i = 0; i < a.count; i++) {
    const o = base + i * stride;
    const key = `${bin.readFloatLE(o).toFixed(6)},${bin.readFloatLE(o + 4).toFixed(6)}`;
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
  return hist;
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error("사용법: node remap-palette-uv.mjs <in.glb> <out.glb>");
    process.exit(2);
  }
  const buf = fs.readFileSync(inPath);
  const { json, bin } = parseGlb(buf);

  // 1) 팔레트 머티리얼 = 텍스처를 쓰면서 texCoord 가 0 이 아닌 것.
  const paletteMats = new Set();
  (json.materials ?? []).forEach((m, i) => {
    const p = m.pbrMetallicRoughness ?? {};
    for (const t of [p.baseColorTexture, p.metallicRoughnessTexture, m.normalTexture, m.occlusionTexture, m.emissiveTexture]) {
      if (t && (t.texCoord ?? 0) !== 0) paletteMats.add(i);
    }
  });
  if (paletteMats.size === 0) {
    console.log("ⓘ texCoord≠0 인 머티리얼이 없다 — 이미 세트 0 을 쓰고 있다. 변경 없음.");
    fs.copyFileSync(inPath, outPath);
    return;
  }
  console.log(`대상 머티리얼: ${[...paletteMats].map((i) => `[${i}] ${json.materials[i].name}`).join(", ")}`);

  // 2) primitive 별 UV 세트 재지정
  const before = [];
  const after = [];
  let remapped = 0;
  const failures = [];
  (json.meshes ?? []).forEach((mesh, mi) => {
    mesh.primitives.forEach((pr, pi) => {
      if (!paletteMats.has(pr.material)) return;
      const label = `mesh[${mi}] "${mesh.name}" prim[${pi}]`;
      const t0 = pr.attributes.TEXCOORD_0;
      const t1 = pr.attributes.TEXCOORD_1;
      if (t1 === undefined) {
        // 세트 1 이 없는데 머티리얼이 texCoord:1 → 데이터가 애초에 어긋나 있다. 조용히 넘기지 않는다.
        failures.push(`${label}: TEXCOORD_1 이 없다 (attrs=${Object.keys(pr.attributes).join(",")})`);
        return;
      }
      before.push({ label, hist: uvHistogram(json, bin, t0), accessor: t0 });
      pr.attributes.TEXCOORD_0 = t1;
      delete pr.attributes.TEXCOORD_1;
      after.push({ label, hist: uvHistogram(json, bin, t1), accessor: t1 });
      remapped += 1;
    });
  });
  if (failures.length) {
    console.error("✘ FAIL — 재지정 불가한 primitive:");
    failures.forEach((f) => console.error("   " + f));
    process.exit(1);
  }

  // 3) 머티리얼 texCoord → 0
  for (const mi of paletteMats) {
    const m = json.materials[mi];
    const p = m.pbrMetallicRoughness ?? {};
    for (const t of [p.baseColorTexture, p.metallicRoughnessTexture, m.normalTexture, m.occlusionTexture, m.emissiveTexture]) {
      if (t && t.texCoord !== undefined) t.texCoord = 0;
    }
  }

  // 4) 검증 로그 — 세트 0 의 고유 텍셀 분포가 실제로 늘어났는가
  // 판정 기준: **교체 후 UV(0,1) 을 가리키지 않을 것.**
  // ⚠ "고유 텍셀 ≥ 2" 를 기준으로 삼으면 안 된다 — 정강이·신발처럼 **한 색으로 칠해진
  //   파트는 텍셀 1개가 정상**이다(F26 에서 발이 분리되며 정강이가 맨살 단색이 됐다).
  //   원래 잡으려던 결함은 "팔레트가 아닌 세트 0 의 (0,1) 한 점에 전부 몰림"이다.
  const BAD_UV = "0.000000,1.000000";
  console.log("\n=== TEXCOORD_0 고유 텍셀 분포 (교체 전 → 교체 후) ===");
  let degenerate = 0;
  before.forEach((b, i) => {
    const a = after[i];
    const topB = [...b.hist.entries()].sort((x, y) => y[1] - x[1])[0];
    const topA = [...a.hist.entries()].sort((x, y) => y[1] - x[1])[0];
    const n = [...b.hist.values()].reduce((s, v) => s + v, 0);
    if (a.hist.has(BAD_UV)) degenerate += 1;
    console.log(
      `  ${b.label.padEnd(46)} unique ${String(b.hist.size).padStart(4)} → ${String(a.hist.size).padStart(3)}` +
        `   최다 (${topB[0]})×${topB[1]}/${n} → (${topA[0]})×${topA[1]}/${n}`,
    );
  });

  const outBuf = writeGlb(json, bin);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, outBuf);

  // 5) 무결성: 정점 수가 변하지 않았는가 (버퍼 불변 원칙의 최소 확인)
  //    ⚠ 두 수를 구분한다 — 합격 기준의 "5,521"은 **팔레트(라이더) 대상만**이고,
  //      GLB 전체 정점에는 자전거 메시가 함께 들어 있다.
  let targetVerts = 0;
  let totalVerts = 0;
  (json.meshes ?? []).forEach((m) =>
    m.primitives.forEach((p) => {
      const n = json.accessors[p.attributes.POSITION].count;
      totalVerts += n;
      if (paletteMats.has(p.material)) targetVerts += n;
    }),
  );
  console.log(
    `\n재지정 primitive ${remapped}개 · 팔레트(라이더) 정점 ${targetVerts} · GLB 전체 정점 ${totalVerts}` +
      `\n${inPath} (${buf.length}B) → ${outPath} (${outBuf.length}B)`,
  );
  if (degenerate > 0) {
    console.error(`✘ FAIL — 교체 후에도 UV(0,1)(팔레트 밖 한 점)을 가리키는 primitive 가 ${degenerate}개 있다.`);
    process.exit(1);
  }
  console.log("✔ 모든 대상 primitive 가 팔레트 텍셀을 가리킨다(UV(0,1) 잔존 없음).");
}

main();

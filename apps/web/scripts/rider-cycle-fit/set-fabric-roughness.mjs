#!/usr/bin/env node
/**
 * set-fabric-roughness — 팔레트의 **패브릭 텍셀만** roughness 를 올린다 (F34).
 *
 * ── 왜 ─────────────────────────────────────────────────────────────────────
 * 사용자: *"갑옷처럼 투박한 형태로 나타나는 엉덩이와 허벅지"*
 *
 * 실측 roughness — 실제 사이클 의류(무광 저지·패드 팬츠)는 0.80~0.95 다:
 * ```
 *   팬츠 0.380   저지 0.420   피부 0.620      (metallic 은 전부 0 — 금속이 아니다)
 * ```
 * 0.38 은 가죽·플라스틱 수준이라 Mapbox 직사광에서 강한 스페큘러 띠가 생기고
 * **판금처럼** 보인다. 다만 **주원인은 삼각형 크기**(허벅지 한 변 56.5mm ≈ 14px)이고
 * 광택은 그 위에 얹힌 것이다 — 이 스크립트는 **부차 원인**만 다룬다.
 *
 * ── 무엇을 하는가 ──────────────────────────────────────────────────────────
 * `rtw_palette_metalrough` 의 **G 채널만** 바꾼다.
 *   R(occlusion)·B(metallic) 은 건드리지 않는다 — **metallic 0 이 맞다.**
 *
 * 대상 텍셀은 **baseColor 팔레트에서 색으로 찾는다** — UV 좌표를 하드코딩하지 않는다.
 * 피부(`#bc9179`)는 약간 광택이 정상이므로 **유지**한다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node set-fabric-roughness.mjs <in.glb> <out.glb> [--rough 0.85]
 */
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** 패브릭으로 볼 baseColor (팔레트 실측) — 피부·흰색(신발)·검정(암부)은 제외 */
const FABRIC_HEX = new Set([
  "2c5576", // 저지 파랑
  "8c050a", // 팬츠 빨강
  "9e4d48", // 저지 보조
  "b82429", // 헬멧 빨강
  "163c45", // 저지 암부
]);

function parseGlb(buf) {
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(data.toString("utf8").replace(/\0+$/, ""));
    else if (type === CHUNK_BIN) bin = Buffer.from(data);
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

// ── 최소 PNG 디코더/인코더 (8bit RGBA, non-interlaced) ────────────────────
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
let crcT = null;
function crc32(buf) {
  if (!crcT) { crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c; } }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcT[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function encodePNG(W, H, ch, data) {
  const stride = W * ch;
  const raw = Buffer.alloc(H * (stride + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const mk = (type, d) => {
    const b = Buffer.alloc(8 + d.length + 4);
    b.writeUInt32BE(d.length, 0);
    b.write(type, 4, "ascii");
    d.copy(b, 8);
    b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), d])), 8 + d.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = ch === 4 ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    mk("IHDR", ihdr), mk("IDAT", zlib.deflateSync(raw)), mk("IEND", Buffer.alloc(0)),
  ]);
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  const ri = process.argv.indexOf("--rough");
  const ROUGH = ri >= 0 ? Number(process.argv[ri + 1]) : 0.85;
  if (!inPath || !outPath) {
    console.error("사용법: node set-fabric-roughness.mjs <in.glb> <out.glb> [--rough 0.85]");
    process.exit(2);
  }
  const src = fs.readFileSync(inPath);
  const { json, bin } = parseGlb(src);
  const baseIdx = json.images.findIndex((im) => /basecolor/i.test(im.name ?? ""));
  const mrIdx = json.images.findIndex((im) => /metalrough/i.test(im.name ?? ""));
  if (baseIdx < 0 || mrIdx < 0) {
    console.error("✘ FAIL — basecolor/metalrough 이미지를 찾지 못했다");
    process.exit(1);
  }
  const bvOf = (i) => json.bufferViews[json.images[i].bufferView];
  const sliceOf = (i) => {
    const bv = bvOf(i);
    return bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
  };
  const base = decodePNG(sliceOf(baseIdx));
  const mr = decodePNG(sliceOf(mrIdx));
  if (base.W !== mr.W || base.H !== mr.H) {
    console.error(`✘ FAIL — 두 텍스처 크기가 다르다 ${base.W}×${base.H} vs ${mr.W}×${mr.H}`);
    process.exit(1);
  }
  const hex = (x, y) => {
    const o = y * base.stride + x * base.ch;
    return [base.data[o], base.data[o + 1], base.data[o + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  const target = Math.round(ROUGH * 255);
  const changed = new Map();
  for (let y = 0; y < mr.H; y++) {
    for (let x = 0; x < mr.W; x++) {
      const h = hex(x, y);
      if (!FABRIC_HEX.has(h)) continue;
      const o = y * mr.stride + x * mr.ch;
      const before = mr.data[o + 1];
      if (before === target) continue;
      mr.data[o + 1] = target; // G = roughness 만
      const k = `${h}`;
      const e = changed.get(k) ?? { n: 0, from: before };
      e.n += 1;
      changed.set(k, e);
    }
  }
  console.log(`=== roughness → ${ROUGH} (G 채널만 · R·B 불변) ===`);
  for (const [h, e] of changed)
    console.log(`  #${h}  텍셀 ${String(e.n).padStart(4)}개   ${(e.from / 255).toFixed(3)} → ${ROUGH.toFixed(3)}`);
  if (changed.size === 0) console.log("  (바꿀 텍셀 없음)");

  // 새 PNG 를 bin 끝에 append 하고 bufferView 를 갱신(기존 데이터는 그대로 둔다)
  const newPng = encodePNG(mr.W, mr.H, mr.ch, mr.data);
  const pad = (4 - (bin.length % 4)) % 4;
  const merged = Buffer.concat([bin, Buffer.alloc(pad), newPng]);
  const bv = bvOf(mrIdx);
  bv.byteOffset = bin.length + pad;
  bv.byteLength = newPng.length;
  json.buffers = [{ byteLength: merged.length }];

  const out = writeGlb(json, merged);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, out);

  // 무결성 — 지오메트리는 손대지 않았다
  const verts = (json.meshes ?? []).reduce(
    (s, m) => s + m.primitives.reduce((t, p) => t + json.accessors[p.attributes.POSITION].count, 0), 0);
  console.log(`\n  전체 정점 ${verts} (불변) · ${inPath} (${src.length}B) → ${outPath} (${out.length}B)`);
  console.log("✔ 텍스처 1장만 교체. 지오메트리·노드·정점 불변.");
}

main();

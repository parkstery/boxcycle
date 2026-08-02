#!/usr/bin/env node
/**
 * rotate-rider-nodes — 라이더 루트 노드를 **시상면에서 피벗 회전**시킨다 (F23).
 *
 * ── 왜 ─────────────────────────────────────────────────────────────────────
 * 사용자 지적(2026-08-02): *"엉덩이가 너무 뒤에 있다. 발목을 기준으로 라이더가
 * 앞쪽으로 5도 정도 회전해야 할 것 같다."*
 *
 * 피벗은 **BDC 발목 목표점**(왼발 phase 0) = `ankleTargetWorld("l", 0)` 의 xy.
 * 발이 페달에 닿은 채로 몸 전체가 앞으로 도는 회전이라, 접점을 깨지 않는다.
 *
 * ── 무엇을 하는가 ──────────────────────────────────────────────────────────
 * **루트 노드 5개(`torso` · `leg_l` · `leg_r` · `arm_l` · `arm_r`)의 translation 만**
 * xy 평면에서 회전시킨다. z(좌우)는 불변 — 시상면 회전이다.
 *
 * ```
 * v  = p − pivot
 * p' = pivot + [ vx·cos θ + vy·sin θ ,  −vx·sin θ + vy·cos θ ]      (전방 회전 = +θ)
 * ```
 *
 * - **자식 노드(`*_shin` · `*_fore`)는 부모 로컬이라 손대지 않는다.**
 * - **정점을 굽지 않는다**(F20 의 실패가 그것이다). 노드 `rotation`·`scale` 도 만들지
 *   않는다 — F21 이 제거한 것을 되살리면 앱 오버라이드와 이중으로 겹친다.
 * - 어깨(`arm_*`)는 **안에 따라 목표가 다르다**. `--shoulder x,y` 로 직접 지정한다:
 *     안 A(강체 회전): 몸통을 통째로 5° → 팔꿈치가 크게 굽는다
 *     안 B(상체 세움): 골반만 회전하고 몸통각을 세워 어깨를 덜 움직인다
 *
 * ⚠ 이 스크립트만으로는 부족하다. `riderRig.geometry.mjs` 의 `HIP_GROUND`·`SHOULDER_XY`
 *   를 **같은 값으로** 맞춰야 한다(F22 계약: 앱 IK root == GLB 노드 피벗).
 *   `verify-node-anchors.mjs` 가 그 일치를 검사한다.
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node rotate-rider-nodes.mjs <in.glb> <out.glb> --deg 5 --pivot -93.03,135.0 \
 *        --shoulder 179.43,1117.34
 */
import fs from "node:fs";
import path from "node:path";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** 회전 대상 = 라이더 **루트** 노드만. 자식은 부모 로컬이라 제외. */
const ROOT_NODES = ["torso", "leg_l", "leg_r", "arm_l", "arm_r"];
const SHOULDER_NODES = ["arm_l", "arm_r"];

function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error("GLB magic 불일치");
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
  if (bin) {
    let b = bin;
    const bp = (4 - (b.length % 4)) % 4;
    if (bp) b = Buffer.concat([b, Buffer.alloc(bp)]);
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(b.length, 0);
    bh.writeUInt32LE(CHUNK_BIN, 4);
    parts.push(bh, b);
  }
  const body = Buffer.concat(parts);
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

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error("사용법: node rotate-rider-nodes.mjs <in.glb> <out.glb> --deg 5 --pivot x,y [--shoulder x,y]");
    process.exit(2);
  }
  const deg = Number(arg("deg", "5"));
  const pivot = arg("pivot", "-93.03,135.0").split(",").map(Number);
  const shoulderOverride = arg("shoulder", null)?.split(",").map(Number) ?? null;
  const th = (deg * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const rot = (x, y) => {
    const vx = x - pivot[0];
    const vy = y - pivot[1];
    return [pivot[0] + vx * cos + vy * sin, pivot[1] - vx * sin + vy * cos];
  };

  const src = fs.readFileSync(inPath);
  const { json, bin } = parseGlb(src);
  const byName = new Map();
  json.nodes.forEach((n, i) => n.name && byName.set(n.name, i));

  const missing = ROOT_NODES.filter((n) => !byName.has(n));
  if (missing.length) {
    console.error(`✘ FAIL — 노드 없음: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`=== 라이더 루트 노드 ${deg}° 전방 회전 (피벗 [${pivot.join(", ")}] mm, z 불변) ===`);
  for (const name of ROOT_NODES) {
    const node = json.nodes[byName.get(name)];
    if (node.rotation || node.scale) {
      console.error(`✘ FAIL — "${name}" 에 rest rotation/scale 이 있다. F21 의 strip-node-rest 를 먼저 통과시켜라`);
      process.exit(1);
    }
    const t = node.translation ?? [0, 0, 0];
    const before = t.map((v) => +(v * 1000).toFixed(2));
    let after;
    if (shoulderOverride && SHOULDER_NODES.includes(name)) {
      after = [shoulderOverride[0], shoulderOverride[1], before[2]]; // 어깨는 안별 지정값
    } else {
      const [x, y] = rot(before[0], before[1]);
      after = [+x.toFixed(2), +y.toFixed(2), before[2]];
    }
    node.translation = [after[0] / 1000, after[1] / 1000, after[2] / 1000];
    const tag = shoulderOverride && SHOULDER_NODES.includes(name) ? " ← --shoulder 지정" : "";
    console.log(`  ${name.padEnd(8)} [${before.join(", ")}] → [${after.join(", ")}]${tag}`);
  }

  // 자식은 손대지 않았음을 확인 로그로 남긴다
  for (const child of ["leg_l_shin", "leg_r_shin", "arm_l_fore", "arm_r_fore"]) {
    const n = json.nodes[byName.get(child)];
    const t = (n.translation ?? [0, 0, 0]).map((v) => +(v * 1000).toFixed(2));
    console.log(`  ${child.padEnd(11)} [${t.join(", ")}]  (부모 로컬 — 불변)`);
  }

  const out = writeGlb(json, bin);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, out);
  const verts = (json.meshes ?? []).reduce(
    (s, m) => s + m.primitives.reduce((t, p) => t + json.accessors[p.attributes.POSITION].count, 0),
    0,
  );
  console.log(`\nGLB 전체 정점 ${verts} (불변) · ${inPath} (${src.length}B) → ${outPath} (${out.length}B)`);
  console.log("✔ 루트 5개만 이동. 정점·자식·rest 는 그대로.");
}

main();

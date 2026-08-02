#!/usr/bin/env node
/**
 * strip-node-rest — 라이더 노드에서 rest `rotation`·`scale` **키만 삭제**한다 (F21).
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────────────
 * Mapbox 는 노드 override 를 **누적**한다(대체가 아니다).
 * `mapbox-gl-dev.js:36067~36073` `_applyTransformations`:
 *
 *   multiply(node.globalMatrix, parentMatrix, node.localMatrix);  // localMatrix = rest T·R·S
 *   if (nodeOverride) { rotationYZX(m, o); multiply(g, g, m); }   // ← post-multiply = 누적
 *
 * `localMatrix` 는 `fromRotationTranslationScale(rotation, translation, scale)`(:36432) 이라
 * **rest 회전·배율이 그대로 살아 적용된다.** 따라서 F19 산출물이 노드에 남긴
 *
 *   rotation [0,−0.7071,0,0.7071] = y −90°   → 몸통이 자전거와 90° 어긋난다.
 *                                              IK override 는 그 돌아간 프레임에서 곱해져
 *                                              관절이 기형적으로 움직인다
 *   scale 1.13636 = 1/0.88                   → 계층마다 누적돼 사지가 과대해진다
 *                                              (정강이는 1.13636² = ×1.291)
 *
 * 는 앱 IK 계약(`riderGlbPedalPose.pose.mjs:10`)을 깬다.
 *
 * ── ⚠ 정점을 굽지 마라 ─────────────────────────────────────────────────────
 * **정점은 이미 올바른 좌표계·크기다.** 실측 근거 2가지:
 *   ① torso 메시 로컬 AABB — 전후가 x[−141.9…466.2], 좌우 폭이 z[±193.6].
 *      자전거와 같은 축 배치다.
 *   ② 키 삭제 시 전고 = torso.T.y 802.21 + 메시 y최대 645.8 = **1448mm**
 *      (`glbModelLayer.ts:30` 의 라이딩 자세 실제치 ~1450mm 와 오차 0.1%).
 *      scale 을 살리면 1536mm 로 6% 과대해진다.
 *
 * F20 의 `normalize-node-rest.mjs` 는 이 올바른 정점에 −90° 를 **구워버려**
 * 오차를 노드에서 정점으로 옮겼을 뿐이었다(x가 폭, z가 전후로 뒤바뀜). 그래서 폐기했다.
 * **여기서는 키만 지운다. translation·정점·`crank` 는 손대지 않는다.**
 *
 * ── 사용 ───────────────────────────────────────────────────────────────────
 *   node apps/web/scripts/rider-cycle-fit/strip-node-rest.mjs <in.glb> <out.glb>
 *
 * 제품 이식 전 항상 통과시켜라. GLB 를 다시 구우면 rest 가 되살아난다.
 */
import fs from "node:fs";
import path from "node:path";

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** 대상 — 앱 계약 노드 중 **라이더** 쪽 9개.
 *  `crank` 는 제외: rest `+90°z` 는 자전거측 값이고 F18 이전부터 정상 동작해 왔다. */
const TARGET_NODES = [
  "torso",
  "leg_l",
  "leg_l_shin",
  "leg_r",
  "leg_r_shin",
  "arm_l",
  "arm_l_fore",
  "arm_r",
  "arm_r_fore",
];

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

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error("사용법: node strip-node-rest.mjs <in.glb> <out.glb>");
    process.exit(2);
  }
  const src = fs.readFileSync(inPath);
  const { json, bin } = parseGlb(src);
  const byName = new Map();
  json.nodes.forEach((n, i) => n.name && byName.set(n.name, i));

  const missing = TARGET_NODES.filter((n) => !byName.has(n));
  if (missing.length) {
    console.error(`✘ FAIL — 앱 계약 노드가 GLB 에 없다: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log("=== rest 키 삭제 (translation·정점은 손대지 않는다) ===");
  let stripped = 0;
  for (const name of TARGET_NODES) {
    const node = json.nodes[byName.get(name)];
    const hadR = node.rotation ? `[${node.rotation.map((v) => v.toFixed(4)).join(", ")}]` : "null";
    const hadS = node.scale ? node.scale[0].toFixed(5) : "null";
    // ⚠ node.matrix 형식이면 TRS 키가 없다 — 그 경우는 이 스크립트로 다룰 수 없다.
    if (node.matrix) {
      console.error(`✘ FAIL — "${name}" 이 matrix 형식이다. TRS 형식만 지원한다`);
      process.exit(1);
    }
    if (node.rotation || node.scale) stripped += 1;
    delete node.rotation;
    delete node.scale;
    const t = node.translation ? node.translation.map((v) => +(v * 1000).toFixed(2)) : null;
    console.log(
      `  ${name.padEnd(11)} rotation ${hadR.padEnd(38)} → 삭제   scale ${hadS.padEnd(8)} → 삭제   translation ${JSON.stringify(t)} (불변)`,
    );
  }

  // 검증 — 대상 노드에 rest 가 하나도 남지 않았는가
  const leftover = TARGET_NODES.filter((n) => {
    const nd = json.nodes[byName.get(n)];
    return nd.rotation || nd.scale;
  });

  // 정점 수 — 팔레트(라이더) / 전체 구분. 합격 기준의 5,521 은 라이더 쪽이다.
  const paletteMats = new Set();
  (json.materials ?? []).forEach((m, i) => {
    if (m.pbrMetallicRoughness?.baseColorTexture) paletteMats.add(i);
  });
  let riderVerts = 0;
  let totalVerts = 0;
  (json.meshes ?? []).forEach((m) =>
    m.primitives.forEach((p) => {
      const n = json.accessors[p.attributes.POSITION].count;
      totalVerts += n;
      if (paletteMats.has(p.material)) riderVerts += n;
    }),
  );

  const out = writeGlb(json, bin);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, out);

  console.log(
    `\nrest 제거 노드 ${stripped}/${TARGET_NODES.length}개 · 라이더 정점 ${riderVerts} · GLB 전체 정점 ${totalVerts} (둘 다 불변)` +
      `\n${inPath} (${src.length}B) → ${outPath} (${out.length}B)`,
  );
  if (leftover.length) {
    console.error(`✘ FAIL — rest 가 남은 노드: ${leftover.join(", ")}`);
    process.exit(1);
  }
  console.log("✔ 대상 9개 노드가 순수 translation 이다 (crank 는 의도적으로 제외).");
}

main();

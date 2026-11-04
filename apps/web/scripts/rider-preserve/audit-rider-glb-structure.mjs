#!/usr/bin/env node
/**
 * RIDER15-P3 — glTF/GLB 후보 구조 감사.
 * 읽기 전용이다. 제품 파일을 수정하거나 승격하지 않는다.
 *
 * 사용법:
 *   node scripts/rider-preserve/audit-rider-glb-structure.mjs <rider.glb>
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("usage: audit-rider-glb-structure.mjs <rider.glb>");

const file = path.resolve(input);
const bytes = fs.readFileSync(file);
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
if (view.getUint32(0, true) !== 0x46546c67) throw new Error("not a GLB file");

let offset = 12;
let json = null;
while (offset + 8 <= bytes.byteLength) {
  const length = view.getUint32(offset, true);
  const type = view.getUint32(offset + 4, true);
  const chunk = bytes.subarray(offset + 8, offset + 8 + length);
  if (type === 0x4e4f534a) json = JSON.parse(Buffer.from(chunk).toString("utf8").replace(/\s+$/, ""));
  offset += 8 + length;
}
if (!json) throw new Error("GLB JSON chunk missing");

const nodes = json.nodes ?? [];
const meshes = json.meshes ?? [];
const materials = json.materials ?? [];
const skins = json.skins ?? [];
const animations = json.animations ?? [];
const accessors = json.accessors ?? [];
const attributeNames = new Set();
let triangles = 0;
for (const mesh of meshes) {
  for (const primitive of mesh.primitives ?? []) {
    for (const name of Object.keys(primitive.attributes ?? {})) attributeNames.add(name);
    const accessor = accessors[primitive.indices];
    if (accessor?.count && accessor.type === "SCALAR") triangles += Math.floor(accessor.count / 3);
  }
}

const result = {
  file,
  bytes: bytes.byteLength,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  gltf: {
    nodes: nodes.length,
    meshes: meshes.length,
    materials: materials.length,
    skins: skins.length,
    animations: animations.length,
    triangles,
    attributes: [...attributeNames].sort(),
  },
  skinContract: {
    hasSkins: skins.length > 0,
    hasJoints0: attributeNames.has("JOINTS_0"),
    hasWeights0: attributeNames.has("WEIGHTS_0"),
    jointCount: skins[0]?.joints?.length ?? 0,
  },
  nodes: nodes.map((node, index) => ({ index, name: node.name ?? `node_${index}`, mesh: node.mesh ?? null, skin: node.skin ?? null })),
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);


/**
 * 제품 preserved GLB 에 riderVisualKit 을 적용해
 * - Helmet/Jersey 만 바뀌는지
 * - self 복원 시 기존 오렌지로 돌아가는지
 * 를 오프스크린으로 검증한다. (화면 픽셀 검증이 아님)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Mesh, MeshStandardMaterial } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  RIDER_HELMET_SHELL_MATERIAL_NAME,
  RIDER_JERSEY_MATERIAL_NAME,
  RIDER_VISUAL_KIT_PEER,
  RIDER_VISUAL_KIT_SELF,
  applyRiderVisualKit,
} from "../../src/lib/riderPrototype/riderVisualKit.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const glbPath = path.resolve(
  here,
  "../../public/rider/preserved/candidates/20260921-041426-cd81398e/rider.glb",
);

function snapshotColors(root) {
  const out = new Map();
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    const list = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of list) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      const key = material.name || "(unnamed)";
      if (!out.has(key)) {
        out.set(key, {
          r: material.color.r,
          g: material.color.g,
          b: material.color.b,
        });
      }
    }
  });
  return out;
}

function nearly(a, b, eps = 1e-5) {
  return Math.abs(a - b) <= eps;
}

function sameRgb(a, b) {
  return nearly(a.r, b.r) && nearly(a.g, b.g) && nearly(a.b, b.b);
}

const buf = fs.readFileSync(glbPath);
const loader = new GLTFLoader();
const gltf = await new Promise((resolve, reject) => {
  loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject);
});

const root = gltf.scene;
const before = snapshotColors(root);
assert.ok(before.has(RIDER_HELMET_SHELL_MATERIAL_NAME), "helmet material missing");
assert.ok(before.has(RIDER_JERSEY_MATERIAL_NAME), "jersey material missing");
assert.ok(
  sameRgb(before.get(RIDER_HELMET_SHELL_MATERIAL_NAME), RIDER_VISUAL_KIT_SELF.helmet),
  "GLB helmet should already match SELF kit",
);
assert.ok(
  sameRgb(before.get(RIDER_JERSEY_MATERIAL_NAME), RIDER_VISUAL_KIT_SELF.jersey),
  "GLB jersey should already match SELF kit",
);

applyRiderVisualKit(root, "peer");
const peer = snapshotColors(root);
assert.ok(sameRgb(peer.get(RIDER_HELMET_SHELL_MATERIAL_NAME), RIDER_VISUAL_KIT_PEER.helmet));
assert.ok(sameRgb(peer.get(RIDER_JERSEY_MATERIAL_NAME), RIDER_VISUAL_KIT_PEER.jersey));

const changed = [];
const unchanged = [];
for (const [name, rgb] of before) {
  if (sameRgb(peer.get(name), rgb)) unchanged.push(name);
  else changed.push(name);
}
assert.deepEqual(
  changed.sort(),
  [RIDER_HELMET_SHELL_MATERIAL_NAME, RIDER_JERSEY_MATERIAL_NAME].sort(),
  `unexpected material changes: ${changed.join(", ")}`,
);
assert.ok(unchanged.includes("Bicycle | orange frame"), "bike frame must stay");
assert.ok(unchanged.includes("Rider | black shorts"), "shorts must stay");

applyRiderVisualKit(root, "self");
const restored = snapshotColors(root);
assert.ok(sameRgb(restored.get(RIDER_HELMET_SHELL_MATERIAL_NAME), RIDER_VISUAL_KIT_SELF.helmet));
assert.ok(sameRgb(restored.get(RIDER_JERSEY_MATERIAL_NAME), RIDER_VISUAL_KIT_SELF.jersey));
for (const [name, rgb] of before) {
  assert.ok(sameRgb(restored.get(name), rgb), `self restore drifted: ${name}`);
}

// peer→peer again (multiple peers share kit)
applyRiderVisualKit(root, "peer");
applyRiderVisualKit(root, "peer");
const peer2 = snapshotColors(root);
assert.ok(sameRgb(peer2.get(RIDER_HELMET_SHELL_MATERIAL_NAME), RIDER_VISUAL_KIT_PEER.helmet));
assert.ok(sameRgb(peer2.get(RIDER_JERSEY_MATERIAL_NAME), RIDER_VISUAL_KIT_PEER.jersey));

console.log(
  JSON.stringify(
    {
      ok: true,
      glb: path.basename(glbPath),
      changedOnPeerOnly: changed,
      unchangedCount: unchanged.length,
      selfHelmet: RIDER_VISUAL_KIT_SELF.helmet,
      peerHelmet: RIDER_VISUAL_KIT_PEER.helmet,
      selfJersey: RIDER_VISUAL_KIT_SELF.jersey,
      peerJersey: RIDER_VISUAL_KIT_PEER.jersey,
    },
    null,
    2,
  ),
);

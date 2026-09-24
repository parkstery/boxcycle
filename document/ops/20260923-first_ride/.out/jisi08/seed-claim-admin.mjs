/**
 * 지시08 캡처용 — Firestore 에뮬레이터에 Claim 시드(Admin SDK).
 * stdin/파일: { uid, chunks: { chunkId: { cellId: day } }, path: number[], cellCount }
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(pathToFileURL(path.resolve("functions/package.json")));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error("usage: seed-claim-admin.mjs <payload.json>");
  process.exit(1);
}

const p = JSON.parse(readFileSync(payloadPath, "utf8"));
initializeApp({ projectId: "boxcycle-dc2df" });
const db = getFirestore();
const base = db.doc(`conquest/${p.uid}`);
await base.set({ totalMeters: 3000, totalCells: p.cellCount }, { merge: true });
for (const [chunkId, cells] of Object.entries(p.chunks)) {
  await base.collection("chunks").doc(chunkId).set({ cells }, { merge: true });
}
await base.collection("traces").doc("jisi08seed").set({
  path: p.path,
  newMeters: Math.round(p.path.length * 12),
  day: "2026-09-24",
});
console.log(JSON.stringify({ ok: true, chunks: Object.keys(p.chunks).length, cells: p.cellCount }));

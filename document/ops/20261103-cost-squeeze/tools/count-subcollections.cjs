// 읽기 전용: 하위 컬렉션 문서 수(count 집계).
// 사용: node count-subcollections.cjs <functions 폴더>
const path = require("path");
const fnDir = process.argv[2];
const { initFirebaseAdminForCli } = require(path.join(fnDir, "lib/initAdminForCli.js"));
initFirebaseAdminForCli({});
const { getFirestore } = require(path.join(fnDir, "node_modules/firebase-admin/lib/firestore"));
(async () => {
  const db = getFirestore();
  const c = async (q) => (await q.count().get()).data().count;
  const out = [];
  for (const g of ["members", "livePublicationRides", "traces", "chunks", "openTrailListings"]) out.push([await c(db.collectionGroup(g)), `group:${g}`]);
  out.push([await c(db.collection("trails/default/members")), "trails/default/members"]);
  const sessions = await db.collection("publicationSessions").listDocuments();
  for (const s of sessions) out.push([await c(s.collection("members")), `${s.path}/members`]);
  const conq = await db.collection("conquest").listDocuments();
  for (const d of conq) {
    out.push([await c(d.collection("traces")), `${d.path}/traces`]);
    out.push([await c(d.collection("chunks")), `${d.path}/chunks`]);
  }
  const trails = await db.collection("trails").listDocuments();
  const lpr = [];
  for (const t of trails) { const n = await c(t.collection("livePublicationRides")); if (n > 0) lpr.push([n, `${t.path}/livePublicationRides`]); }
  out.push(...lpr);
  out.sort((a, b) => b[0] - a[0]);
  for (const [n, id] of out) if (n > 0) console.log(String(n).padStart(7), id);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

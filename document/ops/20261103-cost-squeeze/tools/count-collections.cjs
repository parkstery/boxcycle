// 읽기 전용: 최상위 컬렉션별 문서 수(count 집계 — 실행 시 조회 사용량 발생).
// 사용: node count-collections.cjs <functions 폴더> [collectionGroup 이름...]
const path = require("path");
const fnDir = process.argv[2];
const groups = process.argv.slice(3);
const { initFirebaseAdminForCli } = require(path.join(fnDir, "lib/initAdminForCli.js"));
initFirebaseAdminForCli({});
const { getFirestore } = require(path.join(fnDir, "node_modules/firebase-admin/lib/firestore"));
(async () => {
  const db = getFirestore();
  const cols = await db.listCollections();
  const rows = [];
  for (const c of cols) {
    const n = (await c.count().get()).data().count;
    rows.push([n, c.id]);
  }
  for (const g of groups) {
    const n = (await db.collectionGroup(g).count().get()).data().count;
    rows.push([n, `group:${g}`]);
  }
  rows.sort((a, b) => b[0] - a[0]);
  for (const [n, id] of rows) console.log(String(n).padStart(8), id);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

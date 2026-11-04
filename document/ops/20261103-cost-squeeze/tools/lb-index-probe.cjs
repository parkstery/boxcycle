// 읽기 전용: leaderboardScores 쿼리 모양이 운영 색인으로 실행되는지 본다(컬렉션은 비어 있음).
const path = require("path");
const fnDir = process.argv[2];
const { initFirebaseAdminForCli } = require(path.join(fnDir, "lib/initAdminForCli.js"));
const { getFirestore } = require(path.join(fnDir, "node_modules/firebase-admin/lib/firestore/index.js"));
(async () => {
  initFirebaseAdminForCli({});
  const db = getFirestore();
  for (const tr of ["T1", "All"]) {
    const t = `tenths${tr}`, r = `rounded${tr}`;
    const base = db.collection("leaderboardScores").where("board", "==", "distance").where("periodKey", "==", "W2026-45")
      .where("scopeType", "==", "world").where("scopeCode", "==", "-").where("member", "==", true).where(t, ">", 0);
    const shapes = {
      top: base.orderBy(t, "desc").orderBy(r, "desc").orderBy("uid", "asc").limit(21),
      count: base.where(t, ">", 5).count(),
      nearestAbove: base.where(t, ">", 5).orderBy(t, "asc").orderBy(r, "asc").orderBy("uid", "desc").limit(1),
      before: base.orderBy(t, "asc").orderBy(r, "asc").orderBy("uid", "desc").startAfter(5, 500, "u").limit(3),
      after: base.orderBy(t, "desc").orderBy(r, "desc").orderBy("uid", "asc").startAfter(5, 500, "u").limit(3),
    };
    for (const [name, q] of Object.entries(shapes)) {
      try { await q.get(); console.log(`${tr} ${name}: OK`); }
      catch (e) { console.log(`${tr} ${name}: FAIL ${String(e.message).split("\n")[0].slice(0, 160)}`); }
    }
  }
  try { await db.collection("leaderboardScores").where("uid", "==", "x").get(); console.log("byUid: OK"); } catch (e) { console.log("byUid: FAIL", e.message.slice(0, 120)); }
})();

// 읽기 전용: 최근 주행의 rides.netStats 를 출력한다. 실행: node <이 파일> C:/20.HDev/boxcycle/functions [건수]
const path = require("path");
const fnDir = process.argv[2], n = Number(process.argv[3] || 10);
const { initFirebaseAdminForCli } = require(path.join(fnDir, "lib/initAdminForCli.js"));
const { getFirestore } = require(path.join(fnDir, "node_modules/firebase-admin/lib/firestore/index.js"));
(async () => {
  initFirebaseAdminForCli({});
  const s = await getFirestore().collection("rides").orderBy("endedAt", "desc").limit(n * 3).get(); // status+endedAt 복합 색인이 없어 코드로 거른다
  for (const d of s.docs.filter((x) => x.data().status === "completed").slice(0, n)) {
    const r = d.data();
    console.log(new Date(r.endedAt.toMillis() + 9 * 3600e3).toISOString().slice(5, 19), r.userId.slice(0, 6), `${r.elapsedSec}s`, JSON.stringify(r.netStats ?? "netStats 없음"));
  }
})();

// 읽기 전용: 운영 데이터로 기존 순위(rides 훑기)와 새 순위(누적 점수) 응답을 비교한다.
const path = require("path");
const assert = require("assert");
const fnDir = process.argv[2];
const L = (m) => require(path.join(fnDir, "lib", m));
const { initFirebaseAdminForCli } = L("initAdminForCli.js");
const { getFirestore } = require(path.join(fnDir, "node_modules/firebase-admin/lib/firestore/index.js"));
const core = L("leaderboardCore.js");
const store = L("leaderboardScoresStore.js");
(async () => {
  initFirebaseAdminForCli({});
  const db = getFirestore();
  const nowMs = Date.now();
  const users = await db.collection("users").select("isAnonymous").get();
  const requesters = users.docs.map((d) => ({ uid: d.id, isAnonymous: d.get("isAnonymous") === true }));
  requesters.push({ uid: "no-such-user-parity", isAnonymous: false }, { uid: "no-such-guest-parity", isAnonymous: true });
  const names = { nicknames: new Map(), liveByUid: new Map() };
  let same = 0, diff = 0;
  for (const board of core.LEADERBOARD_BOARDS) for (const period of core.LEADERBOARD_PERIODS) {
    const rows = await core.loadLeaderboardRideRows(db, core.periodStartMs(period, nowMs));
    const uids = [...new Set(rows.map((r) => r.uid))];
    const pubIds = [...new Set(rows.map((r) => r.publicationId).filter(Boolean))];
    const [memberUids, owners] = await Promise.all([core.loadMemberUids(uids), board === "pioneer" ? core.loadPublicationOwners(db, pubIds) : Promise.resolve(new Map())]);
    const snap = core.computeBoardSnapshot({ rows, memberUids, publicationOwners: owners, board, period, nowMs });
    for (const rq of requesters) {
      const oldR = core.buildLeaderboardResponse(snap, rq, names);
      const layout = await store.loadLeaderboardLayoutFromScores(db, { board, period, requester: rq, nowMs });
      const newR = core.renderLeaderboard(layout, names);
      const strip = (r) => ({ ...r, generatedAt: null });
      try { assert.deepStrictEqual(strip(newR), strip(oldR)); same++; }
      catch { diff++; console.log(`DIFF ${board}/${period} ${rq.isAnonymous ? "guest" : "member"} ${rq.uid.slice(0, 6)}`);
        console.log("  old top:", JSON.stringify(oldR.top.map((t) => [t.rank, t.valueKm])), "me:", JSON.stringify(oldR.me).slice(0, 160));
        console.log("  new top:", JSON.stringify(newR.top.map((t) => [t.rank, t.valueKm])), "me:", JSON.stringify(newR.me).slice(0, 160)); }
    }
    console.log(`${board}/${period}: rides=${rows.length} top=${snap.entries.length}`);
  }
  console.log(`parity same=${same} diff=${diff}`);
  process.exit(diff ? 1 : 0);
})().catch((e) => { console.error("ERR", String(e.message).slice(0, 200)); process.exit(2); });

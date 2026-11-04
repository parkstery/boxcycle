// 2026-11-04 aPbTo3 게스트가 되살린 주행 정리. 기본은 읽기 전용(건수·스냅샷). --apply 일 때만 지운다.
// 실행: node <이 파일> C:/20.HDev/boxcycle/functions <스냅샷 폴더> [--apply]
const fs = require("fs");
const path = require("path");
const [fnDir, outDir, flag] = process.argv.slice(2);
const apply = flag === "--apply";
const { initFirebaseAdminForCli } = require(path.join(fnDir, "lib/initAdminForCli.js"));
const { getFirestore, Timestamp } = require(path.join(fnDir, "node_modules/firebase-admin/lib/firestore/index.js"));

const UID_PREFIX = "aPbTo3";
const FROM = new Date("2026-11-04T03:12:50Z");
const TO = new Date("2026-11-04T03:13:00Z");
const EXPECTED = 50;

(async () => {
  initFirebaseAdminForCli({});
  const db = getFirestore();
  const s = await db.collection("rides").where("createdAt", ">=", Timestamp.fromDate(FROM)).where("createdAt", "<=", Timestamp.fromDate(TO)).get();
  const rides = s.docs.filter((d) => String(d.data().userId).startsWith(UID_PREFIX));
  if (rides.length !== EXPECTED || rides.length !== s.size) throw new Error(`건수 불일치: 구간 ${s.size}, 대상 ${rides.length}, 기대 ${EXPECTED}`);
  const uids = new Set(rides.map((d) => d.data().userId));
  if (uids.size !== 1) throw new Error("대상 계정이 하나가 아니다");
  const uid = [...uids][0];
  const userRef = db.doc(`users/${uid}`);
  const user = (await userRef.get()).data();
  if (!user?.isAnonymous) throw new Error("게스트가 아니다");
  const all = await db.collection("rides").where("userId", "==", uid).get();
  const others = all.docs.filter((d) => !rides.some((r) => r.id === d.id));
  const sum = rides.reduce((a, d) => a + (Number(d.data().distanceMeters) || 0), 0);
  const secs = rides.reduce((a, d) => a + (Number(d.data().elapsedSec) || 0), 0);
  const withTier = rides.filter((d) => d.data().conquestResult?.tier).length;
  const conquestDoc = await db.doc(`conquest/${uid}`).get().catch(() => null);
  const ledger = await Promise.all(rides.map((d) => db.doc(`leaderboardScoreApplied/${d.id}`).get()));
  console.log({
    uid: uid.slice(0, 6), rides: rides.length, otherRides: others.length, sumMeters: Math.round(sum), sumSec: secs, withTier,
    scoreLedger: ledger.filter((x) => x.exists).length, conquestDoc: conquestDoc?.exists ?? null,
    user: { mileageTotalMeters: user.mileageTotalMeters, mileageTotalSec: user.mileageTotalSec, mileageRideCount: user.mileageRideCount, routeTokenBalance: user.routeTokenBalance, routeTokenEarnedToday: user.routeTokenEarnedToday, tier: user.tier },
  });
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "aPbTo3-rides-before.json");
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), uid, user, rides: rides.map((d) => ({ id: d.id, data: d.data() })) }, null, 1));
  console.log("스냅샷", file, fs.statSync(file).size);
  if (!apply) return console.log("읽기 전용 — 지우려면 --apply");
  if (others.length) throw new Error("다른 주행이 있어 마일리지를 0으로 둘 수 없다");
  const b = db.batch();
  for (const d of rides) b.delete(d.ref);
  // 다른 주행이 0건임을 위에서 확인했으므로 소수 잔여가 남지 않게 0으로 둔다.
  b.update(userRef, {
    mileageTotalMeters: 0,
    mileageTotalSec: 0,
    mileageRideCount: 0,
  });
  await b.commit();
  const after = (await userRef.get()).data();
  const left = await db.collection("rides").where("userId", "==", uid).count().get();
  console.log("완료", { ridesLeft: left.data().count, mileageTotalMeters: after.mileageTotalMeters, mileageTotalSec: after.mileageTotalSec, mileageRideCount: after.mileageRideCount });
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

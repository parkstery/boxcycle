/**
 * 지역별 주행 거리 소급 — 기존 주행의 `regionDistances` 를 채우고 `conquest/{uid}/rideRegions/*` 를 전체 재계산해 맞춘다.
 * 기본은 dry-run(쓰기 없음). `--apply` 일 때만 쓴다. rideRegions 는 set(덮어쓰기)이라 몇 번 돌려도 같다.
 * 이번 계산에 없는 기존 rideRegions 문서는 지우지 않고 건수만 보고한다.
 *
 *   npm run admin:backfill-ride-region-distances                         # dry-run
 *   npm run admin:backfill-ride-region-distances -- --uid=UID --limit=50 # 한 명 / 앞 N명
 *   npm run admin:backfill-ride-region-distances -- --apply              # 실제 쓰기 (에뮬레이터 또는 --confirm-prod)
 *
 * 계약: document/ops/20261106-region-ride-stats/README.md
 */
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { planUserRideRegions, type BackfillRideInput, type UserRideRegionPlan } from "./rideRegionBackfill.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const WRITE_BATCH = 400;

type UserResult = { plan: UserRideRegionPlan; staleDocs: number; wroteDocs: number; wroteRides: number };

async function readRides(db: Firestore, uid: string): Promise<BackfillRideInput[]> {
  const snap = await db
    .collection("rides")
    .where("userId", "==", uid)
    .select("distanceMeters", "elapsedSec", "conquest.v", "conquest.z", "conquest.cells", "regionDistances")
    .get();
  return snap.docs.map((d) => {
    const conquest = d.get("conquest") as Record<string, unknown> | undefined;
    const valid = conquest?.v === 2 && conquest?.z === 20;
    return {
      id: d.id,
      distanceMeters: Number(d.get("distanceMeters")),
      elapsedSec: Number(d.get("elapsedSec")),
      conquestCells: valid ? conquest?.cells : undefined,
      regionDistances: d.get("regionDistances"),
    };
  });
}

/**
 * 한 사용자 처리. 주행은 트랜잭션 밖에서 읽고 `regionDistances` 필드만 update(멱등) 한 뒤,
 * 요약 문서 `conquest/{uid}` 를 트랜잭션으로 다시 읽어 먼저 읽은 시점과 같은 버전일 때만 rideRegions 를 쓴다
 * (주행 트리거가 요약을 갱신하면 버전이 달라지므로 최대 3번 다시 읽는다).
 */
async function processUser(db: Firestore, uid: string, apply: boolean): Promise<UserResult | null> {
  const summaryRef = db.doc(`conquest/${uid}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await summaryRef.get();
    if (!before.exists) return null;
    const rides = await readRides(db, uid);
    const plan = planUserRideRegions(rides, resolveGeoRegion);
    const existing = await summaryRef.collection("rideRegions").listDocuments();
    const keep = new Set(plan.docs.map((d) => d.scopeCode));
    const staleDocs = existing.filter((r) => !keep.has(r.id)).length;
    if (!apply) return { plan, staleDocs, wroteDocs: 0, wroteRides: 0 };

    const writes = plan.items.filter((i) => i.toWrite);
    for (let i = 0; i < writes.length; i += WRITE_BATCH) {
      const batch = db.batch();
      for (const w of writes.slice(i, i + WRITE_BATCH)) {
        batch.update(db.doc(`rides/${w.id}`), { regionDistances: w.toWrite });
      }
      await batch.commit();
    }
    const done = await db.runTransaction(async (tx) => {
      const cur = await tx.get(summaryRef);
      if (!cur.exists || !cur.updateTime || !before.updateTime || !cur.updateTime.isEqual(before.updateTime)) {
        return false; // 그 사이 주행이 요약을 바꿨다 → 다시 읽는다
      }
      for (const d of plan.docs) {
        tx.set(summaryRef.collection("rideRegions").doc(d.scopeCode), {
          scopeType: d.scopeType,
          meters: d.meters,
          sec: d.sec,
          rideCount: d.rideCount,
        });
      }
      return true;
    });
    if (done) return { plan, staleDocs, wroteDocs: plan.docs.length, wroteRides: writes.length };
  }
  throw new Error(`conquest/${uid}: 요약이 계속 바뀌어 3번 시도 후 중단`);
}

async function main(): Promise<void> {
  if (hasFlag("help") || hasFlag("h")) {
    console.info(`Usage:
  npm run admin:backfill-ride-region-distances [-- --apply] [--uid=UID] [--limit=N] [--confirm-prod] [--projectId=id] [--serviceAccount=path]
  (기본 dry-run — --apply 일 때만 쓴다. 에뮬레이터(FIRESTORE_EMULATOR_HOST)가 아니면 --apply 에 --confirm-prod 도 필요)`);
    return;
  }
  const apply = hasFlag("apply");
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (apply && !emulator && !hasFlag("confirm-prod")) {
    console.error("[cli] 운영 Firestore 에 쓰려면 --apply 와 함께 --confirm-prod 가 필요합니다. (Supervisor 승인 후)");
    process.exit(2);
  }
  initFirebaseAdminForCli({ projectId: arg("projectId"), serviceAccountPath: arg("serviceAccount") });
  const db = getFirestore();
  const onlyUid = arg("uid");
  const limitRaw = arg("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : Number.POSITIVE_INFINITY;

  const uids: string[] = onlyUid
    ? [onlyUid]
    : (await db.collection("conquest").select().get()).docs
        .map((d) => d.id)
        .sort()
        .slice(0, limit);

  const report = {
    mode: apply ? "apply" : "dry-run",
    target: emulator ? "emulator" : "live",
    users: uids.length,
    usersWithoutSummary: 0,
    rides: 0,
    computedRides: 0,
    noCellRides: 0,
    skippedByLimitRides: 0,
    rideDocsWritten: 0,
    rideRegionDocs: 0,
    wroteDocs: 0,
    auditMismatchUsers: 0,
    staleDocsKept: 0,
  };
  const mismatchUids: string[] = [];
  for (const uid of uids) {
    const r = await processUser(db, uid, apply);
    if (!r) {
      report.usersWithoutSummary += 1;
      continue;
    }
    report.rides += r.plan.rides;
    report.computedRides += r.plan.computed;
    report.noCellRides += r.plan.nocells;
    report.skippedByLimitRides += r.plan.skipped;
    report.rideDocsWritten += r.wroteRides;
    report.rideRegionDocs += r.plan.docs.length;
    report.wroteDocs += r.wroteDocs;
    report.staleDocsKept += r.staleDocs;
    if (!r.plan.auditOk) {
      report.auditMismatchUsers += 1;
      mismatchUids.push(uid);
    }
  }
  console.info(JSON.stringify({ ...report, mismatchUids: mismatchUids.slice(0, 20) }, null, 2));
  if (!apply) console.info("[cli] dry-run only — 쓰려면 --apply");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

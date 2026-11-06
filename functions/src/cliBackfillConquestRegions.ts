/**
 * 지역별 개인 누적 채우기(G5 S5) — 기존 chunks 로 `conquest/{uid}/regions/{scopeCode}` 를 맞춘다.
 * 기본은 dry-run(쓰기 없음). `--apply` 일 때만 쓴다. regions 문서는 set(덮어쓰기)이라 몇 번 돌려도 같다.
 * 순위 점수·rides 는 건드리지 않는다. 이번 계산에 없는 기존 regions 문서는 지우지 않고 건수만 보고한다.
 *
 *   npm run admin:backfill-conquest-regions                         # dry-run
 *   npm run admin:backfill-conquest-regions -- --uid=UID --limit=50 # 한 명 / 앞 N명
 *   npm run admin:backfill-conquest-regions -- --apply              # 실제 쓰기 (에뮬레이터 또는 --confirm-prod)
 *
 * 계획: document/ops/20261103-global-geo-data/00-plan.md §4.4·§5
 */
import { FieldValue, getFirestore, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { chunkCenterLngLat } from "./conquestRegion.js";
import { auditRegionPlan, planRegionsFromChunks } from "./conquestRegionBackfill.js";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

type UserResult = {
  plan: ReturnType<typeof planRegionsFromChunks>;
  totalMeters: number;
  auditOk: boolean;
  staleRegionDocs: number;
  written: boolean;
};

async function readChunkCounts(userRef: DocumentReference): Promise<Map<string, number>> {
  const snap = await userRef.collection("chunks").get();
  const counts = new Map<string, number>();
  for (const d of snap.docs) {
    const cells = d.get("cells") as Record<string, unknown> | undefined;
    counts.set(d.id, cells ? Object.keys(cells).length : 0);
  }
  return counts;
}

/**
 * 한 사용자 처리. chunks 는 문서가 많아 트랜잭션 읽기 한도에 걸릴 수 있으니 먼저 읽고,
 * 요약 문서(`conquest/{uid}`)만 트랜잭션으로 다시 읽어 먼저 읽은 시점과 같은 버전일 때만 쓴다
 * (주행 트랜잭션이 요약을 갱신하면 버전이 달라지므로 최대 3번 다시 읽는다).
 * lastRideAt 은 사용자의 마지막 주행 endedAt 을 따로 조회하지 않고 요약의 updatedAt 을 쓴다
 * (요약은 주행마다 갱신되므로 마지막 주행 시각과 같거나 매우 가깝고, 조회 비용이 없다).
 */
async function processUser(db: Firestore, uid: string, apply: boolean): Promise<UserResult | null> {
  const userRef = db.doc(`conquest/${uid}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await userRef.get();
    if (!before.exists) return null;
    const counts = await readChunkCounts(userRef);
    const compute = (summary: { get(f: string): unknown }) => {
      const totalMeters = Number(summary.get("totalMeters") ?? 0) || 0;
      const plan = planRegionsFromChunks(totalMeters, counts, resolveGeoRegion);
      const seaChunks = [...counts.entries()].filter(([id, n]) => {
        if (n <= 0) return false;
        const c = chunkCenterLngLat(id);
        return !c || !resolveGeoRegion(c)?.geoCountry;
      }).length;
      return { totalMeters, plan, auditOk: auditRegionPlan(totalMeters, counts, plan, seaChunks) };
    };
    const existing = await userRef.collection("regions").listDocuments();
    const stale = (plan: UserResult["plan"]): number => {
      const keep = new Set(plan.map((p) => p.scopeCode));
      return existing.filter((r) => !keep.has(r.id)).length;
    };
    if (!apply) {
      const r = compute(before);
      return { ...r, staleRegionDocs: stale(r.plan), written: false };
    }
    const result = await db.runTransaction(async (tx) => {
      const cur = await tx.get(userRef);
      if (!cur.exists || !cur.updateTime || !before.updateTime || !cur.updateTime.isEqual(before.updateTime)) {
        return null; // 그 사이 주행이 요약을 바꿨다 → 다시 읽는다
      }
      const r = compute(cur);
      const lastRideAt = cur.get("updatedAt") ?? FieldValue.serverTimestamp();
      for (const t of r.plan) {
        tx.set(userRef.collection("regions").doc(t.scopeCode), {
          scopeType: t.scopeType,
          meters: t.meters,
          cells: t.cells,
          lastRideAt,
        });
      }
      return { ...r, staleRegionDocs: stale(r.plan), written: true };
    });
    if (result) return result;
  }
  throw new Error(`conquest/${uid}: 요약이 계속 바뀌어 3번 시도 후 중단`);
}

async function main(): Promise<void> {
  if (hasFlag("help") || hasFlag("h")) {
    console.info(`Usage:
  npm run admin:backfill-conquest-regions [-- --apply] [--uid=UID] [--limit=N] [--confirm-prod] [--projectId=id] [--serviceAccount=path]
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
    regionDocs: 0,
    wrote: 0,
    auditMismatchUsers: 0,
    staleRegionDocsKept: 0,
  };
  const byCountry: Record<string, { meters: number; cells: number }> = {};
  const mismatchUids: string[] = [];
  for (const uid of uids) {
    const r = await processUser(db, uid, apply);
    if (!r) {
      report.usersWithoutSummary += 1;
      continue;
    }
    report.regionDocs += r.plan.length;
    if (r.written) report.wrote += r.plan.length;
    report.staleRegionDocsKept += r.staleRegionDocs;
    if (!r.auditOk) {
      report.auditMismatchUsers += 1;
      mismatchUids.push(uid);
    }
    for (const t of r.plan) {
      if (t.scopeType !== "country") continue;
      const cur = byCountry[t.scopeCode] ?? { meters: 0, cells: 0 };
      cur.meters += t.meters;
      cur.cells += t.cells;
      byCountry[t.scopeCode] = cur;
    }
  }
  const top = Object.entries(byCountry)
    .sort((a, b) => b[1].meters - a[1].meters)
    .slice(0, 10);
  console.info(
    JSON.stringify({ ...report, topCountries: Object.fromEntries(top), mismatchUids: mismatchUids.slice(0, 20) }, null, 2),
  );
  if (!apply) console.info("[cli] dry-run only — 쓰려면 --apply");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

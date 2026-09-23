/**
 * 익명(Guest) Firebase Auth 계정 + 그 uid 귀속 Firestore 데이터 일괄 삭제.
 * 판정·삭제 대상 상세는 `purgeGuestUsersCore.ts` 헤더 주석 참고.
 *
 *   npm run admin:purge-guest-users                                  (조사만, 아무것도 안 지움)
 *   npm run admin:purge-guest-users -- --yes                         (실제 삭제, 전체)
 *   npm run admin:purge-guest-users -- --yes --limit=50              (실제 삭제, 50건 제한)
 *   npm run admin:purge-guest-users -- --serviceAccount=/abs/path.json
 */
import { getAuth } from "firebase-admin/auth";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import {
  buildPresenceIndex,
  countGuestUidData,
  deleteGuestAuthUser,
  deleteGuestUidFirestoreData,
  firestoreForGuestPurge,
  isAnonymousUserRecord,
  listGuestCandidates,
  type GuestDataCounts,
} from "./purgeGuestUsersCore.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const DEFAULT_PROJECT_ID = "boxcycle-dc2df";

function initFirebaseAdmin(): void {
  initFirebaseAdminForCli({
    projectId: arg("projectId")?.trim() || DEFAULT_PROJECT_ID,
    serviceAccountPath: arg("serviceAccount"),
  });
}

function outDir(): string {
  return resolve(
    process.cwd(),
    "..",
    "document",
    "ops",
    "20260923-first_ride",
    ".out",
    "guest-purge",
  );
}

function writeTargetListFile(mode: "dry-run" | "delete", counts: GuestDataCounts[]): string {
  const dir = outDir();
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = resolve(dir, `${stamp}_${mode}.json`);
  writeFileSync(filePath, JSON.stringify({ mode, generatedAt: new Date().toISOString(), uids: counts }, null, 2), "utf8");
  return filePath;
}

function printTable(counts: GuestDataCounts[]): void {
  for (const c of counts) {
    console.info(
      `  uid=${c.uid} users=${c.users} conquest=${c.conquestSummary}/${c.conquestChunks}chunks/${c.conquestTraces}traces ` +
        `rides=${c.rides} savedRoutes=${c.savedRoutes} tokenLedger=${c.routeTokenLedger} livePresence=${c.livePresence} ` +
        `openTrailListings=${c.openTrailListings} trailMembers=${c.trailMembers} pubSessionMembers=${c.publicationSessionMembers} ` +
        `livePubRides=${c.livePublicationRides} publicRouteRequests=${c.publicRouteRequests} ` +
        `[REPORT-ONLY routePublicationsOwned=${c.routePublicationsOwnedReportOnly} trailsHosted=${c.trailsHostedReportOnly}]`,
    );
  }
}

async function main(): Promise<void> {
  if (hasFlag("help") || hasFlag("h")) {
    console.info(`Usage:
  npm run admin:purge-guest-users -- [--yes] [--limit=N] [--serviceAccount=/abs/path.json]

기본(인자 없음)은 조사 전용 — 아무것도 지우지 않는다.
--yes 를 붙여야 Auth 계정 + Firestore 데이터를 실제로 삭제한다.
--limit=N 은 --yes 와 함께일 때만 삭제 건수를 제한한다(기본 무제한).`);
    return;
  }

  initFirebaseAdmin();
  const yes = hasFlag("yes");
  const limitArg = arg("limit");
  const limit = limitArg ? Number(limitArg) : undefined;
  if (limitArg && (!Number.isFinite(limit) || (limit as number) <= 0)) {
    console.error(`[cli] --limit 값이 잘못됐습니다: ${limitArg}`);
    process.exit(1);
  }

  console.info(yes ? "[DELETE] 익명 Guest 계정 실삭제 모드" : "[DRY-RUN] 익명 Guest 계정 조사 전용 모드");

  const { scannedAuthUsers, candidates, excludedAdminClaims } = await listGuestCandidates();
  console.info(
    `[cli] Auth 전체 스캔 ${scannedAuthUsers}건 중 익명 후보 ${candidates.length}건, admin claims 제외 ${excludedAdminClaims.length}건`,
  );
  if (excludedAdminClaims.length > 0) {
    console.info("[cli] admin claims 로 제외된 uid:");
    for (const e of excludedAdminClaims) console.info(`  - ${e.uid}: ${e.reason}`);
  }

  // 안전장치: 필터 로직이 잘못돼 provider 계정이 섞이면 즉시 중단.
  const auth = getAuth();
  for (const c of candidates) {
    const fresh = await auth.getUser(c.uid);
    if (!isAnonymousUserRecord(fresh)) {
      console.error(
        `[cli] ABORT — uid=${c.uid} 는 익명이 아닙니다(provider=${fresh.providerData.map((p) => p.providerId).join(",")}, email=${fresh.email ?? "none"}). 판정 로직 결함 — 삭제를 중단합니다.`,
      );
      process.exit(1);
    }
  }

  if (candidates.length === 0) {
    console.info("[cli] 익명 후보가 없습니다. 종료.");
    return;
  }

  const db = firestoreForGuestPurge();
  const presence = await buildPresenceIndex(db);

  const targets = yes && limit ? candidates.slice(0, limit) : candidates;
  const counts: GuestDataCounts[] = [];
  for (const c of targets) {
    counts.push(await countGuestUidData(db, c.uid, presence));
  }

  console.info(`\n[cli] 대상 ${counts.length}건(${yes ? "삭제 예정" : "조사만"}) 데이터 요약:`);
  printTable(counts);

  const listFile = writeTargetListFile(yes ? "delete" : "dry-run", counts);
  console.info(`\n[cli] 대상 uid 목록 저장: ${listFile}`);

  if (!yes) {
    console.info("\n[DRY-RUN] 아무것도 지우지 않았습니다. 실제로 지우려면 --yes 를 붙이세요.");
    return;
  }

  let authDeleted = 0;
  let firestoreDocsDeleted = 0;
  const failed: { uid: string; error: string }[] = [];

  for (const c of counts) {
    try {
      const docsDeleted = await deleteGuestUidFirestoreData(db, c.uid, presence);
      await deleteGuestAuthUser(auth, c.uid);
      authDeleted += 1;
      firestoreDocsDeleted += docsDeleted;
      console.info(`[DELETE] uid=${c.uid} ok — firestore ${docsDeleted}건 삭제`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      failed.push({ uid: c.uid, error: message });
      console.error(`[DELETE] uid=${c.uid} 실패 — ${message}`);
    }
  }

  console.info("\n[cli] 삭제 합계:");
  console.info(JSON.stringify({ authDeleted, firestoreDocsDeleted, failed: failed.length }, null, 2));
  if (failed.length > 0) {
    console.info("[cli] 실패 목록:");
    for (const f of failed) console.info(`  - ${f.uid}: ${f.error}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

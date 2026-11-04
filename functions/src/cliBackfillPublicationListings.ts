/**
 * 공개 경로 요약 목록 채우기(G2) — 기존 `routePublications` 전체로 `publicationListings` 를 맞춘다.
 * 기본은 dry-run(쓰기 없음). `--apply` 일 때만 쓴다. 내용이 같으면 다시 쓰지 않아 몇 번 돌려도 같다.
 * 원본(`routePublications`)에는 쓰지 않는다. 원본이 없거나 공개가 아닌 목록 문서(고아)는 지운다.
 *
 *   npm run admin:backfill-publication-listings                # dry-run
 *   npm run admin:backfill-publication-listings -- --apply     # 실제 쓰기 (운영은 Chief 승인 후)
 *
 * 완료 조건(계획 §5 G2): dry-run 의 wouldUpsert·wouldRemove = apply 의 upserted·removed.
 * 계획: document/ops/20261103-global-geo-data/00-plan.md §4.1
 */
import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { resolveGeoRegion } from "./geoRegion/geoRegionData.js";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import {
  buildPublicationListing,
  PUBLICATION_LISTINGS_COLLECTION,
  ROUTE_PUBLICATIONS_COLLECTION,
} from "./publicationListingCore.js";
import { syncPublicationListing } from "./publicationListingStore.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function readAll(collection: string): Promise<QueryDocumentSnapshot[]> {
  const db = getFirestore();
  const out: QueryDocumentSnapshot[] = [];
  let last: QueryDocumentSnapshot | null = null;
  for (;;) {
    let q = db.collection(collection).orderBy("__name__").limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    out.push(...snap.docs);
    if (snap.size < 300) break;
    last = snap.docs[snap.docs.length - 1]!;
  }
  return out;
}

async function main(): Promise<void> {
  if (hasFlag("help") || hasFlag("h")) {
    console.info(`Usage:
  npm run admin:backfill-publication-listings [-- --apply] [--projectId=id] [--serviceAccount=path]
  (기본 dry-run — --apply 일 때만 Firestore 에 쓴다)`);
    return;
  }
  initFirebaseAdminForCli({ projectId: arg("projectId"), serviceAccountPath: arg("serviceAccount") });
  const apply = hasFlag("apply");
  const db = getFirestore();

  const [publications, listings] = await Promise.all([
    readAll(ROUTE_PUBLICATIONS_COLLECTION),
    readAll(PUBLICATION_LISTINGS_COLLECTION),
  ]);
  const listingById = new Map(listings.map((d) => [d.id, d.data() as Record<string, unknown>]));

  const counts = { upserted: 0, unchanged: 0, removed: 0, absent: 0, orphanRemoved: 0 };
  const byCountry: Record<string, number> = {};
  for (const pub of publications) {
    const existing = listingById.get(pub.id) ?? null;
    listingById.delete(pub.id);
    const result = await syncPublicationListing(db, pub.id, pub.data(), resolveGeoRegion, { apply, existing });
    counts[result] += 1;
    if (result === "upserted" || result === "unchanged") {
      const key = buildPublicationListing(pub.id, pub.data(), resolveGeoRegion)?.geoCountry ?? "null";
      byCountry[key] = (byCountry[key] ?? 0) + 1;
    }
  }
  // 원본이 없는 목록 문서(원본 삭제 뒤 트리거 실패 등)
  for (const id of listingById.keys()) {
    counts.orphanRemoved += 1;
    if (apply) await db.collection(PUBLICATION_LISTINGS_COLLECTION).doc(id).delete();
  }

  console.info(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        publicationsScanned: publications.length,
        listingsBefore: listings.length,
        [apply ? "upserted" : "wouldUpsert"]: counts.upserted,
        unchanged: counts.unchanged,
        [apply ? "removed" : "wouldRemove"]: counts.removed + counts.orphanRemoved,
        notListed: counts.absent,
        listedByCountry: byCountry,
      },
      null,
      2,
    ),
  );
  if (!apply) console.info("[cli] dry-run only — 쓰려면 --apply");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

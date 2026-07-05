/**
 * Conquest v1(z16 타일) 잔재 정리 — 도로 전환(v2) 이후 유휴 데이터 삭제.
 * 대상: conquest/{uid}/chunks 의 z10 문서(`10_*`), pioneerChunks 전체,
 *       conquest/{uid} 요약의 legacy 필드(totalTiles·pioneerCount).
 * ⚠️ 출시 전 테스트 데이터 전용. --dry-run(기본) 으로 먼저 확인.
 *
 *   npm run admin:purge-conquest-v1                  (dry-run)
 *   npm run admin:purge-conquest-v1 -- --apply
 */
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });
  const apply = hasFlag("apply");
  const db = getFirestore();

  const report = {
    mode: apply ? "APPLY" : "dry-run",
    v1ChunkDocsDeleted: 0,
    pioneerChunkDocsDeleted: 0,
    summariesCleaned: 0,
  };

  // 사용자별 요약 + v1 청크
  const summaries = await db.collection("conquest").get();
  for (const s of summaries.docs) {
    const data = s.data();
    const hasLegacy = "totalTiles" in data || "pioneerCount" in data;
    if (hasLegacy) {
      report.summariesCleaned += 1;
      if (apply) {
        await s.ref.set(
          { totalTiles: FieldValue.delete(), pioneerCount: FieldValue.delete() },
          { merge: true },
        );
      }
    }
    const chunks = await s.ref.collection("chunks").get();
    for (const c of chunks.docs) {
      if (c.id.startsWith("10_")) {
        report.v1ChunkDocsDeleted += 1;
        if (apply) await c.ref.delete();
      }
    }
  }

  // 전역 pioneerChunks(v1 전용 컬렉션)
  const pioneers = await db.collection("pioneerChunks").get();
  for (const p of pioneers.docs) {
    report.pioneerChunkDocsDeleted += 1;
    if (apply) await p.ref.delete();
  }

  console.info(JSON.stringify(report, null, 2));
  if (!apply) console.info("실제 삭제하려면 -- --apply 를 붙이세요.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

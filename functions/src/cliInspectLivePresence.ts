/**
 * 임시 진단 — 지금 이 순간의 라이브 presence 전체를 한 번에 덤프.
 * 두 계정이 같은 퍼블릭 코스를 주행 중일 때 실행해 "soft 중복·비대칭"의 실제 소스를 특정한다.
 *
 *   npm run build && node lib/cliInspectLivePresence.js
 */
import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";

const now = Date.now();
function toMs(raw: unknown): number | null {
  if (raw && typeof raw === "object") {
    const s = (raw as { _seconds?: number })._seconds;
    if (typeof s === "number") return s * 1000;
    const fn = (raw as { toMillis?: () => number }).toMillis;
    if (typeof fn === "function") return fn.call(raw);
  }
  return null;
}
function age(raw: unknown): string {
  const ms = toMs(raw);
  return ms == null ? "NULL" : `${Math.round((now - ms) / 1000)}s`;
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({});
  const db = getFirestore();

  // 1) publicationSessions/{scope}/members — 동행 블록 소스
  console.info("\n===== publicationSessions (동행 블록) =====");
  const ps = await db.collection("publicationSessions").get();
  let anyPs = false;
  for (const d of ps.docs) {
    const mem = await d.ref.collection("members").get();
    if (mem.size === 0) continue;
    anyPs = true;
    const rows = mem.docs.map((m) => {
      const x = m.data();
      return `${m.id.slice(0, 8)}=${x.displayName}(${age(x.lastSeenAt)})`;
    });
    console.info(`  scope[${d.id}] (${mem.size}): ${rows.join(", ")}`);
  }
  if (!anyPs) console.info("  (members 있는 세션 없음)");

  // 2) trails/{id}/members — 접속 블록 소스 (최근 것만)
  console.info("\n===== trails/{id}/members (접속 블록, 최근 5분) =====");
  const trails = await db.collection("trails").get();
  let anyTm = false;
  for (const t of trails.docs) {
    const mem = await t.ref.collection("members").get();
    if (mem.size === 0) continue;
    const fresh = mem.docs.filter((m) => {
      const ms = toMs(m.data().lastSeenAt);
      return ms != null && now - ms < 300_000;
    });
    if (fresh.length === 0) continue;
    anyTm = true;
    const td = t.data();
    const rows = fresh.map((m) => `${m.id.slice(0, 8)}=${m.data().displayName}(${age(m.data().lastSeenAt)})`);
    console.info(
      `  trail#${td.displayNumber} [${t.id.slice(0, 10)}] pub=${td.publicationId?.slice?.(0, 10) ?? "none"} host=${td.hostUid?.slice?.(0, 8)}: ${rows.join(", ")}`,
    );
  }
  if (!anyTm) console.info("  (최근 members 있는 trail 없음)");

  // 3) trails/{id}/livePublicationRides — 지도 peer 궤적 소스 (최근 것만)
  console.info("\n===== trails/{id}/livePublicationRides (지도 peer, 최근 5분) =====");
  let anyLr = false;
  for (const t of trails.docs) {
    const lr = await t.ref.collection("livePublicationRides").get().catch(() => null);
    if (!lr || lr.size === 0) continue;
    const fresh = lr.docs.filter((m) => {
      const ms = toMs(m.data().updatedAt ?? m.data().lastSeenAt);
      return ms != null && now - ms < 300_000;
    });
    if (fresh.length === 0) continue;
    anyLr = true;
    const td = t.data();
    const rows = fresh.map((m) => {
      const x = m.data();
      return `${m.id.slice(0, 8)}=${x.displayName ?? "?"} pub=${x.publicationId?.slice?.(0, 8)} r=${(x.progressRatio ?? 0).toFixed?.(2)}(${age(x.updatedAt ?? x.lastSeenAt)})`;
    });
    console.info(`  trail#${td.displayNumber} [${t.id.slice(0, 10)}]: ${rows.join(", ")}`);
  }
  if (!anyLr) console.info("  (최근 live ride 없음)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

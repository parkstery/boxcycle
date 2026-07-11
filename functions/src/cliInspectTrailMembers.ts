/**
 * 임시 진단 — 특정 trail 의 members(presence) 를 덤프.
 * "참여 안 한 사람이 왜 접속자로 뜨나" 확인용.
 *
 *   npm run build && node lib/cliInspectTrailMembers.js --trail=1r6dgglhBVg1EAkBkp21
 *   npm run build && node lib/cliInspectTrailMembers.js --all       # members 있는 모든 trail
 */
import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";

function arg(name: string): string | undefined {
  const p = `--${name}=`;
  const h = process.argv.find((a) => a.startsWith(p));
  return h ? h.slice(p.length) : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
const STALE_MS = 240_000;

function toMs(raw: unknown): number | null {
  if (raw && typeof raw === "object" && "toMillis" in raw) {
    try {
      return (raw as { toMillis(): number }).toMillis();
    } catch {
      return null;
    }
  }
  return null;
}

async function dumpTrail(trailId: string): Promise<void> {
  const db = getFirestore();
  const snap = await db.collection("trails").doc(trailId).collection("members").get();
  console.info(`\n■ trail ${trailId} · members ${snap.size}`);
  const now = Date.now();
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const ms = toMs(data.lastSeenAt);
    const ageSec = ms == null ? null : Math.round((now - ms) / 1000);
    const active = ms == null ? "ACTIVE(null!)" : now - ms < STALE_MS ? "ACTIVE" : "stale";
    console.info(
      `  ${d.id.slice(0, 12)} name="${String(data.displayName ?? "")}" ` +
        `lastSeen=${ms == null ? "∅" : `${ageSec}s전`} → ${active}`,
    );
  }
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });
  const db = getFirestore();
  if (flag("all")) {
    const trails = await db.collection("trails").get();
    for (const t of trails.docs) {
      const m = await t.ref.collection("members").get();
      if (m.size > 0) await dumpTrail(t.id);
    }
  } else {
    const trail = arg("trail");
    if (!trail) {
      console.error("필수: --trail=<id> 또는 --all");
      process.exit(1);
    }
    await dumpTrail(trail);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Trail 문서가 얼마나 쌓였는지 재는 점검 — **읽기 전용. 아무것도 쓰지 않는다.**
 *
 * 왜 (2026-09-27) — 서버 정리기(`trailInstanceLifecycle`)는 `status == "closed"` 인 Trail만
 * 걷어 간다. 그런데 Trail 을 `closed` 로 만드는 코드는 「개설자가 주행 종료」 한 곳뿐이었고,
 * 그것이 개설자를 자기 Trail 에서 쫓아내는 결함이라 2026-09-27 에 제거했다.
 * 즉 **지금은 아무 Trail 도 정리 줄에 서지 못한다.** 그 전에도 개설자가 탭만 닫거나
 * 참여자만 있다가 흩어진 Trail 은 새고 있었다.
 *
 * 이 스크립트는 「얼마나 새고 있나」와 「어느 기준으로 닫으면 되나」를 **숫자로** 답한다.
 * 고치기 전에 재는 것이 목적이다 — 기간을 감으로 정하지 않기 위해.
 *
 *   cd functions
 *   npm run admin:audit-trails
 *   npm run admin:audit-trails -- --quietHours=24 --limit=3000 --samples=10
 */
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import {
  ARCHIVED_PURGE_MS,
  CLOSED_TO_ARCHIVED_MS,
  resolveArchivedAtMs,
  resolveClosedAtMs,
} from "./trailLifecycleCore.js";

const TRAILS_COLLECTION = "trails";
const LIVE_SUB = "livePublicationRides";
const MEMBERS_SUB = "members";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function num(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw == null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toMillis(raw: unknown): number | null {
  if (raw instanceof Timestamp) return raw.toMillis();
  if (typeof raw === "object" && raw !== null && typeof (raw as Timestamp).toMillis === "function") {
    const ms = (raw as Timestamp).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * 클라이언트와 **같은 해석**을 쓴다 — 모르는 값은 `open` 으로 본다.
 * (`firestoreOpenTrailListings` 의 listing 파싱과 같은 규칙)
 */
function readStatus(raw: unknown): "open" | "closed" | "archived" {
  return raw === "archived" ? "archived" : raw === "closed" ? "closed" : "open";
}

function readVisibility(raw: unknown): "open" | "private" {
  return raw === "private" ? "private" : "open";
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const AGE_BUCKETS: Array<[string, number]> = [
  ["1시간 미만", HOUR],
  ["1~24시간", DAY],
  ["1~7일", 7 * DAY],
  ["7~30일", 30 * DAY],
  ["30일 이상", Number.POSITIVE_INFINITY],
];

function bucketOf(ageMs: number): string {
  for (const [label, limit] of AGE_BUCKETS) {
    if (ageMs < limit) return label;
  }
  return "30일 이상";
}

function fmtAge(ms: number): string {
  if (!Number.isFinite(ms)) return "알 수 없음";
  if (ms < HOUR) return Math.round(ms / 60_000) + "분";
  if (ms < DAY) return (ms / HOUR).toFixed(1) + "시간";
  return (ms / DAY).toFixed(1) + "일";
}

async function hasAnyDoc(trailId: string, sub: string): Promise<boolean> {
  const snap = await getFirestore()
    .collection(TRAILS_COLLECTION)
    .doc(trailId)
    .collection(sub)
    .limit(1)
    .get();
  return !snap.empty;
}

type OpenRow = { id: string; ageMs: number };

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  const db = getFirestore();
  const limit = num("limit", 3000);
  const quietHours = num("quietHours", 24);
  const samples = num("samples", 8);
  const quietMs = quietHours * HOUR;
  const now = Date.now();

  const snap = await db.collection(TRAILS_COLLECTION).limit(limit).get();

  const byStatus = new Map<string, number>();
  const byVisibility = new Map<string, number>();
  const openAgeBuckets = new Map<string, number>();
  const byPublication = new Map<string, number>();
  const openRows: OpenRow[] = [];

  let noPublication = 0;
  let oldestId: string | null = null;
  let oldestAgeMs = -1;

  /*
   * 정리 줄이 막혔는지 본다. 판정은 **정리기가 쓰는 함수·상수를 그대로 가져다** 쓴다 —
   * 규칙을 베껴 두면 한쪽만 바뀌었을 때 점검이 딴 세상 숫자를 말한다.
   *   · closed 인데 24시간이 넘었다  → 보관 단계가 밀렸다
   *   · archived 인데 7일이 넘었다   → 삭제 단계가 밀렸다
   *   · 기준 시각이 셋 다 없다       → 정리기가 **영원히 건너뛴다**
   */
  let closedOverdue = 0;
  let closedStranded = 0;
  let archivedOverdue = 0;
  let archivedStranded = 0;
  const archivedAges: number[] = [];

  for (const doc of snap.docs) {
    if (doc.id === "default") continue;
    const d = doc.data();

    const status = readStatus(d.status);
    const visibility = readVisibility(d.visibility);
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byVisibility.set(visibility, (byVisibility.get(visibility) ?? 0) + 1);

    const pidRaw = d.publicationId;
    const pid = typeof pidRaw === "string" && pidRaw.trim() ? pidRaw.trim() : null;
    if (pid) byPublication.set(pid, (byPublication.get(pid) ?? 0) + 1);
    else noPublication += 1;

    const lastMs = toMillis(d.lastActivityAt) ?? toMillis(d.createdAt);
    const ageMs = lastMs == null ? Number.POSITIVE_INFINITY : now - lastMs;
    if (Number.isFinite(ageMs) && ageMs > oldestAgeMs) {
      oldestAgeMs = ageMs;
      oldestId = doc.id;
    }

    if (status === "closed") {
      const ms = resolveClosedAtMs(d as Record<string, unknown>, toMillis);
      if (ms == null) closedStranded += 1;
      else if (now - ms > CLOSED_TO_ARCHIVED_MS) closedOverdue += 1;
    }

    if (status === "archived") {
      const ms = resolveArchivedAtMs(d as Record<string, unknown>, toMillis);
      if (ms == null) archivedStranded += 1;
      else {
        archivedAges.push(now - ms);
        if (now - ms > ARCHIVED_PURGE_MS) archivedOverdue += 1;
      }
    }

    if (status === "open") {
      const b = bucketOf(ageMs);
      openAgeBuckets.set(b, (openAgeBuckets.get(b) ?? 0) + 1);
      openRows.push({ id: doc.id, ageMs });
    }
  }

  // 「닫아도 되는가」를 조용함만으로 정하지 않는다 — 실제로 비었는지 하위 문서로 확인한다.
  const quietOpen = openRows
    .filter((r) => r.ageMs >= quietMs)
    .sort((a, b) => b.ageMs - a.ageMs);

  const probeCount = Math.min(quietOpen.length, Math.max(0, samples));
  const probes: Array<{ id: string; ageMs: number; live: boolean; members: boolean }> = [];
  for (const r of quietOpen.slice(0, probeCount)) {
    const [live, members] = await Promise.all([
      hasAnyDoc(r.id, LIVE_SUB).catch(() => false),
      hasAnyDoc(r.id, MEMBERS_SUB).catch(() => false),
    ]);
    probes.push({ id: r.id, ageMs: r.ageMs, live, members });
  }

  const dupPubs = [...byPublication.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);

  console.log("=== Trail 문서 점검 (읽기 전용) ===");
  console.log("조회한 문서 " + snap.size + "개 (limit=" + limit + ")");
  if (snap.size >= limit) {
    console.log("  ⚠ 상한에 걸렸다 — 실제로는 더 많다. --limit 을 올려 다시 재라.");
  }

  console.log("");
  console.log("상태별:");
  for (const s of ["open", "closed", "archived"]) {
    console.log("  " + s.padEnd(9) + (byStatus.get(s) ?? 0));
  }
  console.log("공개여부별:");
  for (const v of ["open", "private"]) {
    console.log("  " + v.padEnd(9) + (byVisibility.get(v) ?? 0));
  }

  console.log("");
  console.log("열린(open) Trail — 마지막 활동 이후 경과:");
  for (const [label] of AGE_BUCKETS) {
    console.log("  " + label.padEnd(11) + (openAgeBuckets.get(label) ?? 0));
  }

  console.log("");
  console.log(
    "정리 후보 — 열려 있고 " + quietHours + "시간 넘게 조용함: " + quietOpen.length + "개",
  );
  if (probes.length > 0) {
    console.log("  그중 " + probes.length + "개를 실제로 열어 봄 (라이더·멤버 문서가 남아 있나):");
    for (const p of probes) {
      const flag = p.live || p.members ? "⚠ 남아 있음" : "비어 있음";
      console.log(
        "    " +
          p.id +
          "  조용 " +
          fmtAge(p.ageMs).padStart(7) +
          "  live=" +
          p.live +
          " members=" +
          p.members +
          "  " +
          flag,
      );
    }
    const dirty = probes.filter((p) => p.live || p.members).length;
    if (dirty > 0) {
      console.log("  ⚠ " + dirty + "개는 하위 문서가 남아 있다 — 닫기 전에 왜 남았는지 봐야 한다.");
    }
  }

  console.log("");
  console.log("정리 줄이 막혔나 (정리기와 같은 규칙으로 판정):");
  console.log(
    "  closed → archived 대기 " +
      Math.round(CLOSED_TO_ARCHIVED_MS / HOUR) +
      "시간 초과: " +
      closedOverdue +
      "개" +
      (closedOverdue > 0 ? "   ⚠ 보관 단계가 밀렸다" : ""),
  );
  console.log(
    "  archived → 삭제 대기 " +
      Math.round(ARCHIVED_PURGE_MS / DAY) +
      "일 초과: " +
      archivedOverdue +
      "개" +
      (archivedOverdue > 0 ? "   ⚠ 삭제 단계가 밀렸다" : ""),
  );
  if (closedStranded > 0 || archivedStranded > 0) {
    console.log(
      "  ⚠ 기준 시각이 없어 정리기가 영원히 건너뛰는 것: closed " +
        closedStranded +
        "개 · archived " +
        archivedStranded +
        "개",
    );
  }
  if (archivedAges.length > 0) {
    const sorted = [...archivedAges].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)] ?? 0;
    console.log(
      "  보관된 것들의 경과 — 최소 " +
        fmtAge(sorted[0] ?? 0) +
        " · 중앙값 " +
        fmtAge(mid) +
        " · 최대 " +
        fmtAge(sorted[sorted.length - 1] ?? 0),
    );
  }

  console.log("");
  console.log("경로(publicationId)가 없는 Trail: " + noPublication + "개");
  console.log("같은 경로로 만들어진 Trail (상위 " + Math.min(10, dupPubs.length) + "):");
  if (dupPubs.length === 0) {
    console.log("  (중복 없음)");
  } else {
    for (const [pid, n] of dupPubs.slice(0, 10)) {
      console.log("  " + String(n).padStart(4) + "개  " + pid);
    }
  }

  if (oldestId) {
    console.log("");
    console.log("가장 오래 조용한 Trail: " + oldestId + " — " + fmtAge(oldestAgeMs));
  }

  console.log("");
  console.log("※ 이 스크립트는 아무것도 쓰지 않았다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

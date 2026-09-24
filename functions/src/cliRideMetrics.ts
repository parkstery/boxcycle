/**
 * LF-4 관측 — 기존 rides(+ Auth provider 구분)만으로 산출(지시09 B).
 * 읽기 전용. 좌표·이메일·uid 목록 출력 금지.
 *
 *   npm run admin:ride-metrics
 *   npm run admin:ride-metrics -- --out=document/ops/20260923-first_ride/.out/jisi09/ride-metrics.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  Timestamp,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import {
  isDiscardableRideRecord,
  MIN_MEANINGFUL_RIDE_DISTANCE_METERS,
  MIN_MEANINGFUL_RIDE_DURATION_SEC,
} from "./rideRecordPolicy.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function toMillis(raw: unknown): number | null {
  if (raw instanceof Timestamp) return raw.toMillis();
  if (typeof raw === "object" && raw !== null && typeof (raw as Timestamp).toMillis === "function") {
    const ms = (raw as Timestamp).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

/** KST 달력 날짜 YYYY-MM-DD */
function dayKeyKst(ms: number): string {
  return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

type Cohort = "guest" | "provider";

type RideRow = {
  userId: string;
  ms: number;
  day: string;
  distanceMeters: number;
  newMeters: number;
};

type UserAgg = {
  cohort: Cohort;
  rides: RideRow[];
};

function pct(n: number, d: number): number | null {
  if (d <= 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

function summarize(users: Map<string, UserAgg>, cohort: Cohort | "all") {
  const list = [...users.values()].filter((u) => cohort === "all" || u.cohort === cohort);
  const withRide = list.filter((u) => u.rides.length >= 1);
  const accountN = list.length;
  const firstComplete = withRide.length;

  let secondIn72h = 0;
  let otherDayReuse = 0;
  let totalDist = 0;
  let totalNew = 0;
  let rideCount = 0;

  for (const u of withRide) {
    const sorted = [...u.rides].sort((a, b) => a.ms - b.ms);
    const first = sorted[0]!;
    const second = sorted[1];
    if (second && second.ms - first.ms <= 72 * 3600 * 1000) secondIn72h += 1;
    if (sorted.some((r) => r.day !== first.day)) otherDayReuse += 1;
    for (const r of sorted) {
      totalDist += r.distanceMeters;
      totalNew += r.newMeters;
      rideCount += 1;
    }
  }

  return {
    accounts: accountN,
    accountsWithValidRide: firstComplete,
    firstRideCompletionRatePct: pct(firstComplete, accountN),
    secondRideWithin72hRatePct: pct(secondIn72h, firstComplete),
    otherDayReuseRatePct: pct(otherDayReuse, firstComplete),
    newRoadClaimRatio: totalDist > 0 ? Math.round((totalNew / totalDist) * 1000) / 1000 : null,
    avgNewRoadKmPerRide:
      rideCount > 0 ? Math.round((totalNew / rideCount / 1000) * 1000) / 1000 : null,
    validRides: rideCount,
    totalDistanceKm: Math.round((totalDist / 1000) * 10) / 10,
    totalNewRoadKm: Math.round((totalNew / 1000) * 10) / 10,
  };
}

async function loadAuthCohorts(): Promise<Map<string, Cohort>> {
  const auth = getAuth();
  const out = new Map<string, Cohort>();
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      const isGuest = u.providerData.length === 0 || u.providerData.every((p) => p.providerId === "anonymous");
      out.set(u.uid, isGuest ? "guest" : "provider");
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return out;
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });
  const db = getFirestore();
  const cohorts = await loadAuthCohorts();

  const users = new Map<string, UserAgg>();
  for (const [uid, cohort] of cohorts) {
    users.set(uid, { cohort, rides: [] });
  }

  // rides 전량 스캔(페이지). 인덱스 없이 createdAt 정렬 실패 시 문서 id 순.
  let scanned = 0;
  let valid = 0;
  let discarded = 0;
  const pageSize = 500;
  let lastDoc: QueryDocumentSnapshot | null = null;

  for (;;) {
    let q: Query = db.collection("rides").orderBy("createdAt", "asc").limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    let snap;
    try {
      snap = await q.get();
    } catch {
      // createdAt 인덱스 없으면 비정렬 페이지
      let q2: Query = db.collection("rides").limit(pageSize);
      if (lastDoc) q2 = q2.startAfter(lastDoc);
      snap = await q2.get();
    }
    if (snap.empty) break;
    for (const d of snap.docs) {
      scanned += 1;
      const data = d.data() as Record<string, unknown>;
      const userId = typeof data.userId === "string" ? data.userId : "";
      if (!userId) continue;
      const distanceMeters = Number(data.distanceMeters);
      const elapsedSec = Number(data.elapsedSec);
      if (isDiscardableRideRecord(distanceMeters, elapsedSec)) {
        discarded += 1;
        continue;
      }
      const ms = toMillis(data.endedAt) ?? toMillis(data.createdAt);
      if (ms == null) continue;
      const conquest = data.conquestResult as Record<string, unknown> | undefined;
      const newMeters = Math.max(0, Number(conquest?.newMeters) || 0);
      if (!users.has(userId)) {
        // Auth 에 없는 uid(이미 삭제된 게스트 등) — provider 로 넣지 않고 guest 로 집계
        users.set(userId, { cohort: "guest", rides: [] });
      }
      users.get(userId)!.rides.push({
        userId,
        ms,
        day: dayKeyKst(ms),
        distanceMeters,
        newMeters,
      });
      valid += 1;
    }
    lastDoc = snap.docs[snap.docs.length - 1]!;
    if (snap.size < pageSize) break;
  }

  const payload = {
    measuredAt: new Date().toISOString(),
    policy: {
      minDistanceMeters: MIN_MEANINGFUL_RIDE_DISTANCE_METERS,
      minDurationSec: MIN_MEANINGFUL_RIDE_DURATION_SEC,
    },
    sampleNote:
      "Guest 대량 purge 이후 표본이 얕을 수 있다. Auth listUsers + rides 전량(유효만).",
    scannedRides: scanned,
    discardedRides: discarded,
    validRides: valid,
    authAccounts: cohorts.size,
    all: summarize(users, "all"),
    guest: summarize(users, "guest"),
    provider: summarize(users, "provider"),
  };

  const table = [
    ["지표", "전체", "Guest", "Provider"],
    ["계정 수", payload.all.accounts, payload.guest.accounts, payload.provider.accounts],
    [
      "첫 주행 완료율(%)",
      payload.all.firstRideCompletionRatePct,
      payload.guest.firstRideCompletionRatePct,
      payload.provider.firstRideCompletionRatePct,
    ],
    [
      "72h 내 2번째 주행률(%)",
      payload.all.secondRideWithin72hRatePct,
      payload.guest.secondRideWithin72hRatePct,
      payload.provider.secondRideWithin72hRatePct,
    ],
    [
      "다른 날 재사용(%)",
      payload.all.otherDayReuseRatePct,
      payload.guest.otherDayReuseRatePct,
      payload.provider.otherDayReuseRatePct,
    ],
    [
      "신규 도로 Claim 비율",
      payload.all.newRoadClaimRatio,
      payload.guest.newRoadClaimRatio,
      payload.provider.newRoadClaimRatio,
    ],
    [
      "주행당 평균 신규 도로 km",
      payload.all.avgNewRoadKmPerRide,
      payload.guest.avgNewRoadKmPerRide,
      payload.provider.avgNewRoadKmPerRide,
    ],
  ];

  console.info("\n=== ride-metrics ===\n");
  for (const row of table) {
    console.info(row.map((c) => String(c ?? "—")).join("\t"));
  }
  console.info("\n" + JSON.stringify(payload, null, 2));

  const outPath =
    arg("out") ??
    resolve("document/ops/20260923-first_ride/.out/jisi09/ride-metrics.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.info(`\nwrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

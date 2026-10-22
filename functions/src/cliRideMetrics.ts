/**
 * LF-4 관측 — 기존 rides(+ Auth provider 구분)만으로 산출(지시09 B).
 * 읽기 전용. 좌표·이메일·uid 목록 출력 금지.
 *
 *   npm run admin:ride-metrics
 *   npm run admin:ride-metrics -- --out=document/ops/20260923-first_ride/.out/jisi09/ride-metrics.json
 *   npm run admin:ride-metrics -- --exclude-internal   (관리자 목록 + config/adminDashboard.excludeUids 제외)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import {
  aggregateRideMetrics,
  loadAuthAccounts,
  loadExcludedUids,
  loadRideRows,
} from "./rideMetricsCore.js";
import {
  MIN_MEANINGFUL_RIDE_DISTANCE_METERS,
  MIN_MEANINGFUL_RIDE_DURATION_SEC,
} from "./rideRecordPolicy.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });
  const db = getFirestore();
  const accounts = await loadAuthAccounts();
  const { rows, scanned } = await loadRideRows(db);
  // 기본은 제외 없음. --exclude-internal 이면 관리자 목록 + config/adminDashboard.excludeUids 를 뺀다.
  const excludeUids = process.argv.includes("--exclude-internal")
    ? await loadExcludedUids(db)
    : new Set<string>();
  const agg = aggregateRideMetrics({
    accounts,
    rides: rows,
    excludeUids,
    nowMs: Date.now(),
    scannedRides: scanned,
  });

  const payload = {
    measuredAt: new Date().toISOString(),
    policy: {
      minDistanceMeters: MIN_MEANINGFUL_RIDE_DISTANCE_METERS,
      minDurationSec: MIN_MEANINGFUL_RIDE_DURATION_SEC,
    },
    sampleNote:
      "Guest 대량 purge 이후 표본이 얕을 수 있다. Auth listUsers + rides 전량(유효만).",
    scannedRides: agg.scannedRides,
    discardedRides: agg.discardedRides,
    validRides: agg.validRides,
    authAccounts: accounts.size,
    all: agg.metrics.all,
    guest: agg.metrics.guest,
    provider: agg.metrics.provider,
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

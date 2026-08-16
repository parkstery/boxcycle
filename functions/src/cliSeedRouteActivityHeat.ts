/**
 * red dot 렌더 검증용 테스트 시드(쓰기) — routeActivity 문서에 lastCompletedRideAt=지금 을 심는다.
 * 3분 주행 임계값을 우회해 "데이터가 신선할 때 red dot 이 그려지는가"만 격리 검증.
 *
 *   npm run admin:seed-route-activity-heat -- --publicationId=basic-intro-seoul-namsan
 *   npm run admin:seed-route-activity-heat -- --publicationId=basic-intro-seoul-namsan --clear
 *
 * 주의: 테스트 데이터다. 24h 지나면 자연히 윈도우 밖으로 빠지고, --clear 로 즉시 제거 가능.
 */
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { ROUTE_ACTIVITY_COLLECTION } from "./routeActivityConstants.js";

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

  const publicationId = arg("publicationId")?.trim();
  if (!publicationId) {
    console.error("필수: --publicationId=<id> (예: basic-intro-seoul-namsan)");
    process.exit(1);
  }

  const db = getFirestore();
  const ref = db.doc(`${ROUTE_ACTIVITY_COLLECTION}/${publicationId}`);

  if (hasFlag("clear")) {
    await ref.set(
      {
        lastCompletedRideAt: FieldValue.delete(),
        recentRideCount7d: 0,
      },
      { merge: true },
    );
    console.info(JSON.stringify({ cleared: publicationId }, null, 2));
    return;
  }

  await ref.set(
    {
      lastCompletedRideAt: Timestamp.now(),
      recentRideCount7d: FieldValue.increment(1),
      liveNow: false,
      activeRiderCount: 0,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const after = (await ref.get()).data();
  console.info(
    JSON.stringify(
      {
        seeded: publicationId,
        lastCompletedRideAt: "now",
        recentRideCount7d: after?.recentRideCount7d ?? null,
        note: "앱 새로고침 후 지도에서 red dot 확인. 끝나면 --clear 로 제거.",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

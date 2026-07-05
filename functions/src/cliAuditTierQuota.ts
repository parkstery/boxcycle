/**
 * Tier Quota 진단 — 특정 사용자에게 저장·신청 한도가 실제로 어떻게 적용되는지(읽기 전용).
 * "왜 free 인데 15건 넘게 저장됐나" 류 검증용.
 *
 *   npm run admin:audit-tier-quota -- --nickname=a111111
 *   npm run admin:audit-tier-quota -- --uid=<uid>
 */
import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdminForCli } from "./initAdminForCli.js";
import { isRouteReviewerUid } from "./savedRouteAdminPromoteCore.js";
import {
  kstMonthKey,
  limitsForTier,
  loadTierQuotaUsage,
  resolveEffectiveTier,
} from "./tierQuotaCore.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

/** 닉네임 → uid. `nicknames/{key}`(정규화 키) 우선, 실패 시 users 스캔. */
async function resolveUid(nickname: string): Promise<string | null> {
  const db = getFirestore();
  const key = nickname.trim().toLowerCase();
  const nickSnap = await db.doc(`nicknames/${key}`).get();
  const owner = nickSnap.data()?.ownerUid;
  if (typeof owner === "string" && owner) return owner;
  const q = await db.collection("users").where("nickname", "==", nickname.trim()).limit(1).get();
  return q.empty ? null : q.docs[0].id;
}

async function main(): Promise<void> {
  initFirebaseAdminForCli({
    projectId: arg("projectId"),
    serviceAccountPath: arg("serviceAccount"),
  });

  let uid = arg("uid")?.trim();
  const nickname = arg("nickname")?.trim();
  if (!uid && nickname) {
    uid = (await resolveUid(nickname)) ?? undefined;
  }
  if (!uid) {
    console.error("필수: --uid=<uid> 또는 --nickname=<닉네임>");
    process.exit(1);
  }

  const db = getFirestore();
  const userSnap = await db.doc(`users/${uid}`).get();
  const userData = userSnap.data() as Record<string, unknown> | undefined;

  const isReviewer = await isRouteReviewerUid(uid);
  const effectiveTier = await resolveEffectiveTier(uid);
  const limits = limitsForTier(effectiveTier);
  const usage = await loadTierQuotaUsage(uid);

  const monthlyBlocked =
    limits.saveRoutePerMonth != null &&
    usage.saveRouteCreatedThisMonth >= limits.saveRoutePerMonth;
  const activeBlocked =
    limits.saveRouteMaxActive != null &&
    usage.saveRouteActiveTotal >= limits.saveRouteMaxActive;

  console.info(
    JSON.stringify(
      {
        uid: uid.slice(0, 10),
        nickname: userData?.nickname ?? null,
        userDocTier: userData?.tier ?? "(none)",
        subscriptionStatus: userData?.subscriptionStatus ?? "(none)",
        "⚑ isRouteReviewer(=admin override)": isReviewer,
        "⚑ effectiveTier(quota 적용)": effectiveTier,
        month: kstMonthKey(),
        limits,
        usage,
        wouldBlockNextSave: monthlyBlocked || activeBlocked,
        verdict: isReviewer
          ? "리뷰어(admin) → 한도 무제한. 이것이 15건 초과 저장의 원인. config/routeReviewers 에서 uid 제거 시 free 한도 적용."
          : effectiveTier === "registered_paid"
            ? "유료 → 50/월·100 보유."
            : effectiveTier === "registered_free"
              ? monthlyBlocked || activeBlocked
                ? "free 한도 도달 — 다음 저장은 차단되어야 정상."
                : "free 인데 아직 한도 미도달(이번 달 createdAt 기준 카운트가 15 미만)."
              : "익명/기타.",
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

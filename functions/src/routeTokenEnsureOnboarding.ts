import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import {
  guestLifecycleBlockedHttpsError,
  permanentAuthHttpsError,
  transientStoreHttpsError,
  verifyUidForAdminHttp,
} from "./guestLifecycleHttp.js";
import { ensureRouteTokenOnboarding } from "./routeTokenCore.js";
import { mergeUserAuthMeta } from "./userTierCore.js";
import { REGION } from "./region.js";

/**
 * 로그인 직후 클라이언트가 1회 호출 — 온보딩 토큰 지급·잔액 표시.
 * POST + Bearer ID token, 응답 `{ result: { routeTokenBalance } }`.
 *
 * 삭제 예약·진행·실패·deleted tombstone 뒤에서는 users·routeTokenLedger 재생성 없이
 * 종료해야 한다(02-task-12 §1 — Task09 검수잔여). 공용 게이트(verifyIdToken(token, true)+marker)로
 * 입구를 끊고, mergeUserAuthMeta 실패는 더 삼키지 않는다 — 예전의
 * "users 메타 실패 → Guest(true) 보수 진행" fallback 도 제거해 metadata 실패 뒤 지급·외부비용이
 * 시작되지 않게 했다(02-task-12 §1).
 */
export const ensureRouteTokenOnboardingHttp = onRequest(
  {
    region: REGION,
    cors: true,
    invoker: "public",
  },
  async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Method Not Allowed");
      return;
    }

    const authHeader = req.get("Authorization") ?? "";
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      const err = new HttpsError("unauthenticated", "로그인 후에 사용할 수 있습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
      return;
    }

    // 공용 게이트 — checkRevoked=true + guestLifecycle tombstone 차단(null 이면 이미 응답됨).
    const uid = await verifyUidForAdminHttp(res, tokenMatch[1]);
    if (!uid) return;

    try {
      /*
       * users 메타 merge 실패는 삼키지 않는다(02-task-12 §1 — Task09 검수잔여).
       * 여기서 실패하면(예: verifyIdToken 뒤 삭제경합 getUser user-not-found) 온보딩 지급
       * transaction 이 아예 시작되지 않고 outer catch 가 guard 403·영구 Auth 401·일시 503·
       * 그 외 500 으로 정직 응답한다. 무조건 200/Guest hint fallback 은 금지다.
       */
      const { isAnonymous } = await mergeUserAuthMeta(uid);
      const routeTokenBalance = await ensureRouteTokenOnboarding(uid, isAnonymous);
      res.status(200).json({ result: { routeTokenBalance } });
    } catch (e: unknown) {
      if (e instanceof HttpsError) {
        res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
        return;
      }
      // transaction guard 의 tombstone 차단은 403, 일시 장애는 503, mergeUserAuthMeta 의
      // 영구 Auth 오류(삭제경합 user-not-found 등)는 401로 그대로 응답한다.
      const blocked = guestLifecycleBlockedHttpsError(e);
      if (blocked) {
        res.status(blocked.httpErrorCode.status).json({ error: blocked.toJSON() });
        return;
      }
      const transient = transientStoreHttpsError(e);
      if (transient) {
        res.status(transient.httpErrorCode.status).json({ error: transient.toJSON() });
        return;
      }
      const authGone = permanentAuthHttpsError(e);
      if (authGone) {
        console.warn("[onboarding] 계정이 Auth 에서 사라져 요청을 끊는다", e);
        res.status(authGone.httpErrorCode.status).json({ error: authGone.toJSON() });
        return;
      }
      console.error(e);
      const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
    }
  },
);

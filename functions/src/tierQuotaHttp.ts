import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import {
  guestLifecycleBlockedHttpsError,
  permanentAuthHttpsError,
  transientStoreHttpsError,
  verifyUidForAdminHttp,
} from "./guestLifecycleHttp.js";
import { assertTierQuota, type TierQuotaAction } from "./tierQuotaCore.js";
import { mergeUserAuthMeta } from "./userTierCore.js";
import { REGION } from "./region.js";

const ACTIONS: TierQuotaAction[] = ["save_route", "public_route_request", "create_event"];

function parseAction(body: unknown): TierQuotaAction {
  const raw =
    typeof body === "object" && body !== null && "action" in body
      ? (body as { action?: unknown }).action
      : undefined;
  if (typeof raw !== "string" || !ACTIONS.includes(raw as TierQuotaAction)) {
    throw new HttpsError(
      "invalid-argument",
      `action 은 ${ACTIONS.join(" | ")} 중 하나여야 합니다.`,
    );
  }
  return raw as TierQuotaAction;
}

/**
 * tier quota 선검사 — 저장·공개 신청 전 클라이언트 호출.
 * POST + Bearer, 본문 `{ "action": "save_route" | "public_route_request" | "create_event" }`
 */
export const assertTierQuotaHttp = onRequest(
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

    // 공용 게이트 — verifyIdToken(token, true) + guestLifecycle tombstone 차단(null 이면 이미 응답됨).
    const uid = await verifyUidForAdminHttp(res, tokenMatch[1]);
    if (!uid) return;

    try {
      const action = parseAction(req.body);
      /*
       * users 메타 merge 실패는 삼키지 않는다(02-task-12 §1). 실패하면 quota 조회 앞에서
       * outer catch 가 끊는다 — metadata 실패 뒤 사용자자료 작업 진행 금지.
       */
      await mergeUserAuthMeta(uid);
      const result = await assertTierQuota(uid, action);
      res.status(200).json({ result });
    } catch (e: unknown) {
      if (e instanceof HttpsError) {
        res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
        return;
      }
      // transaction guard 의 tombstone 차단은 403, 일시 장애는 503, mergeUserAuthMeta 의
      // 영구 Auth 오류(삭제경합 user-not-found 등)는 401로 응답한다.
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
        console.warn("[quota] 계정이 Auth 에서 사라져 요청을 끊는다", e);
        res.status(authGone.httpErrorCode.status).json({ error: authGone.toJSON() });
        return;
      }
      console.error(e);
      const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
    }
  },
);

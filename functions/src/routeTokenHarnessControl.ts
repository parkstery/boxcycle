import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { resolveHarnessActive } from "./harnessActive.js";
import {
  getHarnessFakeMapboxCallCount,
  resetHarnessFakeMapbox,
  setHarnessFakeMapboxFailNext,
} from "./harnessFakeMapbox.js";
import { ROUTE_TOKEN_LEDGER } from "./routeTokenCore.js";

type HarnessAction = "reset" | "stats" | "setFailNext" | "inspectUser";

function parseAction(raw: unknown): HarnessAction {
  if (raw === "reset" || raw === "stats" || raw === "setFailNext" || raw === "inspectUser") {
    return raw;
  }
  throw new HttpsError("invalid-argument", "action 이 올바르지 않습니다.");
}

/**
 * Route Token harness 전용 — Functions Emulator + RTW_ROUTE_TOKEN_HARNESS=1 일 때만 응답.
 * 운영·일반 localhost 에서는 404.
 */
export const routeTokenHarnessControl = onRequest(
  {
    region: "asia-northeast3",
    cors: false,
    invoker: "public",
  },
  async (req: Request, res: Response) => {
    if (!resolveHarnessActive(process.env)) {
      res.status(404).send("Not Found");
      return;
    }
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Method Not Allowed");
      return;
    }

    let rawBody: unknown = req.body;
    if (typeof rawBody === "string") {
      try {
        rawBody = JSON.parse(rawBody) as unknown;
      } catch {
        const err = new HttpsError("invalid-argument", "JSON 본문이 올바르지 않습니다.");
        res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
        return;
      }
    }

    try {
      const data = (rawBody as { data?: Record<string, unknown> } | null)?.data ?? {};
      const action = parseAction(data.action);

      if (action === "reset") {
        await resetHarnessFakeMapbox();
        res.status(200).json({ result: { providerCallCount: 0, failNext: false } });
        return;
      }

      if (action === "stats") {
        res.status(200).json({
          result: {
            providerCallCount: await getHarnessFakeMapboxCallCount(),
          },
        });
        return;
      }

      if (action === "setFailNext") {
        const fail = data.fail === true;
        await setHarnessFakeMapboxFailNext(fail);
        res.status(200).json({ result: { failNext: fail } });
        return;
      }

      const uid = typeof data.uid === "string" ? data.uid.trim() : "";
      if (!uid) {
        throw new HttpsError("invalid-argument", "uid 가 필요합니다.");
      }

      const db = getFirestore();
      const userSnap = await db.doc(`users/${uid}`).get();
      const balance =
        typeof userSnap.data()?.routeTokenBalance === "number"
          ? userSnap.data()!.routeTokenBalance
          : 0;

      const ledgerSnap = await db
        .collection(ROUTE_TOKEN_LEDGER)
        .where("userId", "==", uid)
        .get();

      const ledger = ledgerSnap.docs
        .map((doc) => {
          const row = doc.data();
          return {
            reason: row.reason ?? null,
            delta: typeof row.delta === "number" ? row.delta : 0,
            balanceAfter: typeof row.balanceAfter === "number" ? row.balanceAfter : null,
            idempotencyKey: row.idempotencyKey ?? null,
          };
        })
        .sort((a, b) => String(a.idempotencyKey).localeCompare(String(b.idempotencyKey)));

      const routeGenerateSpend = ledger.filter(
        (row) => row.reason === "route_generate" && row.delta < 0,
      ).length;

      res.status(200).json({
        result: {
          balance,
          ledger,
          routeGenerateSpend,
          providerCallCount: await getHarnessFakeMapboxCallCount(),
        },
      });
    } catch (e: unknown) {
      if (e instanceof HttpsError) {
        res.status(e.httpErrorCode.status).json({ error: e.toJSON() });
        return;
      }
      console.error(e);
      const err = new HttpsError("internal", "서버 오류가 발생했습니다.");
      res.status(err.httpErrorCode.status).json({ error: err.toJSON() });
    }
  },
);

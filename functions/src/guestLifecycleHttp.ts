/**
 * Guest 활동 갱신·Google 연결 lease HTTP 등록부.
 * 시각은 서버 Date.now() 만 쓴다. 본문의 timestamp 는 읽지 않는다.
 *
 * 인증 토큰 판정 계약:
 * - 만료·무효·사용중지 등 **영구 인증 오류**만 verifyToken null → handler 401.
 * - 토큰 검증 네트워크 오류·Auth 내부 장애 등 **일시 오류**는 예외로 전파하고
 *   runGuestLifecycleRequest 가 503 JSON 으로 응답한다(클라이언트는 상태 보존·재시도).
 * 정상 계정을 일시 장애로 401(강제 로그아웃)로 만들지 않는 계약이다.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onRequest, type Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import {
  GUEST_LIFECYCLE_BLOCKED_MESSAGE,
  assertGuestLifecycleWritable,
  isGuestLifecycleBlockedError,
} from "./guestLifecycleGuard.js";
import { handleGuestActivityRequest, handleGuestLinkRequest } from "./guestLifecycleHandlers.js";
import { guestLifecyclePortsFromAdmin, getRtdbOrNull } from "./guestLifecycleAdmin.js";
import { REGION } from "./region.js";

/**
 * 토큰이 만료·무효·폐기·사용중지·대상 유실인 영구 오류 코드. 새 코드는 기본 일시에 속한다 —
 * 모르는 코드를 영구로 분류하면 정상 Guest 를 일시 장애 때 강제 로그아웃시킨다(반대 방향이 안전).
 */
export const TOKEN_PERMANENT_ERROR_CODES: ReadonlySet<string> = new Set([
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/argument-error",
  "auth/user-not-found",
  "auth/user-disabled",
]);

export function isPermanentTokenVerificationError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && TOKEN_PERMANENT_ERROR_CODES.has(code);
}

/** null = 영구(401). throw = 일시(503 재시도). handler 계약은 이 두 갈래만 본다. */
export async function verifyToken(token: string): Promise<{ uid: string } | null> {
  try {
    const decoded = await getAuth().verifyIdToken(token, true);
    return { uid: decoded.uid };
  } catch (error) {
    if (isPermanentTokenVerificationError(error)) return null;
    throw error;
  }
}

export type GuestHttpResult = { status: number; body: Record<string, unknown> };

export const GUEST_TRANSIENT_HTTP_RESULT: GuestHttpResult = {
  status: 503,
  body: {
    error: {
      message: "일시적인 장애로 요청을 처리하지 못했습니다. 상태를 유지하고 잠시 후 다시 시도하십시오.",
      reason: "transient-failure",
    },
  },
};

type StatusJson = { status(code: number): { json(body: unknown): void }; };

/**
 * HTTP 입구 공용 토큰·tombstone 게이트 — index.ts 2종·routeTokenEnsureOnboarding·
 * tierQuotaHttp 의 반복 본문을 하나의 계약으로 고정한다(02-task-09 §2).
 *
 * - verifyIdToken(token, true): 서버가 끈 계정(disabled)의 기존 토큰도 거절한다.
 * - 영구 인증 오류는 종래 계약 그대로 401, 일시 오류는 무조건 401/정상으로 삼키지 않고
 *   HttpsError("unavailable") 503 JSON 으로 응답한다(클라이언트 상태 보존·재시도).
 * - 검증 뒤 guestLifecycle tombstone(삭제 예약·진행·실패·deleted)을 읽어 차단이면
 *   개인자료 생성 코드가 아예 실행되지 않게 403으로 끊는다. marker 조회가 일시 실패하면
 *   차단 상태를 모른다는 그 자체를 정상으로 삼지 않고 503으로 응답한다.
 * - 진짜 진행 중 transaction·지연 trigger 직렬화는 guestLifecycleGuard 의
 *   writer transaction 안 marker read가 담당한다(입구 게이트는 조기 종료일 뿐이다).
 *
 * 정상(토큰 유효 + marker 없음)은 uid 를 돌려준다. 그 외는 응답 후 null.
 */
export async function verifyUidForAdminHttp(res: StatusJson, token: string): Promise<string | null> {
  const respond = (error: HttpsError): null => {
    res.status(error.httpErrorCode.status).json({ error: error.toJSON() });
    return null;
  };

  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(token, true);
    uid = decoded.uid;
  } catch (error) {
    console.error("[guestLifecycle] admin http 토큰 검증 실패", error);
    if (isPermanentTokenVerificationError(error)) {
      // 영구 인증 오류는 본래 계약 그대로 401 — 상태를 끊지 않는다.
      return respond(new HttpsError("unauthenticated", "유효하지 않은 인증 토큰입니다."));
    }
    return respond(
      new HttpsError("unavailable", "일시적인 인증 장애입니다. 상태를 유지하고 잠시 후 다시 시도하십시오."),
    );
  }

  try {
    await assertGuestLifecycleWritable(getFirestore(), uid);
  } catch (error) {
    console.error("[guestLifecycle] admin http tombstone 게이트", error);
    if (isGuestLifecycleBlockedError(error)) {
      return respond(new HttpsError("permission-denied", GUEST_LIFECYCLE_BLOCKED_MESSAGE));
    }
    return respond(
      new HttpsError("unavailable", "일시적인 장애입니다. 상태를 유지하고 잠시 후 다시 시도하십시오."),
    );
  }
  return uid;
}

/**
 * 처리 과정에서 던져진 marker 차단 guard 오류를 HTTP 계약으로 바꾼다(403).
 * transaction guard 가 입구 검증 뒤의 경합(삭제 진행 중)을 잡았을 때 나온다.
 */
export function guestLifecycleBlockedHttpsError(error: unknown): HttpsError | null {
  if (isGuestLifecycleBlockedError(error)) {
    return new HttpsError("permission-denied", GUEST_LIFECYCLE_BLOCKED_MESSAGE);
  }
  return null;
}

/** mergeUserAuthMeta(Admin Auth getUser) 쪽 영구 Auth 오류 → 401. 토큰 검증 소스의 영구 집합과 공유한다. */
export function permanentAuthHttpsError(error: unknown): HttpsError | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && TOKEN_PERMANENT_ERROR_CODES.has(code)) {
    return new HttpsError("unauthenticated", "계정을 찾을 수 없어 요청을 처리하지 않습니다. 다시 로그인해 주시기 바랍니다.");
  }
  return null;
}

/** Firestore 일시 장애 코드 → 503. 문자열 계약 + Admin gRPC 숫자 코드 4/10/14. 그 외(null)는 호출 측 기존 처리(500)로 둔다. */
const TRANSIENT_STORE_ERROR_CODES: ReadonlySet<string> = new Set([
  "unavailable",
  "aborted",
  "deadline-exceeded",
]);

/**
 * Admin Firestore gRPC 오류 code 는 문자열("unavailable") 대신 숫자(14 UNAVAILABLE·10 ABORTED·
 * 4 DEADLINE_EXCEEDED)로 노출되는 계열이 있다(08-supervisor-admin-review). 숫자와 문자열이
 * 같은 503 분류를 받게 한다 — 숫자를 500이나 오류삼킴에 유출하지 않는다.
 */
const TRANSIENT_STORE_GRPC_CODES: ReadonlySet<number> = new Set([
  4, // DEADLINE_EXCEEDED
  10, // ABORTED
  14, // UNAVAILABLE
]);

export function transientStoreHttpsError(error: unknown): HttpsError | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && TRANSIENT_STORE_ERROR_CODES.has(code)) {
    return transientStoreHttpsResult();
  }
  if (typeof code === "number" && TRANSIENT_STORE_GRPC_CODES.has(code)) {
    return transientStoreHttpsResult();
  }
  return null;
}

function transientStoreHttpsResult(): HttpsError {
  return new HttpsError(
    "unavailable",
    "일시적인 장애입니다. 상태를 유지하고 잠시 후 다시 시도하십시오.",
  );
}

/** handler 결과를 응답한다. 여기서 throw 된 일시 장애는 401 로 줄이지 않고 503 JSON 이 된다. */
export async function runGuestLifecycleRequest(res: StatusJson, run: () => Promise<GuestHttpResult>): Promise<void> {
  let out: GuestHttpResult;
  try {
    out = await run();
  } catch (error) {
    console.error("[guestLifecycle] 일시 장애 — 클라이언트는 상태 보존·재시도", error);
    out = GUEST_TRANSIENT_HTTP_RESULT;
  }
  res.status(out.status).json(out.body);
}

export const guestActivityHttp = onRequest(
  { region: REGION, cors: true, invoker: "public", timeoutSeconds: 60 },
  async (req: Request, res: Response) => {
    await runGuestLifecycleRequest(res, async () => {
      const ports = await guestLifecyclePortsFromAdmin(getFirestore(), getAuth(), getRtdbOrNull(), Date.now());
      return handleGuestActivityRequest(
        { method: req.method, authorization: req.get("Authorization") ?? null },
        { nowMs: ports.nowMs, verifyToken, ports },
      );
    });
  },
);

export const guestLinkHttp = onRequest(
  { region: REGION, cors: true, invoker: "public", timeoutSeconds: 60 },
  async (req: Request, res: Response) => {
    await runGuestLifecycleRequest(res, async () => {
      const ports = await guestLifecyclePortsFromAdmin(getFirestore(), getAuth(), getRtdbOrNull(), Date.now());
      const body = typeof req.body === "object" && req.body !== null ? (req.body as { action?: unknown; leaseToken?: unknown }) : {};
      return handleGuestLinkRequest(
        {
          method: req.method,
          authorization: req.get("Authorization") ?? null,
          action: body.action,
          leaseToken: body.leaseToken,
        },
        { nowMs: ports.nowMs, verifyToken, ports },
      );
    });
  },
);

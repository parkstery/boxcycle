/**
 * Guest 활동·연결 lease HTTP 본문. Firebase 등록은 guestLifecycleHttp.ts.
 * 익명 여부는 토큰 claim 이 아니라 Auth 사용자 조회로 확정한다(core).
 */
import type { GuestLifecyclePorts } from "./guestLifecycleCore.js";
import {
  beginGuestLinkLease,
  cancelGuestLinkLease,
  completeGuestLink,
  recordGuestActivity,
} from "./guestLifecycleCore.js";

export type HandlerResult = { status: number; body: Record<string, unknown> };

function bearer(authorization: string | null): string | null {
  const match = (authorization ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function handleGuestActivityRequest(
  input: { method: string; authorization: string | null },
  deps: {
    nowMs: number;
    verifyToken: (token: string) => Promise<{ uid: string } | null>;
    ports: Pick<GuestLifecyclePorts, "store" | "auth">;
  },
): Promise<HandlerResult> {
  if (input.method !== "POST") return { status: 405, body: { error: { message: "Method Not Allowed" } } };
  const token = bearer(input.authorization);
  if (!token) return { status: 401, body: { error: { message: "로그인 후에 사용할 수 있습니다." } } };
  const verified = await deps.verifyToken(token);
  if (!verified) return { status: 401, body: { error: { message: "유효하지 않은 인증 토큰입니다." } } };
  const result = await recordGuestActivity(deps.ports, verified.uid, deps.nowMs);
  if (!result.ok && result.reason === "deletion-pending") {
    return { status: 409, body: { error: { message: "게스트 정리 중에는 활동을 연장할 수 없습니다.", reason: result.reason } } };
  }
  if (!result.ok) {
    return { status: 412, body: { error: { message: "게스트 계정만 활동 시각을 갱신합니다.", reason: result.reason } } };
  }
  return { status: 200, body: { result: { ok: true, lastActivityAtMs: result.lastActivityAtMs } } };
}

export async function handleGuestLinkRequest(
  input: { method: string; authorization: string | null; action: unknown; leaseToken: unknown },
  deps: {
    nowMs: number;
    verifyToken: (token: string) => Promise<{ uid: string } | null>;
    ports: Pick<GuestLifecyclePorts, "store" | "auth" | "rtdb">;
  },
): Promise<HandlerResult> {
  if (input.method !== "POST") return { status: 405, body: { error: { message: "Method Not Allowed" } } };
  const token = bearer(input.authorization);
  if (!token) return { status: 401, body: { error: { message: "로그인 후에 사용할 수 있습니다." } } };
  const verified = await deps.verifyToken(token);
  if (!verified) return { status: 401, body: { error: { message: "유효하지 않은 인증 토큰입니다." } } };
  const action = input.action;
  if (action === "begin") {
    const lease = await beginGuestLinkLease(deps.ports, verified.uid, deps.nowMs);
    if (!lease.ok && lease.reason === "deletion-pending") {
      return { status: 409, body: { error: { message: "정리 중인 게스트는 Google에 연결할 수 없습니다.", reason: lease.reason } } };
    }
    if (!lease.ok) {
      return { status: 412, body: { error: { message: "게스트 계정만 연결 lease를 받을 수 있습니다.", reason: lease.reason } } };
    }
    return { status: 200, body: { result: { ok: true, leaseToken: lease.leaseToken, leaseUntilMs: lease.leaseUntilMs } } };
  }
  if (typeof input.leaseToken !== "string" || input.leaseToken.length < 8) {
    return { status: 400, body: { error: { message: "leaseToken이 필요합니다." } } };
  }
  if (action === "cancel") {
    await cancelGuestLinkLease(deps.ports, verified.uid, input.leaseToken);
    return { status: 200, body: { result: { ok: true } } };
  }
  if (action === "complete") {
    const done = await completeGuestLink(deps.ports, verified.uid, input.leaseToken);
    if (!done.ok) {
      return { status: 412, body: { error: { message: "Google 연결을 확정하지 못했습니다.", reason: done.reason } } };
    }
    return { status: 200, body: { result: { ok: true, exempt: true } } };
  }
  return { status: 400, body: { error: { message: "action은 begin, complete, cancel 중 하나여야 합니다." } } };
}

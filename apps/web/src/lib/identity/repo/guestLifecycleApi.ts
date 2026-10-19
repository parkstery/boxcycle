/**
 * Guest 활동·Google 연결 lease. 본문에 시각을 넣지 않는다. 서버가 기록한다.
 */
import type { User } from "firebase/auth";
import { functionsHttpUrl } from "../../firebase/functionsEmulatorUrl";

type ErrorBody = { error?: { message?: string; reason?: string }; result?: { ok?: boolean; leaseToken?: string; leaseUntilMs?: number } };

async function postJson(url: string, token: string, body?: unknown): Promise<{ status: number; json: ErrorBody }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json: ErrorBody;
  try {
    json = (await res.json()) as ErrorBody;
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

export async function postGuestActivity(user: User): Promise<"ok" | "stop" | "retry"> {
  const token = await user.getIdToken();
  const { status, json } = await postJson(functionsHttpUrl("guestActivityHttp"), token);
  if (status === 409 || json.error?.reason === "deletion-pending") return "stop";
  if (status === 200 && json.result?.ok === true) return "ok";
  return "retry";
}

export async function postGuestLink(
  user: User,
  action: "begin" | "complete" | "cancel",
  leaseToken?: string,
): Promise<{ ok: true; leaseToken?: string } | { ok: false; reason: string | null; message: string | null }> {
  const token = await user.getIdToken();
  const { status, json } = await postJson(functionsHttpUrl("guestLinkHttp"), token, { action, leaseToken });
  if (status === 200 && json.result?.ok === true) {
    return { ok: true, leaseToken: json.result.leaseToken };
  }
  return { ok: false, reason: json.error?.reason ?? null, message: json.error?.message ?? null };
}

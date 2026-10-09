/**
 * Guest 로그아웃(=삭제) 서버 호출 — resetGuestHttp 가 Firestore·RTDB 데이터와 Auth 를 함께 지운다.
 * 진입점은 `identity/guestAccountReset.ts`.
 */
import type { User } from "firebase/auth";
import { functionsHttpUrl } from "../../firebase/functionsEmulatorUrl";

export async function postResetGuest(user: User): Promise<{ ok: boolean; errorMessage: string | null }> {
  const idToken = await user.getIdToken();
  const res = await fetch(functionsHttpUrl("resetGuestHttp"), {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  let json: { result?: { ok?: boolean }; error?: { message?: string } } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    json = {};
  }
  const ok = res.ok && json.result?.ok === true;
  const msg = json.error?.message?.trim();
  return { ok, errorMessage: ok ? null : msg || `서버 오류 (${res.status})` };
}

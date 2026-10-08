/**
 * 계정 탈퇴 — Firebase 를 아는 부분만(재인증·서버 호출·로그아웃).
 * 진입점·순서는 `account/accountDeletion.ts` (tierQuota 와 같은 2층 구조).
 */
import { GoogleAuthProvider, reauthenticateWithPopup, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "../../firebase/app";
import { functionsHttpUrl } from "../../firebase/functionsEmulatorUrl";

/** 현재 토큰이 기록한 마지막 로그인 시각(ms). 읽지 못하면 null — 그때는 재인증한다 */
export async function readAuthTimeMs(user: User): Promise<number | null> {
  try {
    const ms = Date.parse((await user.getIdTokenResult()).authTime);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

/**
 * 서버는 최근 5분 내 로그인만 탈퇴를 받는다 — Google 팝업으로 다시 인증한다.
 *
 * 계정 선택 화면(prompt: select_account)을 띄우지 않는다(2026-10-09 Chief): 탈퇴 대상은
 * 이미 로그인한 이 계정뿐이라 「어느 계정?」 은 묻지 않는다. login_hint 로 이 계정을 지정하면
 * Google 은 보통 선택 없이 확인만 하고 닫힌다. 다른 계정을 고르면 auth/user-mismatch 로 거절된다.
 */
export async function reauthenticateWithGoogle(user: User): Promise<void> {
  const provider = new GoogleAuthProvider();
  if (user.email) provider.setCustomParameters({ login_hint: user.email });
  await reauthenticateWithPopup(user, provider);
}

/** Firebase Auth 오류 코드(없으면 null) */
export function authErrorCode(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

export type DeleteAccountHttpResponse = {
  ok: boolean;
  status: number;
  errorMessage: string | null;
};

export async function postDeleteAccount(user: User, confirmPhrase: string): Promise<DeleteAccountHttpResponse> {
  // 재인증 직후 새 토큰(auth_time 갱신)을 강제로 받는다
  const idToken = await user.getIdToken(true);
  const res = await fetch(functionsHttpUrl("deleteAccountHttp"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ confirmPhrase }),
  });
  let json: { result?: { ok?: boolean }; error?: { message?: string } } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    json = {};
  }
  const ok = res.ok && json.result?.ok === true;
  const errorMessage =
    typeof json.error?.message === "string" && json.error.message.trim() ? json.error.message.trim() : null;
  return { ok, status: res.status, errorMessage };
}

/** 서버가 Auth 계정을 지운 뒤 — 클라이언트 세션 정리(이미 없는 사용자여도 안전) */
export async function signOutAfterDeletion(): Promise<void> {
  try {
    await signOut(getFirebaseAuth());
  } catch {
    /* 계정이 이미 지워져 실패해도 무시 — 아래 로컬 정리가 세션을 끊는다 */
  }
}

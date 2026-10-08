/**
 * 계정 탈퇴 진입점(2026-10-06 Chief 결정 — document/ops/20261006-account-deletion/01-plan.md §7).
 *
 * 순서: (필요할 때만) Google 재인증 → 서버 탈퇴(deleteAccountHttp: 구독 해지·데이터 삭제/익명화·Auth 삭제)
 *       → 로그아웃 → 이 기기의 앱 데이터 정리.
 * 게스트(익명)는 서버 탈퇴 대상이 아니다 — 「이 기기 데이터 지우기」(identity/guestAccountReset).
 */
import type { User } from "firebase/auth";
import { clearAppLocalStorage, clearFirebaseAuthIndexedDb } from "../identity/guestAccountReset";
import {
  authErrorCode,
  postDeleteAccount,
  readAuthTimeMs,
  reauthenticateWithGoogle,
  signOutAfterDeletion,
} from "./repo/accountDeletionApi";

/** 사용자가 직접 입력해야 하는 확인 문구 — 서버(accountDeletionCore)와 같다 */
export const ACCOUNT_DELETION_CONFIRM_PHRASE = "탈퇴";

export function isDeletionConfirmPhrase(typed: string): boolean {
  return typed.trim() === ACCOUNT_DELETION_CONFIRM_PHRASE;
}

export class AccountDeletionError extends Error {}

/**
 * 서버 허용 창(accountDeletionCore ACCOUNT_DELETION_MAX_AUTH_AGE_SEC = 5분)보다 짧게 잡는다 —
 * 확인 문구를 치는 사이 창이 닫혀 서버에서 거절되지 않도록 1분 여유.
 */
export const REAUTH_SKIP_MAX_AGE_MS = 4 * 60 * 1000;

/** 방금 로그인했다면 Google 창을 다시 띄우지 않는다. 시각을 모르면 재인증한다 */
export function needsReauthForDeletion(authTimeMs: number | null, nowMs: number): boolean {
  if (authTimeMs === null || !Number.isFinite(authTimeMs)) return true;
  const ageMs = nowMs - authTimeMs;
  return ageMs < 0 || ageMs > REAUTH_SKIP_MAX_AGE_MS;
}

export async function deleteMyAccount(user: User, confirmPhrase: string): Promise<void> {
  if (user.isAnonymous) {
    throw new AccountDeletionError("게스트는 「이 기기 데이터 지우기」를 사용하세요.");
  }
  if (!isDeletionConfirmPhrase(confirmPhrase)) {
    throw new AccountDeletionError(`확인 문구 「${ACCOUNT_DELETION_CONFIRM_PHRASE}」를 입력하세요.`);
  }
  if (needsReauthForDeletion(await readAuthTimeMs(user), Date.now())) {
    try {
      await reauthenticateWithGoogle(user);
    } catch (e) {
      if (authErrorCode(e) === "auth/user-mismatch") {
        throw new AccountDeletionError(
          `로그인한 계정(${user.email ?? "현재 계정"})으로만 확인할 수 있습니다. 다른 계정은 탈퇴되지 않았습니다.`,
        );
      }
      throw new AccountDeletionError("본인 확인이 취소되었거나 실패했습니다.");
    }
  }
  const res = await postDeleteAccount(user, confirmPhrase);
  if (!res.ok) {
    throw new AccountDeletionError(res.errorMessage ?? `탈퇴 처리에 실패했습니다. (${res.status})`);
  }
  await signOutAfterDeletion();
  clearAppLocalStorage();
  await clearFirebaseAuthIndexedDb();
}

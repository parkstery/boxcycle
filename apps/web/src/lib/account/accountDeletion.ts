/**
 * 계정 탈퇴 진입점(2026-10-06 Chief 결정 — document/ops/20261006-account-deletion/01-plan.md §7).
 *
 * 순서: Google 재인증 → 서버 탈퇴(deleteAccountHttp: 구독 해지·데이터 삭제/익명화·Auth 삭제)
 *       → 로그아웃 → 이 기기의 앱 데이터 정리.
 * 게스트(익명)는 서버 탈퇴 대상이 아니다 — 「이 기기 데이터 지우기」(identity/guestAccountReset).
 */
import type { User } from "firebase/auth";
import { clearAppLocalStorage, clearFirebaseAuthIndexedDb } from "../identity/guestAccountReset";
import {
  postDeleteAccount,
  reauthenticateWithGoogle,
  signOutAfterDeletion,
} from "./repo/accountDeletionApi";

/** 사용자가 직접 입력해야 하는 확인 문구 — 서버(accountDeletionCore)와 같다 */
export const ACCOUNT_DELETION_CONFIRM_PHRASE = "탈퇴";

export function isDeletionConfirmPhrase(typed: string): boolean {
  return typed.trim() === ACCOUNT_DELETION_CONFIRM_PHRASE;
}

export class AccountDeletionError extends Error {}

export async function deleteMyAccount(user: User, confirmPhrase: string): Promise<void> {
  if (user.isAnonymous) {
    throw new AccountDeletionError("게스트는 「이 기기 데이터 지우기」를 사용하세요.");
  }
  if (!isDeletionConfirmPhrase(confirmPhrase)) {
    throw new AccountDeletionError(`확인 문구 「${ACCOUNT_DELETION_CONFIRM_PHRASE}」를 입력하세요.`);
  }
  try {
    await reauthenticateWithGoogle(user);
  } catch {
    throw new AccountDeletionError("Google 재인증이 취소되었거나 실패했습니다.");
  }
  const res = await postDeleteAccount(user, confirmPhrase);
  if (!res.ok) {
    throw new AccountDeletionError(res.errorMessage ?? `탈퇴 처리에 실패했습니다. (${res.status})`);
  }
  await signOutAfterDeletion();
  clearAppLocalStorage();
  await clearFirebaseAuthIndexedDb();
}

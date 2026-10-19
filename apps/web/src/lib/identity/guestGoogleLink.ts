/**
 * Guest → Google 연결.
 * 팝업은 lease 응답을 기다리지 않고 클릭 턴에서 연다. 사용자 활성화가 끊기면 브라우저가 팝업을 막는다.
 * 이미 있는 Google 계정으로 바꾸는 경우 어느 쪽 데이터도 지우지 않는다.
 */
export type GuestLinkLeaseResult =
  | { ok: true; leaseToken?: string }
  | { ok: false; reason: string | null; message: string | null };

export type GuestGoogleLinkOutcome = "linked" | "existing" | "cancelled" | "blocked" | "blocked-linked";

export async function runGuestGoogleLink(actions: {
  beginLease: () => Promise<GuestLinkLeaseResult>;
  openLinkPopup: () => Promise<void>;
  completeLease: (token: string) => Promise<void>;
  cancelLease: (token: string) => Promise<void>;
  signIntoExistingAccount: (error: unknown) => Promise<void>;
  isExistingAccountError: (error: unknown) => boolean;
  isPopupCancel: (error: unknown) => boolean;
}): Promise<GuestGoogleLinkOutcome> {
  const leasePromise = actions.beginLease();
  const popupPromise = actions.openLinkPopup();
  let lease: GuestLinkLeaseResult;
  try {
    lease = await leasePromise;
  } catch (error) {
    lease = {
      ok: false,
      reason: null,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const token = lease.ok ? lease.leaseToken : undefined;
  if (!lease.ok && lease.reason === "deletion-pending") {
    try {
      await popupPromise;
      return "blocked-linked";
    } catch {
      return "blocked";
    }
  }
  try {
    await popupPromise;
  } catch (error) {
    if (token) await actions.cancelLease(token).catch(() => undefined);
    if (actions.isPopupCancel(error)) return "cancelled";
    if (actions.isExistingAccountError(error)) {
      await actions.signIntoExistingAccount(error);
      return "existing";
    }
    throw error;
  }
  if (token) await actions.completeLease(token).catch(() => undefined);
  return "linked";
}

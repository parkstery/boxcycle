/**
 * 복원된 인증을 앱에 넘기기 전에 서버에서 확인한다.
 * 확정된 만료만 세션을 지우고, 네트워크 오류는 쓰기를 막은 채 재시도한다.
 */
const AUTH_EXPIRED_CODES = new Set([
  "auth/user-not-found",
  "auth/user-disabled",
  "auth/user-token-expired",
  "auth/invalid-user-token",
  "auth/user-token-revoked",
  "auth/id-token-expired",
  "auth/id-token-revoked",
]);

type AuthVerifyKind = "ready" | "expired" | "offline";

export type RestoredAuthUser = {
  reload: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

export function authErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

function classifyAuthVerificationFailure(error: unknown): Exclude<AuthVerifyKind, "ready"> {
  const code = authErrorCode(error);
  if (code && AUTH_EXPIRED_CODES.has(code)) return "expired";
  return "offline";
}

/** 계정이 없다는 확인만 캐시를 지운다. 비활성·토큰 무효(삭제 예약·일시 차단)는 기록을 남긴다. */
export function expiryClearsUidCache(code: string | null): boolean {
  return code === "auth/user-not-found";
}

export type AuthVerifyResult =
  | { kind: "ready" }
  | { kind: "expired"; code: string | null; clearCache: boolean }
  | { kind: "offline"; code: string | null };

export async function verifyRestoredAuthUser(user: RestoredAuthUser): Promise<AuthVerifyResult> {
  try {
    await user.reload();
    await user.getIdToken(true);
    return { kind: "ready" };
  } catch (error) {
    const code = authErrorCode(error);
    const kind = classifyAuthVerificationFailure(error);
    if (kind === "expired") return { kind, code, clearCache: expiryClearsUidCache(code) };
    return { kind: "offline", code };
  }
}

export function authExpiryNoticeText(kind: AuthExpiryKind): string {
  if (kind === "guest-expired") {
    return "게스트 체험이 만료되었습니다. 30일간 사용하지 않으면 기록이 정리됩니다.";
  }
  return "이 계정은 더 이상 사용할 수 없습니다.";
}

export type AuthExpiryKind = "guest-expired" | "account-unavailable";

type AuthExposurePhase = "booting" | "verifying" | "ready" | "offline" | "expired";

export type AuthExposure = {
  phase: AuthExposurePhase;
  exposedUid: string | null;
  pendingUid: string | null;
  blockAutoAnonymous: boolean;
  expiryKind: AuthExpiryKind | null;
};

export const INITIAL_AUTH_EXPOSURE: AuthExposure = {
  phase: "booting",
  exposedUid: null,
  pendingUid: null,
  blockAutoAnonymous: true,
  expiryKind: null,
};

export type AuthExposureEvent =
  | { type: "cleared" }
  | { type: "early-null" }
  | { type: "persistence-empty" }
  | { type: "guest-restore-unconfirmed" }
  | { type: "restore-wait-failed" }
  | { type: "expiry-sign-out"; kind: AuthExpiryKind }
  | { type: "candidate"; uid: string }
  | { type: "verified"; uid: string }
  | { type: "offline"; uid: string }
  | { type: "expired"; uid: string; kind: AuthExpiryKind };

export function reduceAuthExposure(state: AuthExposure, event: AuthExposureEvent): AuthExposure {
  switch (event.type) {
    case "candidate":
      return {
        phase: "verifying",
        exposedUid: null,
        pendingUid: event.uid,
        blockAutoAnonymous: true,
        expiryKind: state.expiryKind,
      };
    case "verified":
      if (state.pendingUid !== event.uid) return state;
      return {
        phase: "ready",
        exposedUid: event.uid,
        pendingUid: null,
        blockAutoAnonymous: false,
        expiryKind: null,
      };
    case "offline":
      if (state.pendingUid !== event.uid) return state;
      return {
        phase: "offline",
        exposedUid: null,
        pendingUid: event.uid,
        blockAutoAnonymous: true,
        expiryKind: null,
      };
    case "expired":
      if (state.pendingUid !== event.uid) return state;
      return {
        phase: "expired",
        exposedUid: null,
        pendingUid: null,
        blockAutoAnonymous: true,
        expiryKind: event.kind,
      };
    case "early-null":
      if (state.phase !== "booting") return state;
      return { ...state, exposedUid: null, pendingUid: null, blockAutoAnonymous: true };
    case "persistence-empty":
      if (state.phase !== "booting") return state;
      return {
        phase: "ready",
        exposedUid: null,
        pendingUid: null,
        blockAutoAnonymous: false,
        expiryKind: null,
      };
    case "guest-restore-unconfirmed":
      if (state.phase !== "booting") return state;
      return {
        phase: "expired",
        exposedUid: null,
        pendingUid: null,
        blockAutoAnonymous: true,
        expiryKind: "guest-expired",
      };
    case "restore-wait-failed":
      if (state.phase !== "booting") return state;
      return {
        phase: "offline",
        exposedUid: null,
        pendingUid: null,
        blockAutoAnonymous: true,
        expiryKind: null,
      };
    case "expiry-sign-out":
      return {
        phase: "expired",
        exposedUid: null,
        pendingUid: null,
        blockAutoAnonymous: true,
        expiryKind: event.kind,
      };
    case "cleared":
      if (state.phase === "expired" || state.phase === "booting") return state;
      return {
        phase: "ready",
        exposedUid: null,
        pendingUid: null,
        blockAutoAnonymous: false,
        expiryKind: null,
      };
    default:
      return state;
  }
}

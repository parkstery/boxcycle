import { reportRouteTokenSpend } from "../lib/account/routeTokenSpendBridge";

/** 서버 `HttpsError.toJSON().status`(대문자 스네이크) → 클라이언트 `FirebaseError.code` 근사치 */
export function wireStatusToFunctionsCode(status: string | undefined): string | undefined {
  if (!status) return undefined;
  const map: Record<string, string> = {
    UNAUTHENTICATED: "functions/unauthenticated",
    NOT_FOUND: "functions/not-found",
    INVALID_ARGUMENT: "functions/invalid-argument",
    INTERNAL: "functions/internal",
    FAILED_PRECONDITION: "functions/failed-precondition",
    UNAVAILABLE: "functions/unavailable",
    PERMISSION_DENIED: "functions/permission-denied",
    RESOURCE_EXHAUSTED: "functions/resource-exhausted",
  };
  return map[status] ?? "functions/internal";
}

/** 같은 requestId 로 연속 호출되면 한 번만 보고한다. 호출처마다 자기 상태를 따로 가진다. */
export function createRouteTokenSpendReporter(): (
  uid: string,
  balance: number,
  requestId: string,
) => void {
  let lastSpendFeedbackRequestId: string | null = null;
  return (uid, balance, requestId) => {
    if (lastSpendFeedbackRequestId === requestId) return;
    lastSpendFeedbackRequestId = requestId;
    reportRouteTokenSpend(uid, balance, requestId);
  };
}

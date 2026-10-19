/**
 * 「게스트로 시작」이 기존 익명 세션을 다시 쓸지, 하나를 만들지, 만들지 말고 기다릴지.
 * localStorage uid 만으로 로그인하지 않는다.
 */
export type GuestStartDecision = "reuse" | "create" | "hold-blocked" | "hold-offline" | "switch-from-google";

export function decideGuestStart(input: {
  hasAnonymousSession: boolean;
  hasGoogleSession: boolean;
  verifyKind: "ready" | "expired" | "offline" | "none";
  code: string | null;
  activity: "ok" | "stop" | "retry" | "none";
}): GuestStartDecision {
  if (input.hasGoogleSession) return "switch-from-google";
  if (!input.hasAnonymousSession) return "create";
  if (input.verifyKind === "offline" || input.activity === "retry") return "hold-offline";
  if (input.verifyKind === "ready" && input.activity === "ok") return "reuse";
  if (input.verifyKind === "ready" && input.activity === "stop") return "hold-blocked";
  if (input.verifyKind === "expired" && input.code === "auth/user-not-found") return "create";
  if (input.verifyKind === "expired") return "hold-blocked";
  return "hold-offline";
}

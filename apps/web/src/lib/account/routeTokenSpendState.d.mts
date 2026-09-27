export type SpendSession = {
  uid: string | null;
  subscribedBalance: number | null;
  routeResponseBalance: number | null;
  lastSpendMessage: string | null;
  lastSpendRequestId: string | null;
};

export function createEmptySession(uid?: string | null): SpendSession;
export function bindUser(session: SpendSession, uid: string | null): SpendSession;
export function computeEffectiveBalance(session: SpendSession): number | null;
export function convergeResponse(session: SpendSession): SpendSession;
export function applySubscribedBalance(session: SpendSession, balance: number | null): SpendSession;
export function applyRouteSpend(
  session: SpendSession,
  balance: number,
  requestId: string,
  formatSpendMessage: (balance: number) => string,
): SpendSession;
export function isInsufficient(session: SpendSession): boolean;

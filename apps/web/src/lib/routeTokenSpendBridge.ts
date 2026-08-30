import { formatRouteTokenSpendMessage } from "./directionsDirectGuard";
import {
  applyRouteSpend,
  applySubscribedBalance,
  bindUser,
  computeEffectiveBalance,
  createEmptySession,
  isInsufficient,
} from "./routeTokenSpendState.mjs";

export {
  formatRouteTokenHoldingMessage,
  ROUTE_TOKEN_COST_HINT,
  ROUTE_TOKEN_INSUFFICIENT_HINT,
} from "./routeTokenUiCopy";

type BalanceListener = (effective: number | null, insufficient: boolean) => void;
type MessageListener = (message: string | null) => void;

type SpendSession = ReturnType<typeof createEmptySession>;

let session: SpendSession = createEmptySession();

const balanceListeners = new Set<BalanceListener>();
const messageListeners = new Set<MessageListener>();

function notifyBalance() {
  const effective = computeEffectiveBalance(session);
  const insufficient = isInsufficient(session);
  for (const listener of balanceListeners) {
    listener(effective, insufficient);
  }
}

function notifyMessage() {
  for (const listener of messageListeners) {
    listener(session.lastSpendMessage);
  }
}

export function getActiveRouteTokenUserId(): string | null {
  return session.uid;
}

export function bindRouteTokenUser(uid: string | null): void {
  session = bindUser(session, uid);
  notifyBalance();
  notifyMessage();
}

export function setSubscribedRouteTokenBalance(uid: string | null, balance: number | null): void {
  if (uid !== session.uid) return;
  session = applySubscribedBalance(session, balance);
  notifyBalance();
}

export function reportRouteTokenSpend(uid: string, balance: number, requestId: string): void {
  if (uid !== session.uid) return;
  session = applyRouteSpend(session, balance, requestId, formatRouteTokenSpendMessage);
  notifyBalance();
  notifyMessage();
}

export function getRouteTokenInsufficient(uid?: string | null): boolean {
  if (uid != null && uid !== session.uid) return false;
  return isInsufficient(session);
}

export function getEffectiveRouteTokenBalance(uid?: string | null): number | null {
  if (uid != null && uid !== session.uid) return null;
  return computeEffectiveBalance(session);
}

export function subscribeRouteTokenEffective(listener: BalanceListener): () => void {
  balanceListeners.add(listener);
  listener(computeEffectiveBalance(session), isInsufficient(session));
  return () => {
    balanceListeners.delete(listener);
  };
}

export function subscribeRouteTokenSpendMessage(listener: MessageListener): () => void {
  messageListeners.add(listener);
  listener(session.lastSpendMessage);
  return () => {
    messageListeners.delete(listener);
  };
}

/** @internal harness·단위 시험용 */
export function __testRouteTokenSpendSession(): SpendSession {
  return session;
}

/** @internal harness·단위 시험용 */
export function __testResetRouteTokenSpendSession(next: SpendSession = createEmptySession()): void {
  session = next;
  notifyBalance();
  notifyMessage();
}

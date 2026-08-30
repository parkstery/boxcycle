import { formatRouteTokenSpendMessage } from "./directionsDirectGuard";

type BalanceListener = (effective: number | null, insufficient: boolean) => void;
type MessageListener = (message: string | null) => void;

let subscribedBalance: number | null = null;
let routeResponseBalance: number | null = null;
let lastSpendMessage: string | null = null;
let lastSpendRequestId: string | null = null;

const balanceListeners = new Set<BalanceListener>();
const messageListeners = new Set<MessageListener>();

function computeEffectiveBalance(): number | null {
  if (routeResponseBalance != null) {
    return Math.min(routeResponseBalance, subscribedBalance ?? routeResponseBalance);
  }
  return subscribedBalance;
}

function notifyBalance() {
  const effective = computeEffectiveBalance();
  const insufficient = effective != null && effective < 1;
  for (const listener of balanceListeners) {
    listener(effective, insufficient);
  }
}

function notifyMessage() {
  for (const listener of messageListeners) {
    listener(lastSpendMessage);
  }
}

export function setSubscribedRouteTokenBalance(balance: number | null) {
  subscribedBalance = balance;
  notifyBalance();
}

export function reportRouteTokenSpend(balance: number, requestId: string) {
  routeResponseBalance = balance;
  if (lastSpendRequestId !== requestId) {
    lastSpendRequestId = requestId;
    lastSpendMessage = formatRouteTokenSpendMessage(balance);
    notifyMessage();
  }
  notifyBalance();
}

export function clearRouteTokenSpendSession() {
  routeResponseBalance = null;
  lastSpendMessage = null;
  lastSpendRequestId = null;
  notifyBalance();
  notifyMessage();
}

export function getRouteTokenInsufficient(): boolean {
  const effective = computeEffectiveBalance();
  return effective != null && effective < 1;
}

export function subscribeRouteTokenEffective(listener: BalanceListener): () => void {
  balanceListeners.add(listener);
  const effective = computeEffectiveBalance();
  listener(effective, effective != null && effective < 1);
  return () => {
    balanceListeners.delete(listener);
  };
}

export function subscribeRouteTokenSpendMessage(listener: MessageListener): () => void {
  messageListeners.add(listener);
  listener(lastSpendMessage);
  return () => {
    messageListeners.delete(listener);
  };
}

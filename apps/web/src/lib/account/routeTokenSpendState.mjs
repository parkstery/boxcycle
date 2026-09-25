/** @typedef {{
 *   uid: string | null;
 *   subscribedBalance: number | null;
 *   routeResponseBalance: number | null;
 *   lastSpendMessage: string | null;
 *   lastSpendRequestId: string | null;
 * }} SpendSession */

/** @returns {SpendSession} */
export function createEmptySession(uid = null) {
  return {
    uid,
    subscribedBalance: null,
    routeResponseBalance: null,
    lastSpendMessage: null,
    lastSpendRequestId: null,
  };
}

/** @param {SpendSession} session @param {string | null} uid */
export function bindUser(session, uid) {
  if (session.uid === uid) return session;
  return createEmptySession(uid);
}

/** @param {SpendSession} session */
export function computeEffectiveBalance(session) {
  const sub = session.subscribedBalance;
  const resp = session.routeResponseBalance;
  if (resp != null) {
    if (sub == null) return resp;
    if (sub <= resp) return sub;
    return Math.min(resp, sub);
  }
  return sub;
}

/** @param {SpendSession} session */
export function convergeResponse(session) {
  const sub = session.subscribedBalance;
  const resp = session.routeResponseBalance;
  if (resp == null || sub == null) return session;
  if (sub <= resp) {
    return { ...session, routeResponseBalance: null };
  }
  return session;
}

/**
 * @param {SpendSession} session
 * @param {number | null} balance
 */
export function applySubscribedBalance(session, balance) {
  const prevSub = session.subscribedBalance;
  let next = { ...session, subscribedBalance: balance };
  if (balance != null && prevSub != null && balance > prevSub) {
    next = { ...next, routeResponseBalance: null };
  }
  return convergeResponse(next);
}

/**
 * @param {SpendSession} session
 * @param {number} balance
 * @param {string} requestId
 * @param {(n: number) => string} formatSpendMessage
 */
export function applyRouteSpend(session, balance, requestId, formatSpendMessage) {
  let next = { ...session, routeResponseBalance: balance };
  if (session.lastSpendRequestId !== requestId) {
    next = {
      ...next,
      lastSpendRequestId: requestId,
      lastSpendMessage: formatSpendMessage(balance),
    };
  }
  return convergeResponse(next);
}

/** @param {SpendSession} session */
export function isInsufficient(session) {
  const effective = computeEffectiveBalance(session);
  return effective != null && effective < 1;
}

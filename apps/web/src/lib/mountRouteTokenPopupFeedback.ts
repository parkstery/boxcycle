import {
  subscribeRouteTokenEffective,
  subscribeRouteTokenSpendMessage,
} from "./routeTokenSpendBridge";
import {
  formatRouteTokenPopupLine,
  resolveRouteTokenPopupSecondary,
} from "./routeTokenPopupDisplay.mjs";
import { ROUTE_TOKEN_TITLE, formatRouteTokenHoldingMessage } from "./routeTokenUiCopy";
import {
  isRouteTokenGenerateMetered,
  ROUTE_TOKEN_ECONOMY_CLIENT_DEFAULT,
} from "./routeTokenEconomyClient";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseFirestore, isFirebaseConfigured } from "./firebase";

const SPEND_TOAST_MS = 5_000;
const ROUTE_PENDING_CLEAR_MS = 90_000;

export type RouteTokenPopupFeedbackController = {
  setRoutePending: (pending: boolean) => void;
  /** 출발 핀 유무. 찍기 전에는 제목만 서고, 찍으면 잔액이 붙는다(2026-09-16 Chief) */
  setRouteStartPinned: (pinned: boolean) => void;
  destroy: () => void;
};

export function mountRouteTokenPopupFeedback(
  container: HTMLElement,
  signal: AbortSignal,
): RouteTokenPopupFeedbackController {
  let balance: number | null = null;
  let routeStartPinned = false;
  let insufficient = false;
  let spendVisible: string | null = null;
  let routePending = false;
  let generateCostBase: number = ROUTE_TOKEN_ECONOMY_CLIENT_DEFAULT.generateCostBase;
  let hideSpendTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingClearTimer: ReturnType<typeof setTimeout> | null = null;

  container.className = "map-view__pick-token";
  container.setAttribute("data-testid", "route-token-popup-feedback");
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");

  const lineEl = document.createElement("p");
  lineEl.className = "map-view__pick-token-line";
  lineEl.setAttribute("data-testid", "route-token-holding");

  container.append(lineEl);

  const clearSpendTimer = () => {
    if (hideSpendTimer != null) {
      clearTimeout(hideSpendTimer);
      hideSpendTimer = null;
    }
  };

  const clearPendingTimer = () => {
    if (pendingClearTimer != null) {
      clearTimeout(pendingClearTimer);
      pendingClearTimer = null;
    }
  };

  const scheduleSpendHide = () => {
    clearSpendTimer();
    if (!spendVisible) return;
    hideSpendTimer = setTimeout(() => {
      spendVisible = null;
      hideSpendTimer = null;
      render();
    }, SPEND_TOAST_MS);
  };

  const render = () => {
    /*
     * 이 줄은 팝업의 **제목 행**이다 — 잔액을 몰라도 숨기지 않는다.
     * 숨기면 긴 주소가 첫 줄로 올라와 닫기 ✕ 를 덮는다(이 배치의 애초 목적).
     * 지시07: generateCostBase===0 이면 「잔여 토큰 N개」를 붙이지 않는다(제목만).
     */
    container.hidden = false;
    const metered = isRouteTokenGenerateMetered(generateCostBase);
    if (!metered || balance == null || !routeStartPinned) {
      lineEl.textContent = ROUTE_TOKEN_TITLE;
      lineEl.className = "map-view__pick-token-line map-view__pick-token-line--title";
      delete lineEl.dataset.tokenVariant;
      return;
    }
    const holding = formatRouteTokenHoldingMessage(balance);
    const secondary = resolveRouteTokenPopupSecondary({
      insufficient,
      spendMessage: spendVisible,
      routePending,
    });

    lineEl.textContent = formatRouteTokenPopupLine(holding, secondary);
    lineEl.className = `map-view__pick-token-line map-view__pick-token-line--${secondary.variant}`;
    lineEl.setAttribute("data-testid", "route-token-holding");
    lineEl.dataset.tokenVariant = secondary.variant;
  };

  const unsubBalance = subscribeRouteTokenEffective((next, blocked) => {
    balance = next;
    insufficient = blocked;
    render();
  });

  const unsubMessage = subscribeRouteTokenSpendMessage((next) => {
    if (next) {
      spendVisible = next;
      routePending = false;
      clearPendingTimer();
      scheduleSpendHide();
    }
    render();
  });

  let unsubEconomy: (() => void) | null = null;
  let forcePoll: ReturnType<typeof setInterval> | null = null;
  const applyCost = (raw: unknown) => {
    if (import.meta.env.DEV && typeof window !== "undefined") {
      const f = window.__rtwForceGenerateCostBase;
      if (typeof f === "number" && Number.isFinite(f)) {
        generateCostBase = Math.max(0, Math.floor(f));
        render();
        return;
      }
    }
    generateCostBase =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.max(0, Math.floor(raw))
        : ROUTE_TOKEN_ECONOMY_CLIENT_DEFAULT.generateCostBase;
    render();
  };
  if (isFirebaseConfigured()) {
    unsubEconomy = onSnapshot(
      doc(getFirebaseFirestore(), "config", "routeTokenEconomy"),
      (snap) => applyCost(snap.exists() ? snap.data()?.generateCostBase : undefined),
      () => applyCost(undefined),
    );
  }
  if (import.meta.env.DEV) {
    forcePoll = setInterval(() => applyCost(generateCostBase), 400);
  }

  const destroy = () => {
    clearSpendTimer();
    clearPendingTimer();
    unsubBalance();
    unsubMessage();
    unsubEconomy?.();
    if (forcePoll) clearInterval(forcePoll);
  };

  signal.addEventListener("abort", destroy, { once: true });

  return {
    setRouteStartPinned(pinned: boolean) {
      routeStartPinned = pinned;
      render();
    },
    setRoutePending(pending: boolean) {
      routePending = pending;
      clearPendingTimer();
      if (pending) {
        pendingClearTimer = setTimeout(() => {
          routePending = false;
          pendingClearTimer = null;
          render();
        }, ROUTE_PENDING_CLEAR_MS);
      }
      render();
    },
    destroy,
  };
}

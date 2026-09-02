import {
  subscribeRouteTokenEffective,
  subscribeRouteTokenSpendMessage,
} from "./routeTokenSpendBridge";
import {
  formatRouteTokenPopupLine,
  resolveRouteTokenPopupSecondary,
} from "./routeTokenPopupDisplay.mjs";
import { formatRouteTokenHoldingMessage } from "./routeTokenUiCopy";

const SPEND_TOAST_MS = 5_000;
const ROUTE_PENDING_CLEAR_MS = 90_000;

export type RouteTokenPopupFeedbackController = {
  setRoutePending: (pending: boolean) => void;
  destroy: () => void;
};

export function mountRouteTokenPopupFeedback(
  container: HTMLElement,
  signal: AbortSignal,
): RouteTokenPopupFeedbackController {
  let balance: number | null = null;
  let insufficient = false;
  let spendVisible: string | null = null;
  let routePending = false;
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
    if (balance == null) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
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

  const destroy = () => {
    clearSpendTimer();
    clearPendingTimer();
    unsubBalance();
    unsubMessage();
  };

  signal.addEventListener("abort", destroy, { once: true });

  return {
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

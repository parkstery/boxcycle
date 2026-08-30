import {
  subscribeRouteTokenEffective,
  subscribeRouteTokenSpendMessage,
} from "./routeTokenSpendBridge";
import {
  resolveRouteTokenPopupSecondary,
  ROUTE_TOKEN_POPUP_SECONDARY_TEST_IDS,
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

  const holdingEl = document.createElement("p");
  holdingEl.className = "map-view__pick-token-holding";
  holdingEl.setAttribute("data-testid", "route-token-holding");

  const secondaryEl = document.createElement("p");
  secondaryEl.className = "map-view__pick-token-secondary";

  container.append(holdingEl, secondaryEl);

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
    holdingEl.textContent = formatRouteTokenHoldingMessage(balance);

    const { variant, text } = resolveRouteTokenPopupSecondary({
      insufficient,
      spendMessage: spendVisible,
      routePending,
    });

    secondaryEl.textContent = text;
    secondaryEl.className = `map-view__pick-token-secondary map-view__pick-token-secondary--${variant}`;
    secondaryEl.setAttribute("data-testid", ROUTE_TOKEN_POPUP_SECONDARY_TEST_IDS[variant]);
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

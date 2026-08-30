import {
  formatRouteTokenHoldingMessage,
  ROUTE_TOKEN_COST_HINT,
  ROUTE_TOKEN_INSUFFICIENT_HINT,
} from "../../lib/routeTokenUiCopy";
import { useRouteTokenEffective } from "../../hooks/useRouteTokenEffective";
import { useRouteTokenSpendToast } from "../../hooks/useRouteTokenSpendToast";
import "./RouteTokenMapFeedback.css";

export function RouteTokenMapFeedback() {
  const { balance, insufficient } = useRouteTokenEffective();
  const spendToast = useRouteTokenSpendToast();

  if (balance == null) return null;

  return (
    <div className="route-token-map-feedback" data-testid="route-token-map-feedback">
      <p
        className="route-token-map-feedback__holding"
        data-testid="route-token-holding"
        role="status"
        aria-live="polite"
      >
        {formatRouteTokenHoldingMessage(balance)}
      </p>
      {insufficient ? (
        <p
          className="route-token-map-feedback__blocked"
          data-testid="route-token-insufficient"
          role="status"
          aria-live="polite"
        >
          {ROUTE_TOKEN_INSUFFICIENT_HINT}
        </p>
      ) : (
        <p
          className="route-token-map-feedback__cost"
          data-testid="route-token-cost-hint"
          role="status"
          aria-live="polite"
        >
          {ROUTE_TOKEN_COST_HINT}
        </p>
      )}
      {spendToast ? (
        <p
          className="route-token-map-feedback__spend"
          data-testid="route-token-spend-toast"
          role="status"
          aria-live="polite"
        >
          {spendToast}
        </p>
      ) : null}
    </div>
  );
}

import type { Ref } from "react";
import "./RouteOverviewFoldToggle.css";

type RouteOverviewFoldKind = "route" | "map";

type RouteOverviewFoldToggleProps = {
  kind: RouteOverviewFoldKind;
  expanded: boolean;
  ariaLabel: string;
  controls?: string;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  onClick: () => void;
};

/** 공통 접기 손잡이. 미니맵은 접힘=지도, 펼침=캐럿 하나만 표시한다. */
export function RouteOverviewFoldToggle({
  kind,
  expanded,
  ariaLabel,
  controls,
  className,
  buttonRef,
  onClick,
}: RouteOverviewFoldToggleProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`route-overview-fold-toggle${className ? ` ${className}` : ""}`}
      data-fold-kind={kind}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      <svg viewBox="0 0 28 20" fill="none" aria-hidden="true">
        {kind === "route" || !expanded ? (
          <g
            className="route-overview-fold-toggle__identity"
            transform={kind === "map" ? "translate(5.25 0)" : undefined}
          >
            {kind === "route" ? (
              <>
                <circle cx="5" cy="6" r="2" />
                <circle cx="5" cy="14" r="2" />
                <path d="M7 6h6M7 14h6" />
              </>
            ) : (
              <path d="M2.5 5.5 7 3.5l4 2 4-2v11l-4 2-4-2-4.5 2zM7 3.5v11M11 5.5v11" />
            )}
          </g>
        ) : null}
        {kind === "route" || expanded ? (
          <path
            className="route-overview-fold-toggle__chevron"
            transform={kind === "map" ? "translate(-6.5 0)" : undefined}
            d={expanded ? "m23 5-5 5 5 5" : "m18 5 5 5-5 5"}
          />
        ) : null}
      </svg>
    </button>
  );
}

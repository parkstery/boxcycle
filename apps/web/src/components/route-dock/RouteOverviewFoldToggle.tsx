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

/** 공통 접기 손잡이. 접힘=도안, 펼침=캐럿 하나만 가운데에 표시한다(미니맵 10-29, RouteDock 10-30 Chief). */
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
      title={ariaLabel}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      <svg viewBox="0 0 28 20" fill="none" aria-hidden="true">
        {!expanded ? (
          <g
            className="route-overview-fold-toggle__identity"
            transform={kind === "map" ? "translate(5.25 0)" : "translate(6 0)"}
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
        {expanded ? (
          <path
            className="route-overview-fold-toggle__chevron"
            transform="translate(-6.5 0)"
            d="m23 5-5 5 5 5"
          />
        ) : null}
      </svg>
    </button>
  );
}

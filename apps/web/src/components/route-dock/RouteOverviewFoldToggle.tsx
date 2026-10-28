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

/** RouteDock·미니맵이 함께 쓰는 접기 손잡이. 식별 도안과 방향을 한 버튼 안에 둔다. */
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
        <g className="route-overview-fold-toggle__identity">
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
        <path
          className="route-overview-fold-toggle__chevron"
          d={expanded ? "m23 5-5 5 5 5" : "m18 5 5 5-5 5"}
        />
      </svg>
    </button>
  );
}

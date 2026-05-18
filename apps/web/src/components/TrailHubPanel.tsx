import type { User } from "firebase/auth";
import { useMemo } from "react";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../lib/firestoreTrail";
import {
  canUserManageTrail,
  type TrailInstance,
  type TrailVisibility,
} from "../lib/firestoreTrailInstance";
import { formatTrailDisplayNumber } from "../lib/trailDisplayNumber";
import { TRAILHEAD_LABEL, TRAIL_LABEL } from "../lib/productTerms";
import "./TrailHubPanel.css";

export type TrailHubPanelProps = {
  user: User | null | undefined;
  activeTrailId: string;
  currentTrail: TrailInstance | null;
  openTrails: TrailInstance[];
  openTrailsLoading: boolean;
  openTrailsError: string | null;
  onGoTrailhead: () => void;
  onJoinTrail: (trailId: string) => void;
  onSetVisibility: (visibility: TrailVisibility) => void;
  visibilityBusy?: boolean;
};

function formatTrailRow(t: TrailInstance): string {
  const num = formatTrailDisplayNumber(t.displayNumber);
  const region = t.regionLabel?.trim() || "—";
  const riders =
    t.liveRiderCount != null && Number.isFinite(t.liveRiderCount)
      ? `${t.liveRiderCount}명`
      : "—";
  const km =
    t.distanceKm != null && Number.isFinite(t.distanceKm) ? `${t.distanceKm.toFixed(1)} km` : "—";
  const vis = t.visibility === "private" ? "PRIVATE" : "OPEN";
  return `${num} / ${region} / ${riders} / ${km} / ${vis}`;
}

export function TrailHubPanel(props: TrailHubPanelProps) {
  const active = sanitizeTrailId(props.activeTrailId);
  const onTrailhead = active === DEFAULT_TRAIL_ID;
  const currentLabel = props.currentTrail
    ? formatTrailDisplayNumber(props.currentTrail.displayNumber)
    : onTrailhead
      ? TRAILHEAD_LABEL
      : active.slice(0, 8);

  const joinable = useMemo(
    () =>
      props.openTrails.filter(
        (t) => t.id !== active && t.status === "open" && t.visibility === "open",
      ),
    [props.openTrails, active],
  );

  const canToggleVisibility = canUserManageTrail(props.currentTrail, props.user);

  return (
    <section className="trail-hub" aria-label={`${TRAILHEAD_LABEL} · ${TRAIL_LABEL}`}>
      <div className="trail-hub__current">
        <span className="trail-hub__kicker">지금</span>
        <strong className="trail-hub__current-id">
          {onTrailhead ? TRAILHEAD_LABEL : `Trail ${currentLabel}`}
        </strong>
        {!onTrailhead && props.currentTrail ? (
          <span className="trail-hub__current-meta">
            {props.currentTrail.regionLabel ?? "—"} ·{" "}
            {props.currentTrail.visibility === "private" ? "비공개" : "공개"}
          </span>
        ) : (
          <span className="trail-hub__current-meta">
            코스를 고르고 ▶ 주행하면 Trail이 자동으로 열립니다. 다른 Trail 주행자는 Activity
            World로, 같은 Trail은 지도에서 실시간으로 보입니다.
          </span>
        )}
      </div>

      <div className="trail-hub__row">
        <button
          type="button"
          className="trail-hub__trailhead-btn"
          disabled={onTrailhead}
          onClick={props.onGoTrailhead}
        >
          {TRAILHEAD_LABEL}로
        </button>
        {canToggleVisibility ? (
          <div className="trail-hub__visibility" role="group" aria-label="Trail 공개 설정">
            <button
              type="button"
              className={
                props.currentTrail?.visibility === "open"
                  ? "trail-hub__vis-btn trail-hub__vis-btn--on"
                  : "trail-hub__vis-btn"
              }
              disabled={props.visibilityBusy}
              onClick={() => props.onSetVisibility("open")}
            >
              Open
            </button>
            <button
              type="button"
              className={
                props.currentTrail?.visibility === "private"
                  ? "trail-hub__vis-btn trail-hub__vis-btn--on"
                  : "trail-hub__vis-btn"
              }
              disabled={props.visibilityBusy}
              onClick={() => props.onSetVisibility("private")}
            >
              Private
            </button>
          </div>
        ) : null}
      </div>

      <div className="trail-hub__list-head">
        <span className="trail-hub__kicker">열린 Trail</span>
        {props.openTrailsLoading ? <span className="trail-hub__meta">불러오는 중…</span> : null}
      </div>
      {props.openTrailsError ? (
        <p className="trail-hub__err" title={props.openTrailsError}>
          {props.openTrailsError}
        </p>
      ) : null}
      {joinable.length > 0 ? (
        <ul className="trail-hub__list">
          {joinable.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="trail-hub__join-btn"
                onClick={() => props.onJoinTrail(t.id)}
              >
                {formatTrailRow(t)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="trail-hub__empty">
          {onTrailhead ? "지금 합류할 공개 Trail이 없습니다." : "다른 공개 Trail이 없습니다."}
        </p>
      )}
    </section>
  );
}

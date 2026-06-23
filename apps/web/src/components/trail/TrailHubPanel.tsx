import type { User } from "firebase/auth";
import { useMemo } from "react";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../../lib/firestoreTrail";
import {
  canUserManageTrail,
  type TrailInstance,
  type TrailVisibility,
} from "../../lib/firestoreTrailInstance";
import { compareOpenTrailsForListing } from "../../lib/firestoreOpenTrailListings";
import { formatTrailDisplayNumber } from "../../lib/trailDisplayNumber";
import { readTrailDisplayNumberCache } from "../../lib/trailDisplayNumberCache";
import { TRAILHEAD_LABEL, TRAIL_LABEL } from "../../lib/productTerms";
import "./TrailHubPanel.css";

export type TrailHubPanelProps = {
  user: User | null | undefined;
  activeTrailId: string;
  currentTrail: TrailInstance | null;
  openTrails: TrailInstance[];
  openTrailsLoading: boolean;
  openTrailsError: string | null;
  onGoTrailhead: () => void;
  onJoinTrail: (trailId: string, listingPublicationId?: string | null) => void;
  onSetVisibility: (visibility: TrailVisibility) => void;
  visibilityBusy?: boolean;
  /** running·paused — Trailhead 이동 비활성 */
  rideSessionActive?: boolean;
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
  const vis = t.visibility === "private" ? "비공개" : "공개";
  return `${num} / ${region} / ${riders} / ${km} / ${vis}`;
}

export function TrailHubPanel(props: TrailHubPanelProps) {
  const active = sanitizeTrailId(props.activeTrailId);
  const onTrailhead = active === DEFAULT_TRAIL_ID;
  const currentLabel = props.currentTrail
    ? formatTrailDisplayNumber(props.currentTrail.displayNumber)
    : onTrailhead
      ? TRAILHEAD_LABEL
      : formatTrailDisplayNumber(readTrailDisplayNumberCache(active));

  /** 주행 중: 공개 Trail 전체(현재 Trail 포함). 대기 중: 합류 가능 Trail만(현재 제외) */
  const listedTrails = useMemo(() => {
    const open = props.openTrails
      .filter((t) => t.status === "open" && t.visibility === "open")
      .sort(compareOpenTrailsForListing);
    if (props.rideSessionActive) {
      if (
        !onTrailhead &&
        props.currentTrail?.id === active &&
        !open.some((t) => t.id === active)
      ) {
        return [props.currentTrail, ...open];
      }
      return open;
    }
    return open.filter((t) => t.id !== active);
  }, [props.openTrails, props.rideSessionActive, onTrailhead, active, props.currentTrail]);

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
            {props.currentTrail.regionLabel?.trim() || "—"} ·{" "}
            {props.currentTrail.visibility === "private" ? "비공개" : "공개"}
          </span>
        ) : null}
      </div>

      <div className="trail-hub__row">
        <button
          type="button"
          className="trail-hub__trailhead-btn"
          disabled={onTrailhead || Boolean(props.rideSessionActive)}
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
              공개
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
              비공개
            </button>
          </div>
        ) : null}
      </div>

      <div className="trail-hub__list-head">
        <span className="trail-hub__kicker">Trail</span>
        {props.openTrailsLoading ? <span className="trail-hub__meta">불러오는 중…</span> : null}
      </div>
      {props.openTrailsError ? (
        <p className="trail-hub__err" title={props.openTrailsError}>
          {props.openTrailsError}
        </p>
      ) : null}
      {props.openTrailsLoading && listedTrails.length === 0 ? (
        <p className="trail-hub__empty">불러오는 중…</p>
      ) : listedTrails.length > 0 ? (
        <ul className="trail-hub__list">
          {listedTrails.map((t) => {
            const isCurrent = t.id === active;
            const showActiveRow = isCurrent && props.rideSessionActive;
            return (
              <li key={t.id}>
                {showActiveRow ? (
                  <div className="trail-hub__active-row" aria-current="true">
                    {formatTrailRow(t)}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="trail-hub__join-btn"
                    disabled={props.rideSessionActive}
                    onClick={() => props.onJoinTrail(t.id, t.publicationId)}
                  >
                    {formatTrailRow(t)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="trail-hub__empty">없음</p>
      )}
    </section>
  );
}

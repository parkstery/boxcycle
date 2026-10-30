import type { User } from "firebase/auth";
import { useMemo } from "react";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../../lib/trail/repo/firestoreTrail";
import {
  canUserManageTrail,
  type TrailInstance,
  type TrailVisibility,
} from "../../lib/trail/repo/firestoreTrailInstance";
import { compareOpenTrailsForListing, isActiveOpenTrailListing } from "../../lib/trail/repo/firestoreOpenTrailListings";
import { TRAILHEAD_LABEL, TRAIL_LABEL } from "../../lib/terms/productTerms";
import { formatTrailDisplayNumber } from "../../lib/trail/trailDisplayNumber";
import "./TrailHubPanel.css";

export type TrailHubPanelProps = {
  user: User | null | undefined;
  activeTrailId: string;
  currentTrail: TrailInstance | null;
  openTrails: TrailInstance[];
  openTrailsLoading: boolean;
  openTrailsError: string | null;
  onJoinTrail: (trailId: string, listingPublicationId?: string | null) => void;
  onSetVisibility: (visibility: TrailVisibility) => void;
  visibilityBusy?: boolean;
  /** running·paused — Trail 합류 비활성 */
  rideSessionActive?: boolean;
};

function trailDisplayName(t: TrailInstance): string {
  const region = t.regionLabel?.trim();
  return region || `${TRAIL_LABEL} ${formatTrailDisplayNumber(t.displayNumber)}`;
}

function trailKmLabel(t: TrailInstance): string | null {
  if (t.distanceKm == null || !Number.isFinite(t.distanceKm)) return null;
  return `${t.distanceKm.toFixed(1)}`;
}

function trailRowLabel(t: TrailInstance): string {
  const parts = [trailDisplayName(t)];
  if (t.regionLabel?.trim()) parts.push(`${TRAIL_LABEL} ${formatTrailDisplayNumber(t.displayNumber)}`);
  const km = trailKmLabel(t);
  if (km) parts.push(`${km} km`);
  const riders =
    t.liveRiderCount != null && Number.isFinite(t.liveRiderCount) ? t.liveRiderCount : null;
  if (riders != null) parts.push(`주행 중 ${riders}명`);
  parts.push(t.visibility === "private" ? "비공개" : "공개");
  return parts.join(", ");
}

export function TrailHubPanel(props: TrailHubPanelProps) {
  const active = sanitizeTrailId(props.activeTrailId);
  const onTrailhead = active === DEFAULT_TRAIL_ID;

  const listedTrails = useMemo(() => {
    const open = props.openTrails
      .filter(
        (t) =>
          t.status === "open" &&
          t.visibility === "open" &&
          isActiveOpenTrailListing(t),
      )
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
      <div className="trail-hub__context">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 18c0-8 14-3 14-11" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" /></svg>
        <span>현재</span>
        <strong>{onTrailhead ? TRAILHEAD_LABEL : `${TRAIL_LABEL} ${formatTrailDisplayNumber(props.currentTrail?.displayNumber)}`}</strong>
      </div>
      {canToggleVisibility ? (
        <div className="trail-hub__row trail-hub__row--visibility">
          <span className="trail-hub__vis-label">이 Trail 공개</span>
          <div className="trail-hub__visibility" role="group" aria-label="Trail 공개 설정">
            <button
              type="button"
              className={
                props.currentTrail?.visibility === "open"
                  ? "trail-hub__vis-btn trail-hub__vis-btn--on"
                  : "trail-hub__vis-btn"
              }
              disabled={props.visibilityBusy}
              title="이 Trail을 공개로 전환"
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
              title="이 Trail을 비공개로 전환"
              onClick={() => props.onSetVisibility("private")}
            >
              비공개
            </button>
          </div>
        </div>
      ) : null}

      <span className="trail-hub__section-label">지금 달리는 {TRAIL_LABEL}</span>
      {props.openTrailsLoading ? (
        <p className="trail-hub__empty">불러오는 중…</p>
      ) : null}
      {props.openTrailsError ? (
        <p className="trail-hub__err" title={props.openTrailsError}>
          {props.openTrailsError}
        </p>
      ) : null}
      {!props.openTrailsLoading && listedTrails.length === 0 ? (
        <p className="trail-hub__empty">없음</p>
      ) : null}
      {listedTrails.length > 0 ? (
        <ul className="trail-hub__list">
          {listedTrails.map((t) => {
            const isCurrent = t.id === active;
            const showActiveRow = isCurrent && props.rideSessionActive;
            const km = trailKmLabel(t);
            const riders =
              t.liveRiderCount != null && Number.isFinite(t.liveRiderCount)
                ? t.liveRiderCount
                : null;
            const joinLabel =
              riders != null && riders > 0 ? `${riders}명 · 합류` : "합류";
            return (
              <li key={t.id} className={`trail-hub__item${showActiveRow ? " trail-hub__item--current" : ""}`}>
                <div
                  className="trail-hub__live-row"
                  aria-current={showActiveRow ? "true" : undefined}
                  aria-label={showActiveRow ? trailRowLabel(t) : undefined}
                >
                  <span className="trail-hub__live-name" title={trailDisplayName(t)}>
                    {t.regionLabel?.trim() ? <span className="trail-hub__number">{formatTrailDisplayNumber(t.displayNumber)}</span> : null}
                    {trailDisplayName(t)}
                  </span>
                  {km ? (
                    <span className="trail-hub__live-km">
                      {km} <span className="trail-hub__live-km-unit">km</span>
                    </span>
                  ) : null}
                  {showActiveRow ? (
                    <span className="trail-hub__live-join trail-hub__live-join--static">
                      <span className="trail-hub__live-dot" aria-hidden />
                      주행 중
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="trail-hub__live-join"
                      disabled={props.rideSessionActive}
                      title="이 Trail에 합류"
                      aria-label={`${trailRowLabel(t)} — 합류`}
                      onClick={() => props.onJoinTrail(t.id, t.publicationId)}
                    >
                      <span className="trail-hub__live-dot" aria-hidden />
                      {joinLabel}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

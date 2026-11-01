import type { User } from "firebase/auth";
import { useMemo } from "react";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../../lib/trail/repo/firestoreTrail";
import {
  canUserManageTrail,
  type TrailInstance,
  type TrailVisibility,
} from "../../lib/trail/repo/firestoreTrailInstance";
import { TRAILHEAD_LABEL, TRAIL_LABEL } from "../../lib/terms/productTerms";
import { formatTrailDisplayNumber } from "../../lib/trail/trailDisplayNumber";
import { listOpenTrailsForDisplay } from "./trailGlance";
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
  /** Chief 11-02: 지금 달리는 Trail 목록은 지도 오른쪽 목록(Trail 탭)에서 본다. 메뉴엔 개수와 여는 줄만. */
  onShowTrailList?: () => void;
};

export function TrailHubPanel(props: TrailHubPanelProps) {
  const active = sanitizeTrailId(props.activeTrailId);
  const onTrailhead = active === DEFAULT_TRAIL_ID;

  const listedTrails = useMemo(
    () => listOpenTrailsForDisplay(props.openTrails, props.activeTrailId, props.currentTrail, Boolean(props.rideSessionActive)),
    [props.openTrails, props.activeTrailId, props.currentTrail, props.rideSessionActive],
  );

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

      <button
        type="button"
        className="trail-hub__show-list"
        onClick={props.onShowTrailList}
        disabled={!props.onShowTrailList}
      >
        <span>지금 달리는 {TRAIL_LABEL}</span>
        <strong>{props.openTrailsLoading && listedTrails.length === 0 ? "…" : `${listedTrails.length}개`}</strong>
        <span aria-hidden>›</span>
      </button>
    </section>
  );
}

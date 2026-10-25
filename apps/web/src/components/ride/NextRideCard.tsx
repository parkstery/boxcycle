import { useState } from "react";
import type { LngLat } from "../../lib/geo/geo";
import { shortPlaceLabel } from "../../lib/route/repo/firestoreSavedRoutes";
import type { NextRideTarget, NextRideView } from "../../lib/ride/nextRideTarget";
import { formatRideDistanceKmNumber } from "../../lib/ride/rideDistanceFormat";
import { progressPercentLabel } from "../../lib/ride/rideEndResult";
import { composeNextRideStory } from "../../lib/ride/rideStory";
import "./NextRideCard.css";

export type NextRideCardProps = {
  view: NextRideView;
  /** 이어 달리기 — Route 를 불러오고 재개 지점으로 이동해 `ready-to-start` 까지만 만든다(Go 는 그대로) */
  onResume: (target: Extract<NextRideTarget, { kind: "resume_route" }>) => void;
  /** 마지막 종료 지점을 새 Route 의 출발점으로 고정 */
  onExtend: (anchorLngLat: LngLat) => void;
  /** 실제 종료 지점을 지도에서 보기 */
  onShowOnMap: (anchorLngLat: LngLat) => void;
  /** 이번 앱 세션 동안 숨기기 — Ride·SavedRoute 를 삭제하지 않는다 */
  onDismiss: () => void;
};

function formatEndedAtKo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
}

/**
 * 실제 종료 지점의 표시 지명. 좌표 폴백(`formatLngLat`)은 지명이 아니므로 UI 에 노출하지 않는다 —
 * 지명을 못 구하면 「마지막 종료 지점」으로 부른다(§3.1).
 */
function anchorPlaceName(view: NextRideView): string | null {
  return (
    shortPlaceLabel(view.ride.sessionEndPlaceLabel) ?? shortPlaceLabel(view.ride.endPlaceLabel)
  );
}

/**
 * 지도 위 「다음 주행」 카드 — 다음 행동의 **주 표면**(§3.1).
 */
export function NextRideCard(props: NextRideCardProps) {
  const { view } = props;
  const resumeTarget = view.target.kind === "resume_route" ? view.target : null;
  const placeName = anchorPlaceName(view);
  const lastRideKm = formatRideDistanceKmNumber(view.ride.distanceMeters);
  const [openedAt] = useState(() => new Date());
  const story = composeNextRideStory({
    resume:
      resumeTarget && view.route
        ? { routeMeters: view.route.distanceMeters, progressRatio: resumeTarget.progressRatio }
        : null,
    lastRideEndedAtIso: view.ride.endedAt,
    now: openedAt,
  });

  const remainingKm =
    resumeTarget && view.route
      ? formatRideDistanceKmNumber(
          Math.max(0, (1 - resumeTarget.progressRatio) * view.route.distanceMeters),
        )
      : null;

  const stoppedLabel = placeName ?? "마지막 종료 지점";
  const cardTitle = resumeTarget ? "이어 가기" : "새 출발";

  return (
    <div className="next-ride-anchor" aria-label="다음 주행">
      <div className="next-ride__card hud-glass" role="group" aria-label="다음 주행">
        <div className="next-ride__head">
          <div className="next-ride__head-copy">
            <span className="next-ride__kicker">다음 주행</span>
            <h2 id="next-ride-title" className="next-ride__title">
              {cardTitle}
            </h2>
            {story ? <p className="next-ride__story">{story.text}</p> : null}
          </div>
          <button
            type="button"
            className="next-ride__dismiss"
            aria-label="다음 주행 숨기기"
            title="Hide"
            onClick={props.onDismiss}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {resumeTarget && view.route ? (
          <div className="next-ride__facts" aria-label="경로 진행">
            <div className="next-ride__fact">
              <span className="next-ride__fact-label">멈춘 곳</span>
              <span className="next-ride__fact-value" title={view.route.name}>
                {stoppedLabel}
              </span>
            </div>
            {remainingKm != null ? (
              <div className="next-ride__fact next-ride__fact--end">
                <span className="next-ride__fact-label">남은 거리</span>
                <span className="next-ride__fact-value next-ride__fact-value--accent">
                  {remainingKm}
                  <span className="next-ride__fact-unit"> km</span>
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {story ? null : (
              <p className="next-ride__line next-ride__line--muted">
                마지막 주행 {formatEndedAtKo(view.ride.endedAt)} · {lastRideKm} km
              </p>
            )}
            <p className="next-ride__line next-ride__line--strong">
              {placeName ?? "마지막 종료 지점"}
            </p>
          </>
        )}

        <div className="next-ride__actions">
          {resumeTarget ? (
            <button
              type="button"
              className="next-ride__btn next-ride__btn--primary"
              title="Resume this route"
              onClick={() => props.onResume(resumeTarget)}
            >
              {progressPercentLabel(resumeTarget.progressRatio)}%에서 이어 달리기
            </button>
          ) : null}
          <button
            type="button"
            className={`next-ride__btn ${resumeTarget ? "next-ride__btn--ghost" : "next-ride__btn--primary"}`}
            title="New route from here"
            onClick={() => props.onExtend(view.target.anchorLngLat)}
          >
            여기에서 계속
          </button>
          {!resumeTarget ? (
            <button
              type="button"
              className="next-ride__btn next-ride__btn--ghost"
              title="Show on map"
              onClick={() => props.onShowOnMap(view.target.anchorLngLat)}
            >
              지도에서 보기
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

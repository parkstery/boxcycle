import type { LngLat } from "../../lib/geo";
import { shortPlaceLabel } from "../../lib/firestoreSavedRoutes";
import type { NextRideTarget, NextRideView } from "../../lib/nextRideTarget";
import { progressPercentLabel } from "../../lib/rideEndResult";
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
 *
 * 사용자가 MENU → 내 경로 → 선택 → 열기를 반복하지 않도록, 마지막 유효 Ride 를 해석해
 * 「이어 달리기」·「이 지점에서 새 경로」를 지도 위에서 바로 제시한다.
 * 좌하단 RouteDock anchor 자리를 쓰며, 확장된 RouteDock 과 동시에 표시되지 않는다.
 */
export function NextRideCard(props: NextRideCardProps) {
  const { view } = props;
  const resumeTarget = view.target.kind === "resume_route" ? view.target : null;
  const placeName = anchorPlaceName(view);
  const todayKm = (view.ride.distanceMeters / 1000).toFixed(1);

  return (
    <div className="next-ride-anchor" aria-label="다음 주행">
      <div className="next-ride__card hud-glass" role="group" aria-labelledby="next-ride-title">
        <div className="next-ride__head">
          <h2 id="next-ride-title" className="next-ride__title">
            다음 주행
          </h2>
          <button
            type="button"
            className="next-ride__dismiss"
            aria-label="다음 주행 숨기기"
            title="Hide"
            onClick={props.onDismiss}
          >
            ✕
          </button>
        </div>

        {resumeTarget && view.route ? (
          <>
            <p className="next-ride__line next-ride__line--strong">
              <span className="next-ride__route-name" title={view.route.name}>
                {view.route.name}
              </span>
              <span className="next-ride__sep" aria-hidden>
                ·
              </span>
              <span>
                {((resumeTarget.progressRatio * view.route.distanceMeters) / 1000).toFixed(1)} /{" "}
                {(view.route.distanceMeters / 1000).toFixed(1)} km
              </span>
              <span className="next-ride__sep" aria-hidden>
                ·
              </span>
              <span>{progressPercentLabel(resumeTarget.progressRatio)}%</span>
            </p>
            <p className="next-ride__line next-ride__line--muted">멈춘 지점에서 계속합니다</p>
          </>
        ) : (
          <>
            <p className="next-ride__line next-ride__line--strong">
              {placeName ? `${placeName}에서 이어가기` : "마지막 종료 지점에서 이어가기"}
            </p>
            <p className="next-ride__line next-ride__line--muted">
              마지막 주행 {formatEndedAtKo(view.ride.endedAt)} · 오늘 {todayKm} km
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
            이 지점에서 새 경로
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

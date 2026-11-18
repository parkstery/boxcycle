/** 경로 표고 패널. 접기 버튼 외 영역은 지도 조작을 통과시킨다. */
import { useId, useState } from "react";
import type { LngLat, LineStringGeometry } from "../../lib/geo/geo";
import { lineStringLengthMeters } from "../../lib/geo/geo";
import type { RouteElevationProfileState } from "../../hooks/useRouteElevationProfile";
import { buildElevationUi, getProgressRatioOnRoute } from "./mapElevationUi";
import { GoalFlag, RouteStartMarker } from "./RouteEndpointMarkers";
import "./RouteElevationOverlay.css";

export type RouteElevationOverlayProps = {
  routeGeometry: LineStringGeometry | null;
  liveLngLat: LngLat | null;
  /** 차트·코칭과 같은 도로형 보정 프로필. 카메라 높이와는 별개다. */
  routeElevationProfile: RouteElevationProfileState;
};

export function RouteElevationOverlay({
  routeGeometry,
  liveLngLat,
  routeElevationProfile: elevation,
}: RouteElevationOverlayProps) {
  // null=자동: 미수신 때 축약, 수신 뒤 펼침. 사용자가 접은 선택은 수신 후에도 유지한다.
  const [expandedChoice, setExpandedChoice] = useState<boolean | null>(null);
  const plotId = useId();
  const hasRoute = Boolean(routeGeometry && routeGeometry.coordinates.length > 1);
  const progressRatio = getProgressRatioOnRoute(routeGeometry, liveLngLat);
  const routeMeters = routeGeometry && hasRoute ? lineStringLengthMeters(routeGeometry) : 0;
  const ready = hasRoute && !elevation.loading && !elevation.error && elevation.values.length > 1;
  const ui = ready ? buildElevationUi(elevation.values, progressRatio, routeMeters) : null;
  const expanded = expandedChoice ?? Boolean(ui);
  const compact = !ui || !expanded;
  if (!hasRoute) return null;

  // quotaExceeded(429)는 일반 오류와 구분한다. 재요청은 부모 훅의 책임이다.
  const status = elevation.loading ? "고도 계산 중…"
    : elevation.error ? elevation.quotaExceeded
      ? "표고 요청 한도에 도달했습니다. 나중에 다시 시도해 주세요."
      : "고도 데이터를 불러오지 못했습니다."
    : !ui ? "고도 데이터 없음" : null;
  const current = ui ? ui.marker ? `현재 ${ui.marker.elevationMeters.toFixed(1)} m` : "현재 —"
    : elevation.loading ? "···" : "—";

  return (
    <section className={`elevation-overlay${compact ? " elevation-overlay--folded" : ""}${!ui && expanded ? " elevation-overlay--details" : ""}`} aria-label="경로 표고">
      <div className="elevation-overlay__header">
        <span className="elevation-overlay__title">표고</span>
        {compact ? <span className="elevation-overlay__current">{current}</span> : null}
        <button type="button" className="elevation-overlay__toggle"
          aria-label={expanded ? "표고 접기" : "표고 펼치기"}
          aria-expanded={expanded} aria-controls={plotId}
          onClick={() => setExpandedChoice(!expanded)}>
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path d={expanded ? "M4 7l6 6 6-6" : "M7 4l6 6-6 6"} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div id={plotId} hidden={!expanded}>
        {status ? <div className="elevation-overlay__details">
          <div className="elevation-overlay__empty" role="status">{status}</div>
          {!elevation.loading && elevation.retry ? <button type="button" className="elevation-overlay__retry"
            onClick={() => { setExpandedChoice(null); elevation.retry?.(); }}>다시 불러오기</button> : null}
        </div> : ui ? <>
          <div className="elevation-overlay__plot">
            <svg className="elevation-overlay__svg" viewBox="0 0 420 100" preserveAspectRatio="none"
              role="img" aria-label="경로 표고 그래프">
              <polygon points={`8,100 ${ui.polylinePoints} 412,100`} fill="rgba(217,119,48,.12)" />
              <polyline points={ui.polylinePoints} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="4"
                vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" />
              <polyline className="elevation-overlay__line" points={ui.polylinePoints} fill="none" stroke="#c36839" strokeWidth="2"
                vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            {ui.marker ? <>
              <span className="elevation-overlay__cursor" style={{ left: `${ui.marker.xPct}%` }} aria-hidden="true" />
              <span className="elevation-overlay__marker" style={{ left: `${ui.marker.xPct}%`, top: `${ui.marker.yPct}%` }}
                role="img" aria-label={`현재 위치 ${ui.marker.progressPct}%`} />
            </> : null}
            <svg className="elevation-overlay__endpoint elevation-overlay__endpoint--start"
              width="12" height="12" viewBox="0 0 12 12" role="img" aria-label="표고 출발점"
              style={{ left: `${ui.startPoint.xPct}%`, top: `${ui.startPoint.yPct}%` }}>
              <RouteStartMarker x={6} y={6} />
            </svg>
            <svg className="elevation-overlay__endpoint elevation-overlay__endpoint--end"
              width="16" height="20" viewBox="0 0 16 20" role="img" aria-label="표고 도착점"
              style={{ left: `${ui.endPoint.xPct}%`, top: `${ui.endPoint.yPct}%` }}>
              <GoalFlag x={12} y={17} boxW={16} waving={false} />
            </svg>
          </div>
          <div className="elevation-overlay__readout">
            {expanded ? <span className="elevation-overlay__current" aria-label="현재 표고">{current}</span> : null}
          </div>
        </> : null}
      </div>
    </section>
  );
}

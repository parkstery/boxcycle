/**
 * 표고 그래프 오버레이 — 경로의 고도 프로필과 진행 마커·종점 깃발.
 *
 * 왜 MapView 에서 나왔나 (2026-09-28, 구조 정비 A-5a) — 지도 인스턴스도 구독도 만지지 않는
 * **표시 전용**이다. 입력(경로·현재 위치·고도 프로필)만 받아 그린다.
 * **동작·클래스명·문구는 바꾸지 않았다 — 자리만 옮겼다.**
 *
 * ⚠️ `.elevation-overlay__progress--below` 는 **되살리지 마라.** 「시점/종점」 메타 행이
 * 코칭 멘트 줄 높이로 내려가며 뒤집을 자리가 없어져 제거했다(2026-09-24 지시03).
 * e2e `hud-distance-elevation-shots` 가 그 클래스가 다시 붙는지 본다.
 *
 * ⚠️ 그래프가 안 보이면 **회귀를 의심하기 전에 Open-Meteo 일일 한도(429)부터 확인**한다 —
 * `quotaExceeded` 문구가 그래서 따로 있다.
 */
import type { LngLat, LineStringGeometry } from "../../lib/geo/geo";
import { lineStringLengthMeters } from "../../lib/geo/geo";
import type { RouteElevationProfileState } from "../../hooks/useRouteElevationProfile";
import { buildElevationUi, getProgressRatioOnRoute } from "./mapElevationUi";

/** 표고 프로필 선·종점 깃발 — 경로선(#ef4444)과 같은 색이라 혼동을 준다는 Chief 지적으로 분리(2026-09-24) */
const ELEVATION_LINE_COLOR = "#c36839";

export type RouteElevationOverlayProps = {
  routeGeometry: LineStringGeometry | null;
  liveLngLat: LngLat | null;
  /** 부모 `useRouteElevationProfile` 과 동일(도로형 보정 포함) — 차트·코칭과 통일 */
  routeElevationProfile: RouteElevationProfileState;
};

export function RouteElevationOverlay({
  routeGeometry,
  liveLngLat,
  routeElevationProfile,
}: RouteElevationOverlayProps) {
  const progressRatio = getProgressRatioOnRoute(routeGeometry, liveLngLat);
  const hasRoute = Boolean(routeGeometry && routeGeometry.coordinates.length > 1);
  /** 부모 `routeElevationProfile` — 예전 로컬 state 이름(`elevation`)과 혼동 방지용 별칭 */
  const elevation = routeElevationProfile;
  const isLoadingElevation = hasRoute && elevation.loading;
  const isElevationError = hasRoute && elevation.error !== null;
  const isElevationReady =
    hasRoute && !elevation.loading && elevation.error === null && elevation.values.length > 1;
  const routeLenMForChart =
    routeGeometry && routeGeometry.coordinates.length > 1 ? lineStringLengthMeters(routeGeometry) : 0;
  const elevationUi = isElevationReady
    ? buildElevationUi(elevation.values, progressRatio, routeLenMForChart)
    : null;
  return (
    <>
    {isLoadingElevation ? (
      <div className="elevation-overlay">
        <div className="elevation-overlay__empty">고도 계산 중…</div>
      </div>
    ) : null}
    {isElevationError ? (
      <div className="elevation-overlay">
        {/* 한도 초과(429)를 따로 적는다 — 이게 뭉개지면 다음에도 코드 회귀로 오인한다. */}
        <div className="elevation-overlay__empty">
          {elevation.quotaExceeded
            ? "고도 API 일일 한도 초과 — 내일 다시 시도됩니다."
            : "고도 데이터를 불러오지 못했습니다."}
        </div>
      </div>
    ) : null}
    {elevationUi ? (
      <div className="elevation-overlay">
        {/* 시점/종점 — 화면 하단 코칭 멘트 줄(`.hud-coach`, MapHud.css)과 같은 세로 높이로
            절대배치한다(CSS, 2026-09-24 지시03). 코칭 멘트 유무와 무관하게 고정 높이여야
            하므로 실제 코치 DOM 이 아니라 그 줄의 `bottom` 값을 복제해 쓴다 — 가로는 기존처럼
            좌(시점)·우(종점) 끝 그대로. */}
        <div className="elevation-overlay__meta">
          <span>시점 {elevationUi.startMeters.toFixed(0)}m</span>
          <span>종점 {elevationUi.endMeters.toFixed(0)}m</span>
        </div>
        {/* viewBox 는 420x100 인데 실제 렌더는 비균등 비율(preserveAspectRatio="none")이라
            SVG <text> 로 라벨을 쓰면 가로로 눌려 찌그러진다. 라벨은 SVG 밖 HTML 요소로
            같은 박스에 겹쳐서(% 좌표) 절대배치한다 — 그래서 svg 와 라벨을 __plot 으로 함께 감싼다.
            (2026-09-24 지시03) 「시점/종점」 메타 행이 코칭 멘트 줄 높이로 내려가면서, 라벨이
            점 위로 뺄 때 메타 행을 침범하던 문제 자체가 없어졌다 — yPct<20 뒤집기(`--below`)를
            제거했다. 라벨은 이제 항상 점 위에 뜬다(가로 앵커만 남음, 아래). */}
        <div className="elevation-overlay__plot">
          <svg
            className="elevation-overlay__svg"
            viewBox="0 0 420 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="elevation profile"
          >
            <polyline
              points={elevationUi.polylinePoints}
              fill="none"
              stroke={ELEVATION_LINE_COLOR}
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {elevationUi.marker ? (
              <circle
                cx={elevationUi.marker.x}
                cy={elevationUi.marker.y}
                r="4.2"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1.4"
              />
            ) : null}
          </svg>
          {elevationUi.marker ? (
            <span
              className={`elevation-overlay__progress${
                elevationUi.marker.xPct < 15
                  ? " elevation-overlay__progress--start"
                  : elevationUi.marker.xPct > 85
                    ? " elevation-overlay__progress--end"
                    : ""
              }`}
              style={{
                // "N% covered" 라벨은 폭이 약 60px 로 커져(구 "N%" 는 ~17px), 예전처럼
                // 4~96% 로 left 를 클램프하면 경로 시작·끝 부근에서 라벨이 점에서 30px 가까이
                // 떨어져 보인다(클램프를 더 키워도 더 떨어질 뿐). 그래서 클램프 대신 CSS 쪽
                // 앵커 전환(--start/--end)으로 처리한다 — left 는 xPct 그대로 쓴다.
                left: `${elevationUi.marker.xPct}%`,
                top: `${elevationUi.marker.yPct}%`,
              }}
            >
              {elevationUi.marker.progressPct}% covered
            </span>
          ) : null}
          {/* 종점 깃발 — 이모지(🏁)는 색을 바꿀 수 없어 인라인 SVG 로 그린다(2026-09-17 Chief).
              깃대 밑동이 종점에 정확히 앉아야 하므로 깃대를 SVG 오른쪽 끝에 두고
              `translate(-100%, -100%)` 로 span 의 우하단을 종점에 맞춘다. 천은 왼쪽으로
              뻗는다 — 종점이 플롯 오른쪽 끝(xPct 98%)이라 오른쪽으로 뻗으면 박스를 넘는다. */}
          <span
            className="elevation-overlay__finish"
            style={{ left: `${elevationUi.endPoint.xPct}%`, top: `${elevationUi.endPoint.yPct}%` }}
            aria-hidden
          >
            <svg viewBox="0 0 13 14" width="13" height="14">
              <path
                d="M11.9 1V14"
                stroke={ELEVATION_LINE_COLOR}
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
              <path d="M11.15 1.6 L3 4.2 L11.15 6.8 Z" fill={ELEVATION_LINE_COLOR} />
            </svg>
          </span>
        </div>
      </div>
    ) : null}
    </>
  );
}

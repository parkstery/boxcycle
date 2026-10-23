import { formatElapsedFromMs } from "../lib/ride/rideFormat";
import { formatRideDistanceKmNumber } from "../lib/ride/rideDistanceFormat";
import { buildSuggestedRouteName } from "../lib/route/repo/firestoreSavedRoutes";
import type { LineStringGeometry } from "../lib/geo/geo";
import type { RideMetricsUi, RideSessionStatus } from "../hooks/useVirtualRideSession";
import type { RouteElevationProfileState } from "../hooks/useRouteElevationProfile";

export type RoutePreviewElevationHud =
  | { status: "ready"; startM: number; endM: number }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unavailable" };

export type AppHudValuesInput = {
  rideMetrics: RideMetricsUi;
  sessionStartOffsetMeters: number;
  startPlaceLabel: string | null;
  endPlaceLabel: string | null;
  lastEndedWasAdhoc: { distanceMeters: number } | null;
  routeDistanceMeters: number;
  rideStatus: RideSessionStatus;
  routeGeometry: LineStringGeometry | null;
  summaryVisible: boolean;
  avgSpeedLabel: string;
  routeElevationProfile?: RouteElevationProfileState | null;
};

function routePreviewElevationHud(
  profile: RouteElevationProfileState | null | undefined,
): RoutePreviewElevationHud {
  if (!profile) return { status: "unavailable" };
  if (profile.loading) return { status: "loading" };
  if (profile.quotaExceeded) {
    return { status: "error", message: "고도 한도 초과" };
  }
  if (profile.error) {
    return { status: "error", message: "고도 불러오기 실패" };
  }
  const values = profile.values;
  if (!values.length || !Number.isFinite(values[0]) || !Number.isFinite(values[values.length - 1])) return { status: "unavailable" };
  const startM = Math.round(values[0]!);
  const endM = Math.round(values[values.length - 1]!);
  return { status: "ready", startM, endM };
}

/** 계기판(HUD)·종료 요약용 표시값 — 렌더마다 계산하는 순수 함수 */
export function computeAppHudValues({
  rideMetrics,
  sessionStartOffsetMeters,
  startPlaceLabel,
  endPlaceLabel,
  lastEndedWasAdhoc,
  routeDistanceMeters,
  rideStatus,
  routeGeometry,
  summaryVisible,
  avgSpeedLabel,
  routeElevationProfile = null,
}: AppHudValuesInput) {
  /** HUD 거리·종료 요약·기록용 — 이번 세션 실주행 거리(오늘 N km, 재개 시 offset 차감) */
  const sessionDistanceMeters = Math.max(
    0,
    rideMetrics.virtualDistanceMeters - sessionStartOffsetMeters,
  );
  const elapsedLabel = formatElapsedFromMs(rideMetrics.accumulatedMs);
  const sessionDistanceKmLabel = formatRideDistanceKmNumber(sessionDistanceMeters);
  /** HUD 누적 위치 — 경로상 virtualDistance(재개 시 offset 시드 포함) */
  const cumulativeDistanceMeters = Math.max(0, rideMetrics.virtualDistanceMeters);
  const cumulativeDistanceKmLabel = formatRideDistanceKmNumber(cumulativeDistanceMeters);
  // 저장 폼 기본 이름 제안 — "출발지 → 도착지 · 거리"(역지오코딩된 지명 + 저장될 경로 거리).
  // 거리는 세션 주행 거리가 아니라 저장 대상 경로 거리를 써서 이름이 경로를 안정적으로 식별하게 한다.
  const suggestedRouteName = buildSuggestedRouteName({
    startPlaceLabel,
    endPlaceLabel,
    distanceMeters: lastEndedWasAdhoc?.distanceMeters ?? routeDistanceMeters,
  });
  const hudRoutePreview =
    rideStatus === "idle" &&
    Boolean(routeGeometry) &&
    routeDistanceMeters > 0 &&
    !summaryVisible;

  const hudMetrics =
    rideStatus !== "idle"
      ? {
          mode: "ride" as const,
          elapsed: elapsedLabel,
          /** 오늘(이번 세션) 실주행 km — 운동·칼로리와 동일 축 */
          distanceKm: sessionDistanceKmLabel,
          /** 경로상 누적 위치 km — 재개 시 offset 시드 반영 */
          cumulativeKm: cumulativeDistanceKmLabel,
          avgKmh: avgSpeedLabel,
          /* 램핑 적용속도는 소수 꼬리가 길다 — HUD 칩엔 정수만 */
          speedKmh: Math.round(rideMetrics.appliedSpeedKmh),
          /* 주행경로 전체거리 — 경로 확정 시에만(0=미확정 → 누적/전체 병기 생략) */
          routeTotalKm:
            routeDistanceMeters > 0 ? (routeDistanceMeters / 1000).toFixed(2) : null,
        }
      : hudRoutePreview
        ? {
            mode: "route-preview" as const,
            distanceKm: (routeDistanceMeters / 1000).toFixed(2),
            elevation: routePreviewElevationHud(routeElevationProfile),
          }
        : null;
  return {
    elapsedLabel,
    cumulativeDistanceMeters,
    suggestedRouteName,
    hudMetrics,
  };
}

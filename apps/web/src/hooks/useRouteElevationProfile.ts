import { useEffect, useMemo, useState } from "react";
import type { LineStringGeometry, LngLat } from "../lib/geo/geo";
import {
  fetchRouteElevationProfile,
  isElevationQuotaError,
  routeElevationSignature,
} from "../lib/route/fetchRouteElevations";
import { buildCoachElevationPoints } from "../lib/coach/coachElevationFromRoute";
import { applyRoadElevationModel } from "../services/roadElevationCoach";
import { firestoreElevationStore } from "../services/routeElevationStore";

export type RouteElevationProfileState = {
  values: number[];
  sampledCoords: LngLat[];
  loading: boolean;
  error: string | null;
  /** 실패 원인이 고도 API 일일 한도 초과(429)인가 — 네트워크 오류·코드 회귀와 구분해 표시한다. */
  quotaExceeded: boolean;
  routeSig: string;
};

const empty: RouteElevationProfileState = {
  values: [],
  sampledCoords: [],
  loading: false,
  error: null,
  quotaExceeded: false,
  routeSig: "",
};

/** 경로 고정 시 Open-Meteo 고도 1회 로드 후 도로형 보정(차트·코칭 공용). */
export function useRouteElevationProfile(
  geometry: LineStringGeometry | null,
): RouteElevationProfileState {
  const routeSig = useMemo(() => routeElevationSignature(geometry), [geometry]);
  const [state, setState] = useState<RouteElevationProfileState>(empty);

  const geometryValid =
    !!geometry && geometry.coordinates.length >= 2 && !!routeSig;

  useEffect(() => {
    if (!geometryValid || !geometry) return;

    let cancelled = false;

    void (async () => {
      try {
        const { values, sampledCoords } = await fetchRouteElevationProfile(
          geometry,
          firestoreElevationStore,
        );
        if (cancelled) return;
        if (routeElevationSignature(geometry) !== routeSig) return;

        let displayValues = values;
        if (values.length >= 2 && sampledCoords.length >= 2) {
          const coachPoints = buildCoachElevationPoints(geometry, values, sampledCoords);
          displayValues = applyRoadElevationModel(coachPoints).map((p) => p.elevation);
        }

        setState({
          values: displayValues,
          sampledCoords,
          loading: false,
          error: null,
          quotaExceeded: false,
          routeSig,
        });
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setState({
          values: [],
          sampledCoords: [],
          loading: false,
          error: message,
          quotaExceeded: isElevationQuotaError(e),
          routeSig,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [geometry, geometryValid, routeSig]);

  if (!geometryValid) return empty;
  if (state.routeSig === routeSig) return state;
  return { ...empty, loading: true, routeSig };
}

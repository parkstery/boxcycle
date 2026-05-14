import { useEffect, useMemo, useState } from "react";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import {
  fetchRouteElevationProfile,
  routeElevationSignature,
} from "../lib/fetchRouteElevations";
import { buildCoachElevationPoints } from "../lib/coachElevationFromRoute";
import { applyRoadElevationModel } from "../services/roadElevationCoach";

export type RouteElevationProfileState = {
  values: number[];
  sampledCoords: LngLat[];
  loading: boolean;
  error: string | null;
  routeSig: string;
};

const empty: RouteElevationProfileState = {
  values: [],
  sampledCoords: [],
  loading: false,
  error: null,
  routeSig: "",
};

/** 경로 고정 시 Open-Meteo 고도 1회 로드 후 도로형 보정(차트·코칭 공용). */
export function useRouteElevationProfile(
  geometry: LineStringGeometry | null,
): RouteElevationProfileState {
  const routeSig = useMemo(() => routeElevationSignature(geometry), [geometry]);
  const [state, setState] = useState<RouteElevationProfileState>(empty);

  useEffect(() => {
    if (!geometry || geometry.coordinates.length < 2 || !routeSig) {
      setState(empty);
      return;
    }

    let cancelled = false;
    setState((s) => ({
      ...s,
      values: [],
      sampledCoords: [],
      loading: true,
      error: null,
      routeSig,
    }));

    void (async () => {
      try {
        const { values, sampledCoords } = await fetchRouteElevationProfile(geometry);
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
          routeSig,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [geometry, routeSig]);

  return state;
}

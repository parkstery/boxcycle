import type { User } from "firebase/auth";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteCoursePresence } from "../lib/firestoreCoursePresence";
import {
  BASIC_SHARED_HUB_IDS,
  fetchCatalogRoutePayload,
  findPublishedPublicFingerprintsAmong,
  getBasicHubRoutePayload,
  listPublishedPublicRoutes,
  matchBasicSharedHubRouteId,
  routeGeometryMatchesBasicSharedHub,
  type PublishedPublicRouteSummary,
} from "../lib/firestoreRouteCatalog";
import type { LineStringGeometry, LngLat } from "../lib/geo";
import { lockRouteWorkspaceDuringRide } from "../lib/routeWorkspaceLock";
import {
  encodeCanonicalRouteGeometryProfile,
  fingerprintFromCanonicalSync,
} from "../lib/routeFingerprint";
import type { RouteProfile } from "../services/mapboxDirections";
import { formatDuration } from "../services/mapboxDirections";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";
import type { RideSessionStatus } from "./useVirtualRideSession";

export type UseOfficialRouteCatalogOptions = {
  configured: boolean;
  user: User | null;
  routeGeometry: LineStringGeometry | null;
  rideStatus: RideSessionStatus;
  handleEndRideRef: MutableRefObject<() => void>;
  setRouteGeometry: Dispatch<SetStateAction<LineStringGeometry | null>>;
  setStartLngLat: Dispatch<SetStateAction<LngLat | null>>;
  setEndLngLat: Dispatch<SetStateAction<LngLat | null>>;
  setRouteWaypoints: Dispatch<SetStateAction<LngLat[]>>;
  setProfile: Dispatch<SetStateAction<RouteProfile>>;
  setRouteDistanceMeters: Dispatch<SetStateAction<number>>;
  setRouteDurationSec: Dispatch<SetStateAction<number>>;
  setRouteSummary: Dispatch<SetStateAction<string>>;
  resetRide: () => void;
  setActiveOfficialCatalogRouteId: Dispatch<SetStateAction<string | null>>;
  setPlaceSearchMarkerLngLat: Dispatch<SetStateAction<LngLat | null>>;
  enterBasicHubArtifactsRef: MutableRefObject<() => void>;
  savedRoutes: SavedRoute[];
  pendingPublicRouteIds: ReadonlySet<string>;
  onPublicCatalogRideEntry?: () => void;
};

/** 공식·퍼블릭 Route 카탈로그, 지문 매칭, 입문 허브 presence (`coursePresence` legacy path). */
export function useOfficialRouteCatalog(options: UseOfficialRouteCatalogOptions) {
  const {
    configured,
    user,
    routeGeometry,
    rideStatus,
    handleEndRideRef,
    setRouteGeometry,
    setStartLngLat,
    setEndLngLat,
    setRouteWaypoints,
    setProfile,
    setRouteDistanceMeters,
    setRouteDurationSec,
    setRouteSummary,
    resetRide,
    setActiveOfficialCatalogRouteId,
    setPlaceSearchMarkerLngLat,
    enterBasicHubArtifactsRef,
    savedRoutes,
    pendingPublicRouteIds,
    onPublicCatalogRideEntry,
  } = options;

  const [publishedPublicRoutes, setPublishedPublicRoutes] = useState<PublishedPublicRouteSummary[]>([]);
  const [publishedPublicRoutesLoading, setPublishedPublicRoutesLoading] = useState(false);
  const [publishedPublicRoutesError, setPublishedPublicRoutesError] = useState<string | null>(null);
  const [basicActiveHubRouteId, setBasicActiveHubRouteId] = useState<string | null>(null);
  const [basicStartLoading, setBasicStartLoading] = useState(false);
  const basicStartHubJoined = basicActiveHubRouteId !== null;
  const basicStartHubLeftExplicitRef = useRef(false);

  const refreshPublishedPublicRouteCatalog = useCallback(async () => {
    if (!configured) {
      setPublishedPublicRoutes([]);
      setPublishedPublicRoutesError(null);
      setPublishedPublicRoutesLoading(false);
      return;
    }
    setPublishedPublicRoutesLoading(true);
    setPublishedPublicRoutesError(null);
    try {
      const rows = await listPublishedPublicRoutes(50);
      setPublishedPublicRoutes(rows);
    } catch (e: unknown) {
      setPublishedPublicRoutes([]);
      const msg = e instanceof Error ? e.message : String(e);
      setPublishedPublicRoutesError(msg);
    } finally {
      setPublishedPublicRoutesLoading(false);
    }
  }, [configured]);

  const publishedPublicSavedRouteIds = useMemo(
    () =>
      new Set(
        publishedPublicRoutes
          .map((c) => c.sourceSavedRouteId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    [publishedPublicRoutes],
  );

  const [publishedPublicRouteFingerprints, setPublishedPublicRouteFingerprints] = useState<
    ReadonlySet<string>
  >(() => new Set());

  useEffect(() => {
    let cancelled = false;
    if (!configured || !user) {
      setPublishedPublicRouteFingerprints(new Set());
      return;
    }
    const fps = savedRoutes
      .filter((r) => r.completed === 1)
      .map((r) =>
        fingerprintFromCanonicalSync(
          encodeCanonicalRouteGeometryProfile(r.geometry, r.profile),
        ),
      );
    void findPublishedPublicFingerprintsAmong(fps)
      .then((hit) => {
        if (!cancelled) setPublishedPublicRouteFingerprints(hit);
      })
      .catch(() => {
        if (!cancelled) setPublishedPublicRouteFingerprints(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [configured, user, savedRoutes, publishedPublicRoutes, pendingPublicRouteIds]);

  useEffect(() => {
    if (!user) {
      basicStartHubLeftExplicitRef.current = false;
      startTransition(() => setBasicActiveHubRouteId(null));
    }
  }, [user]);

  useEffect(() => {
    const matched = matchBasicSharedHubRouteId(routeGeometry);
    if (!matched) {
      basicStartHubLeftExplicitRef.current = false;
    }
  }, [routeGeometry]);

  useEffect(() => {
    if (!configured || !user) return;
    if (basicStartHubLeftExplicitRef.current) return;

    const matched = matchBasicSharedHubRouteId(routeGeometry);
    if (matched) {
      startTransition(() => setBasicActiveHubRouteId(matched));
      return;
    }

    if (
      basicActiveHubRouteId &&
      (BASIC_SHARED_HUB_IDS as readonly string[]).includes(basicActiveHubRouteId) &&
      routeGeometryMatchesBasicSharedHub(basicActiveHubRouteId, routeGeometry)
    ) {
      return;
    }

    if (routeGeometry?.coordinates?.length) {
      startTransition(() => setBasicActiveHubRouteId(null));
    }
  }, [configured, user, routeGeometry, basicActiveHubRouteId]);

  const enterBasicHub = useCallback(
    async (catalogRouteId: string) => {
      if (lockRouteWorkspaceDuringRide(rideStatus !== "idle")) {
        setRouteSummary("세션이 대기 상태일 때만 입문 경로를 불러올 수 있습니다. 종료 후 다시 시도하세요.");
        return;
      }
      setBasicStartLoading(true);
      setRouteSummary("공식 경로 불러오는 중…");
      try {
        if (user && basicActiveHubRouteId && basicActiveHubRouteId !== catalogRouteId) {
          await deleteCoursePresence(user.uid, basicActiveHubRouteId).catch(() => {
            /* noop */
          });
        }
        let payload = null;
        if (configured) {
          try {
            payload = await fetchCatalogRoutePayload(catalogRouteId);
          } catch {
            payload = null;
          }
        }
        const resolved = payload ?? getBasicHubRoutePayload(catalogRouteId);
        const coords = resolved.geometry.coordinates;
        setRouteGeometry(resolved.geometry);
        setStartLngLat(coords[0] ?? null);
        setEndLngLat(coords[coords.length - 1] ?? null);
        setRouteWaypoints([]);
        setProfile(resolved.profile);
        setRouteDistanceMeters(resolved.distanceMeters);
        setRouteDurationSec(resolved.durationSec);
        resetRide();
        enterBasicHubArtifactsRef.current();
        setRouteSummary(
          `${resolved.title} · 거리 ${(resolved.distanceMeters / 1000).toFixed(2)} km / 예상 ${formatDuration(resolved.durationSec)}`,
        );
        basicStartHubLeftExplicitRef.current = false;
        setPlaceSearchMarkerLngLat(null);
        const joinHubPresence =
          Boolean(user) && (BASIC_SHARED_HUB_IDS as readonly string[]).includes(resolved.id);
        setBasicActiveHubRouteId(joinHubPresence ? resolved.id : null);
        setActiveOfficialCatalogRouteId(resolved.id);
        onPublicCatalogRideEntry?.();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setRouteSummary(message);
      } finally {
        setBasicStartLoading(false);
      }
    },
    [
      rideStatus,
      configured,
      user,
      resetRide,
      basicActiveHubRouteId,
      setRouteGeometry,
      setStartLngLat,
      setEndLngLat,
      setRouteWaypoints,
      setProfile,
      setRouteDistanceMeters,
      setRouteDurationSec,
      setRouteSummary,
      setActiveOfficialCatalogRouteId,
      setPlaceSearchMarkerLngLat,
      enterBasicHubArtifactsRef,
      onPublicCatalogRideEntry,
    ],
  );

  const leaveBasicHub = useCallback(async () => {
    handleEndRideRef.current();
    basicStartHubLeftExplicitRef.current = true;
    if (user && basicActiveHubRouteId) {
      await deleteCoursePresence(user.uid, basicActiveHubRouteId).catch(() => {
        /* noop */
      });
    }
    setBasicActiveHubRouteId(null);
    setPlaceSearchMarkerLngLat(null);
  }, [user, basicActiveHubRouteId, handleEndRideRef, setPlaceSearchMarkerLngLat]);

  return {
    publishedPublicRoutes,
    publishedPublicRoutesLoading,
    publishedPublicRoutesError,
    refreshPublishedPublicRouteCatalog,
    publishedPublicSavedRouteIds,
    publishedPublicRouteFingerprints,
    basicActiveHubRouteId,
    setBasicActiveHubRouteId,
    basicStartLoading,
    basicStartHubJoined,
    enterBasicHub,
    leaveBasicHub,
  };
}

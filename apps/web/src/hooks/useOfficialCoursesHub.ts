import type { User } from "firebase/auth";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteCoursePresence } from "../lib/firestoreCoursePresence";
import {
  BASIC_SHARED_HUB_IDS,
  fetchCourseRoutePayload,
  findPublishedPublicFingerprintsAmong,
  getBasicHubCoursePayload,
  listPublishedPublicCourses,
  matchBasicSharedHubCourseId,
  routeGeometryMatchesBasicSharedHub,
  type PublishedPublicCourseSummary,
} from "../lib/firestoreCourses";
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

export type UseOfficialCoursesHubOptions = {
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
  setActiveOfficialCourseId: Dispatch<SetStateAction<string | null>>;
  setPlaceSearchMarkerLngLat: Dispatch<SetStateAction<LngLat | null>>;
  /** 입문 코스 로드 직전에 저장 경로 ref·ad-hoc 등 App 쪽 정리 */
  enterBasicHubArtifactsRef: MutableRefObject<() => void>;
  /** 퍼블릭 코스 전환 시 이전 coursePresence 정리 */
  activeOfficialCourseIdRef?: MutableRefObject<string | null>;
  savedRoutes: SavedRoute[];
  pendingPublicRouteIds: ReadonlySet<string>;
  /** 퍼블릭·입문 코스 탭에서 불러올 때 주행 입구 표시 */
  onPublicCatalogRideEntry?: () => void;
};

/**
 * 퍼블릭 공식 코스 카탈로그, 경로 지문 매칭, 입문 허브 동행 courseId·입장/퇴장.
 */
export function useOfficialCoursesHub(options: UseOfficialCoursesHubOptions) {
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
    setActiveOfficialCourseId,
    setPlaceSearchMarkerLngLat,
    enterBasicHubArtifactsRef,
    activeOfficialCourseIdRef,
    savedRoutes,
    pendingPublicRouteIds,
    onPublicCatalogRideEntry,
  } = options;

  const [publishedPublicCourses, setPublishedPublicCourses] = useState<PublishedPublicCourseSummary[]>([]);
  const [publishedPublicCoursesLoading, setPublishedPublicCoursesLoading] = useState(false);
  const [publishedPublicCoursesError, setPublishedPublicCoursesError] = useState<string | null>(null);
  const [basicActiveHubCourseId, setBasicActiveHubCourseId] = useState<string | null>(null);
  const [basicStartLoading, setBasicStartLoading] = useState(false);
  const basicStartHubJoined = basicActiveHubCourseId !== null;
  const basicStartHubLeftExplicitRef = useRef(false);

  const refreshPublishedPublicCourseCatalog = useCallback(async () => {
    if (!configured) {
      setPublishedPublicCourses([]);
      setPublishedPublicCoursesError(null);
      setPublishedPublicCoursesLoading(false);
      return;
    }
    setPublishedPublicCoursesLoading(true);
    setPublishedPublicCoursesError(null);
    try {
      const rows = await listPublishedPublicCourses(50);
      setPublishedPublicCourses(rows);
    } catch (e: unknown) {
      setPublishedPublicCourses([]);
      const msg = e instanceof Error ? e.message : String(e);
      setPublishedPublicCoursesError(msg);
    } finally {
      setPublishedPublicCoursesLoading(false);
    }
  }, [configured]);

  const publishedPublicSavedRouteIds = useMemo(
    () =>
      new Set(
        publishedPublicCourses
          .map((c) => c.sourceSavedRouteId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    [publishedPublicCourses],
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
  }, [configured, user, savedRoutes, publishedPublicCourses, pendingPublicRouteIds]);

  useEffect(() => {
    if (!user) {
      basicStartHubLeftExplicitRef.current = false;
      startTransition(() => setBasicActiveHubCourseId(null));
    }
  }, [user]);

  useEffect(() => {
    const matched = matchBasicSharedHubCourseId(routeGeometry);
    if (!matched) {
      basicStartHubLeftExplicitRef.current = false;
    }
  }, [routeGeometry]);

  useEffect(() => {
    if (!configured || !user) return;
    if (basicStartHubLeftExplicitRef.current) return;

    const matched = matchBasicSharedHubCourseId(routeGeometry);
    if (matched) {
      startTransition(() => setBasicActiveHubCourseId(matched));
      return;
    }

    if (
      basicActiveHubCourseId &&
      (BASIC_SHARED_HUB_IDS as readonly string[]).includes(basicActiveHubCourseId) &&
      routeGeometryMatchesBasicSharedHub(basicActiveHubCourseId, routeGeometry)
    ) {
      return;
    }

    if (routeGeometry?.coordinates?.length) {
      startTransition(() => setBasicActiveHubCourseId(null));
    }
  }, [configured, user, routeGeometry, basicActiveHubCourseId]);

  const enterBasicHub = useCallback(
    async (courseId: string) => {
      if (lockRouteWorkspaceDuringRide(rideStatus !== "idle")) {
        setRouteSummary("세션이 대기 상태일 때만 입문 경로를 불러올 수 있습니다.");
        return;
      }
      setBasicStartLoading(true);
      setRouteSummary("공식 경로 불러오는 중…");
      try {
        if (user && basicActiveHubCourseId && basicActiveHubCourseId !== courseId) {
          await deleteCoursePresence(user.uid, basicActiveHubCourseId).catch(() => {
            /* noop */
          });
        }
        const prevOfficial = activeOfficialCourseIdRef?.current;
        if (user && prevOfficial && prevOfficial !== courseId) {
          await deleteCoursePresence(user.uid, prevOfficial).catch(() => {
            /* noop */
          });
        }
        let payload = null;
        if (configured) {
          try {
            payload = await fetchCourseRoutePayload(courseId);
          } catch {
            payload = null;
          }
        }
        const resolved = payload ?? getBasicHubCoursePayload(courseId);
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
        setBasicActiveHubCourseId(joinHubPresence ? resolved.id : null);
        setActiveOfficialCourseId(resolved.id);
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
      basicActiveHubCourseId,
      setRouteGeometry,
      setStartLngLat,
      setEndLngLat,
      setRouteWaypoints,
      setProfile,
      setRouteDistanceMeters,
      setRouteDurationSec,
      setRouteSummary,
      setActiveOfficialCourseId,
      setPlaceSearchMarkerLngLat,
      enterBasicHubArtifactsRef,
      activeOfficialCourseIdRef,
      onPublicCatalogRideEntry,
    ],
  );

  const leaveBasicHub = useCallback(async () => {
    handleEndRideRef.current();
    basicStartHubLeftExplicitRef.current = true;
    if (user && basicActiveHubCourseId) {
      await deleteCoursePresence(user.uid, basicActiveHubCourseId).catch(() => {
        /* noop */
      });
    }
    setBasicActiveHubCourseId(null);
    setPlaceSearchMarkerLngLat(null);
  }, [user, basicActiveHubCourseId, handleEndRideRef, setPlaceSearchMarkerLngLat]);

  return {
    publishedPublicCourses,
    publishedPublicCoursesLoading,
    publishedPublicCoursesError,
    refreshPublishedPublicCourseCatalog,
    publishedPublicSavedRouteIds,
    publishedPublicRouteFingerprints,
    basicActiveHubCourseId,
    setBasicActiveHubCourseId,
    basicStartLoading,
    basicStartHubJoined,
    enterBasicHub,
    leaveBasicHub,
  };
}

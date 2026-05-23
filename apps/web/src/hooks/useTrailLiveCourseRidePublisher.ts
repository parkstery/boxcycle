import { useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import type { LineStringGeometry } from "../lib/geo";
import {
  deleteTrailLiveCourseRide,
  mergeTrailLiveCourseRideSnapshot,
} from "../lib/firestoreTrailLiveCourseRides";
import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../lib/firestoreTrail";
import { touchTrailInstanceActivity } from "../lib/firestoreTrailInstance";
import {
  TRAIL_LIVE_PROGRESS_MAX_WRITE_MS,
  TRAIL_LIVE_PROGRESS_MIN_DELTA,
  TRAIL_LIVE_PROGRESS_MIN_WRITE_MS,
} from "../lib/rideSyncPolicy";

const PROGRESS_POLL_MS = 3_500;

type UseTrailLiveCourseRidePublisherOpts = {
  user: User | null | undefined;
  enabled: boolean;
  pageVisible: boolean;
  trailId: string;
  courseId: string | null;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
};

export function useTrailLiveCourseRidePublisher(opts: UseTrailLiveCourseRidePublisherOpts): void {
  const {
    user,
    enabled,
    pageVisible,
    trailId,
    courseId,
    routeGeometry,
    routeDistanceMeters,
    virtualDistanceMeters,
  } = opts;

  const userRef = useRef(user);
  userRef.current = user ?? null;

  const totalRef = useRef(0);
  totalRef.current = routeDistanceMeters > 0 ? routeDistanceMeters : 0;
  const vRef = useRef(virtualDistanceMeters);
  vRef.current = virtualDistanceMeters;

  const courseIdRef = useRef(courseId);
  courseIdRef.current = courseId;

  const geomRef = useRef(routeGeometry);
  geomRef.current = routeGeometry;

  const pageVisibleRef = useRef(pageVisible);
  pageVisibleRef.current = pageVisible;

  useEffect(() => {
    pageVisibleRef.current = pageVisible;
  }, [pageVisible]);

  useEffect(() => {
    const u = userRef.current;
    if (!enabled || !u) return;

    const tid = sanitizeTrailId(trailId);
    const last = { writeAt: 0, ratio: -1 as number };

    const tick = () => {
      const u2 = userRef.current;
      if (!u2 || !pageVisibleRef.current) return;
      const c = courseIdRef.current?.trim();
      if (!c || !geomRef.current?.coordinates?.length) return;
      const tot = totalRef.current;
      const ratio = tot > 0 ? Math.max(0, Math.min(1, vRef.current / tot)) : 0;
      const now = Date.now();
      const elapsed = last.writeAt === 0 ? TRAIL_LIVE_PROGRESS_MAX_WRITE_MS : now - last.writeAt;
      const maxDue = last.writeAt === 0 || elapsed >= TRAIL_LIVE_PROGRESS_MAX_WRITE_MS;
      const deltaOk = last.ratio < 0 || Math.abs(ratio - last.ratio) >= TRAIL_LIVE_PROGRESS_MIN_DELTA;
      const minOk = last.writeAt === 0 || now - last.writeAt >= TRAIL_LIVE_PROGRESS_MIN_WRITE_MS;
      if (!maxDue && !(deltaOk && minOk)) return;
      last.writeAt = now;
      last.ratio = ratio;
      void mergeTrailLiveCourseRideSnapshot(u2, tid, {
        courseId: c,
        progressRatio: ratio,
      }).catch(() => {});
      if (tid !== DEFAULT_TRAIL_ID) {
        void touchTrailInstanceActivity(tid);
      }
    };

    const cid0 = courseIdRef.current?.trim();
    if (!cid0 || !geomRef.current?.coordinates?.length) {
      void deleteTrailLiveCourseRide(u.uid, tid).catch(() => {});
      return;
    }

    tick();
    const id = window.setInterval(tick, PROGRESS_POLL_MS);
    return () => {
      window.clearInterval(id);
      void deleteTrailLiveCourseRide(u.uid, tid).catch(() => {});
    };
  }, [enabled, pageVisible, trailId, user?.uid, courseId]);
}

/** @deprecated `useTrailLiveCourseRidePublisher` */
export const useLobbyLiveCourseRidePublisher = useTrailLiveCourseRidePublisher;

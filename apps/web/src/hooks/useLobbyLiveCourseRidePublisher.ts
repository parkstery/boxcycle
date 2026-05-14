import { useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import type { LineStringGeometry } from "../lib/geo";
import {
  LOBBY_LIVE_COURSE_RIDE_WRITE_INTERVAL_MS,
  deleteLobbyLiveCourseRide,
  mergeLobbyLiveCourseRideSnapshot,
} from "../lib/firestoreLobbyLiveCourseRides";
import { sanitizeRoomId } from "../lib/firestoreLobby";

type UseLobbyLiveCourseRidePublisherOpts = {
  user: User | null | undefined;
  /** 로비 참가 + 주행 중일 때만 기록 */
  enabled: boolean;
  roomId: string;
  /** 공식/입문 코스 ID (없으면 기록 안 함) */
  courseId: string | null;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
};

export function useLobbyLiveCourseRidePublisher(opts: UseLobbyLiveCourseRidePublisherOpts): void {
  const {
    user,
    enabled,
    roomId,
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

  useEffect(() => {
    const u = userRef.current;
    if (!enabled || !u) return;

    const rid = sanitizeRoomId(roomId);
    const tick = () => {
      const u2 = userRef.current;
      if (!u2) return;
      const c = courseIdRef.current?.trim();
      if (!c || !geomRef.current?.coordinates?.length) return;
      const tot = totalRef.current;
      const ratio = tot > 0 ? Math.max(0, Math.min(1, vRef.current / tot)) : 0;
      void mergeLobbyLiveCourseRideSnapshot(u2, rid, {
        courseId: c,
        progressRatio: ratio,
      }).catch(() => {});
    };

    const cid0 = courseIdRef.current?.trim();
    if (!cid0 || !geomRef.current?.coordinates?.length) {
      void deleteLobbyLiveCourseRide(u.uid, rid).catch(() => {});
      return;
    }

    tick();
    const id = window.setInterval(tick, LOBBY_LIVE_COURSE_RIDE_WRITE_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      void deleteLobbyLiveCourseRide(u.uid, rid).catch(() => {});
    };
  }, [enabled, roomId, user?.uid, courseId, routeGeometry]);
}

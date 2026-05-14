import { useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import type { LineStringGeometry } from "../lib/geo";
import {
  deleteLobbyLiveCourseRide,
  mergeLobbyLiveCourseRideSnapshot,
} from "../lib/firestoreLobbyLiveCourseRides";
import { sanitizeRoomId } from "../lib/firestoreLobby";
import {
  LOBBY_LIVE_PROGRESS_MAX_WRITE_MS,
  LOBBY_LIVE_PROGRESS_MIN_DELTA,
  LOBBY_LIVE_PROGRESS_MIN_WRITE_MS,
} from "../lib/rideSyncPolicy";

const PROGRESS_POLL_MS = 2_000;

type UseLobbyLiveCourseRidePublisherOpts = {
  user: User | null | undefined;
  /** 로비 참가 + 실제 주행 + 포그라운드일 때만 기록 */
  enabled: boolean;
  /** 탭이 보일 때만 진행률 쓰기 */
  pageVisible: boolean;
  roomId: string;
  courseId: string | null;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
};

export function useLobbyLiveCourseRidePublisher(opts: UseLobbyLiveCourseRidePublisherOpts): void {
  const {
    user,
    enabled,
    pageVisible,
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

  const pageVisibleRef = useRef(pageVisible);
  pageVisibleRef.current = pageVisible;

  useEffect(() => {
    pageVisibleRef.current = pageVisible;
  }, [pageVisible]);

  useEffect(() => {
    const u = userRef.current;
    if (!enabled || !u) return;

    const rid = sanitizeRoomId(roomId);
    const last = { writeAt: 0, ratio: -1 as number };

    const tick = () => {
      const u2 = userRef.current;
      if (!u2 || !pageVisibleRef.current) return;
      const c = courseIdRef.current?.trim();
      if (!c || !geomRef.current?.coordinates?.length) return;
      const tot = totalRef.current;
      const ratio = tot > 0 ? Math.max(0, Math.min(1, vRef.current / tot)) : 0;
      const now = Date.now();
      const elapsed = last.writeAt === 0 ? LOBBY_LIVE_PROGRESS_MAX_WRITE_MS : now - last.writeAt;
      const maxDue = last.writeAt === 0 || elapsed >= LOBBY_LIVE_PROGRESS_MAX_WRITE_MS;
      const deltaOk = last.ratio < 0 || Math.abs(ratio - last.ratio) >= LOBBY_LIVE_PROGRESS_MIN_DELTA;
      const minOk = last.writeAt === 0 || now - last.writeAt >= LOBBY_LIVE_PROGRESS_MIN_WRITE_MS;
      if (!maxDue && !(deltaOk && minOk)) return;
      last.writeAt = now;
      last.ratio = ratio;
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
    const id = window.setInterval(tick, PROGRESS_POLL_MS);
    return () => {
      window.clearInterval(id);
      void deleteLobbyLiveCourseRide(u.uid, rid).catch(() => {});
    };
  }, [enabled, pageVisible, roomId, user?.uid, courseId, routeGeometry]);
}

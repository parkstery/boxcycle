import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { ensureCoursePresenceFlagsMerged } from "../lib/firestoreCourses";
import {
  deleteCoursePresence,
  isCourseMemberActive,
  subscribeCourseMembers,
  touchCoursePresence,
  upsertCoursePresence,
  type CourseMemberRow,
} from "../lib/firestoreCoursePresence";
import {
  isTrailLiveCourseRideRowFresh,
  type TrailLiveCourseRideRow,
} from "../lib/firestoreTrailLiveCourseRides";
import { acquireTrailLiveCourseRidesSubscription } from "../lib/liveCourseRidesSubscriptionHub";
import { sanitizeTrailId } from "../lib/firestoreTrail";
import type { MapPeerMarker } from "./MapView";
import { TRAIL_PRESENCE_STALE_MS } from "../lib/firestoreTrail";
import { COURSE_PRESENCE_HEARTBEAT_ACTIVE_MS, COURSE_PRESENCE_HEARTBEAT_PAUSED_MS } from "../lib/rideSyncPolicy";
import { mapNametagForMember, sortedGuestUids } from "../lib/guestNametag";
import { useDocumentVisibility } from "../hooks/useDocumentVisibility";
import "./trail/TrailheadPresence.css";

function peersStableKey(peers: MapPeerMarker[] | undefined): string {
  if (!peers?.length) return "";
  return peers
    .map((p) => {
      if (typeof p.progressRatio === "number" && Number.isFinite(p.progressRatio)) {
        return `${p.id}:p${p.progressRatio.toFixed(5)}:${p.label ?? ""}`;
      }
      if (p.lngLat) {
        return `${p.id}:${p.lngLat[0].toFixed(6)},${p.lngLat[1].toFixed(6)}:${p.label ?? ""}`;
      }
      return `${p.id}:?`;
    })
    .sort()
    .join("|");
}

type CourseSharedPresenceProps = {
  user: User;
  courseId: string;
  trailId: string;
  title?: string;
  isRiding: boolean;
  /** running 또는 paused — heartbeat 주기만 조절 */
  rideSessionActive: boolean;
  onPeersChange?: (peers: MapPeerMarker[]) => void;
  onLiveRiderNametagChange?: (nametag: string | null) => void;
  /** false — 동행 동기화만, 패널 미표시(모바일) */
  showPanel?: boolean;
};

export function CourseSharedPresence({
  user,
  courseId,
  trailId,
  title,
  isRiding,
  rideSessionActive,
  onPeersChange,
  onLiveRiderNametagChange,
  showPanel = false,
}: CourseSharedPresenceProps) {
  const pageVisible = useDocumentVisibility();
  const [rows, setRows] = useState<CourseMemberRow[]>([]);
  const [liveRideRows, setLiveRideRows] = useState<TrailLiveCourseRideRow[]>([]);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const onPeersChangeRef = useRef(onPeersChange);
  const onLiveTagRef = useRef(onLiveRiderNametagChange);
  const userRef = useRef(user);
  userRef.current = user;
  onLiveTagRef.current = onLiveRiderNametagChange;

  useEffect(() => {
    return () => {
      onLiveTagRef.current?.(null);
    };
  }, []);

  useEffect(() => {
    onPeersChangeRef.current = onPeersChange;
  }, [onPeersChange]);

  useEffect(() => {
    return () => {
      onPeersChangeRef.current?.([]);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    startTransition(() => setPresenceError(null));

    if (!pageVisible) {
      startTransition(() => {
        setRows([]);
        setPresenceError(null);
      });
      return;
    }

    void (async () => {
      try {
        await ensureCoursePresenceFlagsMerged(courseId);
      } catch {
        /* noop */
      }
      if (cancelled) return;
      try {
        await upsertCoursePresence(userRef.current, courseId);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setPresenceError(message);
      }
      if (cancelled) return;

      unsub = subscribeCourseMembers(
        courseId,
        (next) => {
          startTransition(() => setRows(next));
        },
        (err) => {
          if (!cancelled) setPresenceError(err.message);
        },
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user.uid, courseId, pageVisible]);

  useEffect(() => {
    if (!pageVisible || !rideSessionActive) {
      startTransition(() => setLiveRideRows([]));
      return;
    }

    const tid = sanitizeTrailId(trailId);
    let cancelled = false;
    const release = acquireTrailLiveCourseRidesSubscription(
      tid,
      (next) => {
        if (!cancelled) startTransition(() => setLiveRideRows(next));
      },
      () => {
        /* live ride 구독 오류는 멤버 presence 와 분리 — 맵 동행만 생략 */
      },
    );

    return () => {
      cancelled = true;
      release();
    };
  }, [pageVisible, rideSessionActive, trailId]);

  useEffect(() => {
    const uid = user.uid;
    const cid = courseId;
    return () => {
      void deleteCoursePresence(uid, cid).catch(() => {});
    };
  }, [user.uid, courseId]);

  useEffect(() => {
    if (!pageVisible) return;
    const ms =
      rideSessionActive && isRiding
        ? COURSE_PRESENCE_HEARTBEAT_ACTIVE_MS
        : COURSE_PRESENCE_HEARTBEAT_PAUSED_MS;
    const id = window.setInterval(() => {
      void touchCoursePresence(userRef.current, courseId).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setPresenceError(message);
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [pageVisible, rideSessionActive, isRiding, courseId, user.uid]);

  const active = useMemo(
    () => rows.filter((r) => isCourseMemberActive(r.lastSeenAtMs)),
    [rows],
  );

  const liveRidesByUid = useMemo(() => {
    const m = new Map<string, TrailLiveCourseRideRow>();
    const cid = courseId.trim();
    for (const row of liveRideRows) {
      if (row.uid === user.uid) continue;
      if (!isTrailLiveCourseRideRowFresh(row)) continue;
      if (row.courseId.trim() !== cid) continue;
      m.set(row.uid, row);
    }
    return m;
  }, [liveRideRows, courseId, user.uid]);

  const guestUidsSorted = useMemo(() => {
    const picks = active.map((r) => ({ uid: r.uid, memberType: r.memberType }));
    let ids = sortedGuestUids(picks);
    if (user.isAnonymous && !ids.includes(user.uid)) {
      ids = [...ids, user.uid].sort((a, b) => a.localeCompare(b));
    }
    return ids;
  }, [active, user.isAnonymous, user.uid]);

  const myMapNametag = useMemo(() => {
    if (user.isAnonymous) {
      const i = guestUidsSorted.indexOf(user.uid);
      return i >= 0 ? `guest${i + 1}` : "guest";
    }
    return user.displayName?.trim() || user.email?.trim() || "Rider";
  }, [user, guestUidsSorted]);

  useEffect(() => {
    onLiveTagRef.current?.(myMapNametag);
  }, [myMapNametag]);

  const peerMarkersForMap = useMemo((): MapPeerMarker[] => {
    if (presenceError) return [];
    return active
      .filter((r) => r.uid !== user.uid && liveRidesByUid.has(r.uid))
      .map((r) => {
        const live = liveRidesByUid.get(r.uid)!;
        return {
          id: r.uid,
          progressRatio: live.progressRatio,
          label: mapNametagForMember(r.uid, r.memberType, r.displayName, guestUidsSorted),
        };
      });
  }, [active, presenceError, user.uid, guestUidsSorted, liveRidesByUid]);

  const lastPeersKeyRef = useRef<string>("__init__");

  useEffect(() => {
    const cb = onPeersChangeRef.current;
    if (!cb) return;
    const nextKey = presenceError ? "__err__" : peersStableKey(peerMarkersForMap);
    if (nextKey === lastPeersKeyRef.current) return;
    lastPeersKeyRef.current = nextKey;
    cb(presenceError ? [] : peerMarkersForMap);
  }, [peerMarkersForMap, presenceError]);

  if (!showPanel) return null;

  return (
    <section className="trailhead-presence" aria-label="경로 동시 주행">
      <div className="trailhead-presence__head">
        <strong>경로 동행</strong>
        <span className="trailhead-presence__meta">
          {title ? `${title}` : null}
          {title ? " · " : null}
          접속 {Math.round(TRAIL_PRESENCE_STALE_MS / 1000)}초
        </span>
      </div>
      {presenceError ? (
        <p className="trailhead-presence__err" title={presenceError}>
          동기화 오류
        </p>
      ) : null}
      <p className="trailhead-presence__count">
        접속 중(추정): <strong>{active.length}</strong>명
        {rows.length !== active.length ? (
          <span className="trailhead-presence__stale-hint">
            {" "}
            (문서 {rows.length}건 중 비활성 제외)
          </span>
        ) : null}
      </p>
      {!presenceError && active.length > 0 ? (
        <ul className="trailhead-presence__list">
          {active.map((r) => (
            <li key={r.uid}>
              {mapNametagForMember(r.uid, r.memberType, r.displayName, guestUidsSorted)}
              {r.uid === user.uid ? <span className="trailhead-presence__you"> (나)</span> : null}
              {liveRidesByUid.has(r.uid) ? (
                <span className="trailhead-presence__live-dot"> · 지도 공유 중</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!presenceError && active.length === 0 ? (
        <p className="trailhead-presence__empty">아직 표시할 접속자가 없습니다.</p>
      ) : null}
      {presenceError && rows.length === 0 ? (
        <p className="trailhead-presence__empty">목록을 불러오지 못했습니다. 위 오류를 해결한 뒤 새로고침하세요.</p>
      ) : null}
    </section>
  );
}

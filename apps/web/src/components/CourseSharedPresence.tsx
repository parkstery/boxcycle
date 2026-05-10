import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  COURSE_LIVE_SHARE_INTERVAL_MS,
  deleteCoursePresence,
  isCourseMemberActive,
  mergeCourseMemberLiveLocation,
  subscribeCourseMembers,
  touchCoursePresence,
  upsertCoursePresence,
  type CourseMemberRow,
} from "../lib/firestoreCoursePresence";
import type { LngLat } from "../lib/geo";
import type { MapPeerMarker } from "./MapView";
import { LOBBY_STALE_MS, PRESENCE_HEARTBEAT_INTERVAL_MS } from "../lib/firestoreLobby";
import "./LobbyPresence.css";

function peersStableKey(peers: MapPeerMarker[]): string {
  if (peers.length === 0) return "";
  return peers
    .map((p) => `${p.id}:${p.lngLat[0].toFixed(6)},${p.lngLat[1].toFixed(6)}:${p.label ?? ""}`)
    .sort()
    .join("|");
}

type CourseSharedPresenceProps = {
  user: User;
  courseId: string;
  title?: string;
  /** 주행 중이면 주기적으로 지도 좌표를 공유 */
  isRiding: boolean;
  myLiveLngLat: LngLat | null;
  onPeersChange?: (peers: MapPeerMarker[]) => void;
};

export function CourseSharedPresence({
  user,
  courseId,
  title,
  isRiding,
  myLiveLngLat,
  onPeersChange,
}: CourseSharedPresenceProps) {
  const [rows, setRows] = useState<CourseMemberRow[]>([]);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const liveRef = useRef<LngLat | null>(null);
  const onPeersChangeRef = useRef(onPeersChange);

  useEffect(() => {
    liveRef.current = myLiveLngLat;
  }, [myLiveLngLat]);

  useEffect(() => {
    onPeersChangeRef.current = onPeersChange;
  }, [onPeersChange]);

  useEffect(() => {
    let cancelled = false;
    startTransition(() => setPresenceError(null));

    void upsertCoursePresence(user, courseId).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (!cancelled) setPresenceError(message);
    });

    const unsub = subscribeCourseMembers(
      courseId,
      (next) => {
        startTransition(() => setRows(next));
      },
      (err) => {
        if (!cancelled) setPresenceError(err.message);
      },
    );

    const timer = window.setInterval(() => {
      void touchCoursePresence(user, courseId).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setPresenceError(message);
      });
    }, PRESENCE_HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsub();
      void deleteCoursePresence(user.uid, courseId).catch(() => {
        /* 코스 전환·언마운트 시 무시 */
      });
    };
  }, [user, courseId]);

  useEffect(() => {
    if (!isRiding) {
      void mergeCourseMemberLiveLocation(user, courseId, null).catch(() => {
        /* 퇴장·일시정지 시 위치 제거 실패는 무시 */
      });
      return;
    }
    const send = () => {
      const p = liveRef.current;
      if (!p) return;
      void mergeCourseMemberLiveLocation(user, courseId, p).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setPresenceError(message);
      });
    };
    send();
    const id = window.setInterval(send, COURSE_LIVE_SHARE_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      void mergeCourseMemberLiveLocation(user, courseId, null).catch(() => {
        /* noop */
      });
    };
  }, [isRiding, user, courseId]);

  /** rows 참조가 바뀔 때만 재계산 — 매 부모 렌더마다 새 배열이 되면 안 됨 */
  const active = useMemo(
    () => rows.filter((r) => isCourseMemberActive(r.lastSeenAtMs)),
    [rows],
  );

  const peerMarkersForMap = useMemo((): MapPeerMarker[] => {
    if (presenceError) return [];
    return active
      .filter((r) => r.uid !== user.uid && r.liveLngLat)
      .map((r) => ({
        id: r.uid,
        lngLat: r.liveLngLat!,
        label: r.displayName,
      }));
  }, [active, presenceError, user.uid]);

  const lastPeersKeyRef = useRef<string>("__init__");

  useEffect(() => {
    const cb = onPeersChangeRef.current;
    if (!cb) return;
    const nextKey = presenceError ? "__err__" : peersStableKey(peerMarkersForMap);
    if (nextKey === lastPeersKeyRef.current) return;
    lastPeersKeyRef.current = nextKey;
    cb(presenceError ? [] : peerMarkersForMap);
  }, [peerMarkersForMap, presenceError]);

  const isPermissionError =
    presenceError?.includes("permission") || presenceError?.includes("Permission");

  return (
    <section className="lobby-presence" aria-label="입문 코스 동시 주행자">
      <div className="lobby-presence__head">
        <strong>입문 코스 동행</strong>
        <span className="lobby-presence__meta">
          {title ? `${title} · ` : null}
          <code>{courseId}</code> · 활동 기준 {Math.round(LOBBY_STALE_MS / 1000)}초
        </span>
      </div>
      {presenceError ? (
        <p className="lobby-presence__err" title={presenceError}>
          동행 동기화 오류: {presenceError}
          {isPermissionError ? (
            <>
              {" "}
              <span className="lobby-presence__err-hint">
                (<code>courses/{'{courseId}'}</code> 에 <code>presenceEnabled: true</code> 또는 입문 허브 시드의{" "}
                <code>isSharedStartHub: true</code> 가 있는지, 저장소 루트 <code>firestore.rules</code> 배포 여부를
                확인하세요. 예: <code>firebase deploy --only firestore</code>)
              </span>
            </>
          ) : null}
        </p>
      ) : null}
      <p className="lobby-presence__count">
        접속 중(추정): <strong>{active.length}</strong>명
        {rows.length !== active.length ? (
          <span className="lobby-presence__stale-hint">
            {" "}
            (문서 {rows.length}건 중 비활성 제외)
          </span>
        ) : null}
      </p>
      {!presenceError && active.length > 0 ? (
        <ul className="lobby-presence__list">
          {active.map((r) => (
            <li key={r.uid}>
              {r.displayName ?? r.uid}
              {r.uid === user.uid ? <span className="lobby-presence__you"> (나)</span> : null}
              {r.liveLngLat ? <span className="lobby-presence__live-dot"> · 지도 공유 중</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!presenceError && active.length === 0 ? (
        <p className="lobby-presence__empty">아직 표시할 접속자가 없습니다.</p>
      ) : null}
      {presenceError && rows.length === 0 ? (
        <p className="lobby-presence__empty">목록을 불러오지 못했습니다. 위 오류를 해결한 뒤 새로고침하세요.</p>
      ) : null}
    </section>
  );
}

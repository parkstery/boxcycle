import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { ensureBasicSharedHubPresenceFlagsMerged } from "../lib/firestoreCourses";
import {
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
import { LOBBY_STALE_MS } from "../lib/firestoreLobby";
import {
  COURSE_PRESENCE_HEARTBEAT_ACTIVE_MS,
  COURSE_PRESENCE_HEARTBEAT_PAUSED_MS,
  haversineMeters,
  LIVE_SHARE_MAX_WRITE_INTERVAL_MS,
  LIVE_SHARE_MIN_MOVE_METERS,
  LIVE_SHARE_MIN_PROGRESS_DELTA,
  LIVE_SHARE_MIN_WRITE_INTERVAL_MS,
  roundLngLatForLiveShare,
} from "../lib/rideSyncPolicy";
import { mapNametagForMember, sortedGuestUids } from "../lib/guestNametag";
import { useDocumentVisibility } from "../hooks/useDocumentVisibility";
import "./LobbyPresence.css";

function peersStableKey(peers: MapPeerMarker[] | undefined): string {
  if (!peers?.length) return "";
  return peers
    .map((p) => `${p.id}:${p.lngLat[0].toFixed(6)},${p.lngLat[1].toFixed(6)}:${p.label ?? ""}`)
    .sort()
    .join("|");
}

type CourseSharedPresenceProps = {
  user: User;
  courseId: string;
  title?: string;
  /** 실제 주행(running)일 때만 라이브 좌표를 Firestore에 동기화 */
  isRiding: boolean;
  /** 0~1 가상 진행률 — 이동·진행률 기반 쓰기 임계값 */
  progressRatio?: number | null;
  myLiveLngLat: LngLat | null;
  onPeersChange?: (peers: MapPeerMarker[]) => void;
  /** 내 라이더 머리 위 네임태그(닉네임·guest1 등) */
  onLiveRiderNametagChange?: (nametag: string | null) => void;
};

export function CourseSharedPresence({
  user,
  courseId,
  title,
  isRiding,
  progressRatio,
  myLiveLngLat,
  onPeersChange,
  onLiveRiderNametagChange,
}: CourseSharedPresenceProps) {
  const pageVisible = useDocumentVisibility();
  const [rows, setRows] = useState<CourseMemberRow[]>([]);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const liveRef = useRef<LngLat | null>(null);
  const progressRef = useRef<number | null>(null);
  const onPeersChangeRef = useRef(onPeersChange);
  const onLiveTagRef = useRef(onLiveRiderNametagChange);
  const userRef = useRef(user);
  userRef.current = user;
  onLiveTagRef.current = onLiveRiderNametagChange;
  progressRef.current =
    typeof progressRatio === "number" && Number.isFinite(progressRatio)
      ? Math.max(0, Math.min(1, progressRatio))
      : null;

  useEffect(() => {
    return () => {
      onLiveTagRef.current?.(null);
    };
  }, []);

  useEffect(() => {
    liveRef.current = myLiveLngLat;
  }, [myLiveLngLat]);

  useEffect(() => {
    onPeersChangeRef.current = onPeersChange;
  }, [onPeersChange]);

  useEffect(() => {
    return () => {
      onPeersChangeRef.current?.([]);
    };
  }, []);

  /**
   * 포그라운드일 때만 멤버 스냅샷 구독.
   * 백그라운드(탭 숨김)에서는 구독만 해제·라이브 좌표만 제거 — presence 문서는 유지해 delete/recreate 쓰기 남발을 막음.
   * 문서 삭제는 uid/courseId 이탈 전용 이펙트에서만 수행.
   */
  useEffect(() => {
    const uid = user.uid;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    startTransition(() => setPresenceError(null));

    if (!pageVisible) {
      startTransition(() => {
        setRows([]);
        setPresenceError(null);
      });
      return () => {
        void mergeCourseMemberLiveLocation(userRef.current, courseId, null).catch(() => {});
      };
    }

    void (async () => {
      try {
        await ensureBasicSharedHubPresenceFlagsMerged(courseId);
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

  /** 코스 동행 문서 삭제 — 코스·uid 전환 또는 컴포넌트 언마운트 시에만(가시성 토글과 분리) */
  useEffect(() => {
    const uid = user.uid;
    const cid = courseId;
    return () => {
      void mergeCourseMemberLiveLocation(userRef.current, cid, null).catch(() => {});
      void deleteCoursePresence(uid, cid).catch(() => {});
    };
  }, [user.uid, courseId]);

  /** presence 생존 신호 — 주행 중은 기본 주기, 일시정지·대기는 저빈도(좌표 쓰기와 분리) */
  useEffect(() => {
    if (!pageVisible) return;
    const ms = isRiding ? COURSE_PRESENCE_HEARTBEAT_ACTIVE_MS : COURSE_PRESENCE_HEARTBEAT_PAUSED_MS;
    const id = window.setInterval(() => {
      void touchCoursePresence(userRef.current, courseId).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setPresenceError(message);
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [pageVisible, isRiding, courseId, user.uid]);

  /** 실제 주행 + 포그라운드일 때만 이동·진행률·시간 기반으로 라이브 좌표 쓰기 */
  useEffect(() => {
    if (!isRiding || !pageVisible) {
      void mergeCourseMemberLiveLocation(userRef.current, courseId, null).catch(() => {});
      return;
    }

    const last = { writeAt: 0, lngLat: null as LngLat | null, ratio: null as number | null };

    const tick = () => {
      const p = liveRef.current;
      if (!p) return;
      const now = Date.now();
      const coarse = roundLngLatForLiveShare(p);
      const ratio = progressRef.current;

      const elapsed = last.writeAt === 0 ? LIVE_SHARE_MAX_WRITE_INTERVAL_MS : now - last.writeAt;
      const maxDue = last.writeAt === 0 || elapsed >= LIVE_SHARE_MAX_WRITE_INTERVAL_MS;
      const minOk = last.writeAt === 0 || elapsed >= LIVE_SHARE_MIN_WRITE_INTERVAL_MS;
      const moved =
        last.lngLat == null ? true : haversineMeters(last.lngLat, coarse) >= LIVE_SHARE_MIN_MOVE_METERS;
      const prog =
        ratio != null &&
        last.ratio != null &&
        Math.abs(ratio - last.ratio) >= LIVE_SHARE_MIN_PROGRESS_DELTA;

      if (!minOk && !maxDue) return;
      if (!maxDue && !moved && !prog) return;

      last.writeAt = now;
      last.lngLat = coarse;
      last.ratio = ratio;
      void mergeCourseMemberLiveLocation(userRef.current, courseId, coarse).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setPresenceError(message);
      });
    };

    tick();
    const id = window.setInterval(tick, 1_000);
    return () => {
      window.clearInterval(id);
      void mergeCourseMemberLiveLocation(userRef.current, courseId, null).catch(() => {});
    };
  }, [isRiding, pageVisible, user.uid, courseId]);

  const active = useMemo(
    () => rows.filter((r) => isCourseMemberActive(r.lastSeenAtMs)),
    [rows],
  );

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
      .filter((r) => r.uid !== user.uid && r.liveLngLat)
      .map((r) => ({
        id: r.uid,
        lngLat: r.liveLngLat!,
        label: mapNametagForMember(r.uid, r.memberType, r.displayName, guestUidsSorted),
      }));
  }, [active, presenceError, user.uid, guestUidsSorted]);

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
              {mapNametagForMember(r.uid, r.memberType, r.displayName, guestUidsSorted)}
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

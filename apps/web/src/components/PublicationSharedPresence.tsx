import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { ensurePublicationPresenceFlagsMerged } from "../lib/firestoreCourses";
import {
  deletePublicationSessionMember,
  isPublicationSessionMemberActive,
  subscribePublicationSessionMembers,
  touchPublicationSessionMember,
  upsertPublicationSessionMember,
  type PublicationSessionMemberRow,
} from "../lib/firestorePublicationSessionPresence";
import {
  isTrailLivePublicationRideRowPeerVisible,
  type TrailLivePublicationRideRow,
} from "../lib/firestoreTrailLivePublicationRides";
import { acquireTrailLivePublicationRidesSubscription } from "../lib/livePublicationRidesSubscriptionHub";
import { sanitizeTrailId } from "../lib/firestoreTrail";
import { TRAIL_PRESENCE_STALE_MS } from "../lib/firestoreTrail";
import {
  COURSE_PRESENCE_HEARTBEAT_ACTIVE_MS,
  COURSE_PRESENCE_HEARTBEAT_PAUSED_MS,
  PEER_LIVE_RIDE_STALE_MS,
} from "../lib/rideSyncPolicy";
import { mapNametagForMember, sortedGuestUids } from "../lib/guestNametag";
import { getPeerMotionRegistry, resetPeerMotionRegistry, trailLiveRowToPeerMotionPacket } from "../lib/peerMotion";
import { peerHudStableKey, type PeerHudEntry } from "../lib/peerHud";
import { useDocumentVisibility } from "../hooks/useDocumentVisibility";
import "./trail/TrailheadPresence.css";

type PublicationSharedPresenceProps = {
  user: User;
  publicationId: string;
  trailId: string;
  title?: string;
  isRiding: boolean;
  /** running 또는 paused — heartbeat 주기만 조절 */
  rideSessionActive: boolean;
  onPeerHudChange?: (peers: PeerHudEntry[]) => void;
  onLiveRiderNametagChange?: (nametag: string | null) => void;
  /** false — 동행 동기화만, 패널 미표시(모바일) */
  showPanel?: boolean;
};

export function PublicationSharedPresence({
  user,
  publicationId,
  trailId,
  title,
  isRiding,
  rideSessionActive,
  onPeerHudChange,
  onLiveRiderNametagChange,
  showPanel = false,
}: PublicationSharedPresenceProps) {
  const pageVisible = useDocumentVisibility();
  const [rows, setRows] = useState<PublicationSessionMemberRow[]>([]);
  const [liveRideRows, setLiveRideRows] = useState<TrailLivePublicationRideRow[]>([]);
  const [peerVisibilityTick, setPeerVisibilityTick] = useState(0);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const onPeerHudChangeRef = useRef(onPeerHudChange);
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
    onPeerHudChangeRef.current = onPeerHudChange;
  }, [onPeerHudChange]);

  useEffect(() => {
    return () => {
      onPeerHudChangeRef.current?.([]);
      resetPeerMotionRegistry();
    };
  }, []);

  useEffect(() => {
    resetPeerMotionRegistry();
  }, [publicationId]);

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
        await ensurePublicationPresenceFlagsMerged(publicationId);
      } catch {
        /* noop */
      }
      if (cancelled) return;
      try {
        await upsertPublicationSessionMember(userRef.current, publicationId);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setPresenceError(message);
      }
      if (cancelled) return;

      unsub = subscribePublicationSessionMembers(
        publicationId,
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
  }, [user.uid, publicationId, pageVisible]);

  useEffect(() => {
    if (!pageVisible) {
      startTransition(() => setLiveRideRows([]));
      return;
    }

    const tid = sanitizeTrailId(trailId);
    let cancelled = false;
    const release = acquireTrailLivePublicationRidesSubscription(
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
  }, [pageVisible, trailId]);

  useEffect(() => {
    if (!pageVisible || liveRideRows.length === 0) return;
    const id = window.setInterval(() => setPeerVisibilityTick((n) => n + 1), 1_000);
    return () => window.clearInterval(id);
  }, [pageVisible, liveRideRows.length]);

  useEffect(() => {
    const uid = user.uid;
    const pid = publicationId;
    return () => {
      void deletePublicationSessionMember(uid, pid).catch(() => {});
    };
  }, [user.uid, publicationId]);

  useEffect(() => {
    if (!pageVisible) return;
    const ms =
      rideSessionActive && isRiding
        ? COURSE_PRESENCE_HEARTBEAT_ACTIVE_MS
        : COURSE_PRESENCE_HEARTBEAT_PAUSED_MS;
    const id = window.setInterval(() => {
      void touchPublicationSessionMember(userRef.current, publicationId)
        .then(() => {
          setPresenceError(null);
        })
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          setPresenceError(message);
        });
    }, ms);
    return () => window.clearInterval(id);
  }, [pageVisible, rideSessionActive, isRiding, publicationId, user.uid]);

  const active = useMemo(
    () => rows.filter((r) => isPublicationSessionMemberActive(r.lastSeenAtMs)),
    [rows],
  );

  /** Firestore 구독 행 — sim ingest 는 stale 여부와 무관, HUD 만 visibility 판단 */
  const liveRidesByUid = useMemo(() => {
    const m = new Map<string, TrailLivePublicationRideRow>();
    const pid = publicationId.trim();
    for (const row of liveRideRows) {
      if (row.uid === user.uid) continue;
      if (row.publicationId.trim() !== pid) continue;
      m.set(row.uid, row);
    }
    return m;
  }, [liveRideRows, publicationId, user.uid]);

  const peerVisibleByUid = useMemo(() => {
    const now = Date.now();
    const m = new Map<string, boolean>();
    for (const [uid, row] of liveRidesByUid) {
      m.set(uid, isTrailLivePublicationRideRowPeerVisible(row, now));
    }
    return m;
  }, [liveRidesByUid, peerVisibilityTick]);

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

  const sessionByUid = useMemo(() => {
    const m = new Map<string, PublicationSessionMemberRow>();
    for (const r of rows) m.set(r.uid, r);
    return m;
  }, [rows]);

  /** Firestore → PeerMotionRegistry (display snap 없음, rAF 가 displayDistM 적분) */
  useEffect(() => {
    const pid = publicationId.trim();
    if (!pid) return;
    const registry = getPeerMotionRegistry();
    const activeUids: string[] = [];
    for (const [uid, live] of liveRidesByUid) {
      const packet = trailLiveRowToPeerMotionPacket(live, pid, 0);
      if (!packet) continue;
      const member = sessionByUid.get(uid);
      const label = member
        ? mapNametagForMember(uid, member.memberType, member.displayName, guestUidsSorted)
        : live.displayName?.trim() || uid.slice(0, 6);
      registry.ingest(packet, label);
      activeUids.push(uid);
    }
    registry.markActiveUids(activeUids);
  }, [liveRidesByUid, sessionByUid, guestUidsSorted, publicationId]);

  const peerHudEntries = useMemo((): PeerHudEntry[] => {
    return [...liveRidesByUid.keys()]
      .filter((uid) => peerVisibleByUid.get(uid))
      .map((uid) => {
        const live = liveRidesByUid.get(uid)!;
        const member = sessionByUid.get(uid);
        const label = member
          ? mapNametagForMember(uid, member.memberType, member.displayName, guestUidsSorted)
          : live.displayName?.trim() || uid.slice(0, 6);
        return { id: uid, label };
      });
  }, [liveRidesByUid, peerVisibleByUid, sessionByUid, guestUidsSorted]);

  const lastPeerHudKeyRef = useRef<string>("__init__");

  useEffect(() => {
    const cb = onPeerHudChangeRef.current;
    if (!cb) return;
    const nextKey = peerHudStableKey(peerHudEntries);
    if (nextKey === lastPeerHudKeyRef.current) return;
    lastPeerHudKeyRef.current = nextKey;
    cb(peerHudEntries);
  }, [peerHudEntries]);

  if (!showPanel) return null;

  return (
    <section className="trailhead-presence" aria-label="경로 동시 주행">
      <div className="trailhead-presence__head">
        <strong>경로 동행</strong>
        <span className="trailhead-presence__meta">
          {title ? `${title}` : null}
          {title ? " · " : null}
          접속 {Math.round(TRAIL_PRESENCE_STALE_MS / 1000)}초 · peer {Math.round(PEER_LIVE_RIDE_STALE_MS / 1000)}초
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
              {peerVisibleByUid.get(r.uid) ? (
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

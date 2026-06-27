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
import { acquireTrailMotionSubscription } from "../lib/rtdbMotionSubscriptionHub";
import { isFirebaseDatabaseConfigured } from "../lib/firebase";
import { sanitizeTrailId } from "../lib/firestoreTrail";
import { TRAIL_PRESENCE_STALE_MS } from "../lib/firestoreTrail";
import {
  COURSE_PRESENCE_HEARTBEAT_ACTIVE_MS,
  COURSE_PRESENCE_HEARTBEAT_PAUSED_MS,
  PEER_LIVE_RIDE_STALE_MS,
} from "../lib/rideSyncPolicy";
import { mapNametagForMember, sortedGuestUids } from "../lib/guestNametag";
import {
  resetPeerMotionRegistry,
  syncPeerMotionFromPresence,
} from "../lib/peerMotion";
import type { RtdbTrailMotionRow } from "../lib/rtdbTrailMotion";
import { peerHudStableKey, type PeerHudEntry } from "../lib/peerHud";
import { useDocumentVisibility } from "../hooks/useDocumentVisibility";
import "./trail/TrailheadPresence.css";

/** DEV 전용 — peer 동기화 진단 (RTDB 5Hz 수신/막힘 판별). throttle 로그. */
const peerSyncDevLog = (() => {
  let lastAt = 0;
  return (tag: string, payload: Record<string, unknown>): void => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - lastAt < 1_000) return;
    lastAt = now;
    console.debug(`[peerSync] ${tag}`, payload);
  };
})();

function motionRowsEqual(a: RtdbTrailMotionRow[], b: RtdbTrailMotionRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.uid !== y.uid ||
      x.publicationId !== y.publicationId ||
      x.distM !== y.distM ||
      x.speedMps !== y.speedMps ||
      x.ridePhase !== y.ridePhase ||
      x.serverAtMs !== y.serverAtMs
    ) {
      return false;
    }
  }
  return true;
}

type PublicationSharedPresenceProps = {
  user: User;
  publicationId: string;
  trailId: string;
  title?: string;
  /** geometry 길이(m) — Firestore progressRatio → distM fallback */
  routeLenM?: number;
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
  routeLenM = 0,
  isRiding,
  rideSessionActive,
  onPeerHudChange,
  onLiveRiderNametagChange,
  showPanel = false,
}: PublicationSharedPresenceProps) {
  const pageVisible = useDocumentVisibility();
  const [rows, setRows] = useState<PublicationSessionMemberRow[]>([]);
  const [liveRideRows, setLiveRideRows] = useState<TrailLivePublicationRideRow[]>([]);
  const [motionRows, setMotionRows] = useState<RtdbTrailMotionRow[]>([]);
  const [peerVisibilityTick, setPeerVisibilityTick] = useState(0);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const onPeerHudChangeRef = useRef(onPeerHudChange);
  const onLiveTagRef = useRef(onLiveRiderNametagChange);
  const userRef = useRef(user);
  const publicationIdRef = useRef(publicationId);
  const routeLenMRef = useRef(routeLenM);
  const liveRideRowsRef = useRef(liveRideRows);
  const motionRowsRef = useRef(motionRows);
  const sessionRowsRef = useRef(rows);
  const guestUidsRef = useRef<string[]>([]);
  userRef.current = user;
  publicationIdRef.current = publicationId;
  routeLenMRef.current = routeLenM;
  liveRideRowsRef.current = liveRideRows;
  motionRowsRef.current = motionRows;
  sessionRowsRef.current = rows;
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
        syncPeerMotionFromPresence({
          publicationId: publicationIdRef.current,
          myUid: userRef.current.uid,
          motionRows: motionRowsRef.current,
          liveRideRows: next,
          sessionMembers: sessionRowsRef.current,
          guestUidsSorted: guestUidsRef.current,
          routeLenM: routeLenMRef.current,
        });
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
    if (!pageVisible || !isFirebaseDatabaseConfigured()) {
      peerSyncDevLog("rtdb-off", {
        pageVisible,
        dbConfigured: isFirebaseDatabaseConfigured(),
      });
      startTransition(() => setMotionRows([]));
      return;
    }

    const tid = sanitizeTrailId(trailId);
    let cancelled = false;
    const release = acquireTrailMotionSubscription(
      tid,
      (next) => {
        if (cancelled) return;
        const pid = publicationIdRef.current.trim();
        const peers = next.filter((r) => r.uid !== userRef.current.uid && r.publicationId.trim() === pid);
        const now = Date.now();
        peerSyncDevLog("rtdb-rx", {
          trailId: tid,
          rows: next.length,
          peers: peers.length,
          sample: peers[0]
            ? {
                uid: peers[0].uid.slice(0, 6),
                distM: peers[0].distM,
                speedMps: peers[0].speedMps,
                ageMs: peers[0].serverAtMs > 0 ? now - peers[0].serverAtMs : null,
              }
            : null,
        });
        setMotionRows((prev) => (motionRowsEqual(prev, next) ? prev : next));
        syncPeerMotionFromPresence({
          publicationId: publicationIdRef.current,
          myUid: userRef.current.uid,
          motionRows: next,
          liveRideRows: liveRideRowsRef.current,
          sessionMembers: sessionRowsRef.current,
          guestUidsSorted: guestUidsRef.current,
          routeLenM: routeLenMRef.current,
        });
      },
      (err) => {
        // RTDB motion 오류 — Firestore fallback. DEV 에선 permission_denied 등 표면화.
        if (import.meta.env.DEV) {
          console.warn("[peerSync] RTDB motion subscribe error:", err?.message ?? err);
        }
      },
    );

    return () => {
      cancelled = true;
      release();
    };
  }, [pageVisible, trailId]);

  useEffect(() => {
    if (!pageVisible) return;
    if (liveRideRows.length === 0 && motionRows.length === 0) return;
    const id = window.setInterval(() => setPeerVisibilityTick((n) => n + 1), 1_000);
    return () => window.clearInterval(id);
  }, [pageVisible, liveRideRows.length, motionRows.length]);

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

  const motionRowsByUid = useMemo(() => {
    const m = new Map<string, RtdbTrailMotionRow>();
    const pid = publicationId.trim();
    for (const row of motionRows) {
      if (row.uid === user.uid) continue;
      if (row.publicationId.trim() !== pid) continue;
      m.set(row.uid, row);
    }
    return m;
  }, [motionRows, publicationId, user.uid]);

  const peerVisibleByUid = useMemo(() => {
    const now = Date.now();
    const m = new Map<string, boolean>();
    for (const [uid, row] of liveRidesByUid) {
      m.set(uid, isTrailLivePublicationRideRowPeerVisible(row, now));
    }
    for (const [uid, row] of motionRowsByUid) {
      if (m.get(uid)) continue;
      const age = row.serverAtMs > 0 ? now - row.serverAtMs : 0;
      m.set(uid, age <= PEER_LIVE_RIDE_STALE_MS);
    }
    return m;
  }, [liveRidesByUid, motionRowsByUid, peerVisibilityTick]);

  const guestUidsSorted = useMemo(() => {
    const picks = active.map((r) => ({ uid: r.uid, memberType: r.memberType }));
    let ids = sortedGuestUids(picks);
    if (user.isAnonymous && !ids.includes(user.uid)) {
      ids = [...ids, user.uid].sort((a, b) => a.localeCompare(b));
    }
    return ids;
  }, [active, user.isAnonymous, user.uid]);

  guestUidsRef.current = guestUidsSorted;

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

  /** Firestore 1Hz + RTDB 5Hz → PeerMotionRegistry (소스별 최신 패킷 병합) */
  useEffect(() => {
    syncPeerMotionFromPresence({
      publicationId,
      myUid: user.uid,
      motionRows,
      liveRideRows,
      sessionMembers: rows,
      guestUidsSorted,
      routeLenM,
    });
  }, [motionRows, liveRideRows, rows, guestUidsSorted, publicationId, user.uid, routeLenM]);

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

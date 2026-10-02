import { startTransition, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { FirestoreError } from "firebase/firestore";
import {
  deleteTrailPresence,
  DEFAULT_TRAIL_ID,
  sanitizeTrailId,
  subscribeTrailMembers,
  touchTrailPresence,
  upsertTrailPresence,
  type TrailMemberRow,
} from "../lib/trail/repo/firestoreTrail";
import { touchTrailInstanceActivity } from "../lib/trail/repo/firestoreTrailInstance";
import { TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS } from "../lib/trail/trailLivePolicy";
import { LISTENER_VISIBILITY_GRACE_MS } from "../lib/trail/listenerVisibilityGracePolicy";
import { decidePresenceWriteResume } from "../lib/trail/presenceWriteResumePolicy";
import { useVisibilityListenGrace } from "./useVisibilityListenGrace";

/** Trail 1곳에 대한 upsert·스냅샷·하트비트 — 단일 구독용(App + 표시 컴포넌트 공유) */
export function useTrailSession(opts: {
  user: User | null | undefined;
  trailId: string;
  enabled: boolean;
  pageVisible: boolean;
}): { rows: TrailMemberRow[]; error: string | null } {
  const [rows, setRows] = useState<TrailMemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rowsTrailId, setRowsTrailId] = useState(opts.trailId);
  const userRef = useRef<User | null>(null);
  const lastPresenceSuccessRef = useRef<{ key: string; atMs: number } | null>(null);
  const hiddenSinceMsRef = useRef<number | null>(null);

  const eligible = Boolean(opts.enabled && opts.user);
  const sessionKey = opts.user ? `${opts.user.uid}:${opts.trailId}` : "";
  const listenActive = useVisibilityListenGrace(eligible, opts.pageVisible, sessionKey);

  useEffect(() => {
    userRef.current = opts.user ?? null;
  });

  // Trail 전환과 같은 렌더에서 이전 멤버를 비운다 — 헤더만 Trailhead 로 바뀌고
  // 목록에 옛 Trail 상대가 남는 한 프레임을 만들지 않는다(4D 낙관적 정리).
  if (opts.trailId !== rowsTrailId) {
    setRowsTrailId(opts.trailId);
    setRows([]);
    setError(null);
  }

  useEffect(() => {
    if (!opts.enabled || !opts.user) return;
    const uid = opts.user.uid;
    const tid = opts.trailId;
    return () => {
      void deleteTrailPresence(uid, tid).catch(() => {});
    };
  }, [opts.enabled, opts.user?.uid, opts.trailId]);

  // Members listener — visibility grace (presence write 와 분리)
  useEffect(() => {
    if (!listenActive || !opts.user) {
      startTransition(() => {
        setRows([]);
        setError(null);
      });
      return;
    }

    const { trailId } = opts;
    let cancelled = false;
    startTransition(() => setError(null));

    const unsub = subscribeTrailMembers(
      trailId,
      (next) => {
        startTransition(() => setRows(next));
      },
      (err: FirestoreError) => {
        if (!cancelled) setError(err.message);
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [listenActive, opts.trailId, opts.user?.uid]);

  // Presence write / heartbeat — visible 일 때만. short resume 은 heartbeat 창 안이면 지연.
  useEffect(() => {
    if (!opts.enabled || !opts.user || !opts.pageVisible) {
      if (!opts.pageVisible && hiddenSinceMsRef.current == null) {
        hiddenSinceMsRef.current = Date.now();
      }
      return;
    }

    const user = opts.user;
    const { trailId } = opts;
    const key = `${user.uid}:${trailId}`;
    const prev = lastPresenceSuccessRef.current;
    const lastSuccessAtMs = prev && prev.key === key ? prev.atMs : null;
    const hiddenMs =
      hiddenSinceMsRef.current != null ? Date.now() - hiddenSinceMsRef.current : 0;
    hiddenSinceMsRef.current = null;
    // long hide (≥ read grace) → immediate; short hide uses heartbeat remaining
    const decision =
      hiddenMs >= LISTENER_VISIBILITY_GRACE_MS
        ? ({ action: "immediate" } as const)
        : decidePresenceWriteResume({
            lastSuccessAtMs,
            nowMs: Date.now(),
            heartbeatIntervalMs: TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS,
          });

    let cancelled = false;
    let heartbeatTimer: number | undefined;
    let resumeTimer: number | undefined;

    const noteSuccess = () => {
      if (!cancelled) {
        lastPresenceSuccessRef.current = { key, atMs: Date.now() };
      }
    };

    const runUpsert = () => {
      void upsertTrailPresence(user, trailId)
        .then(noteSuccess)
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          if (!cancelled) setError(message);
        });
    };

    const startHeartbeat = () => {
      heartbeatTimer = window.setInterval(() => {
        const u = userRef.current;
        if (!u) return;
        void touchTrailPresence(u, trailId)
          .then(noteSuccess)
          .catch((e: unknown) => {
            const message = e instanceof Error ? e.message : String(e);
            if (!cancelled) setError(message);
          });
        const tid = sanitizeTrailId(trailId);
        if (tid !== DEFAULT_TRAIL_ID) {
          void touchTrailInstanceActivity(tid).catch(() => {});
        }
      }, TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS);
    };

    if (decision.action === "immediate") {
      runUpsert();
      startHeartbeat();
    } else {
      resumeTimer = window.setTimeout(() => {
        if (cancelled) return;
        runUpsert();
        startHeartbeat();
      }, decision.delayMs);
    }

    return () => {
      cancelled = true;
      if (resumeTimer != null) window.clearTimeout(resumeTimer);
      if (heartbeatTimer != null) window.clearInterval(heartbeatTimer);
    };
  }, [opts.enabled, opts.trailId, opts.user?.uid, opts.pageVisible]);

  if (!listenActive || !opts.user) {
    return { rows: [], error: null };
  }
  return { rows, error };
}

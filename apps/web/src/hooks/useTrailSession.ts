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
} from "../lib/firestoreTrail";
import { touchTrailInstanceActivity } from "../lib/firestoreTrailInstance";
import { TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS } from "../lib/rideSyncPolicy";

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

  useEffect(() => {
    if (!opts.enabled || !opts.user || !opts.pageVisible) {
      startTransition(() => {
        setRows([]);
        setError(null);
      });
      return;
    }

    const user = opts.user;
    const { trailId } = opts;
    let cancelled = false;
    startTransition(() => setError(null));

    void upsertTrailPresence(user, trailId).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (!cancelled) setError(message);
    });

    const unsub = subscribeTrailMembers(
      trailId,
      (next) => {
        startTransition(() => setRows(next));
      },
      (err: FirestoreError) => {
        if (!cancelled) setError(err.message);
      },
    );

    const timer = window.setInterval(() => {
      const u = userRef.current;
      if (!u) return;
      void touchTrailPresence(u, trailId).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(message);
      });
      const tid = sanitizeTrailId(trailId);
      if (tid !== DEFAULT_TRAIL_ID) {
        void touchTrailInstanceActivity(tid).catch(() => {});
      }
    }, TRAIL_PRESENCE_HEARTBEAT_ACTIVE_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsub();
    };
  }, [opts.enabled, opts.trailId, opts.user?.uid, opts.pageVisible]);

  if (!opts.enabled || !opts.user || !opts.pageVisible) {
    return { rows: [], error: null };
  }
  return { rows, error };
}

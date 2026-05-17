import { startTransition, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { FirestoreError } from "firebase/firestore";
import {
  deleteTrailPresence,
  subscribeTrailMembers,
  touchTrailPresence,
  upsertTrailPresence,
  type TrailMemberRow,
} from "../lib/firestoreTrail";
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
  const userRef = useRef<User | null>(null);
  userRef.current = opts.user ?? null;

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

/** @deprecated `useTrailSession` */
export const useLobbyRoomSession = useTrailSession;

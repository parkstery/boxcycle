import { startTransition, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  globalLivePresenceRowsToDots,
  subscribeGlobalLivePresence,
  type GlobalLivePresenceDot,
  type GlobalLivePresenceRow,
} from "../lib/firestoreGlobalLivePresence";

type UseGlobalLivePresenceOpts = {
  user: User | null | undefined;
  enabled: boolean;
};

/** global livePresence 구독 전용 — publish 는 `useLiveLocationPublishSession` */
export function useGlobalLivePresence(opts: UseGlobalLivePresenceOpts): {
  dots: GlobalLivePresenceDot[];
  rows: GlobalLivePresenceRow[];
  error: string | null;
} {
  const { user, enabled } = opts;
  const [rows, setRows] = useState<GlobalLivePresenceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !user) {
      startTransition(() => {
        setRows([]);
        setError(null);
      });
      return;
    }

    let cancelled = false;
    startTransition(() => setError(null));

    const unsub = subscribeGlobalLivePresence(
      (next) => {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.debug("[GlobalLivePresence] rows", next.length);
          }
          startTransition(() => setRows(next));
        }
      },
      (err) => {
        if (!cancelled) setError(err.message);
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [enabled, user?.uid]);

  const dots = useMemo(
    () => globalLivePresenceRowsToDots(rows, { myUid: user?.uid ?? null, includeSelf: true }),
    [rows, user?.uid],
  );

  return { dots, rows, error };
}

export type { GlobalLivePresenceDot };

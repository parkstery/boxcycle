/**
 * 단일 이어달리기 슬롯 훅.
 * - 등록 사용자: Firestore users/{uid} onSnapshot (UID당 1개)
 * - Guest(익명): localStorage + storage event + Web Locks
 * - 서버 실패 시 status='error', 성공처럼 abandon/acquire 보고 금지
 * - 자동 acquire는 과거 미완주 스캔 금지 — App의 ensureAcquired(새 유효 ride)만
 * - active 노출은 slotOwnerUid===현재 uid 일 때만(첫 렌더 교차 누출 방지)
 */
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { SavedRoute } from "../lib/route/repo/firestoreSavedRoutes";
import type { StoredRideSession } from "../lib/ride/rideSessionsStorage";
import {
  emptyRideResumeSlot,
  pickBootstrapRouteId,
  resolveResumeSlotSwitchAction,
  type RideResumeSlot,
} from "../lib/ride/rideResumeSlotPolicy";
import {
  subscribeRideResumeSlot,
  acquireRideResumeSlot,
  bootstrapRideResumeSlot,
  abandonRideResumeSlot,
  clearRideResumeSlotIfActive,
  markRideResumeSlotInitializedEmpty,
  type SlotTxResult,
} from "../lib/ride/repo/firestoreRideResumeSlot";
import {
  readLocalRideResumeSlot,
  subscribeLocalRideResumeSlot,
  acquireLocalRideResumeSlot,
  bootstrapLocalRideResumeSlot,
  markLocalSlotInitializedEmpty,
  abandonLocalRideResumeSlot,
  clearLocalRideResumeSlotIfActive,
  type LocalSlotResult,
} from "../lib/ride/repo/rideResumeSlotLocal";
import { resumeAnchorForRoute } from "../lib/ride/nextRideTarget";

export type UseRideResumeSlotStatus = "idle" | "loading" | "ready" | "error";

export type SlotOpResult =
  | { ok: true; slot: RideResumeSlot }
  | { ok: false; reason: string; slot: RideResumeSlot };

export type UseRideResumeSlotReturn = {
  slot: RideResumeSlot;
  /** ownerUid 일치 + ready 일 때만 활성 id. 그 외 null */
  activeRouteId: string | null;
  status: UseRideResumeSlotStatus;
  errorMessage: string | null;
  /** 슬롯을 채운 uid — 첫 렌더/전환 가드용 */
  slotOwnerUid: string | null;
  abandon: () => void;
  clearIfActive: (routeId: string, options?: { force?: boolean }) => Promise<SlotOpResult>;
  ensureAcquired: (routeId: string) => Promise<SlotOpResult>;
  /**
   * 이어달리기 대상을 routeId 로 맞춤 — none/acquire/switch.
   * switch 는 abandon(기존 「이어달리기 종료」와 동일) 성공 후 acquire.
   */
  switchTo: (routeId: string) => Promise<SlotOpResult>;
  refresh: () => void;
};

export type UseRideResumeSlotProps = {
  configured: boolean;
  user: User | null;
  savedRoutes: readonly SavedRoute[];
  savedRoutesLoaded: boolean;
  savedRoutesLoading: boolean;
  /** 로드 성공 vs 조회 실패 구분 — 실패 시 빈 목록으로 clear 금지 */
  savedRoutesLoadFailed?: boolean;
  recentSessions: readonly StoredRideSession[];
};

function resetSlotState(
  setSlot: (s: RideResumeSlot) => void,
  setSlotOwnerUid: (u: string | null) => void,
  setStatusSafe: (s: UseRideResumeSlotStatus) => void,
  setErrorMessage: (m: string | null) => void,
  nextStatus: UseRideResumeSlotStatus = "idle",
) {
  setSlot(emptyRideResumeSlot());
  setSlotOwnerUid(null);
  setStatusSafe(nextStatus);
  setErrorMessage(null);
}

function toOpResult(r: SlotTxResult | LocalSlotResult): SlotOpResult {
  return r.ok ? { ok: true, slot: r.slot } : { ok: false, reason: r.reason, slot: r.slot };
}

export function useRideResumeSlot(props: UseRideResumeSlotProps): UseRideResumeSlotReturn {
  const {
    configured,
    user,
    savedRoutes,
    savedRoutesLoaded,
    savedRoutesLoading,
    savedRoutesLoadFailed = false,
    recentSessions,
  } = props;

  const [slot, setSlot] = useState<RideResumeSlot>(emptyRideResumeSlot);
  const [slotOwnerUid, setSlotOwnerUid] = useState<string | null>(null);
  const [status, setStatus] = useState<UseRideResumeSlotStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bootstrapAttemptedRef = useRef(false);
  const mountedUidRef = useRef<string | null>(null);
  const statusRef = useRef<UseRideResumeSlotStatus>("idle");

  const uid = user?.uid ?? null;
  const isGuest = Boolean(user?.isAnonymous);
  const isRegistered = Boolean(user && !user.isAnonymous);

  const setStatusSafe = useCallback((next: UseRideResumeSlotStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const ownerMatches = slotOwnerUid != null && slotOwnerUid === uid;
  const safeSlot = ownerMatches ? slot : emptyRideResumeSlot();
  const activeRouteId =
    ownerMatches && status === "ready" ? safeSlot.activeRouteId : null;

  // ---------------------------------------------------------------------------
  // 등록 사용자: Firestore onSnapshot — setState는 콜백/cleanup/startTransition만
  // ---------------------------------------------------------------------------
  useEffect(() => {
    mountedUidRef.current = uid;
    bootstrapAttemptedRef.current = false;

    if (!uid || !isRegistered || !configured) {
      return () => {
        startTransition(() => {
          resetSlotState(setSlot, setSlotOwnerUid, setStatusSafe, setErrorMessage, "idle");
        });
      };
    }

    let cancelled = false;
    startTransition(() => {
      // 이전 uid 슬롯이 한 프레임이라도 ready로 보이지 않게 즉시 비움
      setSlot(emptyRideResumeSlot());
      setSlotOwnerUid(null);
      setStatusSafe("loading");
      setErrorMessage(null);
    });

    const timeoutId = window.setTimeout(() => {
      if (cancelled || mountedUidRef.current !== uid) return;
      if (statusRef.current !== "loading") return;
      startTransition(() => {
        setStatusSafe("error");
        setErrorMessage("슬롯 로드 실패");
      });
    }, 10_000);

    const unsub = subscribeRideResumeSlot(
      uid,
      (received) => {
        if (cancelled || mountedUidRef.current !== uid) return;
        window.clearTimeout(timeoutId);
        startTransition(() => {
          setSlot(received);
          setSlotOwnerUid(uid);
          setStatusSafe("ready");
          setErrorMessage(null);
        });
      },
      () => {
        if (cancelled || mountedUidRef.current !== uid) return;
        window.clearTimeout(timeoutId);
        startTransition(() => {
          setStatusSafe("error");
          setErrorMessage("슬롯 로드 실패");
        });
      },
    );

    return () => {
      cancelled = true;
      unsub();
      window.clearTimeout(timeoutId);
      startTransition(() => {
        resetSlotState(setSlot, setSlotOwnerUid, setStatusSafe, setErrorMessage, "idle");
      });
    };
  }, [uid, isRegistered, configured, setStatusSafe]);

  // ---------------------------------------------------------------------------
  // Guest: localStorage + storage event
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!uid || !isGuest) {
      return;
    }
    mountedUidRef.current = uid;
    bootstrapAttemptedRef.current = false;

    let cancelled = false;
    startTransition(() => {
      setSlot(emptyRideResumeSlot());
      setSlotOwnerUid(null);
      setStatusSafe("loading");
      setErrorMessage(null);
    });

    const t = window.setTimeout(() => {
      if (cancelled || mountedUidRef.current !== uid) return;
      startTransition(() => {
        setSlot(readLocalRideResumeSlot(uid));
        setSlotOwnerUid(uid);
        setStatusSafe("ready");
        setErrorMessage(null);
      });
    }, 0);

    const unsub = subscribeLocalRideResumeSlot(uid, (received) => {
      if (cancelled || mountedUidRef.current !== uid) return;
      startTransition(() => {
        setSlot(received);
        setSlotOwnerUid(uid);
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      unsub();
      startTransition(() => {
        resetSlotState(setSlot, setSlotOwnerUid, setStatusSafe, setErrorMessage, "idle");
      });
    };
  }, [uid, isGuest, setStatusSafe]);

  // ---------------------------------------------------------------------------
  // Bootstrap — 서버/로컬 슬롯 ready 후에만 + owner 일치
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!uid || !user) return;
    if (status !== "ready") return;
    if (!ownerMatches) return;
    if (!savedRoutesLoaded || savedRoutesLoading) return;
    if (savedRoutesLoadFailed) return;
    if (safeSlot.initialized) return;
    if (bootstrapAttemptedRef.current) return;
    bootstrapAttemptedRef.current = true;

    const candidateId = pickBootstrapRouteId({
      routes: savedRoutes,
      rides: recentSessions,
      slot: safeSlot,
    });

    if (isGuest) {
      void (async () => {
        if (mountedUidRef.current !== uid) return;
        if (candidateId) {
          const result = await bootstrapLocalRideResumeSlot(uid, candidateId, savedRoutes);
          if (mountedUidRef.current !== uid) return;
          startTransition(() => {
            if (result.ok) {
              setSlot(result.slot);
              setSlotOwnerUid(uid);
              setErrorMessage(null);
            } else {
              bootstrapAttemptedRef.current = false;
              setStatusSafe("error");
              setErrorMessage("슬롯 초기화 실패");
            }
          });
        } else {
          const next = await markLocalSlotInitializedEmpty(uid);
          if (mountedUidRef.current !== uid) return;
          startTransition(() => {
            setSlot(next);
            setSlotOwnerUid(uid);
          });
        }
      })();
      return;
    }

    if (!configured) return;

    const run = candidateId
      ? bootstrapRideResumeSlot(uid, candidateId)
      : markRideResumeSlotInitializedEmpty(uid);

    void run
      .then((result) => {
        if (mountedUidRef.current !== uid) return;
        startTransition(() => {
          if (!result.ok) {
            bootstrapAttemptedRef.current = false;
            setStatusSafe("error");
            setErrorMessage("슬롯 초기화 실패");
            return;
          }
          setSlot(result.slot);
          setSlotOwnerUid(uid);
          setErrorMessage(null);
        });
      })
      .catch(() => {
        if (mountedUidRef.current !== uid) return;
        bootstrapAttemptedRef.current = false;
        startTransition(() => {
          setStatusSafe("error");
          setErrorMessage("슬롯 초기화 실패");
        });
      });
  }, [
    uid,
    user,
    status,
    ownerMatches,
    savedRoutesLoaded,
    savedRoutesLoading,
    savedRoutesLoadFailed,
    safeSlot,
    savedRoutes,
    recentSessions,
    isGuest,
    configured,
    setStatusSafe,
  ]);

  // ---------------------------------------------------------------------------
  // 활성 경로 유효성 — geometry 파손·완주만 clear. 조회실패/빈 목록 clear 금지.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!uid || !activeRouteId) return;
    if (status !== "ready" || !ownerMatches) return;
    if (!savedRoutesLoaded || savedRoutesLoading || savedRoutesLoadFailed) return;
    if (savedRoutes.length === 0) return;

    const route = savedRoutes.find((r) => r.id === activeRouteId);
    if (!route) return;

    const shouldClear = route.completed === 1 || resumeAnchorForRoute(route) == null;
    if (!shouldClear) return;

    const routeId = activeRouteId;
    if (isGuest) {
      void (async () => {
        if (mountedUidRef.current !== uid) return;
        const result = await clearLocalRideResumeSlotIfActive(uid, routeId, savedRoutes);
        if (mountedUidRef.current !== uid) return;
        if (result.ok) startTransition(() => setSlot(result.slot));
      })();
      return;
    }
    if (!configured) return;
    void clearRideResumeSlotIfActive(uid, routeId, { expectedUid: uid })
      .then((result) => {
        if (mountedUidRef.current !== uid) return;
        if (result.ok) startTransition(() => setSlot(result.slot));
      })
      .catch(() => {
        if (mountedUidRef.current !== uid) return;
        startTransition(() => setErrorMessage("슬롯 해제 실패"));
      });
  }, [
    uid,
    activeRouteId,
    status,
    ownerMatches,
    savedRoutesLoaded,
    savedRoutesLoading,
    savedRoutesLoadFailed,
    savedRoutes,
    isGuest,
    configured,
  ]);

  const abandon = useCallback(() => {
    if (!uid) return;
    if (!ownerMatches) return;
    if (status !== "ready" && status !== "error") return;
    const expectedRouteId = safeSlot.activeRouteId;
    if (!expectedRouteId) return;

    if (isGuest) {
      void abandonLocalRideResumeSlot(uid, savedRoutes, expectedRouteId).then((next) => {
        if (mountedUidRef.current !== uid) return;
        if (next.ok) {
          startTransition(() => {
            setSlot(next.slot);
            setErrorMessage(null);
          });
        } else if (next.reason !== "expected_mismatch") {
          startTransition(() => setErrorMessage("이어달리기 종료 실패"));
        }
      });
      return;
    }
    if (!configured) return;
    void abandonRideResumeSlot(uid, expectedRouteId)
      .then((result) => {
        if (mountedUidRef.current !== uid) return;
        startTransition(() => {
          if (result.ok) {
            setSlot(result.slot);
            setErrorMessage(null);
          } else if (result.reason !== "expected_mismatch") {
            setErrorMessage("이어달리기 종료 실패");
          }
        });
      })
      .catch(() => {
        if (mountedUidRef.current !== uid) return;
        startTransition(() => setErrorMessage("이어달리기 종료 실패"));
      });
  }, [uid, ownerMatches, status, safeSlot.activeRouteId, isGuest, configured, savedRoutes]);

  const clearIfActive = useCallback(
    async (routeId: string, options?: { force?: boolean }): Promise<SlotOpResult> => {
      if (!uid) {
        return { ok: false, reason: "no_uid", slot: emptyRideResumeSlot() };
      }
      if (!ownerMatches && !options?.force) {
        return { ok: false, reason: "uid_mismatch", slot: emptyRideResumeSlot() };
      }
      if (isGuest) {
        const next = await clearLocalRideResumeSlotIfActive(uid, routeId, savedRoutes, options);
        if (mountedUidRef.current !== uid) {
          return { ok: false, reason: "uid_changed", slot: emptyRideResumeSlot() };
        }
        if (next.ok) setSlot(next.slot);
        return toOpResult(next);
      }
      if (!configured) {
        return { ok: false, reason: "not_configured", slot: safeSlot };
      }
      try {
        const result = await clearRideResumeSlotIfActive(uid, routeId, {
          force: options?.force,
          expectedUid: uid,
        });
        if (mountedUidRef.current !== uid) {
          return { ok: false, reason: "uid_changed", slot: emptyRideResumeSlot() };
        }
        if (result.ok) startTransition(() => setSlot(result.slot));
        return toOpResult(result);
      } catch {
        if (mountedUidRef.current === uid) {
          startTransition(() => setErrorMessage("슬롯 해제 실패"));
        }
        return { ok: false, reason: "clear_failed", slot: safeSlot };
      }
    },
    [uid, ownerMatches, isGuest, configured, savedRoutes, safeSlot],
  );

  const ensureAcquired = useCallback(
    async (routeId: string): Promise<SlotOpResult> => {
      if (!uid) {
        return { ok: false, reason: "no_uid", slot: emptyRideResumeSlot() };
      }
      if (!ownerMatches) {
        return { ok: false, reason: "uid_mismatch", slot: emptyRideResumeSlot() };
      }
      if (status !== "ready") {
        return { ok: false, reason: "not_ready", slot: safeSlot };
      }
      if (!safeSlot.initialized) {
        return { ok: false, reason: "not_initialized", slot: safeSlot };
      }
      if (safeSlot.activeRouteId === routeId) {
        return { ok: true, slot: safeSlot };
      }
      if (safeSlot.activeRouteId !== null) {
        return { ok: false, reason: "slot_occupied", slot: safeSlot };
      }

      if (isGuest) {
        const result = await acquireLocalRideResumeSlot(uid, routeId, savedRoutes);
        if (mountedUidRef.current !== uid) {
          return { ok: false, reason: "uid_changed", slot: emptyRideResumeSlot() };
        }
        if (result.ok) {
          setSlot(result.slot);
          setErrorMessage(null);
        } else if (result.reason !== "slot_occupied") {
          setErrorMessage("슬롯 확보 실패");
        }
        return toOpResult(result);
      }
      if (!configured) {
        return { ok: false, reason: "not_configured", slot: safeSlot };
      }
      try {
        const result = await acquireRideResumeSlot(uid, routeId);
        if (mountedUidRef.current !== uid) {
          return { ok: false, reason: "uid_changed", slot: emptyRideResumeSlot() };
        }
        startTransition(() => {
          if (result.ok) {
            setSlot(result.slot);
            setErrorMessage(null);
          } else if (result.reason !== "slot_occupied") {
            setErrorMessage("슬롯 확보 실패");
          }
        });
        return toOpResult(result);
      } catch {
        if (mountedUidRef.current === uid) {
          startTransition(() => setErrorMessage("슬롯 확보 실패"));
        }
        return { ok: false, reason: "acquire_failed", slot: safeSlot };
      }
    },
    [
      uid,
      ownerMatches,
      status,
      safeSlot,
      isGuest,
      configured,
      savedRoutes,
    ],
  );

  const switchTo = useCallback(
    async (routeId: string): Promise<SlotOpResult> => {
      if (!uid) {
        return { ok: false, reason: "no_uid", slot: emptyRideResumeSlot() };
      }
      if (!ownerMatches) {
        return { ok: false, reason: "uid_mismatch", slot: emptyRideResumeSlot() };
      }
      if (status !== "ready") {
        return { ok: false, reason: "not_ready", slot: safeSlot };
      }
      if (!safeSlot.initialized) {
        return { ok: false, reason: "not_initialized", slot: safeSlot };
      }

      const decision = resolveResumeSlotSwitchAction(safeSlot.activeRouteId, routeId);
      if (decision === "none") {
        return { ok: true, slot: safeSlot };
      }
      if (decision === "acquire") {
        return ensureAcquired(routeId);
      }

      // switch: abandon(기존 이어달리기 종료와 동일) 성공 후에만 확보
      const expectedRouteId = safeSlot.activeRouteId;
      if (!expectedRouteId) {
        return ensureAcquired(routeId);
      }

      if (isGuest) {
        const abandoned = await abandonLocalRideResumeSlot(uid, savedRoutes, expectedRouteId);
        if (mountedUidRef.current !== uid) {
          return { ok: false, reason: "uid_changed", slot: emptyRideResumeSlot() };
        }
        if (!abandoned.ok) {
          if (abandoned.reason !== "expected_mismatch") {
            setErrorMessage("이어달리기 대상 변경 실패");
          }
          return toOpResult(abandoned);
        }
        setSlot(abandoned.slot);
        const acquired = await acquireLocalRideResumeSlot(uid, routeId, savedRoutes);
        if (mountedUidRef.current !== uid) {
          return { ok: false, reason: "uid_changed", slot: emptyRideResumeSlot() };
        }
        if (acquired.ok) {
          setSlot(acquired.slot);
          setErrorMessage(null);
        } else {
          setErrorMessage("이어달리기 대상 변경 실패");
        }
        return toOpResult(acquired);
      }

      if (!configured) {
        return { ok: false, reason: "not_configured", slot: safeSlot };
      }
      try {
        const abandoned = await abandonRideResumeSlot(uid, expectedRouteId);
        if (mountedUidRef.current !== uid) {
          return { ok: false, reason: "uid_changed", slot: emptyRideResumeSlot() };
        }
        if (!abandoned.ok) {
          if (abandoned.reason !== "expected_mismatch") {
            startTransition(() => setErrorMessage("이어달리기 대상 변경 실패"));
          }
          return toOpResult(abandoned);
        }
        startTransition(() => setSlot(abandoned.slot));
        const acquired = await acquireRideResumeSlot(uid, routeId);
        if (mountedUidRef.current !== uid) {
          return { ok: false, reason: "uid_changed", slot: emptyRideResumeSlot() };
        }
        startTransition(() => {
          if (acquired.ok) {
            setSlot(acquired.slot);
            setErrorMessage(null);
          } else {
            setErrorMessage("이어달리기 대상 변경 실패");
          }
        });
        return toOpResult(acquired);
      } catch {
        if (mountedUidRef.current === uid) {
          startTransition(() => setErrorMessage("이어달리기 대상 변경 실패"));
        }
        return { ok: false, reason: "switch_failed", slot: safeSlot };
      }
    },
    [
      uid,
      ownerMatches,
      status,
      safeSlot,
      isGuest,
      configured,
      savedRoutes,
      ensureAcquired,
    ],
  );

  const refresh = useCallback(() => {
    if (!uid || !isGuest) return;
    if (mountedUidRef.current !== uid) return;
    setSlot(readLocalRideResumeSlot(uid));
    setSlotOwnerUid(uid);
  }, [uid, isGuest]);

  return {
    slot: safeSlot,
    activeRouteId,
    status: ownerMatches || status === "loading" || status === "error" ? status : "idle",
    errorMessage,
    slotOwnerUid,
    abandon,
    clearIfActive,
    ensureAcquired,
    switchTo,
    refresh,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadRecentTrails,
  recordTrailLeft,
  recordTrailRideProgress,
  trailProgressFor,
  visibleRecentTrails,
  type RecentTrailEntry,
  type RecentTrailMeta,
} from "../lib/trail/recentTrails";

/** 「N분 남음」 갱신 주기 */
const TICK_MS = 30_000;

export type VisibleRecentTrail = RecentTrailEntry & { remainingMs: number };

/**
 * 「최근 내가 달린 Trail」(10분)·Trail 별 내 진행 — 기기 안 저장(`lib/trail/recentTrails`)을 화면 상태로 잇는다
 * (2026-11-05 Chief D4·D5).
 */
type TrailMetaLike = {
  id: string;
  displayNumber?: number | null;
  regionLabel?: string | null;
  distanceKm?: number | null;
  publicationId?: string | null;
};

export function useTrailRecent(opts: {
  uid: string | null;
  currentTrailId: string;
  /** 지금 달리는 목록의 Trail — 최근 목록에서 뺀다 */
  liveTrails: ReadonlyArray<{ id: string }>;
  /** 경로상 내 위치(m)·경로 길이(m) — 종료 시점 진행을 읽는다 */
  progressMeters: number;
  routeMeters: number;
}) {
  const { uid, currentTrailId, liveTrails } = opts;
  const exclude = useMemo(() => new Set([currentTrailId, ...liveTrails.map((t) => t.id)]), [currentTrailId, liveTrails]);
  const progressRef = useRef({ v: 0, r: 0 });
  useEffect(() => {
    progressRef.current = { v: opts.progressMeters, r: opts.routeMeters };
  });
  /** 같은 Trail 다시 시작 — 이어서/처음부터(시안 ③⑥). 고른 시작점(m)은 ref 로 주행 시작에 넘긴다 */
  const [startChoice, setStartChoice] = useState<RecentTrailEntry | null>(null);
  const resumeOffsetRef = useRef<number | null>(null);
  const [version, setVersion] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!uid) return;
    const t = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(t);
  }, [uid]);

  const entries = useMemo(() => (uid ? loadRecentTrails(uid) : []),
    // version: 기록 직후 다시 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, version]);
  const recent = useMemo<VisibleRecentTrail[]>(() => visibleRecentTrails(entries, nowMs, exclude), [entries, nowMs, exclude]);

  /** 공개 Trail 주행 종료 — 종료 시점 진행을 남긴다 */
  const recordRideEnd = useCallback(
    (m: TrailMetaLike) => {
      if (!uid) return;
      const meta: RecentTrailMeta = {
        trailId: m.id,
        displayNumber: m.displayNumber ?? null,
        regionLabel: m.regionLabel ?? null,
        distanceKm: m.distanceKm ?? null,
        publicationId: m.publicationId ?? null,
      };
      recordTrailRideProgress(uid, meta, progressRef.current.v, progressRef.current.r);
      setVersion((v) => v + 1);
    },
    [uid],
  );
  const recordLeft = useCallback(
    (trailId: string) => {
      if (!uid) return;
      recordTrailLeft(uid, trailId);
      setNowMs(Date.now());
      setVersion((v) => v + 1);
    },
    [uid],
  );
  /** 이어 달리기 후보 — 이벤트 처리 중에 부른다(시각은 그때 읽는다) */
  const progressFor = useCallback((trailId: string) => (uid ? trailProgressFor(loadRecentTrails(uid), trailId, Date.now()) : null), [uid]);

  /**
   * 주행 시작 직전 — 이 Trail 에서 달린 적이 있고 아직 고르지 않았으면 이어서/처음부터를 띄우고 true(시작 보류).
   * 고른 뒤 다시 부르면 {@link resumeOffsetRef} 가 차 있어 그대로 진행한다.
   */
  const askStartChoice = useCallback(
    (trailId: string) => {
      if (resumeOffsetRef.current != null || !uid) return false;
      const prior = trailProgressFor(loadRecentTrails(uid), trailId, Date.now());
      if (!prior || (!prior.completed && prior.progressMeters < 50)) return false;
      setStartChoice(prior);
      return true;
    },
    [uid],
  );

  return { recent, recordRideEnd, recordLeft, progressFor, startChoice, setStartChoice, resumeOffsetRef, askStartChoice };
}

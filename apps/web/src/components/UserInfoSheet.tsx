import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { loadRideSessionsForStatsFromFirestore } from "../lib/firestoreRides";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  aggregateRideStatsForPeriod,
  type RideStatsPeriod,
} from "../lib/rideStatsAggregate";
import type { StoredRideSession } from "../lib/rideSessionsStorage";
import { formatDuration } from "../services/mapboxDirections";
import "./UserInfoSheet.css";

type UserInfoSheetProps = {
  open: boolean;
  onClose: () => void;
  user: User | null;
  recentSessions: StoredRideSession[];
  isGuest: boolean;
  busy: boolean;
  onLinkGoogle?: () => void;
  onLeaveLobby: () => void;
  onServiceExit: () => void;
};

function formatElapsedFromSec(sec: number): string {
  const totalMin = Math.floor(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * TR 슬롯에서 우측으로 슬라이드 인 하는 사용자 패널.
 * - 계정 식별 + 주간·월간·연간 통계 + 최근 주행 + 핵심 액션.
 */
export function UserInfoSheet(props: UserInfoSheetProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<RideStatsPeriod>("week");
  const [statsSessions, setStatsSessions] = useState<StoredRideSession[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoadNote, setStatsLoadNote] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  /** 시트가 닫힐 때마다 「최근 주행」 펼침을 default(닫힘) 으로 리셋 */
  useEffect(() => {
    if (!props.open) setHistoryOpen(false);
  }, [props.open]);

  const recentSessionsTipId = props.recentSessions[0]?.id ?? "";

  /** 통계용 세션 — 시트 열릴 때 Firestore 에서 최대 400건(가능 시), 실패·미설정 시 recentSessions */
  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    void (async () => {
      if (!props.user?.uid) {
        if (!cancelled) {
          setStatsSessions([]);
          setStatsLoading(false);
          setStatsLoadNote(null);
        }
        return;
      }
      if (!isFirebaseConfigured()) {
        if (!cancelled) {
          setStatsSessions(props.recentSessions);
          setStatsLoading(false);
          setStatsLoadNote("클라우드 미설정: 이 기기에 캐시된 최근 기록만 집계합니다.");
        }
        return;
      }
      if (!cancelled) {
        setStatsLoading(true);
        setStatsLoadNote(null);
      }
      try {
        const rows = await loadRideSessionsForStatsFromFirestore(props.user.uid, 400);
        if (!cancelled) {
          setStatsSessions(rows);
          setStatsLoadNote(
            rows.length >= 400
              ? "최근 400건까지 반영됩니다. 그 이전 기록은 통계에 포함되지 않을 수 있습니다."
              : null,
          );
        }
      } catch {
        if (!cancelled) {
          setStatsSessions(props.recentSessions);
          setStatsLoadNote("통계 전용 불러오기 실패: 화면에 보이는 최근 기록으로 집계합니다.");
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.user?.uid, recentSessionsTipId]);

  const periodStats = useMemo(
    () => aggregateRideStatsForPeriod(statsSessions, statsPeriod),
    [statsSessions, statsPeriod],
  );

  const initial = (() => {
    if (!props.user) return "?";
    if (props.user.isAnonymous) return "G";
    const src = props.user.displayName?.trim() || props.user.email?.trim() || "U";
    return src.slice(0, 1).toUpperCase();
  })();
  const nickname = props.user
    ? props.user.isAnonymous
      ? "게스트"
      : props.user.displayName ?? props.user.email ?? "Rider"
    : "";
  const subLine = props.user
    ? props.user.isAnonymous
      ? props.user.uid.slice(0, 12) + "…"
      : props.user.email ?? props.user.uid
    : "";

  return (
    <div
      className={`user-info-sheet-root${props.open ? " is-open" : ""}`}
      aria-hidden={!props.open}
    >
      <button
        type="button"
        className="user-info-sheet__scrim"
        aria-label="닫기"
        onClick={props.onClose}
        tabIndex={props.open ? 0 : -1}
      />
      <aside className="user-info-sheet" role="dialog" aria-label="사용자 정보">
        <div className="user-info-sheet__head">
          <div className={`user-info-sheet__avatar ${props.isGuest ? "is-guest" : ""}`}>
            {initial}
          </div>
          <div className="user-info-sheet__id">
            <strong>{nickname}</strong>
            <span>{subLine}</span>
          </div>
          <button
            type="button"
            className="user-info-sheet__close"
            onClick={props.onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="user-info-sheet__stats-head" role="tablist" aria-label="통계 기간">
          {(
            [
              { id: "week" as const, label: "주간" },
              { id: "month" as const, label: "월간" },
              { id: "year" as const, label: "연간" },
            ] satisfies { id: RideStatsPeriod; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={statsPeriod === t.id}
              className={`user-info-sheet__stats-tab ${statsPeriod === t.id ? "is-active" : ""}`}
              onClick={() => setStatsPeriod(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="user-info-sheet__stats-range" title="기기 로컬 달력 기준">
          {statsLoading ? "통계 불러오는 중…" : periodStats.range.labelKo}
        </p>
        {statsLoadNote ? (
          <p className="user-info-sheet__stats-note" role="status">
            {statsLoadNote}
          </p>
        ) : null}
        <div className="user-info-sheet__stats">
          <div>
            <span>주행</span>
            <strong>{periodStats.stats.rides}</strong>
          </div>
          <div>
            <span>거리</span>
            <strong>{(periodStats.stats.distanceMeters / 1000).toFixed(1)} km</strong>
          </div>
          <div>
            <span>시간</span>
            <strong>{formatElapsedFromSec(periodStats.stats.elapsedSec)}</strong>
          </div>
          <div>
            <span>평속</span>
            <strong>{periodStats.stats.avgSpeedKmh.toFixed(1)} km/h</strong>
          </div>
        </div>
        <p className="user-info-sheet__stats-cal">
          칼로리 추정{" "}
          <strong>{Math.round(periodStats.stats.caloriesEstimate)}</strong> kcal
        </p>

        <button
          type="button"
          className="user-info-sheet__h-toggle"
          aria-expanded={historyOpen}
          aria-controls="user-info-sheet-history-list"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <span>최근 주행</span>
          <span className="user-info-sheet__h-count">{props.recentSessions.length}</span>
          <span className="user-info-sheet__h-chevron" aria-hidden>
            {historyOpen ? "▾" : "▸"}
          </span>
        </button>
        {historyOpen ? (
          <ul id="user-info-sheet-history-list" className="user-info-sheet__list">
            {props.recentSessions.length === 0 ? (
              <li className="user-info-sheet__empty">기록 없음</li>
            ) : (
              props.recentSessions.slice(0, 8).map((s) => (
                <li key={s.id} className="user-info-sheet__item">
                  <strong>{(s.distanceMeters / 1000).toFixed(2)} km</strong>
                  <span>{formatDuration(s.elapsedSec)}</span>
                  <span className="user-info-sheet__date">
                    {new Date(s.endedAt).toLocaleDateString()}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}

        <div className="user-info-sheet__actions">
          {props.isGuest && props.onLinkGoogle ? (
            <button
              type="button"
              className="user-info-sheet__btn"
              disabled={props.busy}
              onClick={props.onLinkGoogle}
            >
              Google 연결
            </button>
          ) : null}
          <button
            type="button"
            className="user-info-sheet__btn"
            disabled={props.busy}
            onClick={props.onLeaveLobby}
          >
            로비 나가기
          </button>
          <button
            type="button"
            className="user-info-sheet__btn user-info-sheet__btn--danger"
            disabled={props.busy}
            onClick={props.onServiceExit}
          >
            로그아웃
          </button>
        </div>
      </aside>
    </div>
  );
}

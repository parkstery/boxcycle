import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { loadRideSessionsForStatsFromFirestore } from "../lib/firestoreRides";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  aggregateRideStatsForPeriod,
  type RideStatsPeriod,
} from "../lib/rideStatsAggregate";
import type { StoredRideSession } from "../lib/rideSessionsStorage";
import { AuthGoogleMark } from "./AuthGateCard";
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

/** 출발·도착 한 줄(전체 주소는 title 로 노출, 한 줄은 CSS 말줄임). */
function rideSessionPlacesCaption(s: StoredRideSession): string {
  const a = s.startPlaceLabel?.trim();
  const b = s.endPlaceLabel?.trim();
  if (a && b) return `${a} / ${b}`;
  if (a) return a;
  if (b) return b;
  return "주소 없음";
}

function formatRideEndedAtKo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** 주행 기록 패널과 동일: 계획 거리 대비 95% 이상이면 완주 */
function rideCompletionDisplay(s: StoredRideSession): {
  label: string;
  isCompleted: boolean;
  title: string;
} {
  const r = s.completionRatio;
  if (typeof r !== "number" || !Number.isFinite(r)) {
    return { label: "—", isCompleted: false, title: "완주율 없음" };
  }
  const pct = Math.round(Math.max(0, Math.min(1, r)) * 100);
  const isCompleted = pct >= 95;
  const label = isCompleted ? "완주" : `미완주 (${pct}%)`;
  const title = isCompleted
    ? "계획 경로 대비 95% 이상 주행(완주로 표시)"
    : `계획 경로 대비 ${pct}%`;
  return { label, isCompleted, title };
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

  const showSignedInLobbyActions = props.user != null;
  const showGoogleLink = Boolean(props.isGuest && props.onLinkGoogle);
  const showActionsFooter = showGoogleLink || showSignedInLobbyActions;

  return (
    <div
      className={`user-info-sheet-root${props.open ? " is-open" : ""}`}
      aria-hidden={!props.open}
    >
      <button
        type="button"
        className="user-info-sheet__scrim"
        aria-label="닫기"
        title="Close"
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
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="user-info-sheet__scroll-body">
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
              title={
                t.id === "week" ? "This week" : t.id === "month" ? "This month" : "This year"
              }
              onClick={() => setStatsPeriod(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="user-info-sheet__stats-range" title="Local calendar on this device">
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
          title="Recent rides"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <span>최근 주행</span>
          <span className="user-info-sheet__h-chevron" aria-hidden>
            {historyOpen ? "▾" : "▸"}
          </span>
        </button>
        {historyOpen ? (
          <ul id="user-info-sheet-history-list" className="user-info-sheet__list">
            {props.recentSessions.length === 0 ? (
              <li className="user-info-sheet__empty">기록 없음</li>
            ) : (
              props.recentSessions.map((s) => {
                const routeCaption = rideSessionPlacesCaption(s);
                const whenLabel = formatRideEndedAtKo(s.endedAt);
                const completion = rideCompletionDisplay(s);
                const kmLabel = `${(s.distanceMeters / 1000).toFixed(2)} km`;
                const summaryTitle = `${kmLabel}  ${whenLabel}  ${completion.label}`;
                return (
                  <li key={s.id} className="user-info-sheet__item">
                    <div className="user-info-sheet__item-summary" title={summaryTitle}>
                      <strong className="user-info-sheet__item-km">{kmLabel}</strong>
                      <span className="user-info-sheet__item-when">{whenLabel}</span>
                      <span
                        className={`user-info-sheet__item-completion ${
                          completion.label === "—"
                            ? "is-unknown"
                            : completion.isCompleted
                              ? "is-completed"
                              : "is-partial"
                        }`}
                        title={completion.title}
                      >
                        {completion.label}
                      </span>
                    </div>
                    <span className="user-info-sheet__item-route" title={routeCaption}>
                      {routeCaption}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}

        {showActionsFooter ? (
          <div className="user-info-sheet__actions">
            {showGoogleLink ? (
              <button
                type="button"
                className="user-info-sheet__btn user-info-sheet__btn--google"
                disabled={props.busy}
                title="Link Google account"
                onClick={props.onLinkGoogle}
              >
                <AuthGoogleMark className="user-info-sheet__google-mark" />
                Google 연결
              </button>
            ) : null}
            {showSignedInLobbyActions ? (
              <>
                <button
                  type="button"
                  className="user-info-sheet__btn"
                  disabled={props.busy}
                  title="Leave lobby"
                  onClick={props.onLeaveLobby}
                >
                  로비 나가기
                </button>
                <button
                  type="button"
                  className="user-info-sheet__btn user-info-sheet__btn--danger"
                  disabled={props.busy}
                  title="Sign out"
                  onClick={props.onServiceExit}
                >
                  로그아웃
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        </div>
      </aside>
    </div>
  );
}

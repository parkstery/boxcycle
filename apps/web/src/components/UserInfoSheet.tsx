import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { loadRideSessionsForStatsFromFirestore } from "../lib/firestoreRides";
import { isFirebaseConfigured } from "../lib/firebase";
import { formatRideDistanceKmNumber } from "../lib/rideDistanceFormat";
import {
  aggregateRideStatsForPeriod,
  pickLastRide,
  type RideStatsPeriod,
} from "../lib/rideStatsAggregate";
import type { StoredRideSession } from "../lib/rideSessionsStorage";
import { ROUTE_COMPLETION_RATIO_THRESHOLD, isRouteCompletion } from "../lib/rideRecordPolicy";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";
import type { LngLat } from "../lib/geo";
import { resolveRecentRideActions } from "../lib/nextRideTarget";
import type { UserTier } from "../lib/firestoreUser";
import {
  fetchSubscriptionMe,
  openSubscriptionPortal,
  startSubscriptionCheckout,
  subscriptionStatusLabelKo,
  tierPlanLabel,
  type SubscriptionStatus,
} from "../lib/subscription";
import { AuthGoogleMark } from "./AuthGateCard";
import { resetGuestAccount } from "../lib/guestAccountReset";
import "./UserInfoSheet.css";

type UserInfoSheetProps = {
  open: boolean;
  onClose: () => void;
  user: User | null;
  recentSessions: StoredRideSession[];
  isGuest: boolean;
  tier: UserTier | null;
  subscriptionStatus: SubscriptionStatus;
  isPaid: boolean;
  busy: boolean;
  subscriptionFlash?: string | null;
  /** Conquest 정복 통계 — null=미로그인/데이터 없음 */
  conquest?: { totalMeters: number; totalCells: number } | null;
  /** 마일리지(누적 운동 이력) — 서버 집계, null=미로그인/데이터 없음 */
  mileage?: { totalMeters: number; totalSec: number; rideCount: number } | null;
  onLinkGoogle?: () => void;
  onServiceExit: () => void;
  /** 행 액션 판정용 — 본인 소유 SavedRoute 목록(§3.6) */
  savedRoutes?: readonly SavedRoute[];
  /** 실제 Ride 종료점을 지도에서 보기 */
  onShowRideOnMap?: (ride: StoredRideSession) => void;
  /** 소유 미완주 SavedRoute 이어 달리기 준비 */
  onResumeRideRoute?: (routeId: string) => void;
  /** 실제 종료점에서 새 경로 */
  onExtendFromRide?: (anchorLngLat: LngLat) => void;
  /** 주행 중이면 게스트 초기화 비활성 */
  rideActive?: boolean;
};

/** 한 방향 셰브런(펼침 상태는 CSS 회전) — ▸/▾ 딩벳 대체 */
function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden focusable="false">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatElapsedFromSec(sec: number): string {
  const totalMin = Math.floor(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** 마일리지 블록 전용 — 한국어 "H시간 M분" 포맷(formatElapsedFromSec 은 영문 "Xh Ym" 이라 별도 함수) */
function formatMileageElapsedKo(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}시간 ${m}분`;
}

/**
 * 출발·도착 한 줄(전체 주소는 title 로 노출, 한 줄은 CSS 말줄임).
 * **실제 세션 지명**을 우선하고, 없으면 계획 Route 지명으로 폴백한다(legacy Ride 호환, §4.1).
 */
function rideSessionPlacesCaption(s: StoredRideSession): string {
  const a = s.sessionStartPlaceLabel?.trim() || s.startPlaceLabel?.trim();
  const b = s.sessionEndPlaceLabel?.trim() || s.endPlaceLabel?.trim();
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

function formatSessionAvgSpeedKmh(s: StoredRideSession): string {
  const v = Number(s.avgSpeedKmh);
  if (Number.isFinite(v) && v >= 0) return v.toFixed(1);
  if (s.elapsedSec > 0) {
    return ((s.distanceMeters / 1000) / (s.elapsedSec / 3600)).toFixed(1);
  }
  return "0.0";
}

function formatSessionCaloriesEstimate(s: StoredRideSession): number {
  const v = Number(s.caloriesEstimate ?? 0);
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
}

function formatLastRideWhenKo(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return formatRideEndedAtKo(iso);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return formatRideEndedAtKo(iso);
}

/**
 * 완주 표시는 **전 UI 단일 정책**(`isRouteCompletion` = 98%)을 쓴다(§2.6).
 * 반올림 백분율 95% 로 판정하던 표시는 95~97% Ride 를 「완주」로 보여 주면서
 * SavedRoute 는 미완주로 남는 불일치를 만들었다.
 */
function rideCompletionDisplay(s: StoredRideSession): {
  label: string;
  isCompleted: boolean;
  title: string;
} {
  const r = s.completionRatio;
  if (typeof r !== "number" || !Number.isFinite(r)) {
    return { label: "—", isCompleted: false, title: "완주율 없음" };
  }
  const clamped = Math.max(0, Math.min(1, r));
  const pct = Math.round(clamped * 100);
  const isCompleted = isRouteCompletion(clamped);
  const label = isCompleted ? "완주" : `미완주 (${pct}%)`;
  const completionPct = Math.round(ROUTE_COMPLETION_RATIO_THRESHOLD * 100);
  const title = isCompleted
    ? `계획 경로 대비 ${completionPct}% 이상 주행(완주로 표시)`
    : `계획 경로 대비 ${pct}%`;
  return { label, isCompleted, title };
}

/**
 * TR 슬롯에서 우측으로 슬라이드 인 하는 사용자 패널.
 * - 계정 식별 + 주간·월간·연간 통계 + 최근 주행 + 핵심 액션.
 */
export function UserInfoSheet(props: UserInfoSheetProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<RideStatsPeriod>("day");
  const [statsSessions, setStatsSessions] = useState<StoredRideSession[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoadNote, setStatsLoadNote] = useState<string | null>(null);
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [subscriptionNote, setSubscriptionNote] = useState<string | null>(null);
  const [canCheckout, setCanCheckout] = useState(false);
  const [canManagePortal, setCanManagePortal] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [confirmingGuestReset, setConfirmingGuestReset] = useState(false);
  const [guestResetBusy, setGuestResetBusy] = useState(false);
  const [guestResetNote, setGuestResetNote] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  // 시트가 닫힐 때 펼침·로그아웃 확인을 default 로 리셋 — effect 대신 이전값 비교.
  const [prevOpen, setPrevOpen] = useState(props.open);
  if (props.open !== prevOpen) {
    setPrevOpen(props.open);
    if (!props.open) {
      setHistoryOpen(false);
      setConfirmingLogout(false);
      setConfirmingGuestReset(false);
      setGuestResetNote(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!props.open || !props.user || props.isGuest) {
        if (!cancelled) {
          setCanCheckout(false);
          setCanManagePortal(false);
          setSubscriptionNote(null);
        }
        return;
      }
      try {
        const me = await fetchSubscriptionMe(props.user!);
        if (cancelled) return;
        setCanCheckout(me.canCheckout);
        setCanManagePortal(me.canManagePortal);
        setSubscriptionNote(null);
      } catch (e) {
        if (!cancelled) {
          setCanCheckout(false);
          setCanManagePortal(false);
          setSubscriptionNote(
            e instanceof Error ? e.message : "구독 정보를 불러오지 못했습니다.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.user, props.isGuest]);

  const handleUpgrade = () => {
    if (!props.user) return;
    const base = window.location.origin + window.location.pathname;
    const successUrl = `${base}?subscription=success`;
    const cancelUrl = `${base}?subscription=cancel`;
    setSubscriptionBusy(true);
    setSubscriptionNote(null);
    void (async () => {
      try {
        const url = await startSubscriptionCheckout(props.user!, { successUrl, cancelUrl });
        window.location.assign(url);
      } catch (e) {
        setSubscriptionNote(e instanceof Error ? e.message : "결제 페이지를 열지 못했습니다.");
        setSubscriptionBusy(false);
      }
    })();
  };

  const handleManagePortal = () => {
    if (!props.user) return;
    const returnUrl = window.location.href.split("?")[0] ?? window.location.href;
    setSubscriptionBusy(true);
    setSubscriptionNote(null);
    void (async () => {
      try {
        const url = await openSubscriptionPortal(props.user!, returnUrl);
        window.location.assign(url);
      } catch (e) {
        setSubscriptionNote(e instanceof Error ? e.message : "구독 관리 페이지를 열지 못했습니다.");
        setSubscriptionBusy(false);
      }
    })();
  };

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
              ? "최근 400건 기준"
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

  const lastRide = useMemo(() => pickLastRide(statsSessions), [statsSessions]);

  /**
   * 플랜 줄의 단일 행동. Guest 는 액션 없음(종전과 동일), Free 는 업그레이드,
   * 유료는 구독 관리 — 상태만 알리던 표시 세 개를 이 한 줄이 대신한다.
   */
  const planAction = useMemo((): { label: string; onClick: () => void } | null => {
    if (props.isGuest) return null;
    if (canCheckout) return { label: "업그레이드", onClick: handleUpgrade };
    if (canManagePortal) return { label: "구독 관리", onClick: handleManagePortal };
    return null;
    // handleUpgrade/handleManagePortal 은 렌더마다 새로 만들어지는 클로저다 —
    // 의존성에 넣으면 매 렌더 재계산되므로 판정 입력만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.isGuest, canCheckout, canManagePortal]);

  const hasAssets =
    (props.conquest?.totalMeters ?? 0) > 0 || (props.mileage?.totalMeters ?? 0) > 0;

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

  const showGoogleLink = Boolean(props.isGuest && props.onLinkGoogle);
  const showLogout = props.user != null;
  /** 익명만 — 구글 등 provider 계정에는 절대 노출하지 않는다(지시07 B). */
  const showGuestReset = Boolean(props.user?.isAnonymous);
  const showActionsFooter = showGoogleLink || showLogout || showGuestReset;

  const runGuestReset = async () => {
    if (!props.user?.isAnonymous || props.rideActive || guestResetBusy) return;
    setGuestResetBusy(true);
    setGuestResetNote(null);
    try {
      const result = await resetGuestAccount(props.user);
      if (!result.deletedAuth && result.deleteError) {
        setGuestResetNote(`계정 삭제 실패 — 로컬만 정리합니다. (${result.deleteError})`);
        await new Promise((r) => setTimeout(r, 1200));
      }
      location.reload();
    } catch (e) {
      setGuestResetBusy(false);
      setGuestResetNote(e instanceof Error ? e.message : String(e));
    }
  };

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
          {/*
            플랜 — 상태와 행동을 **한 줄**로. 종전에는 「Free/미구독」 행 · 「Free 플랜」 라벨 ·
            「유료 플랜 구독」 버튼이 같은 사실을 세 번 말했다(2026-09-15 Chief 지적).
            상태만 알리는 표시는 지우고 누를 수 있는 것만 남긴다.
          */}
          {planAction ? (
            <button
              type="button"
              className="user-info-sheet__plan is-actionable"
              aria-label={`플랜 ${tierPlanLabel(props.tier)} — ${planAction.label}`}
              disabled={props.busy || subscriptionBusy}
              onClick={planAction.onClick}
            >
              <span className="user-info-sheet__plan-tier">{tierPlanLabel(props.tier)}</span>
              <span className="user-info-sheet__plan-cta">
                {planAction.label}
                <ChevronRight />
              </span>
            </button>
          ) : (
            <div className="user-info-sheet__plan" aria-label="플랜">
              <span className="user-info-sheet__plan-tier">{tierPlanLabel(props.tier)}</span>
              <span className="user-info-sheet__plan-status">
                {subscriptionStatusLabelKo(props.subscriptionStatus)}
              </span>
            </div>
          )}
          {props.subscriptionFlash ? (
            <p className="user-info-sheet__subscription-note is-ok" role="status">
              {props.subscriptionFlash}
            </p>
          ) : null}
          {subscriptionNote ? (
            <p className="user-info-sheet__subscription-note" role="status">
              {subscriptionNote}
            </p>
          ) : null}

          {/* 자산 — 내 도로망·누적을 2열 한 행으로(종전 2블록) */}
          {hasAssets ? (
            <div className="user-info-sheet__assets">
              {props.conquest && props.conquest.totalMeters > 0 ? (
                <div className="user-info-sheet__asset is-conquest" aria-label="내 도로망">
                  <span className="user-info-sheet__asset-k">🏴 내 도로망</span>
                  <strong className="user-info-sheet__asset-v rtw-numeric">
                    {(props.conquest.totalMeters / 1000).toFixed(1)}
                    <span> km</span>
                  </strong>
                </div>
              ) : null}
              {props.mileage && props.mileage.totalMeters > 0 ? (
                <div className="user-info-sheet__asset" aria-label="누적">
                  <span className="user-info-sheet__asset-k">누적</span>
                  <strong className="user-info-sheet__asset-v rtw-numeric">
                    {(props.mileage.totalMeters / 1000).toFixed(1)}
                    <span> km</span>
                  </strong>
                  <span className="user-info-sheet__asset-sub rtw-numeric">
                    {props.mileage.rideCount}회 · {formatMileageElapsedKo(props.mileage.totalSec)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/*
            기간 축 하나 — 종전에는 「일일 주행」이 탭 밖 별도 블록이라 주행·거리·시간·평속 +
            칼로리 타일이 **두 벌** 쌓였다. 오늘을 탭으로 흡수해 숫자 묶음을 하나로 만든다.
          */}
          <div className="user-info-sheet__stats-head" role="tablist" aria-label="통계 기간">
            {(
              [
                { id: "day" as const, label: "오늘", title: "Today" },
                { id: "week" as const, label: "주간", title: "This week" },
                { id: "month" as const, label: "월간", title: "This month" },
                { id: "year" as const, label: "연간", title: "This year" },
              ] satisfies { id: RideStatsPeriod; label: string; title: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={statsPeriod === t.id}
                className={`user-info-sheet__stats-tab ${statsPeriod === t.id ? "is-active" : ""}`}
                title={t.title}
                onClick={() => setStatsPeriod(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 거리를 히어로로 — 같은 크기 타일 4개는 눈이 훑을 곳을 정하지 못한다 */}
          <div className="user-info-sheet__stats-card">
            <div className="user-info-sheet__stats-meta">
              <span className="rtw-numeric" title="Local calendar on this device">
                {statsLoading ? "통계 불러오는 중…" : periodStats.range.labelKo}
              </span>
              <span className="rtw-numeric">주행 {periodStats.stats.rides}회</span>
            </div>
            {statsLoadNote ? (
              <p className="user-info-sheet__stats-note" role="status">
                {statsLoadNote}
              </p>
            ) : null}
            <p className="user-info-sheet__stats-hero">
              <strong className="rtw-numeric">
                {(periodStats.stats.distanceMeters / 1000).toFixed(2)}
              </strong>
              <span>km</span>
            </p>
            <div className="user-info-sheet__stats">
              <div>
                <span>시간</span>
                <strong className="rtw-numeric">
                  {formatElapsedFromSec(periodStats.stats.elapsedSec)}
                </strong>
              </div>
              <div>
                <span>평속</span>
                <strong className="rtw-numeric">
                  {periodStats.stats.avgSpeedKmh.toFixed(1)}
                </strong>
              </div>
              <div>
                <span>칼로리</span>
                <strong className="rtw-numeric">
                  {Math.round(periodStats.stats.caloriesEstimate)}
                </strong>
              </div>
            </div>
          </div>

          {/*
            마지막 주행 카드가 곧 「최근 주행」 목록의 입구다 — 종전에는 두 블록이 패널
            위아래로 갈라져 있어 스크롤해서 다른 행을 찾아 눌러야 했다.
          */}
          <button
            type="button"
            className="user-info-sheet__last-ride"
            aria-expanded={historyOpen}
            aria-controls="user-info-sheet-history-list"
            title="Recent rides"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span className="user-info-sheet__last-ride-body">
              <span className="user-info-sheet__last-ride-head">
                <span className="user-info-sheet__last-ride-k">마지막 주행</span>
                {lastRide ? (
                  <span className="user-info-sheet__last-ride-when">
                    {formatLastRideWhenKo(lastRide.endedAt)}
                  </span>
                ) : null}
              </span>
              {lastRide ? (
                <span
                  className="user-info-sheet__last-ride-v rtw-numeric"
                  title={formatRideEndedAtKo(lastRide.endedAt)}
                >
                  {formatRideDistanceKmNumber(lastRide.distanceMeters)} km ·{" "}
                  {formatElapsedFromSec(lastRide.elapsedSec)} ·{" "}
                  {formatSessionAvgSpeedKmh(lastRide)} km/h ·{" "}
                  {formatSessionCaloriesEstimate(lastRide)} kcal
                </span>
              ) : (
                <span className="user-info-sheet__last-ride-v is-empty">없음</span>
              )}
            </span>
            <span className={`user-info-sheet__h-chevron ${historyOpen ? "is-open" : ""}`} aria-hidden>
              <ChevronRight />
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
                /**
                 * 행 액션(§3.6) — 실제 종료점이 없는 legacy Ride 는 기록만 표시한다.
                 * 중첩 button 을 만들지 않기 위해 요약 자체가 「지도에서 보기」 버튼이고,
                 * 재개·새 경로는 형제 버튼으로 둔다.
                 */
                const actions = resolveRecentRideActions(s, props.savedRoutes ?? []);
                const summaryInner = (
                  <>
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
                  </>
                );
                const showOnMap = actions.canShowOnMap && props.onShowRideOnMap;
                return (
                  <li key={s.id} className="user-info-sheet__item">
                    {showOnMap ? (
                      <button
                        type="button"
                        className="user-info-sheet__item-summary user-info-sheet__item-summary--action"
                        title={`${summaryTitle} — 지도에서 보기`}
                        aria-label={`${kmLabel} ${whenLabel} 주행 지도에서 보기`}
                        onClick={() => props.onShowRideOnMap?.(s)}
                      >
                        {summaryInner}
                      </button>
                    ) : (
                      <div className="user-info-sheet__item-summary" title={summaryTitle}>
                        {summaryInner}
                      </div>
                    )}
                    <span className="user-info-sheet__item-route" title={routeCaption}>
                      {routeCaption}
                    </span>
                    {actions.resumeRouteId || actions.extendAnchor ? (
                      <div className="user-info-sheet__item-actions">
                        {actions.resumeRouteId && props.onResumeRideRoute ? (
                          <button
                            type="button"
                            className="user-info-sheet__item-action"
                            title="Resume this route"
                            onClick={() => props.onResumeRideRoute?.(actions.resumeRouteId!)}
                          >
                            이어 달리기
                          </button>
                        ) : null}
                        {actions.extendAnchor && props.onExtendFromRide ? (
                          <button
                            type="button"
                            className="user-info-sheet__item-action"
                            title="New route from here"
                            onClick={() => props.onExtendFromRide?.(actions.extendAnchor!)}
                          >
                            여기서 새 경로
                          </button>
                        ) : null}
                      </div>
                    ) : null}
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
            {showGuestReset ? (
              confirmingGuestReset ? (
                <div
                  className="user-info-sheet__logout-confirm"
                  role="group"
                  aria-label="게스트 초기화 확인"
                >
                  <p className="user-info-sheet__logout-confirm-copy">
                    이 게스트의 기록이 사라집니다
                  </p>
                  {guestResetNote ? (
                    <p className="user-info-sheet__logout-confirm-copy" role="status">
                      {guestResetNote}
                    </p>
                  ) : null}
                  <div className="user-info-sheet__logout-confirm-row">
                    <button
                      type="button"
                      className="user-info-sheet__btn"
                      disabled={guestResetBusy}
                      onClick={() => {
                        setConfirmingGuestReset(false);
                        setGuestResetNote(null);
                      }}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="user-info-sheet__btn user-info-sheet__btn--danger"
                      disabled={guestResetBusy || props.rideActive}
                      title="Reset guest"
                      onClick={() => void runGuestReset()}
                    >
                      {guestResetBusy ? "초기화 중…" : "초기화"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="user-info-sheet__btn user-info-sheet__btn--danger"
                  disabled={props.busy || props.rideActive || guestResetBusy}
                  title={props.rideActive ? "주행 중에는 초기화할 수 없습니다" : "Reset guest"}
                  onClick={() => setConfirmingGuestReset(true)}
                >
                  게스트 초기화
                </button>
              )
            ) : null}
            {showLogout ? (
              confirmingLogout ? (
                <div className="user-info-sheet__logout-confirm" role="group" aria-label="로그아웃 확인">
                  <p className="user-info-sheet__logout-confirm-copy">로그아웃하시겠습니까?</p>
                  <div className="user-info-sheet__logout-confirm-row">
                    <button
                      type="button"
                      className="user-info-sheet__btn"
                      disabled={props.busy}
                      onClick={() => setConfirmingLogout(false)}
                    >
                      취소
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
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="user-info-sheet__btn user-info-sheet__btn--danger"
                  disabled={props.busy}
                  title="Sign out"
                  onClick={() => setConfirmingLogout(true)}
                >
                  로그아웃
                </button>
              )
            ) : null}
          </div>
        ) : null}
        </div>
      </aside>
    </div>
  );
}

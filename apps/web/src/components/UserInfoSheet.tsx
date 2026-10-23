import { useEffect, useMemo, useRef, useState } from "react";
import { useDialogFocus } from "./ui/useDialogFocus";
import type { User } from "firebase/auth";
import { loadRideSessionsForStatsFromFirestore } from "../lib/ride/repo/firestoreRides";
import { isFirebaseConfigured } from "../lib/firebase/app";
import { formatRideDistanceKmNumber } from "../lib/ride/rideDistanceFormat";
import {
  aggregateRideStatsForPeriod,
  pickLastRide,
  type RideStatsPeriod,
} from "../lib/ride/rideStatsAggregate";
import { isLegacyDistanceCalories } from "../lib/ride/caloriesEstimate";
import type { StoredRideSession } from "../lib/ride/rideSessionsStorage";
import { ROUTE_COMPLETION_RATIO_THRESHOLD, isRouteCompletion } from "../lib/ride/rideRecordPolicy";
import type { SavedRoute } from "../lib/route/repo/firestoreSavedRoutes";
import type { LngLat } from "../lib/geo/geo";
import { resolveRecentRideActions } from "../lib/ride/nextRideTarget";
import type { UserTier } from "../lib/identity/repo/firestoreUser";
import {
  fetchSubscriptionMe,
  openSubscriptionPortal,
  startSubscriptionCheckout,
  subscriptionStatusLabelKo,
  tierPlanLabel,
  type SubscriptionStatus,
} from "../lib/account/repo/subscription";
import "./UserInfoSheet.css";
import { selfRiderDisplayName } from "../lib/identity/riderName";
import { isRouteReviewer } from "../lib/route/repo/publicRouteRequests";

type UserInfoSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 프로필 수정(닉네임·체중·강도) 열기 */
  onEditProfile?: () => void;
  /** 관리자 지표 시트 열기 — 관리자(isRouteReviewer)에게만 「관리」 버튼으로 노출 */
  onOpenAdmin?: () => void;
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
  /**
   * 현재 슬롯 활성 경로 id — 전달 시 다른 경로의 이어달리기 버튼을 차단한다.
   * undefined = legacy(슬롯 미사용, 차단 없음).
   */
  activeRouteId?: string | null;
  /** 슬롯 활성 경로로 지도 포커스 이동 */
  onFocusActiveRoute?: (routeId: string) => void;
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

/** 닫기 아이콘 — 선 굵기 1.7·둥근 끝, 색은 ink-2(디자인 규칙 「아이콘」) */
function CloseGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="#2A2E37" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** 숫자는 숫자 글꼴, 단위는 그 뒤에 작게(디자인 규칙: 단위를 끝까지 적는다) */
function Num({ v, unit }: { v: string | number; unit: string }) {
  return (
    <>
      <span className="user-info-sheet__num">{v}</span>
      <span className="user-info-sheet__unit">{unit}</span>
    </>
  );
}

/** 「40시간 6분」 — 숫자·단위를 나눠 그린다. 1시간 미만이면 분만 */
function ElapsedNum({ sec }: { sec: number }) {
  const totalMin = Math.floor(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return (
    <>
      {h > 0 ? (
        <>
          <Num v={h} unit="시간" />{" "}
        </>
      ) : null}
      <Num v={m} unit="분" />
    </>
  );
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
  if (Number.isNaN(d.getTime())) return "";
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

/** 칼로리 미산정이면 null — 빈 값은 「—」 대신 줄에서 뺀다 */
function sessionCaloriesEstimate(s: StoredRideSession): { n: number; legacy: boolean } | null {
  if (s.caloriesEstimate == null) return null;
  const v = Number(s.caloriesEstimate);
  if (!Number.isFinite(v) || v < 0) return null;
  return { n: Math.round(v), legacy: isLegacyDistanceCalories(s) };
}

function formatLastRideWhenKo(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
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

/** 기간 탭 위 이름표 — 오늘 「10월 23일」, 주간 「10월 19일 ~ 25일」, 월간 「10월」, 연간 「2026년」 */
function periodRangeLabelKo(
  period: RideStatsPeriod,
  range: { start: Date; endExclusive: Date },
): string {
  const start = range.start;
  const last = new Date(range.endExclusive.getTime() - 1);
  if (period === "day") return `${start.getMonth() + 1}월 ${start.getDate()}일`;
  if (period === "week") {
    const head = `${start.getMonth() + 1}월 ${start.getDate()}일`;
    return start.getMonth() === last.getMonth()
      ? `${head} ~ ${last.getDate()}일`
      : `${head} ~ ${last.getMonth() + 1}월 ${last.getDate()}일`;
  }
  if (period === "month") return `${start.getMonth() + 1}월`;
  return `${start.getFullYear()}년`;
}

const PERIOD_WORD_KO: Record<RideStatsPeriod, string> = {
  day: "오늘",
  week: "이번 주",
  month: "이번 달",
  year: "올해",
};

/**
 * 완주 표시는 **전 UI 단일 정책**(`isRouteCompletion` = 98%)을 쓴다(§2.6).
 * 반올림 백분율 95% 로 판정하던 표시는 95~97% Ride 를 「완주」로 보여 주면서
 * SavedRoute 는 미완주로 남는 불일치를 만들었다.
 * 완주율이 없는 옛 기록은 label=null — 화면에서 뺀다(「—」 자리 표시 금지).
 */
function rideCompletionDisplay(s: StoredRideSession): {
  label: string | null;
  isCompleted: boolean;
  title: string;
} {
  const r = s.completionRatio;
  if (typeof r !== "number" || !Number.isFinite(r)) {
    return { label: null, isCompleted: false, title: "완주율 없음" };
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
 * 화면 가운데 뜨는 두 칸 판(리더보드와 같은 틀).
 * - 왼쪽 요약판: 기간 탭 + 고른 기간의 거리(주인공 숫자) + 시간·평균 속도 한 줄.
 * - 오른쪽: 이름·닫기, 내 도로망·누적·마지막 주행·플랜 줄, 하단 버튼.
 */
export function UserInfoSheet(props: UserInfoSheetProps) {
  // 관리자 확인은 시트를 열 때 한 번 — 메뉴 노출용일 뿐, 숫자는 서버가 다시 권한을 확인한다
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const adminCheckUser = props.open && props.onOpenAdmin ? props.user : null;
  useEffect(() => {
    if (!adminCheckUser) return;
    let cancelled = false;
    void isRouteReviewer(adminCheckUser).then((ok) => {
      if (!cancelled) setAdminUid(ok ? adminCheckUser.uid : null);
    });
    return () => {
      cancelled = true;
    };
  }, [adminCheckUser]);
  const showAdminEntry = Boolean(props.onOpenAdmin && props.user && adminUid === props.user.uid);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<RideStatsPeriod>("day");
  const [statsSessions, setStatsSessions] = useState<StoredRideSession[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [subscriptionNote, setSubscriptionNote] = useState<string | null>(null);
  const [canCheckout, setCanCheckout] = useState(false);
  const [canManagePortal, setCanManagePortal] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const panelRef = useRef<HTMLElement>(null);
  useDialogFocus(props.open, panelRef);

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
      } catch {
        // 구독 상태를 못 읽어도 사용자가 할 일은 없다 — 서버 오류 문구를 화면에 내지 않고
        // 업그레이드·구독 관리 행동만 숨긴다(플랜 줄은 「Free 플랜」으로 남는다).
        if (!cancelled) {
          setCanCheckout(false);
          setCanManagePortal(false);
          setSubscriptionNote(null);
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
        }
        return;
      }
      if (!isFirebaseConfigured()) {
        if (!cancelled) {
          setStatsSessions(props.recentSessions);
          setStatsLoading(false);
        }
        return;
      }
      if (!cancelled) setStatsLoading(true);
      try {
        const rows = await loadRideSessionsForStatsFromFirestore(props.user.uid, 400);
        if (!cancelled) setStatsSessions(rows);
      } catch {
        if (!cancelled) setStatsSessions(props.recentSessions);
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
  const periodHasLegacyCalories = useMemo(() => {
    const start = periodStats.range.start.getTime();
    const end = periodStats.range.endExclusive.getTime();
    return statsSessions.some((s) => {
      const t = new Date(s.endedAt).getTime();
      if (!Number.isFinite(t) || t < start || t >= end) return false;
      return isLegacyDistanceCalories(s);
    });
  }, [statsSessions, periodStats.range.start, periodStats.range.endExclusive]);

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

  // 다른 라이더에게 보이는 이름과 같은 규칙(riderName). 이메일은 아래 줄에만 — 이 시트는 본인만 본다
  const nickname = props.user ? selfRiderDisplayName(props.user) : "";
  const subLine = props.user
    ? props.user.isAnonymous
      ? "게스트로 이용 중"
      : props.user.email ?? ""
    : "";

  const showGoogleLink = Boolean(props.isGuest && props.onLinkGoogle);
  const showLogout = props.user != null;

  const stats = periodStats.stats;
  const hasRides = stats.rides > 0;
  const caloriesAllUnknown = hasRides && stats.caloriesUnknownCount >= stats.rides;
  const caloriesApprox = stats.caloriesUnknownCount > 0 || periodHasLegacyCalories;
  const heroText = (stats.distanceMeters / 1000).toFixed(2);
  const periodWord = PERIOD_WORD_KO[statsPeriod];
  const metaLabel =
    periodRangeLabelKo(statsPeriod, periodStats.range) + (hasRides ? ` · 주행 ${stats.rides}회` : "");

  // 플랜 줄 문구 — 「Free 플랜 · 업그레이드」. 개발용 상태어(미구독 등)는 쓰지 않는다
  const planName = props.tier == null ? null : tierPlanLabel(props.tier);
  const planStatus =
    !props.isGuest && props.subscriptionStatus !== "none"
      ? subscriptionStatusLabelKo(props.subscriptionStatus)
      : null;

  const lastRideCalories = lastRide ? sessionCaloriesEstimate(lastRide) : null;

  return (
    <div
      className={`user-info-sheet-root${props.open ? " is-open" : ""}`}
      aria-hidden={!props.open}
      {...(!props.open ? { inert: true } : {})}
    >
      <button
        type="button"
        className="user-info-sheet__scrim"
        aria-label="닫기"
        onClick={props.onClose}
        tabIndex={props.open ? 0 : -1}
      />
      <aside ref={panelRef} className="user-info-sheet" role="dialog" aria-label="사용자 정보">
        {/* 왼쪽 요약판: 기간 탭 + 거리(주인공) + 시간·평균 속도 */}
        <div className="user-info-sheet__left">
          <div className="user-info-sheet__stats-head" role="tablist" aria-label="통계 기간">
            {([
              { id: "day" as const, label: "오늘" },
              { id: "week" as const, label: "주간" },
              { id: "month" as const, label: "월간" },
              { id: "year" as const, label: "연간" },
            ] satisfies { id: RideStatsPeriod; label: string }[]).map((t) => (
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

          <div className="user-info-sheet__summary">
            <span className="user-info-sheet__stats-meta">{metaLabel}</span>
            <p
              className={`user-info-sheet__stats-hero${statsLoading || !hasRides ? " is-empty" : ""}`}
              aria-busy={statsLoading}
            >
              {statsLoading ? (
                <span>통계를 불러오는 중이에요</span>
              ) : hasRides ? (
                <>
                  <strong
                    className={`rtw-numeric${heroText.length >= 6 ? " is-long" : ""}`}
                  >
                    {heroText}
                  </strong>
                  <span>km</span>
                </>
              ) : (
                <span>{periodWord} 주행이 없어요</span>
              )}
            </p>
            {!statsLoading && hasRides ? (
              <div className="user-info-sheet__stats">
                <div>
                  <ElapsedNum sec={stats.elapsedSec} />
                </div>
                <div>
                  평균 <Num v={stats.avgSpeedKmh.toFixed(1)} unit="km/h" />
                </div>
                <div className="user-info-sheet__stats-cal">
                  {caloriesAllUnknown ? (
                    <>
                      칼로리는{" "}
                      {props.onEditProfile ? (
                        <button
                          type="button"
                          className="user-info-sheet__link"
                          onClick={props.onEditProfile}
                        >
                          체중 입력
                        </button>
                      ) : (
                        "체중 입력"
                      )}{" "}
                      후 표시
                    </>
                  ) : (
                    <>
                      {caloriesApprox ? "추정 칼로리 " : "칼로리 "}
                      <Num v={Math.round(stats.caloriesEstimate)} unit="kcal" />
                    </>
                  )}
                </div>
              </div>
            ) : null}
            {!statsLoading && !hasRides ? (
              <p className="user-info-sheet__empty-hint">달리면 여기에 거리가 쌓여요</p>
            ) : null}
          </div>
        </div>

        {/* 오른쪽: 이름·닫기 + 줄 목록 + 하단 버튼 */}
        <div className="user-info-sheet__right">
          <header className="user-info-sheet__head">
            <div className="user-info-sheet__id">
              <strong>{nickname}</strong>
              {subLine ? <span>{subLine}</span> : null}
            </div>
            <button
              type="button"
              className="user-info-sheet__close"
              onClick={props.onClose}
              aria-label="닫기"
            >
              <CloseGlyph />
            </button>
          </header>

          <div className="user-info-sheet__rows">
            {!historyOpen ? (
              <div className="user-info-sheet__row" role="group" aria-label="내 도로망">
                <span className="user-info-sheet__row-k">
                  내 도로망
                  {props.conquest != null && props.conquest.totalMeters <= 0 ? (
                    <span className="user-info-sheet__row-sub">첫 라이딩으로 나만의 길을 남겨보세요.</span>
                  ) : null}
                </span>
                {props.conquest == null ? (
                  <span className="user-info-sheet__row-v is-quiet">확인 중</span>
                ) : (
                  <span className="user-info-sheet__row-v is-accent">
                    <Num v={(props.conquest.totalMeters / 1000).toFixed(1)} unit="km" />
                  </span>
                )}
              </div>
            ) : null}

            {!historyOpen && props.mileage && props.mileage.totalMeters > 0 ? (
              <div className="user-info-sheet__row" role="group" aria-label="누적">
                <span className="user-info-sheet__row-k">누적</span>
                <span className="user-info-sheet__row-v">
                  <Num v={(props.mileage.totalMeters / 1000).toFixed(1)} unit="km" />
                  <span className="user-info-sheet__dot">·</span>
                  <Num v={props.mileage.rideCount} unit="회" />
                  <span className="user-info-sheet__dot">·</span>
                  <ElapsedNum sec={props.mileage.totalSec} />
                </span>
              </div>
            ) : null}

            {/* 마지막 주행 = 최근 주행 목록 입구 */}
            <button
              type="button"
              className="user-info-sheet__row user-info-sheet__last-ride"
              aria-expanded={historyOpen}
              aria-controls="user-info-sheet-history-list"
              onClick={() => setHistoryOpen((v) => !v)}
            >
              <span className="user-info-sheet__row-k">
                마지막 주행
                {lastRide ? (
                  <span className="user-info-sheet__last-ride-when">
                    {formatLastRideWhenKo(lastRide.endedAt)}
                  </span>
                ) : null}
              </span>
              <span className="user-info-sheet__row-v" title={lastRide ? formatRideEndedAtKo(lastRide.endedAt) : undefined}>
                {lastRide ? (
                  <>
                    <Num v={formatRideDistanceKmNumber(lastRide.distanceMeters)} unit="km" />
                    <span className="user-info-sheet__dot">·</span>
                    <ElapsedNum sec={lastRide.elapsedSec} />
                    <span className="user-info-sheet__dot">·</span>
                    <Num v={formatSessionAvgSpeedKmh(lastRide)} unit="km/h" />
                    {lastRideCalories ? (
                      <>
                        <span className="user-info-sheet__dot">·</span>
                        <Num v={lastRideCalories.n} unit={lastRideCalories.legacy ? "kcal(옛)" : "kcal"} />
                      </>
                    ) : null}
                  </>
                ) : (
                  <span className="is-quiet">아직 주행이 없어요</span>
                )}
                <span className={`user-info-sheet__h-chevron ${historyOpen ? "is-open" : ""}`} aria-hidden>
                  <ChevronRight />
                </span>
              </span>
            </button>

            {historyOpen ? (
              <ul id="user-info-sheet-history-list" className="user-info-sheet__list">
                {props.recentSessions.length === 0 ? (
                  <li className="user-info-sheet__empty">최근 주행이 없어요</li>
                ) : (
                  props.recentSessions.map((s) => {
                    const routeCaption = rideSessionPlacesCaption(s);
                    const whenLabel = formatRideEndedAtKo(s.endedAt);
                    const completion = rideCompletionDisplay(s);
                    const kmLabel = `${(s.distanceMeters / 1000).toFixed(2)} km`;
                    const summaryTitle = `${kmLabel}  ${whenLabel}  ${completion.label ?? ""}`.trim();
                    /**
                     * 행 액션(§3.6) — 실제 종료점이 없는 legacy Ride 는 기록만 표시한다.
                     * 중첩 button 을 만들지 않기 위해 요약 자체가 「지도에서 보기」 버튼이고,
                     * 재개·새 경로는 형제 버튼으로 둔다.
                     */
                    const actions = resolveRecentRideActions(s, props.savedRoutes ?? [], {
                      activeRouteId: props.activeRouteId,
                    });
                    const summaryInner = (
                      <>
                        <strong className="user-info-sheet__item-km">{kmLabel}</strong>
                        <span className="user-info-sheet__item-when">{whenLabel}</span>
                        {completion.label ? (
                          <span
                            className={`user-info-sheet__item-completion ${
                              completion.isCompleted ? "is-completed" : "is-partial"
                            }`}
                            title={completion.title}
                          >
                            {completion.label}
                          </span>
                        ) : null}
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
                        {actions.resumeRouteId || actions.extendAnchor || actions.resumeBlocked ? (
                          <div className="user-info-sheet__item-actions">
                            {actions.resumeRouteId && props.onResumeRideRoute ? (
                              <button
                                type="button"
                                className="user-info-sheet__item-action"
                                onClick={() => props.onResumeRideRoute?.(actions.resumeRouteId!)}
                              >
                                이어 달리기
                              </button>
                            ) : null}
                            {actions.resumeBlocked ? (
                              <>
                                <span className="user-info-sheet__item-action user-info-sheet__item-action--blocked">
                                  이어달리기 한 경로만
                                </span>
                                {props.activeRouteId && props.onFocusActiveRoute ? (
                                  <button
                                    type="button"
                                    className="user-info-sheet__item-action"
                                    onClick={() => props.onFocusActiveRoute?.(props.activeRouteId!)}
                                  >
                                    활성 경로 확인
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                            {actions.extendAnchor && props.onExtendFromRide ? (
                              <button
                                type="button"
                                className="user-info-sheet__item-action"
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

            {/* 플랜 — 상태와 행동을 한 줄로 */}
            {!historyOpen ? (
              <div className="user-info-sheet__row" role="group" aria-label="플랜">
                <span className="user-info-sheet__row-k">플랜</span>
                {props.isGuest ? (
                  <span className="user-info-sheet__row-v is-text">
                    게스트 · 회원 등록하면 어느 기기에서나 이어져요
                  </span>
                ) : (
                  <span className="user-info-sheet__row-v is-text">
                    {planName ? (
                      <>
                        {planName} 플랜{planStatus ? ` · ${planStatus}` : ""}
                      </>
                    ) : (
                      <span className="is-quiet">확인 중</span>
                    )}
                    {planAction ? (
                      <>
                        <span className="user-info-sheet__dot">·</span>
                        <button
                          type="button"
                          className="user-info-sheet__link"
                          aria-label={`플랜 ${planName ?? ""} — ${planAction.label}`}
                          disabled={props.busy || subscriptionBusy}
                          onClick={planAction.onClick}
                        >
                          {planAction.label}
                        </button>
                      </>
                    ) : null}
                  </span>
                )}
              </div>
            ) : null}
          </div>

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

          <div className="user-info-sheet__actions">
            {confirmingLogout ? (
              <div className="user-info-sheet__logout-confirm" role="group" aria-label="로그아웃 확인">
                <p className="user-info-sheet__logout-confirm-copy">
                  진행 중인 주행이 여기서 끝납니다.
                </p>
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
                  className="user-info-sheet__btn user-info-sheet__btn--primary"
                  disabled={props.busy}
                  onClick={props.onServiceExit}
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <>
                {props.onEditProfile ? (
                  <button
                    type="button"
                    className="user-info-sheet__btn"
                    onClick={props.onEditProfile}
                  >
                    프로필 수정
                  </button>
                ) : null}
                {showAdminEntry ? (
                  <button
                    type="button"
                    className="user-info-sheet__btn"
                    onClick={props.onOpenAdmin}
                  >
                    관리
                  </button>
                ) : null}
                {showGoogleLink ? (
                  <button
                    type="button"
                    className="user-info-sheet__btn user-info-sheet__btn--primary"
                    disabled={props.busy}
                    onClick={props.onLinkGoogle}
                  >
                    회원 등록
                  </button>
                ) : null}
                {showLogout ? (
                  <button
                    type="button"
                    className="user-info-sheet__btn user-info-sheet__btn--text"
                    disabled={props.busy}
                    onClick={() => (props.rideActive ? setConfirmingLogout(true) : props.onServiceExit())}
                  >
                    로그아웃
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

import type { CoachingData } from "../../lib/coachTypes";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import { useEffect, useState, useSyncExternalStore } from "react";
import { reportHudCompanionTrailDedup } from "../../lib/hudCompanionDiag";
import { RIDE_PULSE_PERIOD_MS, ridePulseAnimationDelay } from "../../lib/ridePulse";
import {
  getOtherLiveRiderCount,
  subscribeHasOtherLiveRiders,
} from "../../lib/liveRideHudSignal";
import {
  companionHudCopy,
  formatCompanionHudActivityLine,
} from "../../lib/companionHudCount";
import { formatRideDistanceKmNumber } from "../../lib/rideDistanceFormat";
import "./MapHud.css";

export type AccountChipState = {
  initial: string;
  isGuest: boolean;
  /** 버튼에 노출할 표시 이름(게스트/닉네임/이메일 등) */
  label: string;
  /** 누적 운동 거리 km(정수 반올림), 데이터 없으면 null → 거리 미표시 */
  mileageKm: number | null;
};

/** 좌상단: Trail + 접속자 / 입문 코스 동행 이름 */
export type MapHudRidePresence = {
  trailheadEnabled: boolean;
  trailId: string;
  /** 현재 Trailhead에 있는지 — true면 「Trailhead로」 버튼 숨김 */
  onTrailhead: boolean;
  /** UI용 3자리 번호 또는 Trailhead */
  trailDisplayLabel: string;
  /** `Trail 042` / `Trailhead` — 주행 중 배지·네임태그 */
  trailLabel: string;
  trailMembers: { key: string; display: string; isSelf: boolean; active: boolean }[];
  trailError: string | null;
  courseTitle: string | null;
  coursePeerNames: string[];
  /** `courseActivity` aggregate 한 줄 — 인원수 절은 MapHud 가 Trail 실시간으로 치환 */
  courseActivityHudLine?: string | null;
};

export type MapHudProps = {
  stage: RideUiStage;

  // TL — 브랜드 마크 = 좌측 Trail 메뉴(Trail·경로 주행) 트리거
  onOpenMenu: () => void;
  menuOpen: boolean;
  /** HUD 접속 패널에서 Trailhead로 복귀(주행 중이 아닐 때만). Trail 안에 있을 때만 노출. */
  onGoTrailhead?: () => void;

  // TR — 사용자 정보 시트 트리거(아바타). 센서 칩은 여기 없다(RouteDock 소유)

  account: AccountChipState | null;
  onOpenUserInfo: () => void;
  userInfoOpen: boolean;
  /** 로그아웃 후 등 비로그인 맵 모드에서만 — 게스트/Google 오버레이 열기 */
  onOpenSignedOutAuth?: () => void;
  /** 첫 진입 게이트 카드만 숨긴 뒤에도 stage 가 gate 일 때 — HUD 를 비게이트처럼 취급 */
  authGateVisualDismissed?: boolean;

  // BC — 맵 뷰 시트 트리거 + 라이딩 중 코칭 라인
  onOpenMapView: () => void;
  mapViewOpen: boolean;
  coachData: CoachingData | null;
  coachLineEnabled: boolean;

  // TC — 핵심 4지표: 주행 중(riding/paused) 또는 경로만 계산된 대기(ready-to-start)
  metrics:
    | ({
        mode: "ride";
        elapsed: string;
        /** 오늘(이번 세션) 실주행 km */
        distanceKm: string;
        /** 경로상 누적 위치 km — 재개 시 offset 시드 반영 */
        cumulativeKm: string;
        avgKmh: string;
        speedKmh: number;
        /** 주행경로 전체거리 km(정수 아님, 소수 2자리 문자열). null=경로 미확정 → 누적/전체 병기 생략 */
        routeTotalKm: string | null;
      })
    | ({
        mode: "route-preview";
        elapsed: string;
        distanceKm: string;
        avgKmh: string;
        speedKmh: number;
      })
    | null;

  // BL — 핀 초기화 (setup 오류 액션 등에서 사용)
  onClearPins: () => void;

  // MC — 액션 카드 (일시정지 / 설정 단계 오류 안내)
  routeError: string | null;

  // BR — 메인 FAB
  canStartRide: boolean;
  onStartRide: () => void;
  onPauseRide: () => void;
  onResumeRide: () => void;
  onEndRide: () => void;

  // paused 단계의 MC 컨트롤
  onResumeFromPause: () => void;
  onEndFromPause: () => void;
  onModifyFromPause: () => void;

  // 첫 진입 안내 (idle 단계만)
  showIdleHint: boolean;
  onDismissIdleHint: () => void;

  /** Trailhead·코스 동행 요약(없으면 미표시) */
  ridePresence?: MapHudRidePresence | null;
  /** 라이브 어스 — 주행 지역 현재 날씨·밤낮 한 줄(Open-Meteo, 세션 중만) */
  weatherHint?: string | null;
  /** Conquest — 낙관 새 도로 m. null=미무장 숨김. 0=+0.00(이미 내 도로) */
  conquestLiveMeters?: number | null;
  /**
   * 「이미 내 도로」 힌트 — true 이면 +0.00 아래에 작은 부가 설명을 표시.
   * 조건: `conquestLiveMeters === 0 && 세션 거리 ≥ 10m`.
   */
  conquestAllOwnedHint?: boolean;
  /** idle 단계 첫 진입 안내 문구 */
  idleHintMessage?: string;
  /**
   * Quick Camera 1~6 — 주행 중에만 Account 왼쪽. null/undefined 이면 미렌더(CSS 숨김 금지).
   */
  quickCamera?: {
    active: 1 | 2 | 3 | 4 | 5 | 6 | null;
    onSelect: (n: 1 | 2 | 3 | 4 | 5 | 6) => void;
    /** 1번 3단 상태 — 버튼에 작은 표식(지시07) */
    camera1Mode?: "routeFit" | "aerial60" | "aerial5";
  } | null;
};

/** TC 지표 캡슐 셀 — 라벨 위·값 아래 (참조 TopHud) */
/**
 * `variant` 는 셀의 **고정 폭**을 고르는 열쇠다(2026-09-17 Chief). 값 글자 수가 바뀌면
 * (`9.9`→`10.0`, `03:58`→`04:02`) 셀이 늘었다 줄었다 하면서 오른쪽 계기가 통째로
 * 밀리고 당겨졌다 — 주행 중 눈이 같은 자리에서 같은 값을 못 찾는다.
 * `tabular-nums` 는 **같은 자릿수**만 맞춰 주므로 이것만으로는 부족하다.
 */
function HudMetricCell({
  label,
  value,
  unit,
  hero = false,
  variant,
}: {
  label: string;
  value: string;
  unit?: string;
  hero?: boolean;
  variant?: "distance" | "time" | "speed";
}) {
  return (
    <span
      className={`hud-metrics__cell${hero ? " hud-metrics__cell--hero" : ""}${
        variant ? ` hud-metrics__cell--w-${variant}` : ""
      }`}
      title={label}
    >
      <span className="hud-metrics__label">{label}</span>
      <span className="hud-metrics__value">
        {value}
        {unit ? <span className="hud-metrics__cell-unit">{unit}</span> : null}
      </span>
    </span>
  );
}

/**
 * 8슬롯 글래스 HUD.
 *
 * - 슬롯 자체는 pointer-events: none, 내부 위젯만 다시 활성화 → 빈 영역은 항상 맵 조작 가능.
 * - 메뉴는 3개로 분리: TL Trail 메뉴(Trail·경로 주행), BC 맵 뷰, TR 사용자 정보. HUD 는 트리거만 들고 시트 자체는 외부에서 렌더.
 */
export function MapHud(props: MapHudProps) {
  const {
    stage,
    onOpenMenu,
    menuOpen,
    onGoTrailhead,
    account,
    onOpenUserInfo,
    userInfoOpen,
    onOpenSignedOutAuth,
    authGateVisualDismissed = false,
    onOpenMapView,
    mapViewOpen,
    coachData,
    coachLineEnabled,
    metrics,
    onClearPins,
    routeError,
    canStartRide,
    onStartRide,
    onPauseRide,
    onResumeRide,
    onEndRide,
    onResumeFromPause,
    onEndFromPause,
    onModifyFromPause,
    showIdleHint,
    onDismissIdleHint,
    ridePresence,
    weatherHint,
    conquestLiveMeters,
    conquestAllOwnedHint,
    idleHintMessage = "MENU → 입문 경로",
    quickCamera = null,
  } = props;

  const riding = stage === "riding";
  const paused = stage === "paused";
  const activeRide = riding || paused;
  const idle = stage === "idle";
  const isGate =
    stage === "gate-nickname" || (stage === "gate" && !authGateVisualDismissed);
  const isSummary = stage === "summary";

  // 트리거 노출 정책: gate/summary 가 아닌 동안 항상 보임.
  /*
   * 「새 도로」 펄스 — 값이 바뀔 때마다 터지는 게 아니라, **새 도로를 먹고 있는 동안**
   * 내 위치 마커와 같은 박자로 뛴다(2026-09-17 Chief).
   * 종전엔 `key={conquestLiveMeters}` 로 값마다 요소를 갈아끼워 0.35s 팝을 다시 틀었다 —
   * 빠르게 달릴수록 갱신이 잦아 주기가 짧아지고 촐랑거렸다. 펄스가 아니라 갱신 알림이었다.
   * 위상은 마커와 같은 격자에 못 박는다(lib/ridePulse.ts). 지연값은 켜지는 순간 한 번만
   * 계산해 ref 에 담는다 — 매 렌더 다시 계산하면 그때마다 위상이 튄다.
   */
  const conquestMeters = conquestLiveMeters ?? null;
  const [conquestPrev, setConquestPrev] = useState<number | null>(null);
  /** null = 조용함. 값이 있으면 그 `delay` 로 마커와 같은 격자 위에서 뛴다. */
  const [conquestPulse, setConquestPulse] = useState<{ delay: string } | null>(null);
  // 값이 바뀐 바로 그 렌더에서 상태를 맞춘다 — React 가 권장하는 「props 로 state 조정」 패턴.
  // effect 로 하면 setState 가 동기로 불려 렌더가 연쇄되고, ref 로 하면 렌더 중 ref 를 읽게 된다.
  if (conquestMeters !== conquestPrev) {
    const prev = conquestPrev;
    setConquestPrev(conquestMeters);
    if (conquestMeters == null) {
      if (conquestPulse) setConquestPulse(null);
    } else if (prev != null && conquestMeters > prev && !conquestPulse) {
      // 켜는 순간에만 위상을 찍는다. 매 렌더 다시 계산하면 그때마다 위상이 튄다.
      setConquestPulse({ delay: ridePulseAnimationDelay() });
    }
  }
  useEffect(() => {
    if (!conquestPulse) return;
    // 새 도로가 끊기면 한 박자 더 뛰고 조용해진다 — 박자 중간에 잘리지 않게 주기의 배수로.
    // `conquestMeters` 가 deps 에 있어 계속 먹는 동안에는 타이머가 매번 다시 선다.
    const timer = window.setTimeout(() => setConquestPulse(null), RIDE_PULSE_PERIOD_MS * 2);
    return () => window.clearTimeout(timer);
  }, [conquestPulse, conquestMeters]);

  const showMenuTrigger = !isGate && !isSummary;
  // 접속·동행 현황은 HUD 가 단독으로 소유. MENU(Trail 섹션=참가·공개 설정 행동) 열린 동안은
  // 가림·중복을 피하려 숨긴다.
  const showRidePresence = ridePresence != null && !menuOpen && !activeRide;
  const otherLiveRiderCount = useSyncExternalStore(
    subscribeHasOtherLiveRiders,
    getOtherLiveRiderCount,
    getOtherLiveRiderCount,
  );
  const hasOtherLiveRiders = otherLiveRiderCount > 0;

  useEffect(() => {
    if (!ridePresence) return;
    reportHudCompanionTrailDedup({
      activeTrailMemberUids: ridePresence.trailMembers.filter((m) => m.active).map((m) => m.key),
      coursePeerNamesLength: ridePresence.coursePeerNames.length,
    });
  }, [ridePresence]);
  const showAccount = account !== null && !isGate && !isSummary;
  const showSignedOutAuth =
    !isGate && !isSummary && account === null && typeof onOpenSignedOutAuth === "function";
  /*
   * 2026-09-16: 우상단에서 센서 칩이 완전히 빠졌다. RouteDock 이 `idle` 을 포함한
   * 모든 주행 가능 stage 에서 보이므로 칩은 항상 dock 이 그린다(`lib/sensorChipSlot`).
   * 여기 남는 것은 계정·로그인 칩뿐이고, `cadence` 는 **RouteDock 으로만** 간다.
   */
  const showTopRight = showAccount || showSignedOutAuth || Boolean(quickCamera);
  const showMapViewTrigger = !isGate && !isSummary;
  const showMetrics =
    metrics !== null &&
    !isGate &&
    !isSummary &&
    (riding || paused || metrics.mode === "route-preview");
  const showCoach = coachLineEnabled && coachData !== null && (riding || paused);
  const showMainFab = riding;
  const showMc = paused || (stage === "setup" && Boolean(routeError));

  const companionCopy =
    ridePresence != null
      ? companionHudCopy({
          otherLiveRiderCount,
          selfRiding: riding,
          coursePeerNamesLength: ridePresence.coursePeerNames.length,
        })
      : { riderCount: null, showEmptyCopy: false };
  const companionActivityLine =
    ridePresence != null
      ? formatCompanionHudActivityLine({
          aggregateHudLine: ridePresence.courseActivityHudLine ?? null,
          displayedRiderCount: companionCopy.riderCount,
        })
      : null;

  return (
    <div
      className={`map-hud${activeRide ? " map-hud--active-ride" : ""}`}
      aria-label="라이딩 HUD"
    >
      {paused ? <div className="map-hud__scrim" aria-hidden /> : null}

      {showMenuTrigger || (showMetrics && metrics) ? (
        <div className="map-hud__tl">
          {/*
            한 행 — RTW(좌상단 코너) + 계기판(그 오른쪽).
            미니맵 세로 공간용: 예전 두 줄(계기/RTW)을 한 줄로 줄인다(20260923-minimap 지시01).
            한쪽만 있어도 남은 요소가 좌상단 코너를 지킨다(idle=RTW만 / 일부 stage=계기만).
          */}
          <div className="map-hud__tl-row">
            {showMenuTrigger ? (
              <button
                type="button"
                className={`hud-brand ${menuOpen ? "hud-brand--muted" : ""}`}
                onClick={onOpenMenu}
                aria-label="Trail 메뉴"
                aria-expanded={menuOpen}
                title="Trail menu"
              >
                <span className="hud-brand__dot" aria-hidden />
                RTW
              </button>
            ) : null}
            {showMetrics && metrics ? (
              <div className="map-hud__tl-metrics">
                <div
                  className={`hud-metrics${metrics.mode === "route-preview" ? " hud-metrics--route-preview" : ""}`}
                >
                  <div className="hud-metrics__capsule" role="group" aria-label="주행 지표">
                    {/* 주행 중 — 세션 거리는 offset 없으면 누적과 항상 동일해 중복이었다.
                        이제 누적거리/전체거리 한 줄만 표시(§9.5.5 단위7·U4) */}
                    {metrics.mode === "ride" && metrics.routeTotalKm ? (
                      <span
                        className="hud-metrics__cell hud-metrics__cell--hero hud-metrics__cell--w-distance"
                        title="주행 누적 거리 / 경로 전체거리"
                      >
                        <span className="hud-metrics__label">거리</span>
                        <span
                          className="hud-metrics__value hud-metrics__value--cumulative"
                          aria-label="주행 누적 거리"
                        >
                          {metrics.cumulativeKm}
                          <span className="hud-metrics__value-total">
                            {" / "}
                            {metrics.routeTotalKm}
                          </span>
                          <span className="hud-metrics__cell-unit">km</span>
                        </span>
                      </span>
                    ) : (
                      <HudMetricCell label="거리" value={metrics.distanceKm} unit="km" hero variant="distance" />
                    )}
                    <span className="hud-metrics__divider" aria-hidden />
                    <HudMetricCell label="시간" value={metrics.elapsed} variant="time" />
                    <span className="hud-metrics__divider" aria-hidden />
                    <HudMetricCell label="평균" value={metrics.avgKmh} unit="km/h" variant="speed" />
                    <span className="hud-metrics__divider" aria-hidden />
                    <HudMetricCell label="속도" value={String(metrics.speedKmh)} unit="km/h" variant="speed" />
                    {/* null = 미무장 숨김. 0 포함 무장 후 항상 표시(이미 내 도로면 +0.00) */}
                    {(riding || paused) && conquestLiveMeters != null ? (
                      <>
                        <span className="hud-metrics__divider" aria-hidden />
                        <span
                          className={`hud-metrics__cell hud-metrics__cell--conquest${
                            conquestPulse ? " hud-metrics__cell--conquest-pulsing" : ""
                          }`}
                          style={conquestPulse ? { animationDelay: conquestPulse.delay } : undefined}
                          title="이번 주행에서 새로 밟은 도로(이미 내 도로면 0)"
                          role="status"
                          aria-live="polite"
                        >
                          <span className="hud-metrics__label">새 도로</span>
                          <span className="hud-metrics__value">
                            +{formatRideDistanceKmNumber(conquestLiveMeters)}
                            <span className="hud-metrics__cell-unit">km</span>
                          </span>
                          {conquestAllOwnedHint ? (
                            <span className="hud-metrics__conquest-owned-hint" aria-label="이미 내 도로">
                              이미 내 도로
                            </span>
                          ) : null}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {showMenuTrigger &&
          ((weatherHint && !activeRide) || (showRidePresence && ridePresence)) ? (
            <div className="map-hud__tl-stack">
              {weatherHint && !activeRide ? (
                <p className="hud-world-hint hud-weather-hint" role="status" title="주행 지역의 현재 날씨(Open-Meteo)">
                  {weatherHint}
                </p>
              ) : null}
              {showRidePresence && ridePresence ? (
                <aside className="hud-ride-presence hud-glass" aria-label="Trail·동행">
                  {ridePresence.trailheadEnabled ? (
                    <div className="hud-ride-presence__block">
                      <div className="hud-ride-presence__head">
                        <span className="hud-ride-presence__tag">접속</span>
                        <span className="hud-ride-presence__room" title={ridePresence.trailId}>
                          {ridePresence.trailLabel}
                        </span>
                        {!ridePresence.onTrailhead && typeof onGoTrailhead === "function" ? (
                          <button
                            type="button"
                            className="hud-ride-presence__trailhead-btn"
                            disabled={riding || paused}
                            title="Trailhead로 이동"
                            onClick={onGoTrailhead}
                          >
                            Trailhead로
                          </button>
                        ) : null}
                      </div>
                      {ridePresence.trailError ? (
                        <p className="hud-ride-presence__err" title={ridePresence.trailError}>
                          {ridePresence.trailError}
                        </p>
                      ) : ridePresence.trailMembers.filter((m) => m.active).length > 0 ? (
                        <ul className="hud-ride-presence__list">
                          {ridePresence.trailMembers
                            .filter((m) => m.active)
                            .map((m) => (
                              <li key={m.key}>
                                {m.display}
                                {m.isSelf ? <span className="hud-ride-presence__you"> (나)</span> : null}
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="hud-ride-presence__empty">접속자 없음</p>
                      )}
                    </div>
                  ) : null}
                  {ridePresence.courseTitle != null ||
                  ridePresence.coursePeerNames.length > 0 ||
                  hasOtherLiveRiders ||
                  companionActivityLine ? (
                    <div
                      className="hud-ride-presence__block"
                      data-has-other-live={hasOtherLiveRiders ? "1" : "0"}
                    >
                      <div className="hud-ride-presence__head">
                        <span className="hud-ride-presence__tag">동행</span>
                        <span className="hud-ride-presence__room" title={ridePresence.courseTitle ?? ""}>
                          {ridePresence.courseTitle ?? "경로"}
                        </span>
                      </div>
                      {companionActivityLine ? (
                        <p
                          className="hud-ride-presence__activity"
                          data-companion-count={
                            companionCopy.riderCount != null ? String(companionCopy.riderCount) : ""
                          }
                        >
                          {companionActivityLine}
                        </p>
                      ) : null}
                      {ridePresence.coursePeerNames.length > 0 ? (
                        <ul className="hud-ride-presence__list">
                          {ridePresence.coursePeerNames.map((name, i) => (
                            <li key={`${name}-${i}`}>{name}</li>
                          ))}
                        </ul>
                      ) : companionCopy.showEmptyCopy ? (
                        <p className="hud-ride-presence__empty">다른 라이더 없음</p>
                      ) : null}
                    </div>
                  ) : null}
                </aside>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 우상단은 하나의 액션 행 — 계정/로그인 칩만. 센서 칩은 RouteDock 이 소유한다 */}
      {showTopRight ? (
        <div className="map-hud__tr">
          {quickCamera ? (
            <div
              className="hud-quick-camera"
              role="group"
              aria-label="Quick Camera"
              /* 지시10 §3: gap·가장자리 터치가 맵(Mapbox)으로 전파되지 않게.
               * click 만 막으면 모바일에서 touchstart/pointerdown 이 지도를 먼저 움직인다. */
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {([1, 2, 3, 4, 5, 6] as const).map((n) => {
                const c1 = n === 1 ? quickCamera.camera1Mode ?? "routeFit" : null;
                const c1Mark =
                  c1 === "routeFit" ? "R" : c1 === "aerial60" ? "60" : c1 === "aerial5" ? "5" : null;
                const c1Label =
                  c1 === "routeFit"
                    ? "전체 경로"
                    : c1 === "aerial60"
                      ? "60m 상공"
                      : c1 === "aerial5"
                        ? "5m 상공"
                        : null;
                return (
                  <button
                    key={n}
                    type="button"
                    className={`hud-quick-camera__btn${quickCamera.active === n ? " is-active" : ""}${
                      n === 1 ? " hud-quick-camera__btn--c1" : ""
                    }`}
                    aria-label={c1Label ? `카메라 1 · ${c1Label}` : `카메라 ${n}`}
                    aria-pressed={quickCamera.active === n}
                    data-camera1-mode={c1 ?? undefined}
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => quickCamera.onSelect(n)}
                  >
                    <span className="hud-quick-camera__num">{n}</span>
                    {c1Mark && quickCamera.active === 1 ? (
                      <span className="hud-quick-camera__c1-mark" aria-hidden>
                        {c1Mark}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {showAccount && account ? (
            <button
              type="button"
              className={`hud-account ${account.isGuest ? "hud-account--guest" : ""}`}
              aria-label="사용자 정보"
              aria-expanded={userInfoOpen}
              title="Account"
              onClick={onOpenUserInfo}
            >
              <span className="hud-account__avatar" aria-hidden>
                {account.initial}
              </span>
              <span className="hud-account__text">
                <span className="hud-account__name">{account.label}</span>
                {account.mileageKm != null ? (
                  <span className="hud-account__mileage">
                    {account.mileageKm.toLocaleString("ko-KR")} km
                  </span>
                ) : null}
              </span>
            </button>
          ) : null}

          {showSignedOutAuth ? (
            <button
              type="button"
              className="hud-signin-pill"
              aria-label="로그인 또는 게스트로 시작"
              title="Sign in"
              onClick={onOpenSignedOutAuth}
            >
              로그인
            </button>
          ) : null}
        </div>
      ) : null}

      {/*
       * 맵 뷰 트리거 — 우상단 칩 행 바로 아래(지도 컨트롤 열의 머리).
       * 하단 중앙에 두면 폰에서 지도 한가운데를 잡아먹는다.
       */}
      {showMapViewTrigger ? (
        <div className="map-hud__tr-under">
          <button
            type="button"
            className={`hud-bc-trigger ${mapViewOpen ? "is-active" : ""}`}
            onClick={onOpenMapView}
            aria-label="맵 뷰 설정"
            aria-expanded={mapViewOpen}
            title="Map view"
          >
            <span className="hud-bc-trigger__icon" aria-hidden>
              ◰
            </span>
            <span className="hud-bc-trigger__label">맵</span>
          </button>
        </div>
      ) : null}

      {/* BC 슬롯: 코칭 라인(라이딩 중) + 맵 뷰 트리거(항상). 둘은 위·아래로 쌓임. */}
      {showCoach ? (
        <div className="map-hud__bc">
          {showCoach && coachData ? (
            <div className="hud-coach" role="status" aria-live="polite">
              <span className="hud-coach__tip">{coachData.tip.replace(/\s*\(R\d+\)\s*$/, "")}</span>
              <span className="hud-coach__r">{coachData.resistance.replace("Resistance ", "R")}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {showMc ? (
        <div className="map-hud__mc">
          {stage === "setup" && routeError ? (
            <div className="hud-action" role="alert">
              <p className="hud-action__title">{routeError}</p>
              <div className="hud-action__row">
                <button
                  type="button"
                  className="hud-action__btn"
                  title="Clear pins"
                  onClick={onClearPins}
                >
                  핀 초기화
                </button>
              </div>
            </div>
          ) : null}

          {paused ? (
            <div className="hud-action" role="region" aria-label="일시정지">
              <p className="hud-action__title">일시정지</p>
              <div className="hud-action__row">
                <button
                  type="button"
                  className="hud-action__btn hud-action__btn--primary"
                  title="Resume"
                  onClick={onResumeFromPause}
                >
                  재개
                </button>
                <button
                  type="button"
                  className="hud-action__btn"
                  title="Edit route"
                  onClick={onModifyFromPause}
                >
                  변경
                </button>
                <button
                  type="button"
                  className="hud-action__btn hud-action__btn--danger"
                  title="End ride"
                  onClick={onEndFromPause}
                >
                  종료
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showMainFab ? (
        <div className="map-hud__br">
          {idle && showIdleHint ? (
            <button
              type="button"
              className="hud-idle-hint"
              onClick={onDismissIdleHint}
              title="Dismiss hint"
            >
              {idleHintMessage}
            </button>
          ) : null}
          <div className="map-hud__br-main">
            {riding ? (
              <button
                type="button"
                className="hud-main-fab hud-main-fab--pause"
                onClick={onPauseRide}
                aria-label="일시정지"
                title="Pause"
              >
                ‖
              </button>
            ) : (
              <button
                type="button"
                className="hud-main-fab"
                onClick={onStartRide}
                disabled={!canStartRide}
                aria-label="주행 시작"
                title="Start ride"
              >
                ▶
              </button>
            )}
            {riding ? (
              <button
                type="button"
                className="hud-icon-btn hud-icon-btn--danger"
                onClick={onEndRide}
                aria-label="주행 종료"
                title="Stop ride"
              >
                ■
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {paused ? (
        <div className="map-hud__br">
          <div className="map-hud__br-main">
            <button
              type="button"
              className="hud-icon-btn hud-icon-btn--primary"
              onClick={onResumeRide}
              aria-label="재개"
              title="Resume"
            >
              ▶
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

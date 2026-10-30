import type { CoachingData } from "../../lib/coach/coachTypes";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { reportHudCompanionTrailDedup } from "../../lib/debug/hudCompanionDiag";
import { RIDE_PULSE_PERIOD_MS, ridePulseAnimationDelay } from "../../lib/ride/ridePulse";
import {
  getOtherLiveRiderCount,
  subscribeHasOtherLiveRiders,
} from "../../lib/ride/liveRideHudSignal";
import {
  companionHudCopy,
  formatCompanionHudActivityLine,
} from "../../lib/ride/companionHudCount";
import { formatRideDistanceKmNumber } from "../../lib/ride/rideDistanceFormat";
import { type Camera1Mode } from "../../lib/camera/camera1Mode";
import type { RoutePreviewElevationHud } from "../../app/appHudValues";
import { coachingTipDisplayKo } from "../../lib/coach/coachingDisplayKo";
import { CameraViewMenu } from "./CameraViewMenu";
import "./MapHud.css";
import "./CameraViewMenu.css";
import "./CloudMapControls.css";
import { RideIntervalHud } from "../ride/RideIntervalHud";
import type { RideIntervalView } from "../../lib/ride/rideInterval";
import { useRideMoments } from "../../hooks/useRideMoments";
import type { RideMomentInput } from "../../lib/ride/rideMoments";

/** HUD 우상단 시계 — `26.09.29 15:09:35` (로컬, 초 단위) */


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
  /** Authenticated UI visibility; false also removes controls from keyboard navigation. */
  visible?: boolean;
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

  // BC — 라이딩 중 코칭 라인
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
        distanceKm: string;
        elevation: RoutePreviewElevationHud;
      })
    | null;

  /** 선택한 인터벌. 주행·일시정지에서만 표시한다. */
  rideInterval?: RideIntervalView | null;
  intervalTtsEnabled?: boolean;
  intervalCadenceRpm?: number | null;

  // BL — 핀 초기화 (setup 오류 액션 등에서 사용)
  onClearPins: () => void;

  // MC — 액션 카드 (일시정지 / 설정 단계 오류 안내)
  routeError: string | null;


  // paused 단계의 MC 컨트롤
  onResumeFromPause: () => void;
  onEndFromPause: () => void;
  onModifyFromPause: () => void;


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
  /**
   * Quick Camera 1~6 — 주행 중에만 Account 왼쪽. null/undefined 이면 미렌더(CSS 숨김 금지).
   */
  quickCamera?: {
    active: 1 | 2 | 3 | 4 | 5 | 6 | null;
    onSelect: (n: 1 | 2 | 3 | 4 | 5 | 6) => void;
    onSelectFlat: (mode: Camera1Mode) => void;
    /** 1번 순환 상태 — 버튼에 작은 표식(지시07·20260924-지시01: 4단) */
    camera1Mode?: Camera1Mode;
    enable3D?: boolean;
    terrainFallback?: boolean;
    onEnable3D?: (enabled: boolean) => void;
  } | null;
  /**
   * Outdoors/Satellite 토글 + 줌 + − — 카메라 유무와 무관하게 우상단 한 줄
   * (QC 와 계정 사이 · idle 이면 계정 바로 왼쪽). 지시66: 확대가 축소보다 앞.
   */
  mapControls?: {
    styleLabel: string;
    styleAriaLabel: string;
    styleToggleDisabled?: boolean;
    onToggleStyle: () => void;
    onZoomOut: () => void;
    onZoomIn: () => void;
    zoomOutDisabled: boolean;
    zoomInDisabled: boolean;
  } | null;
  /** 순위판은 오른쪽 반달 핸들이 연다. 칩은 우상단에 두지 않는다. */
  leaderboardGlanceChip?: ReactNode;
  leaderboardGlancePanel?: ReactNode;
  rideMoments?: Omit<RideMomentInput, "interval"> & { soundEnabled: boolean } | null;
};

/** TC 지표 캡슐 셀 — 라벨 위·값 아래 (참조 TopHud) */
/**
 * `variant` 는 셀의 **고정 폭**을 고르는 열쇠다(2026-09-17 Chief). 값 글자 수가 바뀌면
 * (`9.9`→`10.0`, `03:58`→`04:02`) 셀이 늘었다 줄었다 하면서 오른쪽 계기가 통째로
 * 밀리고 당겨졌다 — 주행 중 눈이 같은 자리에서 같은 값을 못 찾는다.
 * `tabular-nums` 는 **같은 자릿수**만 맞춰 주므로 이것만으로는 부족하다.
 */
function RoutePreviewElevationCell({ elevation }: { elevation: RoutePreviewElevationHud }) {
  const value = elevation.status === "loading" ? "…" : "—";
  const title =
    elevation.status === "ready"
      ? `고도 ${elevation.startM}m 에서 ${elevation.endM}m`
      : elevation.status === "loading"
        ? "고도 불러오는 중"
        : elevation.status === "error"
          ? elevation.message
          : "고도 데이터 없음";
  return (
    <span
      className="hud-metrics__cell hud-metrics__cell--w-speed hud-metrics__cell--elevation-preview"
      title={title}
      role={elevation.status === "loading" ? "status" : undefined}
      aria-busy={elevation.status === "loading" ? true : undefined}
    >
      <span className="hud-metrics__label">고도</span>
      <span className="hud-metrics__value hud-metrics__value--elevation">
        {elevation.status === "ready" ? (
          <>
            {elevation.startM}
            <span className="hud-metrics__elevation-arrow" aria-hidden> → </span>
            {elevation.endM}
            <span className="hud-metrics__cell-unit">m</span>
          </>
        ) : (
          <span className="hud-metrics__elevation-state">{value}</span>
        )}
      </span>
    </span>
  );
}

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
 * - 메뉴는 TL Trail 메뉴(Trail·경로 주행), TR 사용자 정보로 분리. HUD 는 트리거만 들고 시트 자체는 외부에서 렌더.
 */
export function MapHud(props: MapHudProps) {
  const {
    visible = true,
    stage,
    onOpenMenu,
    menuOpen,
    onGoTrailhead,
    account,
    onOpenUserInfo,
    userInfoOpen,
    onOpenSignedOutAuth,
    authGateVisualDismissed = false,
    coachData,
    coachLineEnabled,
    metrics,
    onClearPins,
    routeError,
    ridePresence,
    weatherHint,
    conquestLiveMeters,
    conquestAllOwnedHint,
    quickCamera = null,
    mapControls = null,
    leaderboardGlanceChip = null,
    leaderboardGlancePanel = null,
    rideMoments = null,
  } = props;
  void leaderboardGlanceChip;

  const riding = stage === "riding";
  const paused = stage === "paused";
  const activeRide = riding || paused;
  const isGate =
    stage === "gate-nickname" || (stage === "gate" && !authGateVisualDismissed);
  const isSummary = stage === "summary";

  // 트리거 노출 정책: gate/summary 가 아닌 동안 항상 보임.
  /*
   * 「새 도로」 펄스 — 값이 바뀔 때마다 터지는 게 아니라, **새 도로를 먹고 있는 동안**
   * 내 위치 마커와 같은 박자로 뛴다(2026-09-17 Chief).
   * 종전엔 `key={conquestLiveMeters}` 로 값마다 요소를 갈아끼워 0.35s 팝을 다시 틀었다 —
   * 빠르게 달릴수록 갱신이 잦아 주기가 짧아지고 촐랑거렸다. 펄스가 아니라 갱신 알림이었다.
   * 위상은 마커와 같은 격자에 못 박는다(lib/ride/ridePulse.ts). 지연값은 켜지는 순간 한 번만
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
  /** 게이트·요약이 아닐 때 상시 — 카메라 유무와 무관 */
  const showMapControls = Boolean(mapControls) && !isGate && !isSummary;
  /*
   * 2026-09-16: 우상단에서 센서 칩이 완전히 빠졌다. RouteDock 이 `idle` 을 포함한
   * 모든 주행 가능 stage 에서 보이므로 칩은 항상 dock 이 그린다(`lib/route/sensorChipSlot`).
   * 여기 남는 것은 계정·로그인 칩뿐이고, `cadence` 는 **RouteDock 으로만** 간다.
   */
  const showTopRight =
    showAccount ||
    showSignedOutAuth ||
    Boolean(quickCamera) ||
    showMapControls;
  const momentEvent = useRideMoments(
    {
      status: rideMoments?.status ?? "idle",
      elapsedMs: rideMoments?.elapsedMs ?? 0,
      routeMeters: rideMoments?.routeMeters ?? 0,
      traveledMeters: rideMoments?.traveledMeters ?? 0,
      waypointMeters: rideMoments?.waypointMeters ?? [],
      interval: props.rideInterval ?? null,
      intervalRunKey: rideMoments?.intervalRunKey ?? null,
      newRoadKm: rideMoments?.newRoadKm ?? null,
      ended: rideMoments?.ended ?? null,
    },
    Boolean(rideMoments?.soundEnabled),
    Boolean(props.intervalTtsEnabled),
  );
  const showMetrics =
    metrics !== null &&
    !isGate &&
    !isSummary &&
    (riding || paused || metrics.mode === "route-preview");
  const intervalCoachingActive = props.rideInterval != null && props.rideInterval.phase !== "complete";
  const showCoach = Boolean(momentEvent && (!intervalCoachingActive || momentEvent.kind.startsWith("interval"))) || (!intervalCoachingActive && coachLineEnabled && coachData !== null && (riding || paused));
  const showMc = stage === "setup" && Boolean(routeError);

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
  const coachTipKo = momentEvent
    ? momentEvent.coach
    : coachData != null
      ? coachingTipDisplayKo(
          (coachData as CoachingData & { tipId?: string }).tipId,
          coachData.tip,
        )
      : "";

  if (!visible) return null;

  return (
    <div
      className={`map-hud${activeRide ? " map-hud--active-ride" : ""}`}
      aria-label="라이딩 HUD"
    >
      {showMenuTrigger ? (
        <button
          type="button"
          className="map-hud__a11y-trigger map-hud__a11y-trigger--menu"
          onClick={onOpenMenu}
          aria-label="Trail 메뉴"
          aria-expanded={menuOpen}
          title="Trail 메뉴"
        >
          Trail 메뉴
        </button>
      ) : null}

      {showMenuTrigger || (showMetrics && metrics) ? (
        <div className="map-hud__tl">
          <div className="map-hud__tl-row">
            {showMetrics && metrics ? (
              <div className="map-hud__tl-metrics">
                <div
                  className={`hud-metrics${metrics.mode === "route-preview" ? " hud-metrics--route-preview" : ""}`}
                >
                  <div className="hud-metrics__capsule" role="group" aria-label="주행 지표">
                    {metrics.mode === "route-preview" ? (
                      <>
                        <HudMetricCell
                          label="경로"
                          value={metrics.distanceKm}
                          unit="km"
                          hero
                          variant="distance"
                        />
                        <span className="hud-metrics__divider" aria-hidden />
                        <RoutePreviewElevationCell elevation={metrics.elevation} />
                      </>
                    ) : null}
                    {metrics.mode === "ride" && metrics.routeTotalKm ? (
                      <span
                        className={`hud-metrics__cell hud-metrics__cell--hero hud-metrics__cell--w-distance${`${metrics.cumulativeKm}/${metrics.routeTotalKm}`.length > 11 ? " hud-metrics__cell--long-distance" : ""}`}
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
                    ) : metrics.mode === "ride" ? (
                      <HudMetricCell label="거리" value={metrics.distanceKm} unit="km" hero variant="distance" />
                    ) : null}
                    {metrics.mode === "ride" ? (
                      <>
                    <HudMetricCell label="시간" value={metrics.elapsed} variant="time" />
                    <HudMetricCell label="속도" value={String(metrics.speedKmh)} unit="km/h" variant="speed" />
                    {(riding || paused) && conquestLiveMeters != null ? (
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
                    ) : (riding || paused) ? (
                      <HudMetricCell label="새 도로" value="—" variant="speed" />
                    ) : null}
                    <HudMetricCell label="평균" value={metrics.avgKmh} unit="km/h" variant="speed" />
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
          {activeRide && props.rideInterval ? <RideIntervalHud view={props.rideInterval} paused={paused} cadenceRpm={props.intervalCadenceRpm ?? null} /> : null}
          {paused ? (
            <p className="map-hud__paused-banner" role="status">잠깐 멈췄어요</p>
          ) : null}
        </div>
      ) : null}

      {/* 우상단 — [시점][야외 + −]  [순위·계정]. 센서 칩은 RouteDock 이 소유한다. 지시66·98 */}
      {showTopRight ? (
        <div className="map-hud__tr">
          {quickCamera ? (
            <CameraViewMenu
              enable3D={quickCamera.enable3D}
              terrainFallback={quickCamera.terrainFallback}
              onEnable3D={quickCamera.onEnable3D}
              active={quickCamera.active}
              camera1Mode={quickCamera.camera1Mode}
              onSelect={quickCamera.onSelect}
              onSelectFlat={quickCamera.onSelectFlat}
            />
          ) : null}

          {showMapControls && mapControls ? (
            <div
              className="hud-ride-map-controls"
              role="group"
              aria-label="맵 제어"
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="hud-ride-map-controls__style"
                aria-label={mapControls.styleAriaLabel}
                title={mapControls.styleAriaLabel}
                disabled={mapControls.styleToggleDisabled}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={mapControls.onToggleStyle}
              >
                <svg
                  className="hud-ride-map-controls__style-icon"
                  data-map-style={mapControls.styleLabel === "위성" ? "satellite" : "outdoors"}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  {mapControls.styleLabel === "위성" ? (
                    <>
                      <path d="m13 7-4-4-6 6 4 4m10-2 4 4-6 6-4-4M8 12l4 4 6-6-4-4Z" />
                      <path d="m16 8 3-3M9 21a6 6 0 0 0-6-6m0 6h.01" />
                    </>
                  ) : (
                    <>
                      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
                      <path d="M9 3v15m6-12v15" />
                    </>
                  )}
                </svg>
              </button>
              <button
                type="button"
                className="hud-ride-map-controls__zoom"
                aria-label="줌 확대"
                title="줌 확대"
                disabled={mapControls.zoomInDisabled}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={mapControls.onZoomIn}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 10h12M10 4v12" /></svg>
              </button>
              <button
                type="button"
                className="hud-ride-map-controls__zoom"
                aria-label="줌 축소"
                title="줌 축소"
                disabled={mapControls.zoomOutDisabled}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={mapControls.onZoomOut}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 10h12" /></svg>
              </button>
            </div>
          ) : null}

          {(showAccount && account) || showSignedOutAuth ? (
            <div className="map-hud__service-actions" role="group" aria-label="서비스 기능">
              {showAccount && account ? (
                <button
                  type="button"
                  className={`hud-account ${account.isGuest ? "hud-account--guest" : ""}`}
                  aria-label="사용자 정보"
                  aria-expanded={userInfoOpen}
                  title="사용자 정보"
                  onClick={onOpenUserInfo}
                >
                  <span className="hud-account__text">
                    <span className="hud-account__name">{account.label}</span>
                  </span>
                </button>
              ) : null}

              {showSignedOutAuth ? (
                <button
                  type="button"
                  className="hud-signin-pill"
                  aria-label="로그인 또는 게스트로 시작"
                  title="로그인"
                  onClick={onOpenSignedOutAuth}
                >
                  로그인
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {leaderboardGlancePanel}

      {/* BC 슬롯: 코칭 라인(라이딩 중). */}
      {showCoach ? (
        <div className="map-hud__bc">
          {showCoach && (momentEvent || coachData) ? (
            <div
              className={`hud-coach hud-coach--banner${momentEvent ? " hud-coach--moment" : ""}`}
              data-moment={momentEvent?.kind ?? undefined}
              role="status"
              aria-live="polite"
            >
              <span className="hud-coach__tip">{coachTipKo}</span>
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

        </div>
      ) : null}

      {/*
        우하단 주행 FAB(일시정지·종료·재개)은 2026-09-28 Chief 지시로 제거했다 —
        RouteDock 헤더의 주행 제어(Go·일시정지·종료)와 같은 버튼이 두 벌이었다.
        같은 자리에 있던 첫 화면 안내 칩(「MENU → 입문 경로」)도 함께 뺐다: 게이트가
        `showMainFab`(=riding) 이라 `idle` 조건과 영영 겹치지 않아 표시된 적이 없었고,
        살려 놓으면 라벨의 「입문」이 Trail 메뉴의 「입문」 탭과 셀렉터에서 겹친다.
      */}
    </div>
  );
}

import type { CoachingData } from "../../lib/coachTypes";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import type { CadenceHudState } from "../../lib/cadenceSensorUi";
import { CadenceHudChip } from "./CadenceHudChip";
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
  /** `courseActivity` aggregate 한 줄(지금 N명 · 최근 7일 등) */
  courseActivityHudLine?: string | null;
};

/** HUD 칩이 필요한 최소 센서 상태 + 상세 설정 열기 */
export type MapHudCadence = {
  state: CadenceHudState;
  open: boolean;
  onOpen: () => void;
};

export type MapHudProps = {
  stage: RideUiStage;

  // TL — 브랜드 마크 = 좌측 Trail 메뉴(Trail·경로 주행) 트리거
  onOpenMenu: () => void;
  menuOpen: boolean;
  /** HUD 접속 패널에서 Trailhead로 복귀(주행 중이 아닐 때만). Trail 안에 있을 때만 노출. */
  onGoTrailhead?: () => void;
  onOpenPlaceSearch: () => void;
  placeSearchOpen: boolean;

  // TR — 케이던스 센서 칩 + 사용자 정보 시트 트리거(아바타)
  /** null 이면 칩 미표시. 상태 표시만 담고 액션은 상세 설정이 소유한다 */
  cadence: MapHudCadence | null;
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
        /** 경로 대비 누적 진행률 0~100. routeTotalKm 과 함께만 표시 */
        routeProgressPct: number | null;
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
  /** Conquest — 이번 주행에서 실시간으로 획득한 신규 도로 미터(낙관). 0/null=비표시 */
  conquestLiveMeters?: number | null;
  /** idle 단계 첫 진입 안내 문구 */
  idleHintMessage?: string;
};

/** TC 지표 캡슐 셀 — 라벨 위·값 아래 (참조 TopHud) */
function HudMetricCell({
  label,
  value,
  unit,
  hero = false,
}: {
  label: string;
  value: string;
  unit?: string;
  hero?: boolean;
}) {
  return (
    <span
      className={`hud-metrics__cell${hero ? " hud-metrics__cell--hero" : ""}`}
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
    onOpenPlaceSearch,
    placeSearchOpen,
    cadence,
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
    idleHintMessage = "MENU → 입문 경로",
  } = props;

  const riding = stage === "riding";
  const paused = stage === "paused";
  const idle = stage === "idle";
  const isGate =
    stage === "gate-nickname" || (stage === "gate" && !authGateVisualDismissed);
  const isSummary = stage === "summary";

  // 트리거 노출 정책: gate/summary 가 아닌 동안 항상 보임.
  const showMenuTrigger = !isGate && !isSummary;
  // 접속·동행 현황은 HUD 가 단독으로 소유. MENU(Trail 섹션=참가·공개 설정 행동) 열린 동안은
  // 가림·중복을 피하려 숨긴다.
  const showRidePresence = ridePresence != null && !menuOpen;
  const showAccount = account !== null && !isGate && !isSummary;
  const showSignedOutAuth =
    !isGate && !isSummary && account === null && typeof onOpenSignedOutAuth === "function";
  // 센서 상태는 계정 데이터에 종속되지 않는다 — signed-out 맵 모드에서도 로그인 칩 왼쪽에 남는다.
  const showCadenceChip = cadence !== null && !isGate && !isSummary;
  const showTopRight = showCadenceChip || showAccount || showSignedOutAuth;
  const showMapViewTrigger = !isGate && !isSummary;
  const showMetrics =
    metrics !== null &&
    !isGate &&
    !isSummary &&
    (riding || paused || metrics.mode === "route-preview");
  const showCoach = coachLineEnabled && coachData !== null && (riding || paused);
  const showMainFab = riding;
  const showMc = paused || (stage === "setup" && Boolean(routeError));

  return (
    <div className="map-hud" aria-label="라이딩 HUD">
      {paused ? <div className="map-hud__scrim" aria-hidden /> : null}

      {showMenuTrigger ? (
        <div className="map-hud__tl">
          <div className="map-hud__tl-stack">
            <div className="map-hud__tl-actions">
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
              <button
                type="button"
                className={`hud-place-search-btn ${placeSearchOpen ? "is-active" : ""}`}
                onClick={onOpenPlaceSearch}
                aria-label="지명 검색"
                aria-expanded={placeSearchOpen}
                title="Place search"
              >
                <span className="hud-place-search-btn__icon" aria-hidden>
                  ⌕
                </span>
                <span className="hud-place-search-btn__label">지명</span>
              </button>
            </div>
            {weatherHint ? (
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
                ridePresence.courseActivityHudLine ? (
                  <div className="hud-ride-presence__block">
                    <div className="hud-ride-presence__head">
                      <span className="hud-ride-presence__tag">동행</span>
                      <span className="hud-ride-presence__room" title={ridePresence.courseTitle ?? ""}>
                        {ridePresence.courseTitle ?? "경로"}
                      </span>
                    </div>
                    {ridePresence.courseActivityHudLine ? (
                      <p className="hud-ride-presence__activity">{ridePresence.courseActivityHudLine}</p>
                    ) : null}
                    {ridePresence.coursePeerNames.length > 0 ? (
                      <ul className="hud-ride-presence__list">
                        {ridePresence.coursePeerNames.map((name, i) => (
                          <li key={`${name}-${i}`}>{name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hud-ride-presence__empty">다른 라이더 없음</p>
                    )}
                  </div>
                ) : null}
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}

      {showMetrics && metrics ? (
        <div className="map-hud__tc">
          <div
            className={`hud-metrics${metrics.mode === "route-preview" ? " hud-metrics--route-preview" : ""}`}
          >
            {(riding || paused) && ridePresence ? (
              <span
                className="hud-metrics__trail hud-metrics__chip hud-metrics__chip--trail"
                title={ridePresence.trailId}
              >
                {ridePresence.trailLabel}
              </span>
            ) : null}
            <div className="hud-metrics__capsule" role="group" aria-label="주행 지표">
              {/* 주행 중 — 오늘(세션) 거리 + 경로 누적 위치·진행률 병기(§9.5.5 단위7·U4) */}
              {metrics.mode === "ride" && metrics.routeTotalKm ? (
                <span
                  className="hud-metrics__cell hud-metrics__cell--hero hud-metrics__cell--distance-dual"
                  title="오늘 거리 / 경로 누적 위치·진행률"
                >
                  <span className="hud-metrics__label">거리</span>
                  <span
                    className="hud-metrics__value hud-metrics__value--today"
                    aria-label="오늘 거리"
                  >
                    {metrics.distanceKm}
                    <span className="hud-metrics__cell-unit">km</span>
                  </span>
                  <span
                    className="hud-metrics__value hud-metrics__value--cumulative"
                    aria-label="누적 진행"
                  >
                    {metrics.cumulativeKm}
                    <span className="hud-metrics__value-total">
                      {" / "}
                      {metrics.routeTotalKm}
                    </span>
                    {metrics.routeProgressPct != null ? (
                      <span className="hud-metrics__value-pct">
                        {" "}
                        ({metrics.routeProgressPct}%)
                      </span>
                    ) : null}
                    <span className="hud-metrics__cell-unit">km</span>
                  </span>
                </span>
              ) : (
                <HudMetricCell label="거리" value={metrics.distanceKm} unit="km" hero />
              )}
              <span className="hud-metrics__divider" aria-hidden />
              <HudMetricCell label="시간" value={metrics.elapsed} />
              <span className="hud-metrics__divider" aria-hidden />
              <HudMetricCell label="평균" value={metrics.avgKmh} unit="km/h" />
              <span className="hud-metrics__divider" aria-hidden />
              <HudMetricCell label="속도" value={String(metrics.speedKmh)} unit="km/h" />
              {/* 50m 미만은 「+0.0km」로 보여 미표시 — 정복 축은 발생 시에만(0 미표시 원칙) */}
              {(riding || paused) && (conquestLiveMeters ?? 0) >= 50 ? (
                <>
                  <span className="hud-metrics__divider" aria-hidden />
                  <span
                    key={conquestLiveMeters}
                    className="hud-metrics__cell hud-metrics__cell--conquest"
                    title="이번 주행에서 획득한 새 도로"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="hud-metrics__label">새 도로</span>
                    <span className="hud-metrics__value">
                      +{((conquestLiveMeters ?? 0) / 1000).toFixed(1)}
                      <span className="hud-metrics__cell-unit">km</span>
                    </span>
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* 우상단은 하나의 액션 행 — 센서 칩이 계정/로그인 칩 왼쪽에 온다(절대 위치 겹침 금지) */}
      {showTopRight ? (
        <div className="map-hud__tr">
          {showCadenceChip && cadence ? (
            <CadenceHudChip
              state={cadence.state}
              riding={riding || paused}
              open={cadence.open}
              onOpen={cadence.onOpen}
            />
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

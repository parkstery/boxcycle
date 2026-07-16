import type { CoachingData } from "../../lib/coachTypes";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import "./MapHud.css";

export type AccountChipState = {
  initial: string;
  isGuest: boolean;
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

export type MapHudProps = {
  stage: RideUiStage;

  // TL — 브랜드 마크 = 좌측 Trail 메뉴(Trail·경로 주행) 트리거
  onOpenMenu: () => void;
  menuOpen: boolean;
  /** HUD 접속 패널에서 Trailhead로 복귀(주행 중이 아닐 때만). Trail 안에 있을 때만 노출. */
  onGoTrailhead?: () => void;
  onOpenPlaceSearch: () => void;
  placeSearchOpen: boolean;

  // TR — 사용자 정보 시트 트리거(아바타)
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
        distanceKm: string;
        avgKmh: string;
        speedKmh: number;
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
  /** 줌 축소 시 월드 레이어 한 줄(집계 문서 기반, 저빈도 갱신) */
  worldActivityHint?: string | null;
  /** 라이브 어스 — 주행 지역 현재 날씨·밤낮 한 줄(Open-Meteo, 세션 중만) */
  weatherHint?: string | null;
  /** 마일리지(누적 운동 이력) — idle 단계 한 줄(서버 집계, users/{uid}.mileageTotalMeters) */
  mileageHint?: string | null;
  /** Conquest — 이번 주행에서 실시간으로 획득한 신규 도로 미터(낙관). 0/null=비표시 */
  conquestLiveMeters?: number | null;
  /** idle 단계 첫 진입 안내 문구 */
  idleHintMessage?: string;
};

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
    worldActivityHint,
    weatherHint,
    mileageHint,
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
            {worldActivityHint ? (
              <p className="hud-world-hint" role="status">
                {worldActivityHint}
              </p>
            ) : null}
            {weatherHint ? (
              <p className="hud-world-hint hud-weather-hint" role="status" title="주행 지역의 현재 날씨(Open-Meteo)">
                {weatherHint}
              </p>
            ) : null}
            {mileageHint ? (
              <p className="hud-world-hint hud-mileage-hint" role="status">
                {mileageHint}
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
            <span className="hud-metrics__chip hud-metrics__chip--hero" title="Distance">
              {metrics.distanceKm}
              <span className="hud-metrics__unit">km</span>
            </span>
            <span className="hud-metrics__chip" title="Elapsed time">
              {metrics.elapsed}
            </span>
            <span className="hud-metrics__chip" title="Average speed">
              {metrics.avgKmh}
              <span className="hud-metrics__unit">avg</span>
            </span>
            <span className="hud-metrics__chip" title="Current speed">
              {metrics.speedKmh}
              <span className="hud-metrics__unit">km/h</span>
            </span>
            {/* 50m 미만은 「+0.0km」로 보여 미표시 — 정복 축은 발생 시에만(0 미표시 원칙) */}
            {(riding || paused) && (conquestLiveMeters ?? 0) >= 50 ? (
              <span
                key={conquestLiveMeters}
                className="hud-metrics__chip hud-metrics__chip--conquest"
                title="이번 주행에서 획득한 새 도로"
                role="status"
                aria-live="polite"
              >
                🏴 +{((conquestLiveMeters ?? 0) / 1000).toFixed(1)}
                <span className="hud-metrics__unit">km</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {showAccount && account ? (
        <div className="map-hud__tr">
          <button
            type="button"
            className={`hud-avatar ${account.isGuest ? "hud-avatar--guest" : ""}`}
            aria-label="사용자 정보"
            aria-expanded={userInfoOpen}
            title="Account"
            onClick={onOpenUserInfo}
          >
            {account.initial}
          </button>
        </div>
      ) : null}

      {showSignedOutAuth ? (
        <div className="map-hud__tr">
          <button
            type="button"
            className="hud-signin-pill"
            aria-label="로그인 또는 게스트로 시작"
            title="Sign in"
            onClick={onOpenSignedOutAuth}
          >
            로그인
          </button>
        </div>
      ) : null}

      {/* BC 슬롯: 코칭 라인(라이딩 중) + 맵 뷰 트리거(항상). 둘은 위·아래로 쌓임. */}
      {(showCoach || showMapViewTrigger) ? (
        <div className="map-hud__bc">
          {showCoach && coachData ? (
            <div className="hud-coach" role="status" aria-live="polite">
              <span className="hud-coach__tip">{coachData.tip.replace(/\s*\(R\d+\)\s*$/, "")}</span>
              <span className="hud-coach__r">{coachData.resistance.replace("Resistance ", "R")}</span>
            </div>
          ) : null}
          {showMapViewTrigger ? (
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

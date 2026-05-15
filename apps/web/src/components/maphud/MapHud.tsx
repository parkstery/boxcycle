import type { CoachingData } from "../../lib/coachTypes";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import "./MapHud.css";

export type AccountChipState = {
  initial: string;
  isGuest: boolean;
};

/** 좌상단: 로비 방 + 접속자 / 입문 코스 동행 이름 */
export type MapHudRidePresence = {
  lobbyEnabled: boolean;
  roomId: string;
  lobbyMembers: { key: string; display: string; isSelf: boolean; active: boolean }[];
  lobbyError: string | null;
  courseTitle: string | null;
  coursePeerNames: string[];
};

export type MapHudProps = {
  stage: RideUiStage;

  // TL — 브랜드 마크 = 좌측 메뉴(경로 주행) 트리거
  onOpenMenu: () => void;
  menuOpen: boolean;

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

  // BL — 핀 진행 칩 / 경로 요약
  pinState: { start: boolean; end: boolean; waypointCount: number };
  routeBrief: { distanceKm: string; durationLabel: string } | null;
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

  /** 로비·코스 동행 요약(없으면 미표시) */
  ridePresence?: MapHudRidePresence | null;
  /** 줌 축소 시 월드 레이어 한 줄(집계 문서 기반, 저빈도 갱신) */
  worldActivityHint?: string | null;
  /** idle 단계 첫 진입 안내 문구 */
  idleHintMessage?: string;
  /** setup 단계(B 여정)·세션당 1회 안내 표시 여부(App 이 sessionStorage 와 상태로 제어) */
  showSetupRouteHint?: boolean;
  onDismissSetupRouteHint?: () => void;
  /** B 여정 안내 문구 (setup 단계) */
  setupRouteHintMessage?: string;
};

/**
 * 8슬롯 글래스 HUD.
 *
 * - 슬롯 자체는 pointer-events: none, 내부 위젯만 다시 활성화 → 빈 영역은 항상 맵 조작 가능.
 * - 메뉴는 3개로 분리: TL 경로 주행, BC 맵 뷰, TR 사용자 정보. HUD 는 트리거만 들고 시트 자체는 외부에서 렌더.
 */
export function MapHud(props: MapHudProps) {
  const {
    stage,
    onOpenMenu,
    menuOpen,
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
    pinState,
    routeBrief,
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
    idleHintMessage = "입문: MENU → 입문 코스 → ▶",
    showSetupRouteHint = false,
    onDismissSetupRouteHint,
    setupRouteHintMessage = "내 경로: 출발·도착까지 찍은 뒤 MENU → 「경로 생성」",
  } = props;

  const riding = stage === "riding";
  const paused = stage === "paused";
  const idle = stage === "idle";
  const isGate =
    stage === "gate-nickname" || (stage === "gate" && !authGateVisualDismissed);
  const isSummary = stage === "summary";

  // 트리거 노출 정책: gate/summary 가 아닌 동안 항상 보임.
  const showMenuTrigger = !isGate && !isSummary;
  const showRidePresence = ridePresence != null;
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
  const showBlPins =
    !riding &&
    !paused &&
    !isSummary &&
    (pinState.start || pinState.end || pinState.waypointCount > 0) &&
    !routeBrief;
  const showBlBrief = !riding && !paused && !isSummary && routeBrief !== null;
  const showMainFab = riding || stage === "ready-to-start";
  const showMc = paused || (stage === "setup" && Boolean(routeError));

  return (
    <div className="map-hud" aria-label="라이딩 HUD">
      {paused ? <div className="map-hud__scrim" aria-hidden /> : null}

      {showMenuTrigger ? (
        <div className="map-hud__tl">
          <div className="map-hud__tl-stack">
            <button
              type="button"
              className={`hud-brand ${menuOpen ? "hud-brand--muted" : ""}`}
              onClick={onOpenMenu}
              aria-label="경로·코스 메뉴"
              aria-expanded={menuOpen}
              title="Route menu"
            >
              <span className="hud-brand__dot" aria-hidden />
              BOXCYCLE
            </button>
            {worldActivityHint ? (
              <p className="hud-world-hint" role="status">
                {worldActivityHint}
              </p>
            ) : null}
            {showRidePresence && ridePresence ? (
              <aside className="hud-ride-presence hud-glass" aria-label="방·동행">
                {ridePresence.lobbyEnabled ? (
                  <div className="hud-ride-presence__block">
                    <div className="hud-ride-presence__head">
                      <span className="hud-ride-presence__tag">접속</span>
                      <span className="hud-ride-presence__room" title={ridePresence.roomId}>
                        방 {ridePresence.roomId}
                      </span>
                    </div>
                    {ridePresence.lobbyError ? (
                      <p className="hud-ride-presence__err" title={ridePresence.lobbyError}>
                        {ridePresence.lobbyError}
                      </p>
                    ) : ridePresence.lobbyMembers.filter((m) => m.active).length > 0 ? (
                      <ul className="hud-ride-presence__list">
                        {ridePresence.lobbyMembers
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
                ridePresence.coursePeerNames.length > 0 ? (
                  <div className="hud-ride-presence__block">
                    <div className="hud-ride-presence__head">
                      <span className="hud-ride-presence__tag">동행</span>
                      <span className="hud-ride-presence__room" title={ridePresence.courseTitle ?? ""}>
                        {ridePresence.courseTitle ?? "코스"}
                      </span>
                    </div>
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
            <span className="hud-metrics__chip" title="Elapsed time">
              {metrics.elapsed}
            </span>
            <span className="hud-metrics__chip" title="Distance">
              {metrics.distanceKm}
              <span className="hud-metrics__unit">km</span>
            </span>
            <span className="hud-metrics__chip" title="Average speed">
              {metrics.avgKmh}
              <span className="hud-metrics__unit">avg</span>
            </span>
            <span className="hud-metrics__chip" title="Current speed">
              {metrics.speedKmh}
              <span className="hud-metrics__unit">km/h</span>
            </span>
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

      {showBlPins ? (
        <div className="map-hud__bl">
          <div className="hud-pin-chip" aria-label="출발·도착·경과 진행">
            <span className="hud-pin-chip__dots" aria-hidden>
              <span className={`hud-pin-chip__dot ${pinState.start ? "is-on" : ""}`} />
              <span className={`hud-pin-chip__dot ${pinState.end ? "is-on" : ""}`} />
            </span>
            <span className="hud-pin-chip__label">
              {pinState.start && pinState.end ? "준비" : pinState.start ? "도착?" : "출발?"}
              {pinState.waypointCount > 0 ? (
                <span className="hud-pin-chip__via"> · 경과 {pinState.waypointCount}</span>
              ) : null}
            </span>
            {(pinState.start || pinState.end || pinState.waypointCount > 0) && (
              <button
                type="button"
                className="hud-pin-chip__clear"
                onClick={onClearPins}
                aria-label="핀 초기화"
                title="Clear pins"
              >
                ✕
              </button>
            )}
          </div>
          {stage === "setup" &&
          showSetupRouteHint &&
          typeof onDismissSetupRouteHint === "function" ? (
            <button
              type="button"
              className="hud-setup-route-hint"
              onClick={onDismissSetupRouteHint}
              title="안내 닫기(이 브라우저 탭에서는 다시 안 띄움)"
            >
              {setupRouteHintMessage}
            </button>
          ) : null}
        </div>
      ) : null}

      {showBlBrief && routeBrief ? (
        <div className="map-hud__bl">
          <div className="hud-brief" aria-label="경로 요약">
            <strong>{routeBrief.distanceKm} km</strong>
            <small>{routeBrief.durationLabel}</small>
          </div>
          {!riding && !paused ? (
            <button
              type="button"
              className="hud-pin-chip__clear hud-chip hud-chip--mute"
              onClick={onClearPins}
              aria-label="경로 초기화"
              title="Reset route"
            >
              ↺ 변경
            </button>
          ) : null}
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

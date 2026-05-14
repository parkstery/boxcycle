import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { RouteProfile } from "../services/mapboxDirections";
import { formatDuration } from "../services/mapboxDirections";
import type { PublishedPublicCourseSummary } from "../lib/firestoreCourses";
import type { BleCrankRpmUiState } from "../hooks/useBleCrankRpm";
import type { RideSessionStatus } from "../hooks/useVirtualRideSession";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";
import { SAVED_ROUTE_NAME_MAX, validateSavedRouteName } from "../lib/firestoreSavedRoutes";
import { SavedRoutesPanel } from "./SavedRoutesPanel";
import { AdminPublicRouteQueue } from "./AdminPublicRouteQueue";
import "./RideRoutePanel.css";

export type FollowMode =
  | "free"
  | "keep"
  | "north"
  | "rear30"
  | "front30"
  | "rightFlat"
  | "leftFlat";

type RideRoutePanelProps = {
  startLabel: string;
  endLabel: string;
  /** 경과지 좌표 라벨(순서대로, 최대 3) */
  waypointLabels: string[];
  profile: RouteProfile;
  onProfile: (p: RouteProfile) => void;
  routeSummary: string;
  routeLoading: boolean;
  onGenerateRoute: () => void;
  /** 공식 코스를 불러온 뒤에는 출발·도착 맞춤 「경로 생성」을 막음 */
  officialCourseActive?: boolean;
  hasRoute: boolean;
  speedKmh: number;
  onSpeedKmh: (n: number) => void;
  sessionStatus: RideSessionStatus;
  basicSharedHubs: { id: string; title: string }[];
  basicActiveHubCourseId: string | null;
  basicStartLoading: boolean;
  basicStartHubJoined: boolean;
  /** Firestore 사용 시 퍼블릭 코스 목록 조회 가능 */
  officialCourseCatalogAvailable: boolean;
  publishedPublicCourses: PublishedPublicCourseSummary[];
  publishedPublicCoursesLoading: boolean;
  publishedPublicCoursesError: string | null;
  authGuest: boolean;
  onEnterBasicHub: (courseId: string) => void;
  onLeaveBasicHub: () => void;
  /** 사용자 경로 관련 (= 기존 「저장된 경로」 라벨 변경) */
  savedRoutes: SavedRoute[];
  savedRoutesLoading: boolean;
  /** 「내 경로로 저장」에서 이름 확정·저장 시에만 DB·로컬 목록에 반영 */
  onSaveCurrentRoute: (name: string) => Promise<void> | void;
  onLoadSavedRoute: (route: SavedRoute) => void;
  onRenameSavedRoute: (route: SavedRoute, newName: string) => Promise<void> | void;
  onDeleteSavedRoute: (route: SavedRoute) => Promise<void> | void;
  /** 목적지 도달 시 3초간 표시되는 토스트. App.tsx 에서 자동으로 false 로 돌아옴. */
  arrivalToastVisible: boolean;
  /** ad-hoc(저장 안 한 채) 주행이 직전에 종료되어 「사용자 경로로 저장」 액션이 가능한 상태인지 */
  adhocSaveAvailable: boolean;
  /** ad-hoc 경로를 새 사용자 경로로 저장하면서 즉시 완주 격상 */
  onSaveAdhocAsUserRoute: (name: string) => Promise<void> | void;
  /** ad-hoc 저장 안내(토스트 액션) 닫기 */
  onDismissAdhocSave: () => void;
  /** 공개 경로 심사자 — 설정 시 「심사」 탭 표시 */
  isPublicRouteReviewer?: boolean;
  publicRouteReviewUser?: User | null;
  publicRouteReviewQueueCount?: number;
  onPublicRouteReviewQueueChanged?: () => void;
  pendingPublicRouteIds?: ReadonlySet<string>;
  onOpenPublicRequest?: (route: SavedRoute) => void;
  /** 코칭 TTS(Web Speech) */
  rideTtsEnabled: boolean;
  onRideTtsEnabled: (enabled: boolean) => void;
  /** 주행 BGM(세션 중 재생) */
  rideBgmEnabled: boolean;
  onRideBgmEnabled: (enabled: boolean) => void;
  /** 화면 상단 코칭 배너 */
  rideCoachingBanner: boolean;
  onRideCoachingBanner: (enabled: boolean) => void;
  /** Open-Meteo 고도 프로필 로딩(코칭용) */
  rideElevationProfileLoading: boolean;
  /** BGM 재생 URL 카탈로그 존재(내장·환경변수) */
  rideBgmCatalogConfigured: boolean;
  /** Web Bluetooth CSC 케이던스 — Chromium 등에서만 표시 */
  bleCadence?: {
    uiState: BleCrankRpmUiState;
    crankRpm: number | null;
    deviceLabel: string | null;
    errorMessage: string | null;
    onConnect: () => void | Promise<void>;
    onDisconnect: () => void;
  };
};

type Tab = "route" | "saved" | "publicReview";

type OfficialCourseSegment = "intro" | "public" | "event";

function profileLabelKo(p: RouteProfile): string {
  if (p === "walking") return "도보";
  if (p === "driving") return "자동차";
  return "자전거";
}

export function RideRoutePanel(props: RideRoutePanelProps) {
  const [tab, setTab] = useState<Tab>("route");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDraft, setSaveDraft] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** ad-hoc 저장 인라인 입력 폼 상태 — 토스트 액션이 열어줌 */
  const [adhocSaveOpen, setAdhocSaveOpen] = useState(false);
  const [adhocSaveDraft, setAdhocSaveDraft] = useState("");
  const [adhocSaveBusy, setAdhocSaveBusy] = useState(false);
  const [adhocSaveError, setAdhocSaveError] = useState<string | null>(null);
  const [officialSegment, setOfficialSegment] = useState<OfficialCourseSegment>("intro");

  useEffect(() => {
    if (tab === "publicReview" && !props.isPublicRouteReviewer) {
      setTab("route");
    }
  }, [tab, props.isPublicRouteReviewer]);

  const canSaveRoute =
    props.sessionStatus === "idle" && props.hasRoute && !props.routeLoading;

  function openSave() {
    setSaveError(null);
    setSaveDraft("");
    setSaveOpen(true);
  }
  function cancelSave() {
    setSaveOpen(false);
    setSaveDraft("");
    setSaveError(null);
  }
  async function commitSave() {
    if (saveBusy) return;
    let normalizedName: string;
    try {
      normalizedName = validateSavedRouteName(saveDraft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSaveBusy(true);
    setSaveError(null);
    try {
      await props.onSaveCurrentRoute(normalizedName);
      setSaveOpen(false);
      setSaveDraft("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }

  async function commitAdhocSave() {
    if (adhocSaveBusy) return;
    let normalizedName: string;
    try {
      normalizedName = validateSavedRouteName(adhocSaveDraft);
    } catch (e) {
      setAdhocSaveError(e instanceof Error ? e.message : String(e));
      return;
    }
    setAdhocSaveBusy(true);
    setAdhocSaveError(null);
    try {
      await props.onSaveAdhocAsUserRoute(normalizedName);
      setAdhocSaveOpen(false);
      setAdhocSaveDraft("");
    } catch (e) {
      setAdhocSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdhocSaveBusy(false);
    }
  }

  return (
    <aside className="ride-panel" aria-label="경로 및 라이딩">
      <div className="ride-panel__tabs" role="tablist" aria-label="패널 보기">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "route"}
          className={`ride-panel__tab ${tab === "route" ? "is-active" : ""}`}
          onClick={() => setTab("route")}
        >
          경로
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "saved"}
          className={`ride-panel__tab ${tab === "saved" ? "is-active" : ""}`}
          onClick={() => setTab("saved")}
        >
          내 경로
          {props.savedRoutes.length > 0 ? (
            <span className="ride-panel__tab-badge">{props.savedRoutes.length}</span>
          ) : null}
        </button>
        {props.isPublicRouteReviewer && props.publicRouteReviewUser ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "publicReview"}
            className={`ride-panel__tab ${tab === "publicReview" ? "is-active" : ""}`}
            onClick={() => setTab("publicReview")}
          >
            심사
            {(props.publicRouteReviewQueueCount ?? 0) > 0 ? (
              <span className="ride-panel__tab-badge">{props.publicRouteReviewQueueCount}</span>
            ) : null}
          </button>
        ) : null}
      </div>

      {tab === "publicReview" && props.publicRouteReviewUser ? (
        <>
          <div className="ride-panel__saved-head">
            <h2 className="ride-panel__h ride-panel__h--inline">공개 심사</h2>
            <button
              type="button"
              className="ride-panel__saved-close"
              aria-label="심사 닫고 경로 화면으로"
              title="경로 화면으로 돌아가기"
              onClick={() => setTab("route")}
            >
              닫기
            </button>
          </div>
          <AdminPublicRouteQueue
            reviewer={props.publicRouteReviewUser}
            onQueueChanged={() => props.onPublicRouteReviewQueueChanged?.()}
          />
          <button
            type="button"
            className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet ride-panel__saved-back"
            onClick={() => setTab("route")}
          >
            경로로
          </button>
        </>
      ) : tab === "saved" ? (
        <>
          <div className="ride-panel__saved-head">
            <h2 className="ride-panel__h ride-panel__h--inline">내 경로</h2>
            <button
              type="button"
              className="ride-panel__saved-close"
              aria-label="사용자 경로 닫고 경로 화면으로 돌아가기"
              title="경로 화면으로 돌아가기"
              onClick={() => setTab("route")}
            >
              닫기
            </button>
          </div>
          <SavedRoutesPanel
            routes={props.savedRoutes}
            loading={props.savedRoutesLoading}
            guestNotice={props.authGuest}
            sessionIdle={props.sessionStatus === "idle"}
            pendingPublicRouteIds={props.pendingPublicRouteIds}
            onOpenPublicRequest={props.onOpenPublicRequest}
            onLoadRoute={(route) => {
              props.onLoadSavedRoute(route);
              setTab("route");
            }}
            onRenameRoute={props.onRenameSavedRoute}
            onDeleteRoute={props.onDeleteSavedRoute}
          />
          <button
            type="button"
            className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet ride-panel__saved-back"
            onClick={() => setTab("route")}
          >
            경로로
          </button>
        </>
      ) : (
        <>
          <div className="ride-panel__official" aria-label="공식 코스">
            <div className="ride-panel__official-head">
              <span className="ride-panel__kicker">공식</span>
              <div className="ride-panel__official-segments" role="tablist" aria-label="공식 코스 종류">
              <button
                type="button"
                role="tab"
                aria-selected={officialSegment === "intro"}
                className={`ride-panel__official-seg ${officialSegment === "intro" ? "is-active" : ""}`}
                onClick={() => setOfficialSegment("intro")}
              >
                입문
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={officialSegment === "public"}
                className={`ride-panel__official-seg ${officialSegment === "public" ? "is-active" : ""}`}
                onClick={() => setOfficialSegment("public")}
              >
                퍼블릭
                {props.publishedPublicCourses.length > 0 ? (
                  <span className="ride-panel__official-seg-badge">{props.publishedPublicCourses.length}</span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={officialSegment === "event"}
                className={`ride-panel__official-seg ${officialSegment === "event" ? "is-active" : ""}`}
                onClick={() => setOfficialSegment("event")}
              >
                이벤트
              </button>
              </div>
            </div>

            {officialSegment === "intro" ? (
          <div className="ride-panel__basic-start" aria-label="입문 상시 코스">
            {props.basicActiveHubCourseId ? (
              <p className="ride-panel__basic-start-active" role="status">
                선택:{" "}
                <strong>
                  {props.basicSharedHubs.find((h) => h.id === props.basicActiveHubCourseId)?.title ??
                    props.basicActiveHubCourseId}
                </strong>
              </p>
            ) : null}
            <div className="ride-panel__basic-start-btns ride-panel__basic-start-btns--grid">
              {props.basicSharedHubs.map((hub, idx) => (
                <button
                  key={hub.id}
                  type="button"
                  className="ride-panel__btn-secondary"
                  disabled={
                    props.routeLoading ||
                    props.basicStartLoading ||
                    props.sessionStatus !== "idle"
                  }
                  title={hub.title}
                  onClick={() => props.onEnterBasicHub(hub.id)}
                >
                  {props.basicStartLoading ? "…" : `${idx + 1}`}
                </button>
              ))}
              {props.basicStartHubJoined ? (
                <button
                  type="button"
                  className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet"
                  disabled={props.basicStartLoading}
                  onClick={() => void props.onLeaveBasicHub()}
                >
                  나가기
                </button>
              ) : null}
            </div>
          </div>

            ) : officialSegment === "public" ? (
              <div className="ride-panel__public-courses" aria-label="퍼블릭 코스">
                {!props.officialCourseCatalogAvailable ? (
                  <p className="ride-panel__public-courses-hint">목록 미연결</p>
                ) : props.publishedPublicCoursesLoading ? (
                  <p className="ride-panel__public-courses-hint">불러오는 중…</p>
                ) : props.publishedPublicCoursesError ? (
                  <p className="ride-panel__public-courses-error" role="alert">
                    목록을 불러오지 못했어요.
                  </p>
                ) : props.publishedPublicCourses.length === 0 ? (
                  <p className="ride-panel__public-courses-hint">아직 등록된 코스 없음</p>
                ) : (
                  <ul className="ride-panel__public-courses-list">
                    {props.publishedPublicCourses.map((c) => (
                      <li key={c.id} className="ride-panel__public-courses-item">
                        <div className="ride-panel__public-courses-meta">
                          <strong className="ride-panel__public-courses-name">{c.title}</strong>
                          <span className="ride-panel__public-courses-sub">
                            {profileLabelKo(c.profile)} · {(c.distanceMeters / 1000).toFixed(2)} km · 예상{" "}
                            {formatDuration(c.durationSec)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="ride-panel__btn-secondary ride-panel__btn-secondary--small"
                          disabled={
                            props.routeLoading ||
                            props.basicStartLoading ||
                            props.sessionStatus !== "idle"
                          }
                          onClick={() => props.onEnterBasicHub(c.id)}
                        >
                          불러오기
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="ride-panel__event-placeholder" aria-label="이벤트 코스">
                <p className="ride-panel__event-placeholder-text">이벤트 코스 (준비 중)</p>
              </div>
            )}
          </div>

          <div className="ride-panel__point-box">
            <div className="ride-panel__point-item">
              <p className="ride-panel__point-label">출발</p>
              <p className="ride-panel__point-value">{props.startLabel}</p>
            </div>
            {props.waypointLabels.map((label, i) => (
              <div key={`wp-${i}-${label}`} className="ride-panel__point-item">
                <p className="ride-panel__point-label">경유 {i + 1}</p>
                <p className="ride-panel__point-value">{label}</p>
              </div>
            ))}
            <div className="ride-panel__point-item">
              <p className="ride-panel__point-label">도착</p>
              <p className="ride-panel__point-value">{props.endLabel}</p>
            </div>
          </div>

          <div className="ride-panel__modes ride-panel__modes--inline">
            <span className="ride-panel__label-inline">수단</span>
            <div className="ride-panel__mode-btns ride-panel__mode-btns--tight">
              <button
                type="button"
                className={`ride-panel__mode ${props.profile === "driving" ? "is-active" : ""}`}
                onClick={() => props.onProfile("driving")}
              >
                차
              </button>
              <button
                type="button"
                className={`ride-panel__mode ${props.profile === "cycling" ? "is-active" : ""}`}
                onClick={() => props.onProfile("cycling")}
              >
                자전거
              </button>
              <button
                type="button"
                className={`ride-panel__mode ${props.profile === "walking" ? "is-active" : ""}`}
                onClick={() => props.onProfile("walking")}
              >
                도보
              </button>
            </div>
          </div>

          <div className="ride-panel__route-action-row">
            <button
              type="button"
              className="ride-panel__btn-primary"
              disabled={
                props.routeLoading ||
                Boolean(props.officialCourseActive)
              }
              title={
                props.officialCourseActive
                  ? "공식 코스를 불러온 상태입니다. 출발지·도착지를 지도에서 바꾼 뒤 맞춤 경로를 만들 수 있습니다."
                  : undefined
              }
              onClick={() => void props.onGenerateRoute()}
            >
              {props.routeLoading ? "경로 계산 중…" : "경로 생성"}
            </button>
            {!saveOpen ? (
              <button
                type="button"
                className="ride-panel__btn-secondary ride-panel__btn-secondary--save-inline"
                disabled={!canSaveRoute}
                onClick={openSave}
              >
                내 경로로 저장
              </button>
            ) : null}
          </div>

          {props.routeSummary.trim() ? (
            <p className="ride-panel__summary" role="status">
              {props.routeSummary}
            </p>
          ) : null}

          {saveOpen ? (
            <div className="ride-panel__save-route">
              <div className="ride-panel__save-route-form">
                <label className="ride-panel__label" htmlFor="ride-panel-save-name">
                  경로 이름
                </label>
                <input
                  id="ride-panel-save-name"
                  className="ride-panel__input"
                  type="text"
                  maxLength={SAVED_ROUTE_NAME_MAX}
                  value={saveDraft}
                  placeholder="예: 한강 코스"
                  onChange={(e) => setSaveDraft(e.target.value)}
                  autoFocus
                />
                {saveError ? (
                  <p className="ride-panel__save-route-error" role="alert">
                    {saveError}
                  </p>
                ) : null}
                <div className="ride-panel__save-route-actions">
                  <button
                    type="button"
                    className="ride-panel__btn-primary ride-panel__btn-primary--small"
                    disabled={saveBusy}
                    onClick={() => void commitSave()}
                  >
                    {saveBusy ? "저장 중…" : "저장"}
                  </button>
                  <button
                    type="button"
                    className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet"
                    disabled={saveBusy}
                    onClick={cancelSave}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="ride-panel__session-block">
            <label className="ride-panel__speed-label" htmlFor="ride-panel-speed-range">
              <span className="ride-panel__kicker">세션</span> 속도 <strong>{props.speedKmh}</strong> km/h
            </label>
            <input
              id="ride-panel-speed-range"
              type="range"
              min={5}
              max={50}
              step={1}
              value={props.speedKmh}
              onChange={(e) => props.onSpeedKmh(Number(e.target.value))}
              className="ride-panel__range"
            />
          </div>

          {props.bleCadence ? (
            <div className="ride-panel__ble-cadence">
              <div className="ride-panel__ble-cadence-head">
                <span className="ride-panel__kicker">RPM</span>
                {props.bleCadence.deviceLabel ? (
                  <span className="ride-panel__ble-status">
                    <strong>{props.bleCadence.deviceLabel}</strong>
                    {props.bleCadence.crankRpm != null ? (
                      <>
                        {" "}
                        · {Math.round(props.bleCadence.crankRpm)}
                      </>
                    ) : null}
                  </span>
                ) : null}
              </div>
              <p
                className="ride-panel__help ride-panel__help--tight"
                title="크랭크 RPM이 있으면 아바타 페달에 반영됩니다. Chrome·Edge 등, HTTPS 또는 localhost에서 CSC 센서를 선택하세요."
              >
                HTTPS·localhost에서 Bluetooth CSC.
              </p>
              <div className="ride-panel__ble-actions">
                {props.bleCadence.uiState === "connected" ? (
                  <button
                    type="button"
                    className="ride-panel__btn-secondary ride-panel__btn-secondary--small"
                    onClick={props.bleCadence.onDisconnect}
                  >
                    해제
                  </button>
                ) : props.bleCadence.uiState === "connecting" ? (
                  <span className="ride-panel__help">연결 중…</span>
                ) : (
                  <button
                    type="button"
                    className="ride-panel__btn-secondary ride-panel__btn-secondary--small"
                    onClick={() => void props.bleCadence?.onConnect()}
                  >
                    연결
                  </button>
                )}
              </div>
              {props.bleCadence.errorMessage ? (
                <p className="ride-panel__save-route-error" role="alert">
                  {props.bleCadence.errorMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="ride-panel__media-toggles" aria-label="코칭·BGM">
            <span className="ride-panel__kicker">표시</span>
            <div className="ride-panel__toggle-grid">
              <label className="ride-panel__toggle">
                <input
                  type="checkbox"
                  checked={props.rideCoachingBanner}
                  onChange={(e) => props.onRideCoachingBanner(e.target.checked)}
                />
                배너
              </label>
              <label className="ride-panel__toggle">
                <input
                  type="checkbox"
                  checked={props.rideTtsEnabled}
                  onChange={(e) => props.onRideTtsEnabled(e.target.checked)}
                />
                TTS
              </label>
              <label className="ride-panel__toggle">
                <input
                  type="checkbox"
                  checked={props.rideBgmEnabled}
                  onChange={(e) => props.onRideBgmEnabled(e.target.checked)}
                  disabled={!props.rideBgmCatalogConfigured}
                  title={!props.rideBgmCatalogConfigured ? "BGM 플레이리스트가 설정되지 않았습니다." : undefined}
                />
                BGM
              </label>
            </div>
          </div>
          {props.rideElevationProfileLoading ? (
            <p className="ride-panel__help ride-panel__help--tight">고도 프로필 로드 중…</p>
          ) : null}

          {props.arrivalToastVisible ? (
            <p className="ride-panel__arrival-toast" role="status" aria-live="polite">
              완료
            </p>
          ) : null}

          {props.adhocSaveAvailable ? (
            <div
              className="ride-panel__adhoc-save"
              role="status"
              aria-live="polite"
            >
              {adhocSaveOpen ? (
                <div className="ride-panel__save-route-form">
                  <label className="ride-panel__label" htmlFor="ride-panel-adhoc-save-name">
                    경로 이름
                  </label>
                  <input
                    id="ride-panel-adhoc-save-name"
                    className="ride-panel__input"
                    type="text"
                    maxLength={SAVED_ROUTE_NAME_MAX}
                    value={adhocSaveDraft}
                    placeholder="예: 한강 코스"
                    onChange={(e) => setAdhocSaveDraft(e.target.value)}
                    autoFocus
                  />
                  {adhocSaveError ? (
                    <p className="ride-panel__save-route-error" role="alert">
                      {adhocSaveError}
                    </p>
                  ) : null}
                  <div className="ride-panel__save-route-actions">
                    <button
                      type="button"
                      className="ride-panel__btn-primary ride-panel__btn-primary--small"
                      disabled={adhocSaveBusy}
                      onClick={() => void commitAdhocSave()}
                    >
                      {adhocSaveBusy ? "저장 중…" : "저장"}
                    </button>
                    <button
                      type="button"
                      className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet"
                      disabled={adhocSaveBusy}
                      onClick={() => {
                        setAdhocSaveOpen(false);
                        setAdhocSaveDraft("");
                        setAdhocSaveError(null);
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ride-panel__adhoc-save-row">
                  <span
                    className="ride-panel__adhoc-save-msg"
                    title="이름을 입력한 뒤 저장하면 내 경로 목록에 반영됩니다."
                  >
                    방금 코스를 목록에 남길까요?
                  </span>
                  <div className="ride-panel__adhoc-save-actions">
                    <button
                      type="button"
                      className="ride-panel__btn-primary ride-panel__btn-primary--small"
                      onClick={() => {
                        setAdhocSaveError(null);
                        setAdhocSaveDraft("");
                        setAdhocSaveOpen(true);
                      }}
                    >
                      내 경로로 저장
                    </button>
                    <button
                      type="button"
                      className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet"
                      onClick={props.onDismissAdhocSave}
                    >
                      안 함
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

        </>
      )}
    </aside>
  );
}

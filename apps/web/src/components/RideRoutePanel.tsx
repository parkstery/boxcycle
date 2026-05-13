import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { RouteProfile } from "../services/mapboxDirections";
import { formatDuration } from "../services/mapboxDirections";
import type { PublishedPublicCourseSummary } from "../lib/firestoreCourses";
import type { RideSessionStatus } from "../hooks/useVirtualRideSession";
import type { StoredRideSession } from "../lib/rideSessionsStorage";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";
import { SAVED_ROUTE_NAME_MAX } from "../lib/firestoreSavedRoutes";
import type { CoverageOverlayMode } from "../lib/coverageOverlayMode";
import { COVERAGE_OVERLAY_OPTIONS } from "../lib/coverageOverlayMode";
import { SavedRoutesPanel } from "./SavedRoutesPanel";
import { RideHistoryPanel } from "./RideHistoryPanel";
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
  profile: RouteProfile;
  onProfile: (p: RouteProfile) => void;
  routeSummary: string;
  routeLoading: boolean;
  onGenerateRoute: () => void;
  /** 공식 코스를 불러온 뒤에는 출발·도착 맞춤 「경로 생성」을 막음 */
  officialCourseActive?: boolean;
  mapStyle: string;
  mapStyleOptions: { value: string; label: string }[];
  onMapStyle: (style: string) => void;
  followMode: FollowMode;
  onFollowMode: (mode: FollowMode) => void;
  enable3D: boolean;
  onEnable3D: (enabled: boolean) => void;
  mapZoom: number;
  onMapZoom: (zoom: number) => void;
  /** Mapbox Streets 기반 라우터블·Mapillary 시퀀스 커버리지 */
  coverageOverlayMode: CoverageOverlayMode;
  onCoverageOverlayMode: (mode: CoverageOverlayMode) => void;
  /** Mapillary 토큰 없을 때 Mapillary·복합 모드 비활성 안내 */
  mapillaryTokenConfigured: boolean;
  hasRoute: boolean;
  speedKmh: number;
  onSpeedKmh: (n: number) => void;
  sessionStatus: RideSessionStatus;
  onStartRide: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndRide: () => void;
  elapsedLabel: string;
  distanceKm: string;
  avgSpeedLabel: string;
  recentSessions: StoredRideSession[];
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
  /** 현재 경로 저장 — 별칭 입력값을 받아 영속화 */
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
  /** 「주행 기록」 탭 렌더에 필요한 사용자 ID (null = 게스트/미로그인) */
  rideHistoryUserId: string | null;
  /** 공개 경로 심사자 — 설정 시 「심사」 탭 표시 */
  isPublicRouteReviewer?: boolean;
  publicRouteReviewUser?: User | null;
  publicRouteReviewQueueCount?: number;
  onPublicRouteReviewQueueChanged?: () => void;
  pendingPublicRouteIds?: ReadonlySet<string>;
  onOpenPublicRequest?: (route: SavedRoute) => void;
};

type Tab = "route" | "saved" | "history" | "publicReview";

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

  const sessionLabel =
    props.sessionStatus === "idle"
      ? "대기"
      : props.sessionStatus === "running"
        ? "주행 중"
        : "일시정지";

  const canStart =
    props.sessionStatus === "idle" && props.hasRoute && !props.routeLoading;

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
    setSaveBusy(true);
    setSaveError(null);
    try {
      await props.onSaveCurrentRoute(saveDraft);
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
    setAdhocSaveBusy(true);
    setAdhocSaveError(null);
    try {
      await props.onSaveAdhocAsUserRoute(adhocSaveDraft);
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
          사용자 경로
          {props.savedRoutes.length > 0 ? (
            <span className="ride-panel__tab-badge">{props.savedRoutes.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={`ride-panel__tab ${tab === "history" ? "is-active" : ""}`}
          onClick={() => setTab("history")}
        >
          주행 기록
        </button>
        {props.isPublicRouteReviewer && props.publicRouteReviewUser ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "publicReview"}
            className={`ride-panel__tab ${tab === "publicReview" ? "is-active" : ""}`}
            onClick={() => setTab("publicReview")}
          >
            공개 심사
            {(props.publicRouteReviewQueueCount ?? 0) > 0 ? (
              <span className="ride-panel__tab-badge">{props.publicRouteReviewQueueCount}</span>
            ) : null}
          </button>
        ) : null}
      </div>

      {tab === "publicReview" && props.publicRouteReviewUser ? (
        <>
          <div className="ride-panel__saved-head">
            <h2 className="ride-panel__h ride-panel__h--inline">공개 경로 심사</h2>
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
            경로 화면으로 돌아가기
          </button>
        </>
      ) : tab === "saved" ? (
        <>
          <div className="ride-panel__saved-head">
            <h2 className="ride-panel__h ride-panel__h--inline">사용자 경로</h2>
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
            경로 화면으로 돌아가기
          </button>
        </>
      ) : tab === "history" ? (
        <RideHistoryPanel
          userId={props.rideHistoryUserId}
          guestNotice={props.authGuest}
          onClose={() => setTab("route")}
        />
      ) : (
        <>
          <h2 className="ride-panel__h">경로 설정</h2>
          <p className="ride-panel__help">지도 클릭 후 팝업에서 출발지/도착지를 선택하세요.</p>

          <div className="ride-panel__official" aria-label="공식 코스">
            <h3 className="ride-panel__official-title">공식 코스</h3>
            <p className="ride-panel__official-lead">
              운영·심사를 거친 코스입니다. 입문은 동시 주행 허브가 있고, 퍼블릭은 커뮤니티 제안이 승인된 루트입니다.
            </p>
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

            {officialSegment === "intro" ? (
          <div className="ride-panel__basic-start" aria-label="입문 상시 코스">
            <p className="ride-panel__basic-start-title">입문 코스 (상시 · 동시 주행)</p>
            <p className="ride-panel__basic-start-desc">
              아래 코스 각각이 서로 다른 동시 주행 방입니다. 같은 코스를 선택한 사용자만 목록·지도
              마커가 공유됩니다(게스트 포함).
            </p>
            <ul className="ride-panel__basic-start-list">
              {props.basicSharedHubs.map((hub, idx) => (
                <li key={hub.id}>
                  <strong>코스 {idx + 1}</strong> · {hub.title}
                </li>
              ))}
            </ul>
            {props.basicActiveHubCourseId ? (
              <p className="ride-panel__basic-start-active" role="status">
                지금 동행 중:{" "}
                <strong>
                  {props.basicSharedHubs.find((h) => h.id === props.basicActiveHubCourseId)?.title ??
                    props.basicActiveHubCourseId}
                </strong>
              </p>
            ) : (
              <p className="ride-panel__basic-start-idle">
                동행 중인 입문 코스 없음 · 입장 버튼으로 선택
              </p>
            )}
            <div className="ride-panel__basic-start-btns">
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
                  {props.basicStartLoading ? "불러오는 중…" : `코스 ${idx + 1} 입장 (5km)`}
                </button>
              ))}
              {props.basicStartHubJoined ? (
                <button
                  type="button"
                  className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet"
                  disabled={props.basicStartLoading}
                  onClick={() => void props.onLeaveBasicHub()}
                >
                  입문 코스 동행 나가기
                </button>
              ) : null}
            </div>
            {props.authGuest ? (
              <p className="ride-panel__basic-start-hint">
                Google 계정을 연결하면 주행 기록·프로필을 클라우드에 저장합니다. 지금은 게스트로도
                동시 주행에 참여할 수 있습니다.
              </p>
            ) : null}
          </div>

            ) : officialSegment === "public" ? (
              <div className="ride-panel__public-courses" aria-label="퍼블릭 코스">
                {!props.officialCourseCatalogAvailable ? (
                  <p className="ride-panel__public-courses-hint">
                    Firebase 프로젝트가 연결되면 여기에서 퍼블릭 코스 목록을 불러옵니다.
                  </p>
                ) : props.publishedPublicCoursesLoading ? (
                  <p className="ride-panel__public-courses-hint">목록 불러오는 중…</p>
                ) : props.publishedPublicCoursesError ? (
                  <p className="ride-panel__public-courses-error" role="alert">
                    목록을 불러오지 못했습니다.{" "}
                    <span className="ride-panel__public-courses-error-detail">
                      {props.publishedPublicCoursesError}
                    </span>
                    {" · "}
                    인덱스가 없으면{" "}
                    <code className="ride-panel__inline-code">firebase deploy --only firestore</code> 후 콘솔 링크로
                    복합 인덱스를 생성하세요.
                  </p>
                ) : props.publishedPublicCourses.length === 0 ? (
                  <p className="ride-panel__public-courses-hint">
                    아직 게시된 퍼블릭 코스가 없습니다. 공개 경로 심사 승인 후 이 목록에 나타납니다.
                  </p>
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
                <p className="ride-panel__public-courses-footnote">
                  퍼블릭 코스는 입문 허브와 달리 <strong>동시 주행(presence) 방</strong>에 자동으로 들어가지 않습니다.
                </p>
              </div>
            ) : (
              <div className="ride-panel__event-placeholder" aria-label="이벤트 코스">
                <p className="ride-panel__event-placeholder-text">
                  <strong>이벤트·챌린지 코스</strong>는 향후 도입 예정입니다. 기간 한정 루트·랭킹·미션 등이 이 탭에
                  모일 계획입니다.
                </p>
              </div>
            )}
          </div>

          <div className="ride-panel__point-box">
            <p className="ride-panel__point-label">출발지</p>
            <p className="ride-panel__point-value">{props.startLabel}</p>
            <p className="ride-panel__point-label">도착지</p>
            <p className="ride-panel__point-value">{props.endLabel}</p>
          </div>

          <div className="ride-panel__modes">
            <span className="ride-panel__label-inline">이동 수단</span>
            <div className="ride-panel__mode-btns">
              <button
                type="button"
                className={`ride-panel__mode ${props.profile === "driving" ? "is-active" : ""}`}
                onClick={() => props.onProfile("driving")}
              >
                자동차
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
                보행
              </button>
            </div>
          </div>

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

          <div className="ride-panel__save-route">
            {saveOpen ? (
              <div className="ride-panel__save-route-form">
                <label className="ride-panel__label" htmlFor="ride-panel-save-name">
                  경로 이름 (1~{SAVED_ROUTE_NAME_MAX}자)
                </label>
                <input
                  id="ride-panel-save-name"
                  className="ride-panel__input"
                  type="text"
                  maxLength={SAVED_ROUTE_NAME_MAX}
                  value={saveDraft}
                  placeholder="예: 한강 → 미사 코스"
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
            ) : (
              <button
                type="button"
                className="ride-panel__btn-secondary"
                disabled={!canSaveRoute}
                title={
                  canSaveRoute
                    ? "현재 표시 중인 경로를 이름과 함께 저장합니다"
                    : "경로 생성 후 저장할 수 있습니다"
                }
                onClick={openSave}
              >
                현재 경로 저장
              </button>
            )}
          </div>

          <p className="ride-panel__summary" role="status">
            {props.routeSummary}
          </p>
          <label className="ride-panel__label">맵 스타일</label>
          <select
            className="ride-panel__input"
            value={props.mapStyle}
            onChange={(e) => props.onMapStyle(e.target.value)}
          >
            {props.mapStyleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="ride-panel__modes ride-panel__modes--coverage">
            <span className="ride-panel__label-inline">노선 커버리지</span>
            <div className="ride-panel__mode-btns ride-panel__mode-btns--compact">
              {COVERAGE_OVERLAY_OPTIONS.map((opt) => {
                const needsMly = opt.value === "mapillary" || opt.value === "both";
                const disabled = needsMly && !props.mapillaryTokenConfigured;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={
                      disabled
                        ? "Mapillary 클라이언트 토큰이 필요합니다(VITE_MAPILLARY_CLIENT_TOKEN)"
                        : opt.value === "osrm" || opt.value === "both"
                          ? "Mapbox Streets 도로 클래스(자전거·도로 등) — OSRM 그래프와 동일하지 않을 수 있음"
                          : "Mapillary 촬영 시퀀스"
                    }
                    className={`ride-panel__mode ride-panel__mode--compact ${
                      props.coverageOverlayMode === opt.value ? "is-active" : ""
                    }`}
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) props.onCoverageOverlayMode(opt.value);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {!props.mapillaryTokenConfigured ? (
              <p className="ride-panel__help ride-panel__help--tight">
                Mapillary 표시는 <code className="inline">VITE_MAPILLARY_CLIENT_TOKEN</code> 설정 시 사용할 수
                있습니다.
              </p>
            ) : null}
          </div>

          <div className="ride-panel__modes">
            <span className="ride-panel__label-inline">카메라 추적</span>
            <div className="ride-panel__mode-btns">
              <button
                type="button"
                className={`ride-panel__mode ${props.followMode === "free" ? "is-active" : ""}`}
                onClick={() => props.onFollowMode("free")}
              >
                자유
              </button>
              <button
                type="button"
                className={`ride-panel__mode ${props.followMode === "keep" ? "is-active" : ""}`}
                onClick={() => props.onFollowMode("keep")}
              >
                진행방향 유지
              </button>
              <button
                type="button"
                className={`ride-panel__mode ${props.followMode === "north" ? "is-active" : ""}`}
                onClick={() => props.onFollowMode("north")}
              >
                북쪽 고정
              </button>
              <button
                type="button"
                className={`ride-panel__mode ${props.followMode === "rear30" ? "is-active" : ""}`}
                onClick={() => props.onFollowMode("rear30")}
              >
                후방
              </button>
              <button
                type="button"
                className={`ride-panel__mode ${props.followMode === "front30" ? "is-active" : ""}`}
                onClick={() => props.onFollowMode("front30")}
              >
                전방
              </button>
              <button
                type="button"
                className={`ride-panel__mode ${props.followMode === "leftFlat" ? "is-active" : ""}`}
                onClick={() => props.onFollowMode("leftFlat")}
              >
                좌측
              </button>
              <button
                type="button"
                className={`ride-panel__mode ${props.followMode === "rightFlat" ? "is-active" : ""}`}
                onClick={() => props.onFollowMode("rightFlat")}
              >
                우측
              </button>
            </div>
          </div>

          <label className="ride-panel__label">
            <input
              type="checkbox"
              checked={props.enable3D}
              onChange={(e) => props.onEnable3D(e.target.checked)}
            />{" "}
            3D 뷰
          </label>
          <label className="ride-panel__label">
            맵 줌: <strong>{props.mapZoom.toFixed(1)}</strong>
          </label>
          <input
            type="range"
            min={3}
            max={20}
            step={0.1}
            value={props.mapZoom}
            onChange={(e) => props.onMapZoom(Number(e.target.value))}
            className="ride-panel__range"
          />

          <h2 className="ride-panel__h">라이딩 세션</h2>
          <label className="ride-panel__label">
            가상 속도: <strong>{props.speedKmh} km/h</strong>
          </label>
          <input
            type="range"
            min={5}
            max={50}
            step={1}
            value={props.speedKmh}
            onChange={(e) => props.onSpeedKmh(Number(e.target.value))}
            className="ride-panel__range"
          />

          <div className="ride-panel__metrics">
            <div>
              <span className="ride-panel__metric-label">상태</span>
              <strong>{sessionLabel}</strong>
            </div>
            <div>
              <span className="ride-panel__metric-label">경과</span>
              <strong>{props.elapsedLabel}</strong>
            </div>
            <div>
              <span className="ride-panel__metric-label">가상 거리</span>
              <strong>{props.distanceKm} km</strong>
            </div>
            <div>
              <span className="ride-panel__metric-label">평균 속도</span>
              <strong>{props.avgSpeedLabel} km/h</strong>
            </div>
          </div>

          {props.arrivalToastVisible ? (
            <p
              className="ride-panel__arrival-toast"
              role="status"
              aria-live="polite"
            >
              주행이 완료되었습니다.
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
                  <label
                    className="ride-panel__label"
                    htmlFor="ride-panel-adhoc-save-name"
                  >
                    이 경로를 사용자 경로로 저장 (1~{SAVED_ROUTE_NAME_MAX}자)
                  </label>
                  <input
                    id="ride-panel-adhoc-save-name"
                    className="ride-panel__input"
                    type="text"
                    maxLength={SAVED_ROUTE_NAME_MAX}
                    value={adhocSaveDraft}
                    placeholder="예: 한강 자전거길"
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
                      {adhocSaveBusy ? "저장 중…" : "사용자 경로로 저장(완주)"}
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
                  <span className="ride-panel__adhoc-save-msg">
                    방금 주행한 경로를 사용자 경로(완주)로 저장하시겠어요?
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
                      저장
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

          <div className="ride-panel__session-btns">
            <button type="button" disabled={!canStart} onClick={props.onStartRide}>
              시작
            </button>
            <button
              type="button"
              disabled={props.sessionStatus !== "running"}
              onClick={props.onPause}
            >
              일시정지
            </button>
            <button
              type="button"
              disabled={props.sessionStatus !== "paused"}
              onClick={props.onResume}
            >
              재개
            </button>
            <button
              type="button"
              disabled={props.sessionStatus === "idle"}
              onClick={props.onEndRide}
            >
              종료
            </button>
          </div>

          <h2 className="ride-panel__h">최근 기록</h2>
          <ul className="ride-panel__sessions">
            {props.recentSessions.length === 0 ? (
              <li className="ride-panel__sessions-empty">저장된 기록이 없습니다.</li>
            ) : (
              props.recentSessions.slice(0, 8).map((s) => (
                <li key={s.id} className="ride-panel__session-item">
                  <span>{formatDuration(s.elapsedSec)}</span>
                  <span> · {(s.distanceMeters / 1000).toFixed(2)} km</span>
                  <span className="ride-panel__session-date">
                    {" "}
                    · {new Date(s.endedAt).toLocaleString()}
                  </span>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </aside>
  );
}

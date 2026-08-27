import { useState } from "react";
import type { PublishedPublicCourseSummary } from "../../lib/firestoreCourses";
import type { RouteActivitySnapshot } from "../../lib/firestoreRouteActivity";
import type { SavedRoute } from "../../lib/firestoreSavedRoutes";
import { SAVED_ROUTE_NAME_MAX, validateSavedRouteName } from "../../lib/firestoreSavedRoutes";
import { isIncompleteQuotaError } from "../../lib/tierQuota";
import { SavedRoutesPanel } from "./SavedRoutesPanel";
import {
  OfficialCourseListModal,
  type OfficialCourseSegment,
} from "./OfficialCourseListModal";
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
  /** 경로 계산 결과 요약(거리·시간 등) — 생성은 RouteDock 소유, 여기선 표시만 */
  routeSummary: string;
  routeLoading: boolean;
  basicSharedHubs: PublishedPublicCourseSummary[];
  basicActiveHubCourseId: string | null;
  basicStartLoading: boolean;
  basicStartHubJoined: boolean;
  /** Firestore 사용 시 퍼블릭 코스 목록 조회 가능 */
  officialCourseCatalogAvailable: boolean;
  publishedPublicCourses: PublishedPublicCourseSummary[];
  publishedPublicCoursesLoading: boolean;
  publishedPublicCoursesError: string | null;
  /** 퍼블릭 탭 진입 시 카탈로그 재조회 */
  onRefreshPublishedPublicCourses?: () => void;
  /** 코스별 activity aggregate(메뉴·카탈로그 로드 후) */
  publicationActivityByPublicationId?: ReadonlyMap<string, RouteActivitySnapshot | null>;
  authGuest: boolean;
  /** Firebase Auth 세션(게스트·Google 포함) */
  signedIn: boolean;
  onEnterBasicHub: (courseId: string) => void;
  onLeaveBasicHub: () => void;
  /** 사용자 경로 관련 (= 기존 「저장된 경로」 라벨 변경) */
  savedRoutes: SavedRoute[];
  savedRoutesLoading: boolean;
  onLoadSavedRoute: (route: SavedRoute) => void;
  onRenameSavedRoute: (route: SavedRoute, newName: string) => Promise<void> | void;
  onDeleteSavedRoute: (route: SavedRoute) => Promise<void> | void;
  /** 값이 바뀌면 「내 경로」 탭을 열고 대기 필터로 전환(미완료 쿼터 초과 유도). 0=무동작 */
  openSavedTabSignal?: number;
  /** 미완료 쿼터 초과 안내 배너 문구(내 경로 탭 상단) */
  savedQuotaNotice?: string | null;
  onDismissSavedQuotaNotice?: () => void;
  /** 미완료 쿼터 초과로 저장이 막혔을 때(ad-hoc 저장 경로) 상위에 알림 */
  onIncompleteQuotaBlocked?: (message: string) => void;
  /** 목적지 도달 시 3초간 표시되는 토스트. App.tsx 에서 자동으로 false 로 돌아옴. */
  arrivalToastVisible: boolean;
  /** ad-hoc(저장 안 한 채) 주행이 직전에 종료되어 「사용자 경로로 저장」 액션이 가능한 상태인지 */
  adhocSaveAvailable: boolean;
  /** ad-hoc 경로를 새 사용자 경로로 저장하면서 즉시 완주 격상 */
  onSaveAdhocAsUserRoute: (name: string, confirmUpdate?: boolean) => Promise<void> | void;
  /** 자동 제안 이름(출발→도착·거리) — 저장 폼 열 때 입력란 초기값으로 채운다 */
  adhocSuggestedName?: string;
  /** ad-hoc 저장 안내(토스트 액션) 닫기 */
  onDismissAdhocSave: () => void;
  pendingPublicRouteIds?: ReadonlySet<string>;
  /** 퍼블릭 코스로 이미 등록된 원본 savedRouteId */
  publishedPublicSavedRouteIds?: ReadonlySet<string>;
  /** 퍼블릭 게시 코스와 동일한 경로 지문(DB 조회) */
  publishedPublicRouteFingerprints?: ReadonlySet<string>;
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
};

type Tab = "route" | "saved";

export function RideRoutePanel(props: RideRoutePanelProps) {
  const [tab, setTab] = useState<Tab>("route");
  /** ad-hoc 저장 인라인 입력 폼 상태 — 토스트 액션이 열어줌 */
  const [adhocSaveOpen, setAdhocSaveOpen] = useState(false);
  const [adhocSaveDraft, setAdhocSaveDraft] = useState("");
  const [adhocSaveBusy, setAdhocSaveBusy] = useState(false);
  const [adhocSaveError, setAdhocSaveError] = useState<string | null>(null);
  /** 같은 경로가 이미 있어 "업데이트하시겠습니까?" 확인을 기다리는 중. */
  const [adhocConfirmUpdate, setAdhocConfirmUpdate] = useState(false);
  const [officialListModal, setOfficialListModal] = useState<OfficialCourseSegment | null>(null);

  /** 주행 중에도 MENU(경로·코스)는 사용 가능 — 속도·시작은 RouteDock, 맵 핀은 App 잠금 */
  const routeLocksAsIdle = true;

  // 미완료 쿼터 초과 유도 — 신호가 오르면 「내 경로」 탭을 연다(대기 필터 전환은 SavedRoutesPanel 이 처리).
  // effect 대신 이전 신호값과 비교(React 권장) — cascading render·set-state-in-effect 회피.
  const openSavedTabSignal = props.openSavedTabSignal ?? 0;
  const [prevOpenSavedTabSignal, setPrevOpenSavedTabSignal] = useState(openSavedTabSignal);
  if (openSavedTabSignal !== prevOpenSavedTabSignal) {
    setPrevOpenSavedTabSignal(openSavedTabSignal);
    if (openSavedTabSignal > 0) setTab("saved");
  }

  function openOfficialList(segment: OfficialCourseSegment) {
    setOfficialListModal(segment);
    if (segment === "public") {
      props.onRefreshPublishedPublicCourses?.();
    }
  }

  const activeOfficialTitle =
    props.basicActiveHubCourseId != null
      ? (props.basicSharedHubs.find((h) => h.id === props.basicActiveHubCourseId)?.title ??
        props.publishedPublicCourses.find((c) => c.id === props.basicActiveHubCourseId)?.title ??
        props.basicActiveHubCourseId)
      : null;

  async function commitAdhocSave(confirmUpdate = false) {
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
      await props.onSaveAdhocAsUserRoute(normalizedName, confirmUpdate);
      setAdhocSaveOpen(false);
      setAdhocSaveDraft("");
      setAdhocConfirmUpdate(false);
    } catch (e) {
      // 미완료 쿼터 초과: 인라인 에러 대신 「내 경로」 대기 탭으로 유도한다.
      if (isIncompleteQuotaError(e)) {
        setAdhocSaveOpen(false);
        setAdhocSaveDraft("");
        setAdhocConfirmUpdate(false);
        setAdhocSaveError(null);
        props.onIncompleteQuotaBlocked?.(e.message);
      } else if (
        // 같은 경로가 이미 있으면 "업데이트하시겠습니까?" 확인을 띄운다.
        e && typeof e === "object" && (e as { code?: string }).code === "saved-route-duplicate"
      ) {
        setAdhocConfirmUpdate(true);
      } else {
        setAdhocSaveError(e instanceof Error ? e.message : String(e));
      }
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
          title="Route"
          onClick={() => setTab("route")}
        >
          공식경로
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "saved"}
          className={`ride-panel__tab ${tab === "saved" ? "is-active" : ""}`}
          title="My routes"
          onClick={() => setTab("saved")}
        >
          내 경로
          {props.savedRoutes.length > 0 ? (
            <span className="ride-panel__tab-badge">{props.savedRoutes.length}</span>
          ) : null}
        </button>
      </div>

      {tab === "saved" ? (
        <>
          <div className="ride-panel__saved-head">
            <h2 className="ride-panel__h ride-panel__h--inline">내 경로</h2>
            <button
              type="button"
              className="ride-panel__saved-close"
              aria-label="사용자 경로 닫고 경로 화면으로 돌아가기"
              title="Back to route"
              onClick={() => setTab("route")}
            >
              닫기
            </button>
          </div>
          <SavedRoutesPanel
            routes={props.savedRoutes}
            loading={props.savedRoutesLoading}
            guestNotice={props.authGuest}
            sessionIdle={routeLocksAsIdle}
            pendingPublicRouteIds={props.pendingPublicRouteIds}
            publishedPublicSavedRouteIds={props.publishedPublicSavedRouteIds}
            publishedPublicRouteFingerprints={props.publishedPublicRouteFingerprints}
            onOpenPublicRequest={props.onOpenPublicRequest}
            onLoadRoute={(route) => {
              props.onLoadSavedRoute(route);
              setTab("route");
            }}
            onRenameRoute={props.onRenameSavedRoute}
            onDeleteRoute={props.onDeleteSavedRoute}
            quotaNotice={props.savedQuotaNotice}
            onDismissQuotaNotice={props.onDismissSavedQuotaNotice}
            focusPendingSignal={openSavedTabSignal}
          />
          <button
            type="button"
            className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet ride-panel__saved-back"
            title="Back to route"
            onClick={() => setTab("route")}
          >
            경로로
          </button>
        </>
      ) : (
        <>
          <div className="ride-panel__official" aria-label="공식 경로">
            <div className="ride-panel__official-head">
              <span className="ride-panel__kicker">공식</span>
              <div className="ride-panel__official-segments" role="group" aria-label="공식 경로 종류">
              <button
                type="button"
                className={`ride-panel__official-seg ${officialListModal === "intro" ? "is-active" : ""}`}
                title="입문 경로 목록"
                aria-haspopup="dialog"
                aria-expanded={officialListModal === "intro"}
                onClick={() => openOfficialList("intro")}
              >
                입문
              </button>
              <button
                type="button"
                className={`ride-panel__official-seg ${officialListModal === "public" ? "is-active" : ""}`}
                title="퍼블릭 경로 목록"
                aria-haspopup="dialog"
                aria-expanded={officialListModal === "public"}
                onClick={() => openOfficialList("public")}
              >
                퍼블릭
                {props.publishedPublicCourses.length > 0 ? (
                  <span className="ride-panel__official-seg-badge">{props.publishedPublicCourses.length}</span>
                ) : null}
              </button>
              <button
                type="button"
                className={`ride-panel__official-seg ${officialListModal === "event" ? "is-active" : ""}`}
                title="이벤트 목록"
                aria-haspopup="dialog"
                aria-expanded={officialListModal === "event"}
                onClick={() => openOfficialList("event")}
              >
                이벤트
              </button>
              </div>
            </div>

            {activeOfficialTitle ? (
              <div className="ride-panel__official-active" role="status">
                <span className="ride-panel__official-active-label">
                  선택: <strong>{activeOfficialTitle}</strong>
                </span>
                {props.basicStartHubJoined ? (
                  <button
                    type="button"
                    className="ride-panel__official-active-leave"
                    disabled={props.basicStartLoading}
                    title="Leave course"
                    onClick={() => void props.onLeaveBasicHub()}
                  >
                    나가기
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {props.routeSummary.trim() ? (
            <p className="ride-panel__summary" role="status">
              {props.routeSummary}
            </p>
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
                    placeholder="예: 한강"
                    onChange={(e) => setAdhocSaveDraft(e.target.value)}
                    autoFocus
                  />
                  {adhocSaveError ? (
                    <p className="ride-panel__save-route-error" role="alert">
                      {adhocSaveError}
                    </p>
                  ) : null}
                  {adhocConfirmUpdate ? (
                    <div className="ride-panel__save-route-confirm" role="alertdialog">
                      <p className="ride-panel__save-route-confirm-msg">
                        이미 저장된 경로입니다. 업데이트하시겠습니까?
                      </p>
                      <div className="ride-panel__save-route-actions">
                        <button
                          type="button"
                          className="ride-panel__btn-primary ride-panel__btn-primary--small"
                          disabled={adhocSaveBusy}
                          title="Update existing"
                          onClick={() => void commitAdhocSave(true)}
                        >
                          {adhocSaveBusy ? "업데이트 중…" : "예 · 업데이트"}
                        </button>
                        <button
                          type="button"
                          className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet"
                          disabled={adhocSaveBusy}
                          title="Keep previous"
                          onClick={() => setAdhocConfirmUpdate(false)}
                        >
                          아니오 · 유지
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="ride-panel__save-route-actions">
                    <button
                      type="button"
                      className="ride-panel__btn-primary ride-panel__btn-primary--small"
                      disabled={adhocSaveBusy}
                      title="Save"
                      onClick={() => void commitAdhocSave()}
                    >
                      {adhocSaveBusy ? "저장 중…" : "저장"}
                    </button>
                    <button
                      type="button"
                      className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet"
                      disabled={adhocSaveBusy}
                      title="Cancel"
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
                    title="Name and save to your route list."
                  >
                    목록에 저장할까요?
                  </span>
                  <div className="ride-panel__adhoc-save-actions">
                    <button
                      type="button"
                      className="ride-panel__btn-primary ride-panel__btn-primary--small"
                      title="Save to my routes"
                      onClick={() => {
                        setAdhocSaveError(null);
                        setAdhocSaveDraft(props.adhocSuggestedName ?? "");
                        setAdhocSaveOpen(true);
                      }}
                    >
                      내 경로로 저장
                    </button>
                    <button
                      type="button"
                      className="ride-panel__btn-secondary ride-panel__btn-secondary--quiet"
                      title="Skip"
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

      {officialListModal ? (
        <OfficialCourseListModal
          segment={officialListModal}
          onClose={() => setOfficialListModal(null)}
          basicSharedHubs={props.basicSharedHubs}
          basicActiveHubCourseId={props.basicActiveHubCourseId}
          basicStartLoading={props.basicStartLoading}
          basicStartHubJoined={props.basicStartHubJoined}
          routeLoading={props.routeLoading}
          sessionIdle={routeLocksAsIdle}
          officialCourseCatalogAvailable={props.officialCourseCatalogAvailable}
          publishedPublicCourses={props.publishedPublicCourses}
          publishedPublicCoursesLoading={props.publishedPublicCoursesLoading}
          publishedPublicCoursesError={props.publishedPublicCoursesError}
          signedIn={props.signedIn}
          publicationActivityByPublicationId={props.publicationActivityByPublicationId}
          onEnterBasicHub={props.onEnterBasicHub}
          onLeaveBasicHub={props.onLeaveBasicHub}
        />
      ) : null}
    </aside>
  );
}

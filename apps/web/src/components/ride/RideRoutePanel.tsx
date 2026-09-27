import { useState } from "react";
import type { PublishedPublicCourseSummary } from "../../lib/route/repo/firestoreCourses";
import type { RouteActivitySnapshot } from "../../lib/activity/repo/firestoreRouteActivity";
import type { SavedRoute } from "../../lib/route/repo/firestoreSavedRoutes";
import { SAVED_ROUTE_NAME_MAX, validateSavedRouteName } from "../../lib/route/repo/firestoreSavedRoutes";
import { isIncompleteQuotaError } from "../../lib/account/tierQuota";
import { SavedRoutesModal } from "./SavedRoutesModal";
import {
  OfficialCourseListModal,
  type OfficialCourseSegment,
} from "./OfficialCourseListModal";
import "./RideRoutePanel.css";

/**
 * 카메라 추종 모드는 지도의 개념이라 `lib/map/mapGlobeView` 가 소유한다(2026-09-25 이동).
 * 종전에는 이 패널이 정의하고 코어가 그것을 import 하는 레이어링 역전이었다(구조 감사 M4).
 * 기존 import 경로를 깨지 않도록 여기서는 다시 내보내기만 한다.
 */
export type { FollowMode } from "../../lib/map/mapGlobeView";

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

export function RideRoutePanel(props: RideRoutePanelProps) {
  /**
   * 「내 경로」 목록 모달 (2026-09-16 B단계).
   * 종전에는 패널 안 탭이라 폰 가로에서 61px 틈으로 스크롤해야 했다 — 공식 코스와 같은
   * 급의 모달로 옮겨 목록이 화면 높이를 쓴다.
   */
  const [savedModalOpen, setSavedModalOpen] = useState(false);
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
    if (openSavedTabSignal > 0) setSavedModalOpen(true);
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
      <div className="ride-panel__official" aria-label="경로 고르기">
            {/*
              경로 출처 한 줄 — 입문·퍼블릭·내 경로. 셋 다 성격이 같다(어디서 경로를 가져올까).
              종전에는 「공식경로/내 경로」 탭 위에 「공식 + 세그먼트」가 얹힌 2층이었는데,
              폰 가로에서 그 두 층 + 섹션 라벨 2줄이 패널 높이의 78% 를 먹고 목록에는 61px 만 남았다.
            */}
            <div className="ride-panel__official-segments" role="group" aria-label="경로 출처">
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
              {/*
                「내 경로」도 같은 줄의 출처 칩이다 — 종전 탭 계층을 없앴다.
                aria-label 을 명시하는 이유: 텍스트만 쓰면 접근성 이름이 「내 경로 50」 이 되고,
                주행 종료 후 나오는 「내 경로로 저장」 과 부분 일치해 셀렉터가 모호해진다.
              */}
              <button
                type="button"
                className="ride-panel__official-seg"
                aria-label="내 경로 목록"
                title="내 경로 목록"
                onClick={() => setSavedModalOpen(true)}
              >
                내 경로
                {props.savedRoutes.length > 0 ? (
                  <span className="ride-panel__official-seg-badge">{props.savedRoutes.length}</span>
                ) : null}
              </button>
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

      {savedModalOpen ? (
        <SavedRoutesModal
          onClose={() => setSavedModalOpen(false)}
          routes={props.savedRoutes}
          loading={props.savedRoutesLoading}
          guestNotice={props.authGuest}
          sessionIdle={routeLocksAsIdle}
          pendingPublicRouteIds={props.pendingPublicRouteIds}
          publishedPublicSavedRouteIds={props.publishedPublicSavedRouteIds}
          publishedPublicRouteFingerprints={props.publishedPublicRouteFingerprints}
          onOpenPublicRequest={props.onOpenPublicRequest}
          onLoadRoute={props.onLoadSavedRoute}
          onRenameRoute={props.onRenameSavedRoute}
          onDeleteRoute={props.onDeleteSavedRoute}
          quotaNotice={props.savedQuotaNotice}
          onDismissQuotaNotice={props.onDismissSavedQuotaNotice}
          focusPendingSignal={openSavedTabSignal}
        />
      ) : null}

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

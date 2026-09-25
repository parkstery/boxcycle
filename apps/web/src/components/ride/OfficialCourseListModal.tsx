import { useEffect, useMemo, useState } from "react";
import type { PublishedPublicCourseSummary } from "../../lib/route/repo/firestoreCourses";
import { formatPublicationListMeta, publicationDisplayTitle } from "../../lib/publicationDisplay";
import type { RouteActivitySnapshot } from "../../lib/activity/repo/firestoreRouteActivity";
import { formatRouteActivityListBadge } from "../../lib/activity/repo/firestoreRouteActivity";
import { sortRouteList, type RouteSortKey } from "../../lib/routeListSort";
import { RouteListModalShell } from "./RouteListModalShell";
import { RouteSortSelect } from "./RouteSortSelect";
import "./OfficialCourseListModal.css";

/*
 * 2026-09-16: `event` 제거. 「이벤트 (준비 중)」 한 줄만 그리는 빈 껍데기가 폰 가로에서
 * 가장 좁은 네비 줄의 1/3 을 상시 점유했다. 실제 이벤트가 생기면 그때 되살린다.
 */
export type OfficialCourseSegment = "intro" | "public";

function segmentTitle(segment: OfficialCourseSegment): string {
  return segment === "intro" ? "입문 경로" : "퍼블릭 경로";
}

function PublicCoursePickRow(props: {
  course: PublishedPublicCourseSummary;
  selected: boolean;
  loadDisabled: boolean;
  activityBadge: string | null;
  onLoad: () => void;
}) {
  const c = props.course;
  return (
    <li>
      <button
        type="button"
        className={`oc-modal__item${props.selected ? " is-selected" : ""}`}
        title={props.loadDisabled ? "Available when idle" : "Load course"}
        disabled={props.loadDisabled}
        onClick={props.onLoad}
      >
        <span className="oc-modal__item-meta">
          <strong className="oc-modal__item-name">{publicationDisplayTitle(c)}</strong>
          <span className="oc-modal__item-sub">
            {formatPublicationListMeta(c)}
            {c.publisherNickname ? (
              <span className="oc-modal__item-publisher"> · {c.publisherNickname}</span>
            ) : null}
            {props.activityBadge ? (
              <span className="oc-modal__item-activity"> · {props.activityBadge}</span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

export type OfficialCourseListModalProps = {
  segment: OfficialCourseSegment;
  onClose: () => void;
  basicSharedHubs: PublishedPublicCourseSummary[];
  basicActiveHubCourseId: string | null;
  basicStartLoading: boolean;
  basicStartHubJoined: boolean;
  routeLoading: boolean;
  sessionIdle: boolean;
  officialCourseCatalogAvailable: boolean;
  publishedPublicCourses: PublishedPublicCourseSummary[];
  publishedPublicCoursesLoading: boolean;
  publishedPublicCoursesError: string | null;
  signedIn: boolean;
  publicationActivityByPublicationId?: ReadonlyMap<string, RouteActivitySnapshot | null>;
  onEnterBasicHub: (courseId: string) => void;
  onLeaveBasicHub: () => void;
};

export function OfficialCourseListModal(props: OfficialCourseListModalProps) {
  const loadDisabled = props.routeLoading || props.basicStartLoading || !props.sessionIdle;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.onClose]);

  function handleLoad(courseId: string) {
    props.onEnterBasicHub(courseId);
    props.onClose();
  }

  /*
   * 정렬 — 내 경로와 같은 컨트롤·같은 비교 규칙(2026-09-16 Chief).
   * 기본값 「최근순」의 시계는 **퍼블릭 등록 시각**(`publishedAtMs`)이다.
   * 입문 허브는 등록 개념이 없어 시각이 없으므로 최근순이 원래 순서로 물러난다 —
   * Basic 1·2·3 의 의도된 난이도 순서가 그대로 지켜진다.
   */
  const [sortKey, setSortKey] = useState<RouteSortKey>("recent");
  const sortFields = (c: PublishedPublicCourseSummary) => ({
    name: publicationDisplayTitle(c),
    distanceMeters: c.distanceMeters,
    updatedAtMs: c.publishedAtMs ?? null,
  });
  const introCourses = useMemo(
    () => sortRouteList(props.basicSharedHubs, sortKey, sortFields),
    [props.basicSharedHubs, sortKey],
  );
  const publicCourses = useMemo(
    () => sortRouteList(props.publishedPublicCourses, sortKey, sortFields),
    [props.publishedPublicCourses, sortKey],
  );
  /** 두 개 이하면 정렬이 의미 없다 — 좁은 화면에서 줄만 먹는다 */
  const sortableCount =
    props.segment === "intro" ? props.basicSharedHubs.length : props.publishedPublicCourses.length;
  const sortBar =
    sortableCount > 2 ? (
      <div className="oc-modal__sortbar">
        <RouteSortSelect
          value={sortKey}
          onChange={setSortKey}
          keys={["recent", "distance", "name"]}
        />
      </div>
    ) : null;

  const body =
    props.segment === "intro" ? (
      <>
        {props.basicActiveHubCourseId ? (
          <p className="oc-modal__hint" role="status">
            선택:{" "}
            <strong>
              {props.basicSharedHubs.find((h) => h.id === props.basicActiveHubCourseId)?.title ??
                props.basicActiveHubCourseId}
            </strong>
          </p>
        ) : null}
        {props.basicSharedHubs.length === 0 ? (
          <p className="oc-modal__hint">입문 경로 없음</p>
        ) : (
          <>
          {sortBar}
          <ul className="oc-modal__list">
            {introCourses.map((c) => (
              <PublicCoursePickRow
                key={c.id}
                course={c}
                selected={props.basicActiveHubCourseId === c.id}
                loadDisabled={loadDisabled}
                activityBadge={formatRouteActivityListBadge(
                  props.publicationActivityByPublicationId?.get(c.id) ?? null,
                )}
                onLoad={() => handleLoad(c.id)}
              />
            ))}
          </ul>
          </>
        )}
        {props.basicStartHubJoined ? (
          <button
            type="button"
            className="oc-modal__leave"
            disabled={props.basicStartLoading}
            title="Leave course"
            onClick={() => {
              void props.onLeaveBasicHub();
              props.onClose();
            }}
          >
            나가기
          </button>
        ) : null}
      </>
    ) : (
      <>
        {!props.officialCourseCatalogAvailable ? (
          <p className="oc-modal__hint">목록 미연결</p>
        ) : props.publishedPublicCoursesLoading ? (
          <p className="oc-modal__hint">불러오는 중…</p>
        ) : props.publishedPublicCoursesError ? (
          <p className="oc-modal__error" role="alert">
            목록을 불러오지 못했어요.{" "}
            <span className="oc-modal__error-detail">{props.publishedPublicCoursesError}</span>
          </p>
        ) : props.publishedPublicCourses.length === 0 ? (
          <p className="oc-modal__hint">
            {!props.signedIn && props.officialCourseCatalogAvailable
              ? "로그인 후 목록"
              : "퍼블릭 경로 없음"}
          </p>
        ) : (
          <>
          {sortBar}
          <ul className="oc-modal__list">
            {publicCourses.map((c) => (
              <PublicCoursePickRow
                key={c.id}
                course={c}
                selected={props.basicActiveHubCourseId === c.id}
                loadDisabled={loadDisabled}
                activityBadge={formatRouteActivityListBadge(
                  props.publicationActivityByPublicationId?.get(c.id) ?? null,
                )}
                onLoad={() => handleLoad(c.id)}
              />
            ))}
          </ul>
          </>
        )}
      </>
    );

  return (
    <RouteListModalShell
      titleId="oc-modal-title"
      title={segmentTitle(props.segment)}
      onClose={props.onClose}
    >
      {body}
    </RouteListModalShell>
  );
}

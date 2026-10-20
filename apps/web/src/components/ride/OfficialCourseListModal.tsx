import { useMemo, useState, type ReactNode } from "react";
import type { PublishedPublicCourseSummary } from "../../lib/route/repo/firestoreCourses";
import {
  formatPublicationListMeta,
  publicationDestinationFromTitle,
  publicationDisplayTitle,
  publicationProfileLabelKo,
} from "../../lib/route/publicationDisplay";
import type { RouteActivitySnapshot } from "../../lib/activity/repo/firestoreRouteActivity";
import { formatRouteActivityListBadge } from "../../lib/activity/repo/firestoreRouteActivity";
import { sortRouteList, type RouteSortKey } from "../../lib/route/routeListSort";
import {
  RouteListModalShell,
  RouteListSourceNav,
  type RouteListSource,
} from "./RouteListModalShell";
import { RouteSortSelect } from "./RouteSortSelect";
import "./OfficialCourseListModal.css";

/*
 * 2026-09-16: `event` 제거. 「이벤트 (준비 중)」 한 줄만 그리는 빈 껍데기가 폰 가로에서
 * 가장 좁은 네비 줄의 1/3 을 상시 점유했다. 실제 이벤트가 생기면 그때 되살린다.
 */
export type OfficialCourseSegment = "intro" | "public";

/** 대화상자 접근성 이름 — 제목 칩은 짧게(입문 · 퍼블릭), 읽히는 이름은 온전하게 */
function segmentTitle(segment: OfficialCourseSegment): string {
  return segment === "intro" ? "입문 경로" : "퍼블릭 경로";
}

function matchesQuery(c: PublishedPublicCourseSummary, query: string): boolean {
  return !query || normalizeForSearch(publicationDisplayTitle(c)).includes(query);
}

function segmentChip(segment: OfficialCourseSegment): string {
  return segment === "intro" ? "입문" : "퍼블릭";
}

/** 검색어·이름 정규화(소문자·트림) — 내 경로 검색과 같은 부분일치 규칙 */
function normalizeForSearch(s: string): string {
  return s.trim().toLowerCase();
}

function introListTitle(title: string): string {
  const stripped = title.replace(/^Basic\s+\d+\s*·\s*/i, "").trim();
  return stripped || title;
}

function OfficialListMeta(props: {
  course: PublishedPublicCourseSummary;
  displayTitle: string;
}) {
  const profile = publicationProfileLabelKo(props.course.profile);
  const km = (props.course.distanceMeters / 1000).toFixed(2);
  const dest = publicationDestinationFromTitle(props.course.title);
  const showDest = Boolean(dest && dest !== props.displayTitle);
  return (
    <>
      <span title="도로 기준">{profile}</span>
      {` · ${km} km`}
      {showDest ? ` · ${dest}` : null}
    </>
  );
}

function PublicCoursePickRow(props: {
  course: PublishedPublicCourseSummary;
  selected: boolean;
  loadDisabled: boolean;
  activityBadge: string | null;
  listTitle: string;
  listMeta: ReactNode;
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
          <strong className="oc-modal__item-name" title={publicationDisplayTitle(c)}>
            {props.listTitle}
          </strong>
          <span className="oc-modal__item-sub">
            <span className="oc-modal__item-sub-left">
              {props.listMeta}
              {props.activityBadge ? (
                <span className="oc-modal__item-activity"> · {props.activityBadge}</span>
              ) : null}
            </span>
            {c.publisherNickname ? (
              <span className="oc-modal__item-publisher">{c.publisherNickname}</span>
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
  onSelectSource?: (source: RouteListSource) => void;
};

export function OfficialCourseListModal(props: OfficialCourseListModalProps) {
  const loadDisabled = props.routeLoading || props.basicStartLoading || !props.sessionIdle;

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
  const [queryText, setQueryText] = useState("");
  const query = normalizeForSearch(queryText);
  const sortFields = (c: PublishedPublicCourseSummary) => ({
    name: publicationDisplayTitle(c),
    distanceMeters: c.distanceMeters,
    updatedAtMs: c.publishedAtMs ?? null,
  });
  const introCourses = useMemo(
    () => sortRouteList(props.basicSharedHubs.filter((c) => matchesQuery(c, query)), sortKey, sortFields),
    [props.basicSharedHubs, sortKey, query],
  );
  const publicCourses = useMemo(
    () => sortRouteList(props.publishedPublicCourses.filter((c) => matchesQuery(c, query)), sortKey, sortFields),
    [props.publishedPublicCourses, sortKey, query],
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
              {introListTitle(
                props.basicSharedHubs.find((h) => h.id === props.basicActiveHubCourseId)?.title ??
                  props.basicActiveHubCourseId,
              )}
            </strong>
          </p>
        ) : null}
        {props.basicSharedHubs.length === 0 ? (
          <p className="oc-modal__hint">입문 경로 없음</p>
        ) : (
          <>
          {sortBar}
          {introCourses.length === 0 ? <p className="oc-modal__hint">검색 결과가 없습니다.</p> : null}
          <ul className="oc-modal__list">
            {introCourses.map((c) => {
              const listTitle = introListTitle(publicationDisplayTitle(c));
              return (
              <PublicCoursePickRow
                key={c.id}
                course={c}
                selected={props.basicActiveHubCourseId === c.id}
                loadDisabled={loadDisabled}
                activityBadge={formatRouteActivityListBadge(
                  props.publicationActivityByPublicationId?.get(c.id) ?? null,
                )}
                listTitle={listTitle}
                listMeta={<OfficialListMeta course={c} displayTitle={listTitle} />}
                onLoad={() => handleLoad(c.id)}
              />
              );
            })}
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
          {publicCourses.length === 0 ? <p className="oc-modal__hint">검색 결과가 없습니다.</p> : null}
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
                listTitle={publicationDisplayTitle(c)}
                listMeta={formatPublicationListMeta(c)}
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
      title={segmentChip(props.segment)}
      dialogLabel={segmentTitle(props.segment)}
      searchValue={queryText}
      onSearchChange={setQueryText}
      onClose={props.onClose}
      sourceNav={
        props.onSelectSource ? (
          <RouteListSourceNav current={props.segment} onSelect={props.onSelectSource} />
        ) : null
      }
    >
      {body}
    </RouteListModalShell>
  );
}

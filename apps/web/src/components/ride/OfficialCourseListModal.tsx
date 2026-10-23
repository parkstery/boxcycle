import { useMemo, useState } from "react";
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
import { RouteProfileIcon } from "./RouteProfileIcon";
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

/** 행 title·접근성 — 화면에는 쓰지 않고 마우스 올림·스크린리더에 남긴다. */
function publicationRowDetailTitle(
  publication: PublishedPublicCourseSummary,
  displayTitle: string,
): string {
  const profile = publicationProfileLabelKo(publication.profile);
  if (publication.publisherNickname) return `${profile} · ${publication.publisherNickname}`;
  const meta = formatPublicationListMeta(publication).replace(/\s*·\s*[\d.]+\s*km\b/i, "");
  return publicationDestinationFromTitle(publication.title) === displayTitle ? profile : meta;
}

function PublicCoursePickRow(props: {
  course: PublishedPublicCourseSummary;
  selected: boolean;
  loadDisabled: boolean;
  activityBadge: string | null;
  listTitle: string;
  detailTitle: string;
  onLoad: () => void;
}) {
  const c = props.course;
  const km = (c.distanceMeters / 1000).toFixed(2);
  const detailId = `oc-row-detail-${c.id}`;
  const loadTitle = props.loadDisabled ? "Available when idle" : "Load course";
  const hoverTitle = [publicationDisplayTitle(c), props.detailTitle].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        className={`oc-modal__item oc-modal__item--map-row${props.selected ? " is-selected" : ""}`}
        title={hoverTitle || loadTitle}
        aria-describedby={props.detailTitle ? detailId : undefined}
        disabled={props.loadDisabled}
        onClick={props.onLoad}
      >
        <span className="oc-modal__item-main">
          <RouteProfileIcon profile={c.profile} />
          <strong className="oc-modal__item-name" title={publicationDisplayTitle(c)}>
            {props.listTitle}
          </strong>
          {props.detailTitle ? (
            <span id={detailId} className="oc-modal__item-detail-sr">
              {props.detailTitle}
            </span>
          ) : null}
        </span>
        <span className="oc-modal__item-status">
          {props.activityBadge ? (
            <span className="oc-modal__item-status-text">{props.activityBadge}</span>
          ) : null}
        </span>
        <span className="oc-modal__item-distance">
          {km} <span className="oc-modal__item-distance-unit">km</span>
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

  const visiblePublications = props.segment === "intro" ? introCourses : publicCourses;
  const publicationList = (
    <>
      {visiblePublications.length === 0 ? <p className="oc-modal__hint">검색 결과가 없습니다.</p> : null}
      <ul className="oc-modal__list oc-modal__list--map">
        {visiblePublications.map((publication) => {
          const title = publicationDisplayTitle(publication);
          const listTitle = props.segment === "intro" ? introListTitle(title) : title;
          return (
            <PublicCoursePickRow
              key={publication.id}
              course={publication}
              selected={props.basicActiveHubCourseId === publication.id}
              loadDisabled={loadDisabled}
              activityBadge={formatRouteActivityListBadge(
                props.publicationActivityByPublicationId?.get(publication.id) ?? null,
              )}
              listTitle={listTitle}
              detailTitle={publicationRowDetailTitle(publication, listTitle)}
              onLoad={() => handleLoad(publication.id)}
            />
          );
        })}
      </ul>
    </>
  );

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
          publicationList
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
          publicationList
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
      appearance="map"
      headTools={sortBar}
      footerHint="경로를 누르면 지도에 올라가요"
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

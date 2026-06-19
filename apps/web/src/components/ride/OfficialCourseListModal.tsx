import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { RouteProfile } from "../../services/mapboxDirections";
import { formatDuration } from "../../services/mapboxDirections";
import type { PublishedPublicCourseSummary, CourseProfile } from "../../lib/firestoreCourses";
import type { RouteActivitySnapshot } from "../../lib/firestoreRouteActivity";
import { formatRouteActivityListBadge } from "../../lib/firestoreRouteActivity";
import "./OfficialCourseListModal.css";

export type OfficialCourseSegment = "intro" | "public" | "event";

function profileLabelKo(p: RouteProfile | CourseProfile): string {
  if (p === "walking") return "도보";
  if (p === "driving") return "자동차";
  return "자전거";
}

function segmentTitle(segment: OfficialCourseSegment): string {
  if (segment === "intro") return "입문 경로";
  if (segment === "public") return "퍼블릭 경로";
  return "이벤트";
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
          <strong className="oc-modal__item-name">{c.title}</strong>
          <span className="oc-modal__item-sub">
            {profileLabelKo(c.profile)} · {(c.distanceMeters / 1000).toFixed(2)} km · 예상{" "}
            {formatDuration(c.durationSec)}
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
          <ul className="oc-modal__list">
            {props.basicSharedHubs.map((c) => (
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
    ) : props.segment === "public" ? (
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
          <ul className="oc-modal__list">
            {props.publishedPublicCourses.map((c) => (
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
        )}
      </>
    ) : (
      <p className="oc-modal__hint">이벤트 (준비 중)</p>
    );

  return createPortal(
    <div className="oc-modal-overlay" role="presentation" onMouseDown={() => props.onClose()}>
      <div
        className="oc-modal"
        role="dialog"
        aria-labelledby="oc-modal-title"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="oc-modal__head">
          <h2 id="oc-modal-title" className="oc-modal__title">
            {segmentTitle(props.segment)}
          </h2>
          <button
            type="button"
            className="oc-modal__close"
            aria-label="닫기"
            title="닫기"
            onClick={() => props.onClose()}
          >
            닫기
          </button>
        </div>
        <div className="oc-modal__body">{body}</div>
      </div>
    </div>,
    document.body,
  );
}

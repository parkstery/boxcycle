/**
 * Route catalog API — Firestore `courses` collection (legacy path).
 * @see firestoreCourses.ts implementation
 * @see document/260603-Route-용어-및-RTW-Pro-브랜딩-통합-전환-방안.md
 */

import type {
  BasicSharedHubCourseId,
  CourseBounds,
  CourseCategory,
  CourseDoc,
  CourseProfile,
  CourseRoutePayload,
  PublishedPublicCourseSummary,
} from "./firestoreCourses";

export type {
  BasicSharedHubCourseId,
  CourseBounds,
  CourseCategory,
  CourseDoc,
  CourseProfile,
  CourseRoutePayload,
  PublishedPublicCourseSummary,
};

/** @deprecated Firestore `courses` — use RouteCatalog* types */
export type RouteCatalogCategory = CourseCategory;
export type RouteCatalogProfile = CourseProfile;
export type RouteCatalogDoc = CourseDoc;
export type CatalogRoutePayload = CourseRoutePayload;
export type PublishedPublicRouteSummary = PublishedPublicCourseSummary;
export type RouteCatalogBounds = CourseBounds;
export type BasicSharedHubRouteId = BasicSharedHubCourseId;

export {
  BASIC_HUB_COURSE_1_ID,
  BASIC_HUB_COURSE_2_ID,
  BASIC_SHARED_HUB_IDS,
  BASIC_START_COURSE_ID,
  BASIC_SHARED_HUB_SUMMARIES,
  boundsCenterLngLat,
  boundsFromLineStringGeometry,
  ensureBasicCoursesSeeded,
  ensureBasicSharedHubPresenceFlagsMerged,
  fetchCourseBounds as fetchRouteCatalogBounds,
  fetchCourseRoutePayload as fetchCatalogRoutePayload,
  findPublishedPublicCourseByCourseId as findPublishedPublicRouteByCatalogId,
  findPublishedPublicCourseByFingerprint as findPublishedPublicRouteByFingerprint,
  findPublishedPublicCourseBySourceSavedRouteId as findPublishedPublicRouteBySourceSavedRouteId,
  findPublishedPublicFingerprintsAmong,
  getBasicHubCourseBounds as getBasicHubRouteBounds,
  getBasicHubCoursePayload as getBasicHubRoutePayload,
  getBasicSharedHubSummaries,
  getBasicStartCourseStatic as getBasicStartRouteStatic,
  isGeometryBasicStartHub,
  listPublishedPublicCourses as listPublishedPublicRoutes,
  matchBasicSharedHubCourseId as matchBasicSharedHubRouteId,
  routeGeometryMatchesBasicSharedHub,
} from "./firestoreCourses";

/** @deprecated use fetchCatalogRoutePayload */
export { fetchCourseRoutePayload } from "./firestoreCourses";

/** @deprecated use listPublishedPublicRoutes */
export { listPublishedPublicCourses } from "./firestoreCourses";

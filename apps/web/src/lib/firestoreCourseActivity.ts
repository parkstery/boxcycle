/**
 * @deprecated Phase 6 — {@link ./firestoreRouteActivity.ts} 사용.
 */
export {
  type RouteActivitySnapshot,
  type RouteActivitySnapshot as CourseActivitySnapshot,
  fetchRouteActivity,
  fetchRouteActivity as fetchCourseActivity,
  fetchRouteActivitiesBatch,
  fetchRouteActivitiesBatch as fetchCourseActivitiesBatch,
  fetchLiveRouteActivityIds,
  fetchLiveRouteActivityIds as fetchLiveCourseActivityIds,
  formatRouteActivityHudLine,
  formatRouteActivityHudLine as formatCourseActivityHudLine,
  formatRouteActivityListBadge,
  formatRouteActivityListBadge as formatCourseActivityListBadge,
  formatActivityWorldPinPopup,
  invalidateRouteActivityCache,
  invalidateRouteActivityCache as invalidateCourseActivityCache,
  invalidateLiveRouteActivityIdsCache,
  invalidateLiveRouteActivityIdsCache as invalidateLiveCourseActivityIdsCache,
  isRouteActivityHeat,
  isRouteActivityHeat as isCourseActivityHeat,
  isRouteActivityLive,
  isRouteActivityLive as isCourseActivityLive,
  markRouteActivityRideCompletedOptimistic,
  markRouteActivityRideCompletedOptimistic as markCourseActivityRideCompletedOptimistic,
  heatVisualWeight,
} from "./firestoreRouteActivity";

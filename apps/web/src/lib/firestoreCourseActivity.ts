/**
 * @deprecated Import from `./firestoreRouteActivity`.
 */
export {
  fetchLiveRouteActivityIds as fetchLiveCourseActivityIds,
  fetchRouteActivitiesBatch as fetchCourseActivitiesBatch,
  fetchRouteActivity as fetchCourseActivity,
  formatActivityWorldPinPopup,
  formatRouteActivityHudLine as formatCourseActivityHudLine,
  formatRouteActivityListBadge as formatCourseActivityListBadge,
  heatVisualWeight,
  invalidateLiveRouteActivityIdsCache as invalidateLiveCourseActivityIdsCache,
  invalidateRouteActivityCache as invalidateCourseActivityCache,
  isRouteActivityHeat as isCourseActivityHeat,
  isRouteActivityLive as isCourseActivityLive,
  markRouteActivityRideCompletedOptimistic as markCourseActivityRideCompletedOptimistic,
  type RouteActivitySnapshot as CourseActivitySnapshot,
} from "./firestoreRouteActivity";

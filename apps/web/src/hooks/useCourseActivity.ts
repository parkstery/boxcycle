/** @deprecated Phase 6 — {@link ./useRouteActivity.ts} */
import { useRouteActivity, type UseRouteActivityOptions } from "./useRouteActivity";
import type { RouteActivitySnapshot } from "../lib/firestoreRouteActivity";

export type UseCourseActivityOptions = Omit<UseRouteActivityOptions, "publicationId"> & {
  courseId: string | null;
};

export type CourseActivitySnapshot = RouteActivitySnapshot;

export function useCourseActivity(options: UseCourseActivityOptions) {
  const { courseId, ...rest } = options;
  return useRouteActivity({ ...rest, publicationId: courseId });
}

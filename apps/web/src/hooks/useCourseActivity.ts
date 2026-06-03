/**
 * @deprecated Use `useRouteActivity` from `./useRouteActivity`.
 */
import { useRouteActivity, type UseRouteActivityOptions } from "./useRouteActivity";

/** @deprecated Use `UseRouteActivityOptions` */
export type UseCourseActivityOptions = Omit<UseRouteActivityOptions, "catalogRouteId"> & {
  courseId: string | null;
};

/** @deprecated Use `useRouteActivity` */
export function useCourseActivity(options: UseCourseActivityOptions) {
  const { courseId, ...rest } = options;
  return useRouteActivity({ ...rest, catalogRouteId: courseId });
}

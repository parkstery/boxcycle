/**
 * @deprecated Use `useOfficialRouteCatalog` from `./useOfficialRouteCatalog`.
 */
import type { Dispatch, SetStateAction } from "react";
import {
  useOfficialRouteCatalog,
  type UseOfficialRouteCatalogOptions,
} from "./useOfficialRouteCatalog";

/** @deprecated Use `UseOfficialRouteCatalogOptions` */
export type UseOfficialCoursesHubOptions = UseOfficialRouteCatalogOptions & {
  setActiveOfficialCourseId: Dispatch<SetStateAction<string | null>>;
};

/** @deprecated Use `useOfficialRouteCatalog` */
export function useOfficialCoursesHub(options: UseOfficialCoursesHubOptions) {
  const { setActiveOfficialCourseId, ...rest } = options;
  const hub = useOfficialRouteCatalog({
    ...rest,
    setActiveOfficialCatalogRouteId: setActiveOfficialCourseId,
  });
  return {
    publishedPublicCourses: hub.publishedPublicRoutes,
    publishedPublicCoursesLoading: hub.publishedPublicRoutesLoading,
    publishedPublicCoursesError: hub.publishedPublicRoutesError,
    refreshPublishedPublicCourseCatalog: hub.refreshPublishedPublicRouteCatalog,
    publishedPublicSavedRouteIds: hub.publishedPublicSavedRouteIds,
    publishedPublicRouteFingerprints: hub.publishedPublicRouteFingerprints,
    basicActiveHubCourseId: hub.basicActiveHubRouteId,
    setBasicActiveHubCourseId: hub.setBasicActiveHubRouteId,
    basicStartLoading: hub.basicStartLoading,
    basicStartHubJoined: hub.basicStartHubJoined,
    enterBasicHub: hub.enterBasicHub,
    leaveBasicHub: hub.leaveBasicHub,
  };
}

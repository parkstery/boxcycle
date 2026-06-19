/**
 * @deprecated Phase 6 — {@link ./useTrailLivePublicationRidePublisher.ts} 사용.
 */
import type { LineStringGeometry } from "../lib/geo";
import type { User } from "firebase/auth";
import { useTrailLivePublicationRidePublisher } from "./useTrailLivePublicationRidePublisher";

type UseTrailLiveCourseRidePublisherOpts = {
  user: User | null | undefined;
  enabled: boolean;
  pageVisible: boolean;
  trailId: string;
  courseId: string | null;
  routeGeometry: LineStringGeometry | null;
  routeDistanceMeters: number;
  virtualDistanceMeters: number;
};

export function useTrailLiveCourseRidePublisher(opts: UseTrailLiveCourseRidePublisherOpts): void {
  useTrailLivePublicationRidePublisher({
    user: opts.user,
    enabled: opts.enabled,
    pageVisible: opts.pageVisible,
    trailId: opts.trailId,
    publicationId: opts.courseId,
    routeGeometry: opts.routeGeometry,
    routeDistanceMeters: opts.routeDistanceMeters,
    virtualDistanceMeters: opts.virtualDistanceMeters,
  });
}

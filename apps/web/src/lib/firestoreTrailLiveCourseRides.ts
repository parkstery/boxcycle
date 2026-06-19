/**
 * @deprecated Phase 6 — {@link ./firestoreTrailLivePublicationRides.ts} 사용.
 */
export {
  TRAIL_LIVE_PUBLICATION_RIDE_WRITE_INTERVAL_MS,
  TRAIL_LIVE_PUBLICATION_RIDE_WRITE_INTERVAL_MS as TRAIL_LIVE_COURSE_RIDE_WRITE_INTERVAL_MS,
  type TrailLivePublicationRideRow,
  type TrailLivePublicationRideRow as TrailLiveCourseRideRow,
  subscribeTrailLivePublicationRides,
  subscribeTrailLivePublicationRides as subscribeTrailLiveCourseRides,
  mergeTrailLivePublicationRideSnapshot,
  mergeTrailLivePublicationRideSnapshot as mergeTrailLiveCourseRideSnapshot,
  deleteTrailLivePublicationRide,
  deleteTrailLivePublicationRide as deleteTrailLiveCourseRide,
  countTrailLiveRidersFresh,
  countTrailLiveRiders,
  fetchTrailIdsWithActiveLiveRides,
  isTrailLivePublicationRideRowFresh,
  isTrailLivePublicationRideRowFresh as isTrailLiveCourseRideRowFresh,
} from "./firestoreTrailLivePublicationRides";

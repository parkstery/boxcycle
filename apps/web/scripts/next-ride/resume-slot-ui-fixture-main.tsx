/**
 * 실제 NextRideCard 컴포넌트 fixture — auth/앱 우회 없음, 카드만 마운트.
 */
import { createRoot } from "react-dom/client";
import { NextRideCard } from "../../src/components/ride/NextRideCard";
import type { NextRideView } from "../../src/lib/ride/nextRideTarget";
import type { SavedRoute } from "../../src/lib/route/repo/firestoreSavedRoutes";
import type { StoredRideSession } from "../../src/lib/ride/rideSessionsStorage";
import type { LineStringGeometry } from "../../src/lib/geo/geo";

const geometry: LineStringGeometry = {
  type: "LineString",
  coordinates: [
    [127.0, 37.5],
    [127.01, 37.5],
    [127.02, 37.5],
  ],
};

const route: SavedRoute = {
  id: "route-A",
  name: "한강공원 A",
  profile: "cycling",
  startLngLat: [127.0, 37.5],
  endLngLat: [127.02, 37.5],
  waypoints: [],
  geometry,
  distanceMeters: 2200,
  durationSec: 480,
  createdAtIso: "2026-10-01T00:00:00.000Z",
  updatedAtIso: "2026-10-06T00:00:00.000Z",
  completed: 0,
  completedAtIso: null,
  expiresAtIso: null,
  lastRideId: "ride-1",
  lastProgressRatio: 0.2,
};

const ride: StoredRideSession = {
  id: "ride-1",
  endedAt: "2026-10-06T00:00:00.000Z",
  elapsedSec: 420,
  distanceMeters: 440,
  avgSpeedKmh: 18,
  caloriesEstimate: 0,
  routeDistanceMeters: 2200,
  routeDurationSec: 480,
  userRouteId: "route-A",
  routeName: route.name,
  completionRatio: 0.2,
  sessionEndLngLat: [127.004, 37.5],
};

const view: NextRideView = {
  target: {
    kind: "resume_route",
    rideId: ride.id,
    routeId: route.id,
    progressRatio: 0.2,
    anchorLngLat: [127.004, 37.5],
  },
  ride,
  route,
};

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

document.body.style.margin = "0";
document.body.style.width = "740px";
document.body.style.height = "300px";
document.body.style.background =
  "linear-gradient(135deg, #1e3a5f 0%, #0f172a 55%, #334155 100%)";
document.body.style.position = "relative";
document.body.style.overflow = "hidden";

createRoot(root).render(
  <NextRideCard
    view={view}
    onResume={() => {}}
    onExtend={() => {}}
    onShowOnMap={() => {}}
    onDismiss={() => {}}
    onAbandonResume={() => {}}
  />,
);

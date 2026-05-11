// BOXCYCLE — Mapbox 토큰은 config.local.js 에서 window.MAPBOX_ACCESS_TOKEN 으로 주입됩니다.
// (config.local.js 는 .gitignore 처리되어 깃에 커밋되지 않습니다.)
const MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || "YOUR_MAPBOX_ACCESS_TOKEN";

const INITIAL_CENTER = [127.035, 37.505];
const DEFAULT_ZOOM = 12;
const SESSIONS_KEY = "indoor_cycle_sessions_v1";
const MY_ROUTES_KEY = "indoor_cycle_my_routes_v1";

/** 루트 Live Server용: `public/rider/pedal-sprite.png`(2400×120 → 20×120px). Vite 앱은 apps/web/public/rider 동일 에셋 사용 */
const RIDER_PEDAL_FRAME_COUNT = 20;
const RIDER_PEDAL_CELL_PX = 120;
const RIDER_PEDAL_SPRITE_REVISION = 1;
const RIDER_PEDAL_SPRITE_URL = `./public/rider/pedal-sprite.png?v=${RIDER_PEDAL_SPRITE_REVISION}`;
const RIDER_PEDAL_STYLE_ID = "boxcycle-rider-pedal-strip-keyframes";
const RIDER_MARKER_ALIGN = { pitchAlignment: "map", rotationAlignment: "map" };

const startInput = document.getElementById("startInput");
const endInput = document.getElementById("endInput");
const routeBtn = document.getElementById("routeBtn");
const driveRouteBtn = document.getElementById("driveRouteBtn");
const walkRouteBtn = document.getElementById("walkRouteBtn");
const roadOverlayBtn = document.getElementById("roadOverlayBtn");
const routeSummary = document.getElementById("routeSummary");
const mapStyleSelect = document.getElementById("mapStyleSelect");
const placeSearchInput = document.getElementById("placeSearchInput");
const placeSearchResults = document.getElementById("placeSearchResults");
const enable3DEl = document.getElementById("enable3D");
const enableBuildings3DEl = document.getElementById("enableBuildings3D");
const terrainExaggerationEl = document.getElementById("terrainExaggeration");
const elevationMetaEl = document.getElementById("elevationMeta");
const elevationChartEl = document.getElementById("elevationChart");
const cameraKeepBtn = document.getElementById("cameraKeepBtn");
const cameraNorthBtn = document.getElementById("cameraNorthBtn");
const cameraFreeBtn = document.getElementById("cameraFreeBtn");
const cameraRear30Btn = document.getElementById("cameraRear30Btn");
const cameraFront30Btn = document.getElementById("cameraFront30Btn");
const cameraRightFlatBtn = document.getElementById("cameraRightFlatBtn");
const cameraLeftFlatBtn = document.getElementById("cameraLeftFlatBtn");
const mapZoomSlider = document.getElementById("mapZoomSlider");
const mapZoomValue = document.getElementById("mapZoomValue");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");

const sessionStateEl = document.getElementById("sessionState");
const elapsedEl = document.getElementById("elapsed");
const distanceEl = document.getElementById("distance");
const avgSpeedEl = document.getElementById("avgSpeed");
const sessionList = document.getElementById("sessionList");

const myRouteNameInput = document.getElementById("myRouteNameInput");
const saveMyRouteBtn = document.getElementById("saveMyRouteBtn");
const myRoutesList = document.getElementById("myRoutesList");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const endBtn = document.getElementById("endBtn");

const BUILDING_LAYER_ID = "3d-buildings";
const TERRAIN_SOURCE_ID = "mapbox-dem";
const ROUTABLE_ROAD_LAYER_ID = "routable-roads-overlay";
const THREE_D_PITCH = 60;
const THREE_D_BEARING = -20;
const CAMERA_MIN_PITCH = 0;
// Mapbox allows pitch up to 85; clamp must not flatten side-view presets (was 80).
const CAMERA_MAX_PITCH = 85;
const CAMERA_MIN_ZOOM = 8;
const CAMERA_MAX_ZOOM = 20;
const CAMERA_PITCH_DOWN_30 = 60;
const CAMERA_PITCH_DOWN_20 = 70;
const CAMERA_PITCH_HORIZONTAL = 85;
// === 시간 기반(damping time-constant) 카메라 평활 ===
// 시간 상수 tau(초). 어떤 주사율에서도 동일한 "끈끈함"을 만든다.
// alpha_per_frame = 1 - exp(-dt / tau). 작을수록 빠르게 따라감.
const CAMERA_POSITION_TAU_SEC = 0.10; // 위치 / pitch / zoom

// === Cinematic chain bearing damping (2단 cascade) ===
// target → primary → final. 두 first-order LPF를 직렬로 걸면 second-order 거동이 되어
// 회전 시작과 끝이 모두 부드러워진다(ease-in-out). 영화/게임 카메라의 표준 기법.
// PRIMARY가 target을 빠르게 추적, SECONDARY가 PRIMARY를 더 천천히 추적.
const CAMERA_BEARING_TAU_PRIMARY_SEC = 0.15;
const CAMERA_BEARING_TAU_SECONDARY_SEC = 0.35;
// 회전 속도 상한(°/sec). 두 단계에 모두 걸어 어쩌다 큰 점프가 와도 부드럽게 잘라줌.
const CAMERA_BEARING_MAX_DPS_PRIMARY = 360;
const CAMERA_BEARING_MAX_DPS_SECONDARY = 220;

// dt clamp 상한(ms). 탭 비활성 후 복귀 시 dt 폭주 방지.
const CAMERA_MAX_DT_MS = 50;

// === sliding-window 평균 bearing (원형 평균) ===
// window 내 sample 간격이 작을수록 segment 경계 점프가 평균에 미치는 영향이 줄어든다.
// 30m / 60 = 0.5m 간격 → 매 프레임 target이 거의 연속적으로 변화.
const CAMERA_BEARING_WINDOW_METERS = 30;
const CAMERA_BEARING_WINDOW_SAMPLES = 60;

if (MAPBOX_ACCESS_TOKEN === "YOUR_MAPBOX_ACCESS_TOKEN") {
  routeSummary.textContent = "토큰이 필요합니다: config.example.js를 config.local.js로 복사하고 Mapbox 토큰을 입력하세요.";
}

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/satellite-streets-v12",
  center: INITIAL_CENTER,
  zoom: DEFAULT_ZOOM
});
map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

let startMarker = null;
let endMarker = null;
let liveMarker = null;
let liveMarkerSpriteEl = null;
let liveMarkerFlipEl = null;
let prevLiveLngLatForRider = null;
let currentRoute = null;
let routeDistanceMeters = 0;
let routeDurationSec = 0;
let pendingPopupLngLat = null;
let activePointPopup = null;
let placeSearchTimer = null;
let lastPlaceSuggestions = [];
// 장소 검색 드롭다운에서 키보드/마우스로 강조 중인 항목 인덱스(-1 = 강조 없음).
let activeSuggestionIndex = -1;
const elevationProfileState = {
  elevations: []
};
const map3DState = {
  enabled: true,
  enableBuildings: true,
  terrainExaggeration: 1.3
};
const roadOverlayState = {
  enabled: false
};
const cameraFollowState = {
  mode: "keep",
  lockedBearing: 0,
  viewMode: "none"
};
const cameraStabilityState = {
  smoothedCenter: null,
  smoothedBearing: null,
  smoothedBearingPrimary: null, // chain damping의 1단계 결과(중간값)
  smoothedPitch: null,
  smoothedZoom: null,
  riskScore: 0
};
const rideConfig = {
  speedKmh: Number(speedSlider.value || 25)
};
const routeProfileState = {
  profile: "cycling"
};

const session = {
  status: "idle",
  startedAt: null,
  accumulatedMs: 0,
  virtualDistanceMeters: 0,
  followBaseZoom: DEFAULT_ZOOM,
  animationFrameId: null,
  lastAnimationTs: null,
  lastMetricsTs: null
};

function parseLngLat(inputValue) {
  const parts = inputValue.split(",").map((v) => Number(v.trim()));
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts;
}

function formatLngLat(lngLat) {
  return `${lngLat[0].toFixed(6)},${lngLat[1].toFixed(6)}`;
}

function setStartPoint(lngLat) {
  startInput.value = formatLngLat(lngLat);
  if (startMarker) startMarker.remove();
  startMarker = new mapboxgl.Marker({ color: "#16a34a" }).setLngLat(lngLat).addTo(map);
}

function setEndPoint(lngLat) {
  endInput.value = formatLngLat(lngLat);
  if (endMarker) endMarker.remove();
  endMarker = new mapboxgl.Marker({ color: "#dc2626" }).setLngLat(lngLat).addTo(map);
}

function getDistanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function interpolatePoint(a, b, ratio) {
  return [
    a[0] + (b[0] - a[0]) * ratio,
    a[1] + (b[1] - a[1]) * ratio
  ];
}

function getPointOnRouteByDistance(distanceMeters) {
  if (!currentRoute || !currentRoute.coordinates || !currentRoute.coordinates.length) return null;
  const coords = currentRoute.coordinates;
  if (coords.length === 1) return coords[0];

  let remaining = Math.max(0, distanceMeters);
  for (let i = 0; i < coords.length - 1; i += 1) {
    const segmentStart = coords[i];
    const segmentEnd = coords[i + 1];
    const segmentDistance = getDistanceMeters(segmentStart, segmentEnd);
    if (segmentDistance <= 0) continue;
    if (remaining <= segmentDistance) {
      const ratio = remaining / segmentDistance;
      return interpolatePoint(segmentStart, segmentEnd, ratio);
    }
    remaining -= segmentDistance;
  }
  return coords[coords.length - 1];
}

function getBearingFromPoints(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function ensureRiderPedalStripKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(RIDER_PEDAL_STYLE_ID)) return;
  const N = RIDER_PEDAL_FRAME_COUNT;
  const CELL = RIDER_PEDAL_CELL_PX;
  const totalW = N * CELL;
  const style = document.createElement("style");
  style.id = RIDER_PEDAL_STYLE_ID;
  style.textContent = `
@keyframes cycling-marker-riding-pedal-cycle {
  from { background-position: 0 0; }
  to { background-position: -${totalW}px 0; }
}
.cycling-sim-marker-pedal-sprite {
  width: ${CELL}px;
  height: ${CELL}px;
  box-sizing: border-box;
  background-repeat: no-repeat;
  background-size: ${totalW}px ${CELL}px;
  background-position: 0 0;
  animation-name: cycling-marker-riding-pedal-cycle;
  animation-timing-function: steps(${N}, end);
  animation-iteration-count: infinite;
  animation-play-state: paused;
  user-select: none;
  -webkit-user-drag: none;
}
`;
  document.head.appendChild(style);
}

function createLiveRiderMarkerRoot() {
  ensureRiderPedalStripKeyframes();
  const root = document.createElement("div");
  root.className = "cycling-sim-marker-host";
  const flip = document.createElement("div");
  flip.className = "cycling-sim-marker-flip";
  const stack = document.createElement("div");
  stack.className = "cycling-sim-marker-stack";
  const sprite = document.createElement("div");
  sprite.className = "cycling-sim-marker-pedal-sprite";
  sprite.style.backgroundImage = `url("${RIDER_PEDAL_SPRITE_URL}")`;
  stack.appendChild(sprite);
  flip.appendChild(stack);
  root.appendChild(flip);
  root.setAttribute("aria-hidden", "true");
  root.title = "현재 위치";
  return { root, flip, sprite };
}

function estimateCrankRpmFromSpeedKmh(speedKmh) {
  const speed = Math.min(95, Math.max(0, speedKmh));
  return Math.min(128, Math.max(16, 22 + speed * 2.85));
}

function updateLiveRiderPedalAndFlip(point, cappedDistance) {
  if (!liveMarkerFlipEl || !liveMarkerSpriteEl) return;

  const prev = prevLiveLngLatForRider;
  let bearingDeg = null;
  if (prev && getDistanceMeters(prev, point) >= 2) {
    bearingDeg = getBearingFromPoints(prev, point);
  }
  if (bearingDeg == null) {
    bearingDeg = getRouteHeadingByDistance(cappedDistance);
  }
  const b = bearingDeg ?? 0;
  liveMarkerFlipEl.style.transform = b > 90 && b < 270 ? "scaleX(-1)" : "scaleX(1)";
  prevLiveLngLatForRider = point;

  const speedNow = rideConfig.speedKmh;
  const pedalingRunning = session.status === "running" && speedNow > 0.35;
  const rpm = estimateCrankRpmFromSpeedKmh(speedNow);
  let pedalLoopSec = 60 / rpm;
  pedalLoopSec = Math.min(5.5, Math.max(0.22, pedalLoopSec));
  liveMarkerSpriteEl.style.animationDuration = `${pedalLoopSec}s`;
  liveMarkerSpriteEl.style.animationPlayState = pedalingRunning ? "running" : "paused";
}

function syncLiveRiderMarkerAppearance() {
  if (!liveMarkerSpriteEl || !currentRoute) return;
  const cappedDistance =
    routeDistanceMeters > 0
      ? Math.min(session.virtualDistanceMeters, routeDistanceMeters)
      : session.virtualDistanceMeters;
  const point = getPointOnRouteByDistance(cappedDistance);
  if (!point) return;
  updateLiveRiderPedalAndFlip(point, cappedDistance);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function normalizeAngle(angle) {
  let normalized = angle % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
}

function shortestAngleDelta(from, to) {
  return normalizeAngle(to - from);
}

function lerpAngle(from, to, t, maxStep) {
  const delta = shortestAngleDelta(from, to);
  const stepped = clamp(delta * t, -maxStep, maxStep);
  return normalizeAngle(from + stepped);
}

// 시간 상수 tau에 따른 프레임당 보간 계수. dt가 0이면 0(움직임 없음).
function dampAlpha(dtSec, tauSec) {
  if (tauSec <= 0 || dtSec <= 0) return 0;
  return 1 - Math.exp(-dtSec / tauSec);
}

function resetCameraSmoothing() {
  const center = map.getCenter();
  const bearing = map.getBearing();
  cameraStabilityState.smoothedCenter = [center.lng, center.lat];
  cameraStabilityState.smoothedBearing = bearing;
  cameraStabilityState.smoothedBearingPrimary = bearing;
  cameraStabilityState.smoothedPitch = map.getPitch();
  cameraStabilityState.smoothedZoom = map.getZoom();
  cameraStabilityState.riskScore = 0;
}

function isRiskyCameraTarget(targetPitch, targetZoom, targetBearing, currentBearing, viewMode) {
  if (!map3DState.enabled) return false;
  const bearingDelta = Math.abs(shortestAngleDelta(currentBearing, targetBearing));
  // Side views deliberately use horizon-style pitch (~85°). The generic high-pitch guard
  // spams risk and drops follow into free camera, which looks like "no tracking".
  if (viewMode === "rightFlat" || viewMode === "leftFlat") {
    return targetPitch > 84 && targetZoom > 19.7 && bearingDelta > 55;
  }
  return (targetPitch > 76 && targetZoom > 19.2) || (targetPitch > 72 && bearingDelta > 40);
}

function getRouteHeadingByDistance(distanceMeters, lookaheadMeters = 0) {
  if (!currentRoute || !currentRoute.coordinates || currentRoute.coordinates.length < 2) return 0;
  const coords = currentRoute.coordinates;
  let remaining = Math.max(0, distanceMeters + lookaheadMeters);

  for (let i = 0; i < coords.length - 1; i += 1) {
    const start = coords[i];
    const end = coords[i + 1];
    const segmentDistance = getDistanceMeters(start, end);
    if (segmentDistance <= 0) continue;
    if (remaining <= segmentDistance) {
      return getBearingFromPoints(start, end);
    }
    remaining -= segmentDistance;
  }
  return getBearingFromPoints(coords[coords.length - 2], coords[coords.length - 1]);
}

// 라이더 앞쪽 window 구간에서 N개의 진행방향을 뽑아 원형 평균(circular mean)을 낸다.
// segment 경계에서의 점프가 자연스럽게 가중 평균으로 흡수돼 카메라 회전이 부드러워진다.
function getAverageHeadingAhead(distanceMeters, windowMeters, samples) {
  if (samples <= 0 || windowMeters <= 0) {
    return getRouteHeadingByDistance(distanceMeters);
  }
  let sumX = 0;
  let sumY = 0;
  for (let i = 1; i <= samples; i += 1) {
    const d = distanceMeters + (windowMeters * i) / samples;
    const headingRad = (getRouteHeadingByDistance(d) * Math.PI) / 180;
    sumX += Math.cos(headingRad);
    sumY += Math.sin(headingRad);
  }
  let deg = (Math.atan2(sumY, sumX) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function getCameraByViewMode(currentDistance) {
  const viewMode = cameraFollowState.viewMode;
  // 직진(rear/front)은 앞쪽 윈도우 평균 → 코너에서 점진적 회전.
  // 측면(right/left)은 현재 진행방향 기준 ±90°가 정의이므로 평균 없이 사용.
  const heading = normalizeCompassDegrees(
    viewMode === "rear30" || viewMode === "front30"
      ? getAverageHeadingAhead(
          currentDistance,
          CAMERA_BEARING_WINDOW_METERS,
          CAMERA_BEARING_WINDOW_SAMPLES
        )
      : getRouteHeadingByDistance(currentDistance)
  );
  // Rear follows from behind; opposite side of front view.
  if (viewMode === "rear30") return { bearing: heading, pitch: CAMERA_PITCH_DOWN_20 };
  if (viewMode === "front30") return { bearing: (heading + 180) % 360, pitch: CAMERA_PITCH_DOWN_30 };
  // Perpendicular to travel: map bearing = heading ± 90° (clockwise from north, Mapbox-style).
  if (viewMode === "rightFlat") return { bearing: (heading + 90) % 360, pitch: CAMERA_PITCH_HORIZONTAL };
  if (viewMode === "leftFlat") return { bearing: (heading + 270) % 360, pitch: CAMERA_PITCH_HORIZONTAL };
  return null;
}

function normalizeCompassDegrees(deg) {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

function updateLiveMarkerPosition(dtMs = 0) {
  if (!currentRoute) return;
  const cappedDistance = routeDistanceMeters > 0
    ? Math.min(session.virtualDistanceMeters, routeDistanceMeters)
    : session.virtualDistanceMeters;
  const point = getPointOnRouteByDistance(cappedDistance);
  if (!point) return;

  if (!liveMarker) {
    const dom = createLiveRiderMarkerRoot();
    liveMarkerFlipEl = dom.flip;
    liveMarkerSpriteEl = dom.sprite;
    prevLiveLngLatForRider = null;
    liveMarker = new mapboxgl.Marker({ element: dom.root, ...RIDER_MARKER_ALIGN })
      .setLngLat(point)
      .addTo(map);
  } else {
    liveMarker.setLngLat(point);
  }
  updateLiveRiderPedalAndFlip(point, cappedDistance);

  if (cameraFollowState.mode === "free" && cameraFollowState.viewMode === "none") {
    return;
  }

  const presetCamera = getCameraByViewMode(cappedDistance);
  const targetBearing = presetCamera
    ? presetCamera.bearing
    : cameraFollowState.mode === "north"
      ? 0
      : cameraFollowState.mode === "keep"
        ? cameraFollowState.lockedBearing
        : map.getBearing();
  const targetPitch = presetCamera ? presetCamera.pitch : map.getPitch();
  const targetZoom = map.getZoom();
  const safePitch = clamp(targetPitch, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH);
  const safeZoom = clamp(targetZoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
  const currentBearing = cameraStabilityState.smoothedBearing ?? map.getBearing();
  const safeBearing = normalizeAngle(targetBearing);

  if (isRiskyCameraTarget(safePitch, safeZoom, safeBearing, currentBearing, cameraFollowState.viewMode)) {
    cameraStabilityState.riskScore += 1;
  } else {
    cameraStabilityState.riskScore = Math.max(0, cameraStabilityState.riskScore - 1);
  }

  if (cameraStabilityState.riskScore >= 4) {
    cameraFollowState.mode = "free";
    cameraFollowState.viewMode = "none";
    cameraFollowState.lockedBearing = map.getBearing();
    updateCameraModeButtons();
    routeSummary.textContent = "카메라 안정화를 위해 자유 카메라로 전환되었습니다.";
    cameraStabilityState.riskScore = 0;
    return;
  }

  if (!cameraStabilityState.smoothedCenter) {
    resetCameraSmoothing();
  }

  // dt 기반 평활: frame-rate / 주사율에 무관한 일관된 카메라 거동.
  // 첫 프레임이나 폭주 dt(탭 복귀 등)는 clamp + alpha=0으로 흡수.
  const dtSec = clamp(dtMs, 0, CAMERA_MAX_DT_MS) / 1000;
  const alphaPos = dampAlpha(dtSec, CAMERA_POSITION_TAU_SEC);
  const alphaBearingPrimary = dampAlpha(dtSec, CAMERA_BEARING_TAU_PRIMARY_SEC);
  const alphaBearingSecondary = dampAlpha(dtSec, CAMERA_BEARING_TAU_SECONDARY_SEC);
  const maxStepPrimary = CAMERA_BEARING_MAX_DPS_PRIMARY * dtSec;
  const maxStepSecondary = CAMERA_BEARING_MAX_DPS_SECONDARY * dtSec;

  const [curLng, curLat] = cameraStabilityState.smoothedCenter;
  const smoothedLng = lerp(curLng, point[0], alphaPos);
  const smoothedLat = lerp(curLat, point[1], alphaPos);
  const smoothedPitch = lerp(cameraStabilityState.smoothedPitch, safePitch, alphaPos);
  const smoothedZoom = lerp(cameraStabilityState.smoothedZoom, safeZoom, alphaPos);

  // Chain damping for bearing: target → primary → final.
  // 1단(빠른 LPF): target을 추적해 매끄러운 중간값을 만든다.
  const smoothedBearingPrimary = lerpAngle(
    cameraStabilityState.smoothedBearingPrimary,
    safeBearing,
    alphaBearingPrimary,
    maxStepPrimary
  );
  // 2단(느린 LPF): 1단 결과를 다시 추적 → second-order 거동(ease-in-out).
  const smoothedBearing = lerpAngle(
    cameraStabilityState.smoothedBearing,
    smoothedBearingPrimary,
    alphaBearingSecondary,
    maxStepSecondary
  );

  cameraStabilityState.smoothedCenter = [smoothedLng, smoothedLat];
  cameraStabilityState.smoothedPitch = smoothedPitch;
  cameraStabilityState.smoothedZoom = smoothedZoom;
  cameraStabilityState.smoothedBearingPrimary = smoothedBearingPrimary;
  cameraStabilityState.smoothedBearing = smoothedBearing;

  map.jumpTo({
    center: cameraStabilityState.smoothedCenter,
    bearing: smoothedBearing,
    pitch: smoothedPitch,
    zoom: smoothedZoom
  });
}

function updateCameraModeButtons() {
  cameraKeepBtn.classList.toggle("active", cameraFollowState.mode === "keep");
  cameraNorthBtn.classList.toggle("active", cameraFollowState.mode === "north");
  cameraFreeBtn.classList.toggle("active", cameraFollowState.mode === "free" && cameraFollowState.viewMode === "none");
  cameraRear30Btn.classList.toggle("active", cameraFollowState.viewMode === "rear30");
  cameraFront30Btn.classList.toggle("active", cameraFollowState.viewMode === "front30");
  cameraRightFlatBtn.classList.toggle("active", cameraFollowState.viewMode === "rightFlat");
  cameraLeftFlatBtn.classList.toggle("active", cameraFollowState.viewMode === "leftFlat");
}

function renderMapZoomValue(zoom) {
  mapZoomValue.textContent = zoom.toFixed(1);
}

function renderSpeedValue() {
  speedValue.textContent = `${rideConfig.speedKmh} km/h`;
}

function updateRouteProfileButtons() {
  driveRouteBtn.classList.toggle("active", routeProfileState.profile === "driving");
  routeBtn.classList.toggle("active", routeProfileState.profile === "cycling");
  walkRouteBtn.classList.toggle("active", routeProfileState.profile === "walking");
}

function updateRoadOverlayButton() {
  roadOverlayBtn.classList.toggle("active", roadOverlayState.enabled);
}

function updateElevationProgressMarker() {
  if (!elevationProfileState.elevations.length) return;
  elevationChartEl.classList.remove("empty");
  elevationChartEl.innerHTML = buildElevationSvg(elevationProfileState.elevations);
}

function resetLiveMarker() {
  if (liveMarker) {
    liveMarker.remove();
    liveMarker = null;
  }
  liveMarkerSpriteEl = null;
  liveMarkerFlipEl = null;
  prevLiveLngLatForRider = null;
}

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function renderSessionMetrics() {
  const elapsedSec = Math.floor(session.accumulatedMs / 1000);
  const avgSpeed = elapsedSec > 0 ? (session.virtualDistanceMeters / 1000) / (elapsedSec / 3600) : 0;

  sessionStateEl.textContent =
    session.status === "idle"
      ? "대기"
      : session.status === "running"
        ? "주행 중"
        : "일시정지";

  elapsedEl.textContent = formatDuration(elapsedSec);
  distanceEl.textContent = `${(session.virtualDistanceMeters / 1000).toFixed(2)} km`;
  avgSpeedEl.textContent = `${avgSpeed.toFixed(1)} km/h`;
}

function setButtonsByState() {
  const isIdle = session.status === "idle";
  const isRunning = session.status === "running";
  const isPaused = session.status === "paused";

  startBtn.disabled = !isIdle || !currentRoute;
  pauseBtn.disabled = !isRunning;
  resumeBtn.disabled = !isPaused;
  endBtn.disabled = isIdle;
}

function stopTicker() {
  if (session.animationFrameId) {
    cancelAnimationFrame(session.animationFrameId);
    session.animationFrameId = null;
  }
  session.lastAnimationTs = null;
  session.lastMetricsTs = null;
}

function startTicker() {
  const animate = (timestampMs) => {
    if (session.status !== "running") return;

    if (session.lastAnimationTs == null) {
      session.lastAnimationTs = timestampMs;
      session.lastMetricsTs = timestampMs;
    }

    const deltaMs = Math.max(0, timestampMs - session.lastAnimationTs);
    session.lastAnimationTs = timestampMs;
    const virtualSpeedMetersPerSec = (rideConfig.speedKmh * 1000) / 3600;

    session.accumulatedMs += deltaMs;
    session.virtualDistanceMeters += virtualSpeedMetersPerSec * (deltaMs / 1000);
    updateLiveMarkerPosition(deltaMs);
    updateElevationProgressMarker();

    if (session.lastMetricsTs == null || timestampMs - session.lastMetricsTs >= 200) {
      renderSessionMetrics();
      session.lastMetricsTs = timestampMs;
    }

    session.animationFrameId = requestAnimationFrame(animate);
  };

  session.animationFrameId = requestAnimationFrame(animate);
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSessions(items) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(items));
}

function loadMyRoutes() {
  try {
    const raw = localStorage.getItem(MY_ROUTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMyRoutes(items) {
  localStorage.setItem(MY_ROUTES_KEY, JSON.stringify(items));
}

function buildMyRouteTitle(item) {
  const startText = item.start ? formatLngLat(item.start) : "-";
  const endText = item.end ? formatLngLat(item.end) : "-";
  const profileLabel =
    item.profile === "driving" ? "자동차" : item.profile === "walking" ? "보행자" : "자전거";
  const name = (item.name || "").trim();
  const namePart = name ? `${name} · ` : "";
  return `${namePart}${profileLabel} · ${startText} → ${endText}`;
}

function renderMyRoutesList() {
  if (!myRoutesList) return;
  const items = loadMyRoutes();
  myRoutesList.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "저장된 경로 없음";
    myRoutesList.appendChild(li);
    return;
  }

  items.slice(0, 10).forEach((item) => {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "my-route-row";

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = buildMyRouteTitle(item);

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "btn-ghost";
    loadBtn.textContent = "불러오기";
    loadBtn.dataset.action = "load-my-route";
    loadBtn.dataset.routeId = item.id;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-danger";
    delBtn.textContent = "삭제";
    delBtn.dataset.action = "delete-my-route";
    delBtn.dataset.routeId = item.id;

    row.appendChild(title);
    row.appendChild(loadBtn);
    row.appendChild(delBtn);
    li.appendChild(row);
    myRoutesList.appendChild(li);
  });
}

function waitForStyleLoadOnce() {
  return new Promise((resolve) => {
    if (map.isStyleLoaded && map.isStyleLoaded()) {
      resolve();
      return;
    }
    const handler = () => {
      map.off("style.load", handler);
      resolve();
    };
    map.on("style.load", handler);
  });
}

async function applyMyRoute(item) {
  if (!item) return;
  if (!item.start || !item.end) return;

  startInput.value = formatLngLat(item.start);
  endInput.value = formatLngLat(item.end);
  setStartPoint(item.start);
  setEndPoint(item.end);

  if (item.profile) {
    routeProfileState.profile = item.profile;
    updateRouteProfileButtons();
  }

  const nextStyle = item.mapStyle;
  if (nextStyle && mapStyleSelect && mapStyleSelect.value !== nextStyle) {
    mapStyleSelect.value = nextStyle;
    map.setStyle(nextStyle);
    await waitForStyleLoadOnce();
  }

  await generateRouteForCurrentProfile();
}

function saveCurrentRouteToMyRoutes() {
  const start = parseLngLat(startInput.value);
  const end = parseLngLat(endInput.value);
  if (!start || !end) {
    routeSummary.textContent = "먼저 출발/도착 좌표를 설정한 뒤 저장할 수 있습니다.";
    return;
  }

  const items = loadMyRoutes();
  const name = (myRouteNameInput?.value || "").trim();
  const mapStyle = mapStyleSelect?.value || null;
  const profile = routeProfileState.profile;

  // 동일 start/end/profile은 기존 항목을 앞으로 이동(업데이트) 처리
  const existingIdx = items.findIndex(
    (it) =>
      it &&
      it.profile === profile &&
      Array.isArray(it.start) &&
      Array.isArray(it.end) &&
      Math.abs(it.start[0] - start[0]) < 1e-7 &&
      Math.abs(it.start[1] - start[1]) < 1e-7 &&
      Math.abs(it.end[0] - end[0]) < 1e-7 &&
      Math.abs(it.end[1] - end[1]) < 1e-7
  );

  const nowIso = new Date().toISOString();
  const item = {
    id: existingIdx >= 0 ? items[existingIdx].id : crypto.randomUUID(),
    name,
    start,
    end,
    profile,
    mapStyle,
    updatedAt: nowIso
  };

  const next = [...items];
  if (existingIdx >= 0) next.splice(existingIdx, 1);
  next.unshift(item);
  saveMyRoutes(next.slice(0, 10));
  renderMyRoutesList();

  if (myRouteNameInput) myRouteNameInput.value = "";
  routeSummary.textContent = "My routes에 저장했습니다.";
}

function renderSessionList() {
  const items = loadSessions();
  sessionList.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "기록 없음";
    sessionList.appendChild(li);
    return;
  }

  items.slice(0, 5).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${new Date(item.endedAt).toLocaleString()} / ${(item.distanceMeters / 1000).toFixed(2)} km / ${formatDuration(item.elapsedSec)}`;
    sessionList.appendChild(li);
  });
}

function setElevationStatus(message) {
  elevationMetaEl.textContent = message;
}

function setElevationEmptyState(message) {
  elevationChartEl.classList.add("empty");
  elevationChartEl.textContent = message;
}

function sampleRouteCoordinates(coords, sampleCount = 80) {
  if (!coords || !coords.length) return [];
  if (coords.length <= sampleCount) return coords;

  const sampled = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const idx = Math.round((i / (sampleCount - 1)) * (coords.length - 1));
    sampled.push(coords[idx]);
  }
  return sampled;
}

async function fetchElevations(sampledCoords) {
  const latitudes = sampledCoords.map((coord) => coord[1].toFixed(6)).join(",");
  const longitudes = sampledCoords.map((coord) => coord[0].toFixed(6)).join(",");
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("고도 데이터 요청 실패");
  const data = await response.json();
  if (!data.elevation || !data.elevation.length) throw new Error("고도 데이터를 받지 못했습니다.");
  return data.elevation;
}

function buildElevationSvg(elevations) {
  const width = 390;
  const height = 130;
  const padding = 12;
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = Math.max(max - min, 1);
  const distanceRatio = routeDistanceMeters > 0
    ? Math.min(session.virtualDistanceMeters / routeDistanceMeters, 1)
    : 0;

  const points = elevations.map((value, index) => {
    const x = padding + (index / (elevations.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y, value };
  });

  const areaPoints = [
    `${padding},${height - padding}`,
    ...points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`),
    `${width - padding},${height - padding}`
  ].join(" ");
  const polylinePoints = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

  // Continuous interpolation prevents marker jumps between sampled points.
  const markerProgress = Math.max(0, Math.min(distanceRatio * (points.length - 1), points.length - 1));
  const markerLowerIndex = Math.floor(markerProgress);
  const markerUpperIndex = Math.min(points.length - 1, markerLowerIndex + 1);
  const markerT = markerProgress - markerLowerIndex;
  const lowerPoint = points[markerLowerIndex];
  const upperPoint = points[markerUpperIndex];
  const markerPoint = {
    x: lowerPoint.x + (upperPoint.x - lowerPoint.x) * markerT,
    y: lowerPoint.y + (upperPoint.y - lowerPoint.y) * markerT
  };

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#f9fafb"></rect>
      <polygon points="${areaPoints}" fill="rgba(37,99,235,0.18)"></polygon>
      <polyline points="${polylinePoints}" fill="none" stroke="#2563eb" stroke-width="2"></polyline>
      <circle cx="${markerPoint.x.toFixed(2)}" cy="${markerPoint.y.toFixed(2)}" r="4.5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5"></circle>
      <text x="${padding}" y="14" font-size="10" fill="#374151">max ${max.toFixed(0)}m</text>
      <text x="${padding}" y="${height - 4}" font-size="10" fill="#6b7280">min ${min.toFixed(0)}m</text>
    </svg>
  `;
}

function calculateElevationGain(elevations) {
  let gain = 0;
  for (let i = 1; i < elevations.length; i += 1) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) gain += diff;
  }
  return gain;
}

async function renderElevationProfile(routeGeometry) {
  if (!routeGeometry || !routeGeometry.coordinates || routeGeometry.coordinates.length < 2) {
    setElevationStatus("경로 없음");
    setElevationEmptyState("데이터 없음");
    return;
  }

  setElevationStatus("고도 계산 중...");
  setElevationEmptyState("로딩 중...");

  try {
    const sampledCoords = sampleRouteCoordinates(routeGeometry.coordinates, 80);
    const elevations = await fetchElevations(sampledCoords);
    elevationProfileState.elevations = elevations;
    updateElevationProgressMarker();

    const gain = calculateElevationGain(elevations);
    setElevationStatus(`최저 ${Math.min(...elevations).toFixed(0)}m / 최고 ${Math.max(...elevations).toFixed(0)}m / 상승 ${gain.toFixed(0)}m`);
  } catch (error) {
    setElevationStatus("고도 계산 실패");
    setElevationEmptyState("고도 데이터를 불러오지 못했습니다.");
  }
}

function addOrUpdateRouteLayer(geometry) {
  const routeFeature = {
    type: "Feature",
    geometry
  };

  if (map.getSource("route")) {
    map.getSource("route").setData(routeFeature);
  } else {
    map.addSource("route", { type: "geojson", data: routeFeature });
    map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#2563eb",
        "line-width": 4
      }
    });
  }
}

function applyRoadOverlayState() {
  const hasLayer = Boolean(map.getLayer(ROUTABLE_ROAD_LAYER_ID));
  if (roadOverlayState.enabled && !hasLayer) {
    map.addLayer({
      id: ROUTABLE_ROAD_LAYER_ID,
      type: "line",
      source: "composite",
      "source-layer": "road",
      filter: [
        "in",
        ["coalesce", ["get", "class"], ""],
        ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "street", "street_limited", "service", "track", "path", "cycleway"]]
      ],
      layout: {
        "line-cap": "round",
        "line-join": "round"
      },
      paint: {
        "line-color": "#22d3ee",
        "line-opacity": 0.9,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10, 1.2,
          13, 2.2,
          16, 4
        ]
      }
    });
  } else if (!roadOverlayState.enabled && hasLayer) {
    map.removeLayer(ROUTABLE_ROAD_LAYER_ID);
  }
  updateRoadOverlayButton();
}

function ensureTerrainSource() {
  if (map.getSource(TERRAIN_SOURCE_ID)) return;
  map.addSource(TERRAIN_SOURCE_ID, {
    type: "raster-dem",
    url: "mapbox://mapbox.terrain-rgb",
    tileSize: 512,
    maxzoom: 14
  });
}

function add3DBuildingsLayer() {
  if (map.getLayer(BUILDING_LAYER_ID)) return;
  const layers = map.getStyle().layers || [];
  const labelLayer = layers.find((layer) => layer.type === "symbol" && layer.layout && layer.layout["text-field"]);
  const beforeLayerId = labelLayer ? labelLayer.id : undefined;

  map.addLayer(
    {
      id: BUILDING_LAYER_ID,
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 15,
      paint: {
        "fill-extrusion-color": "#cbd5e1",
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "min_height"],
        "fill-extrusion-opacity": 0.6
      }
    },
    beforeLayerId
  );
}

function remove3DBuildingsLayer() {
  if (map.getLayer(BUILDING_LAYER_ID)) {
    map.removeLayer(BUILDING_LAYER_ID);
  }
}

function apply3DState() {
  if (map3DState.enabled) {
    ensureTerrainSource();
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: map3DState.terrainExaggeration });

    if (map3DState.enableBuildings) {
      add3DBuildingsLayer();
    } else {
      remove3DBuildingsLayer();
    }

    map.easeTo({ pitch: THREE_D_PITCH, bearing: THREE_D_BEARING, duration: 600 });
  } else {
    map.setTerrain(null);
    remove3DBuildingsLayer();
    map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  }
}

function restoreRouteAfterStyleChange() {
  if (!currentRoute) return;
  addOrUpdateRouteLayer(currentRoute);
}

function hidePlaceResults() {
  placeSearchResults.classList.remove("show");
  placeSearchResults.innerHTML = "";
  activeSuggestionIndex = -1;
}

function renderPlaceResults(features) {
  lastPlaceSuggestions = features;
  activeSuggestionIndex = -1;
  if (!features.length) {
    hidePlaceResults();
    return;
  }

  placeSearchResults.innerHTML = features
    .map((feature, index) => `<li data-place-index="${index}">${feature.place_name}</li>`)
    .join("");
  placeSearchResults.classList.add("show");
}

function applySuggestionHighlight() {
  const items = placeSearchResults.querySelectorAll("li");
  items.forEach((li, i) => {
    const isActive = i === activeSuggestionIndex;
    li.classList.toggle("active", isActive);
    if (isActive) {
      li.scrollIntoView({ block: "nearest" });
    }
  });
}

function selectPlaceSuggestion(index) {
  const selected = lastPlaceSuggestions[index];
  if (!selected || !selected.center) return;
  placeSearchInput.value = selected.place_name;
  map.flyTo({ center: selected.center, zoom: Math.max(map.getZoom(), 14), duration: 1200 });
  hidePlaceResults();
  routeSummary.textContent = `검색 위치로 이동: ${selected.place_name}`;
}

async function fetchPlaceSuggestions(query) {
  const encodedQuery = encodeURIComponent(query);
  const mapCenter = map.getCenter();
  const proximity = `${mapCenter.lng},${mapCenter.lat}`;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json` +
    `?autocomplete=true&limit=6&language=ko,en&proximity=${proximity}&access_token=${MAPBOX_ACCESS_TOKEN}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("지명 검색 요청 실패");
  const data = await response.json();
  return data.features || [];
}

async function fetchRouteByProfile(start, end, profile) {
  const coords = `${start[0]},${start[1]};${end[0]},${end[1]}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_ACCESS_TOKEN}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Directions API 요청 실패");
  const data = await response.json();
  if (!data.routes || !data.routes.length) throw new Error("경로를 찾지 못했습니다.");
  return data.routes[0];
}

async function generateRouteForCurrentProfile() {
  const start = parseLngLat(startInput.value);
  const end = parseLngLat(endInput.value);

  if (!start || !end) {
    routeSummary.textContent = "좌표 형식이 올바르지 않습니다. lng,lat 형식으로 입력하세요.";
    return;
  }
  if (MAPBOX_ACCESS_TOKEN === "YOUR_MAPBOX_ACCESS_TOKEN") {
    routeSummary.textContent = "먼저 app.js에 Mapbox 토큰을 입력하세요.";
    return;
  }

  driveRouteBtn.disabled = true;
  routeBtn.disabled = true;
  walkRouteBtn.disabled = true;
  routeSummary.textContent = "경로 계산 중...";
  try {
    const route = await fetchRouteByProfile(start, end, routeProfileState.profile);
    currentRoute = route.geometry;
    routeDistanceMeters = route.distance;
    routeDurationSec = route.duration;

    addOrUpdateRouteLayer(route.geometry);

    setStartPoint(start);
    setEndPoint(end);

    const bounds = new mapboxgl.LngLatBounds();
    route.geometry.coordinates.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, { padding: 40 });

    routeSummary.textContent = `거리 ${(routeDistanceMeters / 1000).toFixed(2)} km / 예상 ${formatDuration(routeDurationSec)}`;
    renderElevationProfile(route.geometry);
    if (session.status !== "idle") {
      updateLiveMarkerPosition();
    }
  } catch (error) {
    routeSummary.textContent = error.message;
  } finally {
    driveRouteBtn.disabled = false;
    routeBtn.disabled = false;
    walkRouteBtn.disabled = false;
    setButtonsByState();
  }
}

startBtn.addEventListener("click", () => {
  session.status = "running";
  session.startedAt = Date.now();
  session.accumulatedMs = 0;
  session.virtualDistanceMeters = 0;
  session.followBaseZoom = map.getZoom();
  updateLiveMarkerPosition();
  updateElevationProgressMarker();
  startTicker();
  renderSessionMetrics();
  setButtonsByState();
});

pauseBtn.addEventListener("click", () => {
  session.status = "paused";
  stopTicker();
  syncLiveRiderMarkerAppearance();
  updateElevationProgressMarker();
  renderSessionMetrics();
  setButtonsByState();
});

resumeBtn.addEventListener("click", () => {
  session.status = "running";
  updateElevationProgressMarker();
  startTicker();
  renderSessionMetrics();
  setButtonsByState();
});

endBtn.addEventListener("click", () => {
  if (session.status === "idle") return;

  stopTicker();
  const elapsedSec = Math.floor(session.accumulatedMs / 1000);
  const caloriesEstimate = Math.round((session.virtualDistanceMeters / 1000) * 30);
  const sessions = loadSessions();

  sessions.unshift({
    id: crypto.randomUUID(),
    endedAt: new Date().toISOString(),
    elapsedSec,
    distanceMeters: session.virtualDistanceMeters,
    avgSpeedKmh:
      elapsedSec > 0
        ? (session.virtualDistanceMeters / 1000) / (elapsedSec / 3600)
        : 0,
    caloriesEstimate,
    routeDistanceMeters,
    routeDurationSec
  });
  saveSessions(sessions);

  session.status = "idle";
  session.startedAt = null;
  session.accumulatedMs = 0;
  session.virtualDistanceMeters = 0;
  resetLiveMarker();
  updateElevationProgressMarker();
  renderSessionMetrics();
  renderSessionList();
  setButtonsByState();
});

map.on("load", () => {
  renderSessionMetrics();
  renderSessionList();
  renderMyRoutesList();
  setButtonsByState();
  cameraFollowState.lockedBearing = map.getBearing();
  updateCameraModeButtons();
  updateRouteProfileButtons();
  updateRoadOverlayButton();
  renderSpeedValue();
  renderMapZoomValue(map.getZoom());
  apply3DState();
  applyRoadOverlayState();
  resetCameraSmoothing();
});

map.on("style.load", () => {
  restoreRouteAfterStyleChange();
  apply3DState();
  applyRoadOverlayState();
});

map.on("dragstart", () => {
  cameraFollowState.mode = "free";
  cameraFollowState.viewMode = "none";
  cameraFollowState.lockedBearing = map.getBearing();
  updateCameraModeButtons();
  resetCameraSmoothing();
});

map.on("click", (event) => {
  const { lng, lat } = event.lngLat;
  pendingPopupLngLat = [lng, lat];

  const popupHtml =
    `<div style="min-width:180px;">` +
    `<div style="font-size:12px;margin-bottom:8px;">${formatLngLat(pendingPopupLngLat)}</div>` +
    `<button type="button" data-select-point="start" style="width:100%;margin-bottom:6px;">출발지로 설정</button>` +
    `<button type="button" data-select-point="end" style="width:100%;">목적지로 설정</button>` +
    `</div>`;

  if (activePointPopup) {
    activePointPopup.remove();
  }

  activePointPopup = new mapboxgl.Popup({ closeOnClick: true })
    .setLngLat(pendingPopupLngLat)
    .setHTML(popupHtml)
    .addTo(map);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const selectType = target.dataset.selectPoint;
  if (!selectType || !pendingPopupLngLat) return;

  if (selectType === "start") {
    setStartPoint(pendingPopupLngLat);
    routeSummary.textContent = "출발지가 지도 클릭으로 설정되었습니다.";
  } else if (selectType === "end") {
    setEndPoint(pendingPopupLngLat);
    routeSummary.textContent = "목적지가 지도 클릭으로 설정되었습니다.";
  }

  if (activePointPopup) {
    activePointPopup.remove();
    activePointPopup = null;
  }
});

mapStyleSelect.addEventListener("change", () => {
  const nextStyle = mapStyleSelect.value;
  map.setStyle(nextStyle);
});

roadOverlayBtn.addEventListener("click", () => {
  roadOverlayState.enabled = !roadOverlayState.enabled;
  applyRoadOverlayState();
});

driveRouteBtn.addEventListener("click", () => {
  routeProfileState.profile = "driving";
  updateRouteProfileButtons();
  generateRouteForCurrentProfile();
});

routeBtn.addEventListener("click", () => {
  routeProfileState.profile = "cycling";
  updateRouteProfileButtons();
  generateRouteForCurrentProfile();
});

walkRouteBtn.addEventListener("click", () => {
  routeProfileState.profile = "walking";
  updateRouteProfileButtons();
  generateRouteForCurrentProfile();
});

enable3DEl.addEventListener("change", () => {
  map3DState.enabled = enable3DEl.checked;
  apply3DState();
});

enableBuildings3DEl.addEventListener("change", () => {
  map3DState.enableBuildings = enableBuildings3DEl.checked;
  apply3DState();
});

terrainExaggerationEl.addEventListener("input", () => {
  map3DState.terrainExaggeration = Number(terrainExaggerationEl.value);
  if (map3DState.enabled) {
    apply3DState();
  }
});

cameraKeepBtn.addEventListener("click", () => {
  cameraFollowState.mode = "keep";
  cameraFollowState.viewMode = "none";
  cameraFollowState.lockedBearing = map.getBearing();
  updateCameraModeButtons();
  resetCameraSmoothing();
});

cameraNorthBtn.addEventListener("click", () => {
  cameraFollowState.mode = "north";
  cameraFollowState.viewMode = "none";
  map.easeTo({
    bearing: 0,
    zoom: map.getZoom(),
    duration: 500,
    essential: true
  });
  updateCameraModeButtons();
  resetCameraSmoothing();
});

cameraFreeBtn.addEventListener("click", () => {
  cameraFollowState.mode = "free";
  cameraFollowState.viewMode = "none";
  cameraFollowState.lockedBearing = map.getBearing();
  updateCameraModeButtons();
  resetCameraSmoothing();
});

cameraRear30Btn.addEventListener("click", () => {
  cameraFollowState.viewMode = "rear30";
  cameraFollowState.mode = "keep";
  updateCameraModeButtons();
  resetCameraSmoothing();
});

cameraFront30Btn.addEventListener("click", () => {
  cameraFollowState.viewMode = "front30";
  cameraFollowState.mode = "keep";
  updateCameraModeButtons();
  resetCameraSmoothing();
});

cameraRightFlatBtn.addEventListener("click", () => {
  cameraFollowState.viewMode = "rightFlat";
  cameraFollowState.mode = "keep";
  updateCameraModeButtons();
  resetCameraSmoothing();
});

cameraLeftFlatBtn.addEventListener("click", () => {
  cameraFollowState.viewMode = "leftFlat";
  cameraFollowState.mode = "keep";
  updateCameraModeButtons();
  resetCameraSmoothing();
});

speedSlider.addEventListener("input", () => {
  rideConfig.speedKmh = Number(speedSlider.value);
  renderSpeedValue();
  if (session.status !== "idle") {
    syncLiveRiderMarkerAppearance();
  }
});

mapZoomSlider.addEventListener("input", () => {
  const nextZoom = Number(mapZoomSlider.value);
  if (Number.isNaN(nextZoom)) return;
  map.zoomTo(nextZoom, { duration: 0 });
  renderMapZoomValue(nextZoom);
  if (session.status === "running") {
    resetCameraSmoothing();
  }
});

map.on("zoom", () => {
  const currentZoom = map.getZoom();
  mapZoomSlider.value = currentZoom.toFixed(1);
  renderMapZoomValue(currentZoom);
});

placeSearchInput.addEventListener("input", () => {
  const keyword = placeSearchInput.value.trim();
  if (placeSearchTimer) {
    clearTimeout(placeSearchTimer);
  }

  if (!keyword) {
    hidePlaceResults();
    return;
  }

  placeSearchTimer = setTimeout(async () => {
    try {
      const features = await fetchPlaceSuggestions(keyword);
      renderPlaceResults(features);
    } catch (error) {
      routeSummary.textContent = error.message;
      hidePlaceResults();
    }
  }, 250);
});

placeSearchResults.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const idx = Number(target.dataset.placeIndex);
  if (Number.isNaN(idx)) return;
  selectPlaceSuggestion(idx);
});

// 마우스 hover 시 키보드 강조와 동기화: 화살표 키 후 마우스를 움직여도 일관됨.
placeSearchResults.addEventListener("mousemove", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const idx = Number(target.dataset.placeIndex);
  if (Number.isNaN(idx)) return;
  if (idx === activeSuggestionIndex) return;
  activeSuggestionIndex = idx;
  applySuggestionHighlight();
});

placeSearchInput.addEventListener("keydown", (event) => {
  const isOpen = placeSearchResults.classList.contains("show");
  const count = lastPlaceSuggestions.length;

  if (event.key === "ArrowDown") {
    if (!isOpen || count === 0) return;
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1 + count) % count;
    applySuggestionHighlight();
    return;
  }
  if (event.key === "ArrowUp") {
    if (!isOpen || count === 0) return;
    event.preventDefault();
    activeSuggestionIndex =
      activeSuggestionIndex <= 0 ? count - 1 : activeSuggestionIndex - 1;
    applySuggestionHighlight();
    return;
  }
  if (event.key === "Enter") {
    if (!isOpen || count === 0) return;
    event.preventDefault();
    // 강조 항목이 없으면 최상단을 선택(자연스러운 기본 동작).
    const idx = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
    selectPlaceSuggestion(idx);
    return;
  }
  if (event.key === "Escape") {
    if (!isOpen) return;
    event.preventDefault();
    hidePlaceResults();
  }
});

saveMyRouteBtn?.addEventListener("click", () => {
  saveCurrentRouteToMyRoutes();
});

myRoutesList?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  const routeId = target.dataset.routeId;
  if (!action || !routeId) return;

  if (action === "delete-my-route") {
    const next = loadMyRoutes().filter((item) => item && item.id !== routeId);
    saveMyRoutes(next.slice(0, 10));
    renderMyRoutesList();
    routeSummary.textContent = "My routes에서 삭제했습니다.";
    return;
  }

  if (action === "load-my-route") {
    const item = loadMyRoutes().find((it) => it && it.id === routeId);
    routeSummary.textContent = "저장된 경로를 불러오는 중...";
    try {
      await applyMyRoute(item);
      routeSummary.textContent = "저장된 경로를 불러왔습니다.";
    } catch (error) {
      routeSummary.textContent = error?.message || "경로를 불러오지 못했습니다.";
    }
  }
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const clickedInSearchInput = target.id === "placeSearchInput";
  const clickedInSearchResult = target.closest("#placeSearchResults");
  if (!clickedInSearchInput && !clickedInSearchResult) {
    hidePlaceResults();
  }
});

/**
 * 지도 위에 띄우는 **DOM 조각** — 지점 팝업(경로 생성)·출발/도착 핀·경유지 마커·
 * 활동 점 팝업·내 라이더 마커 뿌리.
 *
 * 왜 MapView 에서 나왔나 (2026-09-28, 구조 정비 A-3) — 전부 `document.createElement`
 * 로 만들고 콜백을 붙여 돌려주는 순수 제조기다. React 상태도 지도 구독도 모른다.
 * **동작은 바꾸지 않았다 — 자리만 옮겼다.**
 *
 * ⚠️ 팝업 문구는 계약이다. 「경로 생성 잔여 토큰 N개」·`지점 팝업 제목 행`(2026-09-16)은
 * 계약 시험이 문자열째 겨눈다 — 표현을 바꾸려면 시험부터 고쳐라.
 */
import "../ride/RideMediaButton.css";
import { restartRideStartPulse, stopRideStartPulse } from "../ride/rideStartPulse";
import "./RoutePickPopup.css";
import { formatDistanceAutoRouteDirectionClickHint, DISTANCE_AUTO_ROUTE_KM_MAX, DISTANCE_AUTO_ROUTE_KM_MIN, DISTANCE_AUTO_ROUTE_KM_STEP, DISTANCE_AUTO_ROUTE_REROUTE_HINT, DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_ARIA, DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_LABEL, validateDistanceAutoRouteTargetKm, DISTANCE_AUTO_ROUTE_CHIP_KM, DISTANCE_AUTO_ROUTE_DEFAULT_KM } from "../../lib/route/distanceAutoRouteErrors";
import { getDistanceAutoRouteMapBridge } from "../../lib/map/distanceAutoRouteMapBridge";
import type { LngLat } from "../../lib/geo/geo";
import { subscribeRouteTokenEffective } from "../../lib/account/routeTokenSpendBridge";
import { mountRouteTokenPopupFeedback } from "../../lib/account/mountRouteTokenPopupFeedback";
import { ROUTE_TOKEN_INSUFFICIENT_HINT } from "../../lib/account/routeTokenUiCopy";
import { MAX_ROUTE_WAYPOINTS } from "../../lib/geo/routeWaypoints";
import { buildPickPopupProfileIconSvg } from "../../lib/route/routeProfileIcons";
import type { RouteProfile } from "../../services/mapboxDirections";
import { fetchMapboxReverseGeocodePlaceName } from "../../services/mapboxReverseGeocode";

/**
 * 경로 생성 탭 아이콘. Lucide `route` / `ruler` / `navigation-2` path (ISC).
 * 새 의존성 없이 기존 팝업 SVG 스트로크 규약을 쓴다.
 */
const PICK_TAB_SVG_OPEN =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

function buildPickPopupLocationModeIconSvg(): string {
  return `<svg class="map-view__pick-route-tab-ico" ${PICK_TAB_SVG_OPEN} aria-hidden="true"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`;
}

/** 10-30 Chief A안 — 제목 「경로」 글자 대신 지도 핀. 낭독은 sr-only 「경로」. */
function buildPickPopupTitleIconSvg(): string {
  return `<svg class="map-view__pick-title-ico" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.8-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/></svg>`;
}

function buildPickPopupDistanceModeIconSvg(): string {
  return `<svg class="map-view__pick-route-tab-ico" ${PICK_TAB_SVG_OPEN} aria-hidden="true"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg><svg class="map-view__pick-route-tab-ico map-view__pick-route-tab-ico--nav" ${PICK_TAB_SVG_OPEN} aria-hidden="true"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>`;
}

/** 마커·활동 팝업 제조기는 `mapMarkerElements` 로 옮겼다(2026-10-22) — 옛 import 경로 유지용 재내보내기. */
export {
  pickPickPopupAnchor,
  createLiveRiderMarkerRoot,
  createRouteEndpointPinEl,
  createTemporaryRoutePinEl,
  createWaypointMarkerEl,
  tryOpenActivityWorldPinPopup,
} from "./mapMarkerElements";

/** 거리·방향 탐색의 기본 수단(10-25 Chief 고정). 사용자가 맨 아래 수단 버튼으로 바꾼다. */
export const DISTANCE_DEFAULT_PROFILE: RouteProfile = "driving";

export type PickPopupAutoRouteUi = {
  setInlinePhase: (
    phase: "idle" | "direction" | "searching" | "found" | "failed",
    message?: string,
  ) => void;
  tryArmDirectionPick: () => void;
  /**
   * 목표 거리 슬라이더·숫자 입력을 지정 km 로 맞춘다.
   * popup 은 명령형 DOM 이라 React state 변화로 다시 그려지지 않는다 — 값이 바뀌는 지점에서
   * 명시적으로 부른다(`queueMicrotask` 타이밍 맞추기를 늘리지 않는다).
   */
  syncDistanceInputs: (km: number) => void;
  /** 거리 화면에서 방향을 선택하고 자동 탐색까지 진행한다. */
  stageDirectionPick: (point: LngLat) => boolean;
  getRoutePickView: () => "location" | "distance";
  selectDistanceStart: (point: LngLat) => boolean;
  syncRideStart: () => void;
  /** 우측 하단 주행 버튼과 같은 펄스 번호가 오를 때 MapView 가 부른다(Chief 10-26). */
  pulseRideStart: () => void;
};

export function buildPickPopup(deps: {
  onStartRide?: () => void;
  getCanStartRide?: () => boolean;
  lngLat: LngLat;
  getWaypointCount: () => number;
  accessToken: string;
  signal: AbortSignal;
  onSelectPoint: (
    type: "start" | "end" | "waypoint",
    lngLat: LngLat,
    waypointSlot?: 0 | 1 | 2,
  ) => void;
  initialStart: LngLat | null;
  initialRoutePickView?: "location" | "distance";
  routeProfile: RouteProfile;
  onRouteProfile: (p: RouteProfile) => void;
  onArmDirectionPick?: (input: {
    start: LngLat;
    profile: RouteProfile;
    targetKm: number;
  }) => { ok: true } | { ok: false; message: string };
  onRegisterAutoRouteUi?: (ui: PickPopupAutoRouteUi) => void;
  /** 예상 시간 계산용 누적 주행 — 없으면 폴백 속도를 쓴다(5A-R2 §4.3) */
  getUserMileage?: () => { totalMeters: number | null; totalSec: number | null };
  onDirectionPickArmed?: () => void;
  onGenerateDistanceRoute?: (point: LngLat) => void;
  onPulseDistanceCircle?: (cycles?: number) => void;
  onStopDistanceCirclePulse?: () => void;
  onRoutePanelActivated?: () => void;
  onPreviewDistanceAutoRouteCircle?: (input: {
    start: LngLat;
    targetKm: number;
  }) => void;
  onClearDistanceAutoRouteCircle?: () => void;
  onSetRouteProfileOnly?: (p: RouteProfile) => void;
  /** 호출 시점의 Route Token 부족 여부(잔액<1) — true면 수단 버튼 비활성 */
  getRouteTokenInsufficient?: () => boolean;
  /** Conquest — 이 지점 영토의 개척자 한 줄(null=미개척) */
  onClearRoute?: (() => void) | undefined;
  /** 지시93 — false 면(주행 중) 「경로 삭제」는 onClearRoute(안내)만 부르고 팝업 상태를 지우지 않는다. */
  canClearRouteNow?: () => boolean;
  onClearAutoRouteClickDebugMarker?: () => void;
  initialHasStart: boolean;
  initialHasEnd: boolean;
  initialHasRoute?: boolean;
  autoRouteSessionActive?: boolean;
  autoRouteTargetKm?: number;
  autoRouteStatusMessage?: string | null;
  closePopup: () => void;
}): HTMLDivElement {
  const {
    lngLat,
    getWaypointCount,
    accessToken,
    signal,
    onSelectPoint,
    initialStart,
    routeProfile,
    onRouteProfile,
    onArmDirectionPick,
    onRegisterAutoRouteUi,
    onDirectionPickArmed,
    onGenerateDistanceRoute,
    onPulseDistanceCircle,
    onStopDistanceCirclePulse,
    onRoutePanelActivated,
    onPreviewDistanceAutoRouteCircle,
    onClearDistanceAutoRouteCircle,
    onSetRouteProfileOnly,
    getRouteTokenInsufficient,
    onClearRoute,
    canClearRouteNow,
    onClearAutoRouteClickDebugMarker,
    initialHasStart,
    initialHasEnd,
    autoRouteSessionActive = false,
    autoRouteTargetKm = DISTANCE_AUTO_ROUTE_DEFAULT_KM,
    autoRouteStatusMessage = null,
    closePopup,
  } = deps;

  const wrap = document.createElement("div");
  wrap.className = "map-view__pick";

  /** 팝업이 열린 뒤 출발/도착 클릭으로 갱신되는 끝점 보유 상태(리렌더 전에도 동작). */
  const pins = { start: initialHasStart, end: initialHasEnd };
  let selectedStart = initialStart;
  let currentProfile = routeProfile;
  // 실제 경로가 있으면 적용 수단을 표시하고, 탐색 전 기본값은 강조하지 않는다.
  let profileChosen = Boolean(deps.initialHasRoute);
  let distanceConfirmed = Boolean(deps.autoRouteSessionActive || getDistanceAutoRouteMapBridge()?.sessionActive);
  let selectedDirection: LngLat | null = null;
  let distanceSearchPending = false;
  const mapBridge = getDistanceAutoRouteMapBridge();
  let autoSessionActive = autoRouteSessionActive || mapBridge?.sessionActive || false;
  let distanceDirectionChecked =
    mapBridge?.distanceDirectionMode ?? autoSessionActive;
  /*
   * 지시34 — 위치/거리 별도 화면(단일 routePickView). 30~33의 두 토글/두 영역 혼합 제거.
   * DOM은 같은 wrap, 내용만 교체. 화면 전환으로 핀·거리·수단·토큰·탐색을 초기화하지 않는다.
   * 초기 bridge 거리모드/거리세션 + Start면 distance뷰.
   */
  let routePickView: "location" | "distance" =
    deps.initialRoutePickView ?? (pins.start && (distanceDirectionChecked || autoSessionActive) ? "distance" : "location");
  /*
   * 10-25 Chief — 거리·방향의 기본 수단은 자동차로 고정, 사용자가 맨 아래 수단 버튼으로 바꿀 수 있다.
   * 이미 걸린 거리 세션(팝업 다시 열기·이어 달리기)은 그때 고른·승계한 수단을 그대로 쓴다.
   */
  let distanceProfileKept = autoSessionActive || distanceDirectionChecked;
  function applyDistanceDefaultProfile() {
    if (!distanceProfileKept) currentProfile = DISTANCE_DEFAULT_PROFILE;
  }
  if (routePickView === "distance") applyDistanceDefaultProfile();
  /** 지시09 — 탭으로 location/distance 상호배타. 탭 전환은 핀·거리·수단·경로를 유지한다. */
  function getRouteStart(): LngLat | null {
    const armed = getDistanceAutoRouteMapBridge()?.getArmedStart?.() ?? null;
    return armed ?? selectedStart ?? initialStart;
  }

  function previewCircleForTargetKm(km: number) {
    const start = getRouteStart();
    if (!start || typeof onPreviewDistanceAutoRouteCircle !== "function") return;
    onPreviewDistanceAutoRouteCircle({ start, targetKm: km });
  }

  const addressEl = document.createElement("div");
  addressEl.className = "map-view__pick-address";
  const setAddressText = (text: string) => {
    addressEl.textContent = text;
    addressEl.title = text;
  };
  setAddressText("주소를 불러오는 중…");


  const pinRow = document.createElement("div");
  pinRow.className = "map-view__pick-actions map-view__pick-actions--pin-row";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "map-view__pick-btn map-view__pick-btn--start";
  startBtn.textContent = "Start";
  startBtn.title = "출발 지점으로 설정";
  startBtn.setAttribute("aria-label", "출발 지점으로 설정");
  const selectStart = (point: LngLat) => {
    onClearAutoRouteClickDebugMarker?.();
    if (distanceDirectionChecked) {
      applyDistanceDirectionMode(false);
    }
    getDistanceAutoRouteMapBridge()?.disarm?.();
    onSelectPoint("start", point);
    pins.start = true;
    profileChosen = false;
    selectedStart = point;
    syncProfileUi();
    restartProfileAttention();
    syncAutoRouteUi();
    syncTokenUi();
    if (routePickView === "distance") applyDistanceDirectionMode(true);
    onRoutePanelActivated?.();
  };
  startBtn.onclick = () => selectStart(lngLat);

  /* 10-23 Chief: W1~W3 칸 대신 「+WP」 하나 — 누를 때마다 다음 빈 경유지 칸에 넣는다(최대 3) */
  const wpBtn = document.createElement("button");
  wpBtn.type = "button";
  wpBtn.className = "map-view__pick-btn map-view__pick-btn--wp";
  wpBtn.textContent = "+WP";
  wpBtn.setAttribute("aria-label", "경유지 추가");
  const waypointCount = getWaypointCount();
  wpBtn.disabled = waypointCount >= MAX_ROUTE_WAYPOINTS;
  wpBtn.title = wpBtn.disabled ? `경유지는 최대 ${MAX_ROUTE_WAYPOINTS}개` : `경유지 ${waypointCount + 1} 추가`;
  wpBtn.onclick = () => {
    const slot = getWaypointCount();
    if (slot >= MAX_ROUTE_WAYPOINTS) return;
    if (distanceDirectionChecked) {
      applyDistanceDirectionMode(false);
    }
    onSelectPoint("waypoint", lngLat, slot as 0 | 1 | 2);
    closePopup();
  };

  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "map-view__pick-btn map-view__pick-btn--end";
  endBtn.textContent = "End";
  endBtn.title = "도착 지점으로 설정";
  endBtn.setAttribute("aria-label", "도착 지점으로 설정");
  endBtn.onclick = () => {
    if (distanceDirectionChecked) {
      applyDistanceDirectionMode(false);
    }
    onSelectPoint("end", lngLat);
    pins.end = true;
    profileChosen = false;
    if (!pins.start) closePopup();
    else {
      syncProfileUi();
      restartProfileAttention();
      syncAutoRouteUi();
      syncTokenUi();
    }
  };

  pinRow.append(startBtn, wpBtn, endBtn);

  /* 지시38 — 위치 화면. pinRow가 profileSection보다 앞(profileSection은 아래에서 붙는다). */
  const routeLocationView = document.createElement("div");
  routeLocationView.className =
    "map-view__pick-route-view map-view__pick-route-view--location";
  routeLocationView.id = "map-view-pick-location-view";
  routeLocationView.setAttribute("role", "tabpanel");
  routeLocationView.setAttribute("aria-labelledby", "map-view-pick-tab-location");
  routeLocationView.append(pinRow);

  const profileSection = document.createElement("div");
  profileSection.className = "map-view__pick-profile-section";

  const rowProfile = document.createElement("div");
  rowProfile.className = "map-view__pick-actions map-view__pick-actions--profile";
  rowProfile.setAttribute("role", "group");

  const profileLabel = document.createElement("span");
  profileLabel.className = "map-view__pick-sr-only";
  profileLabel.id = "map-view-pick-profile-label";
  profileLabel.textContent = "이동수단";
  rowProfile.setAttribute("aria-labelledby", "map-view-pick-profile-label");
  rowProfile.append(profileLabel);

  const tokenSection = document.createElement("div");
  const tokenFeedback = mountRouteTokenPopupFeedback(tokenSection, signal);

  const profileSpecs: { profile: RouteProfile; ariaLabelKo: string }[] = [
    { profile: "driving", ariaLabelKo: "자동차 경로" },
    { profile: "cycling", ariaLabelKo: "자전거 경로" },
    { profile: "walking", ariaLabelKo: "보행 경로" },
  ];

  const profileButtons: HTMLButtonElement[] = [];
  for (const { profile, ariaLabelKo } of profileSpecs) {
    const pb = document.createElement("button");
    pb.type = "button";
    pb.className = "map-view__pick-btn map-view__pick-btn--profile";
    pb.innerHTML = buildPickPopupProfileIconSvg(profile);
    pb.title =
      profile === "driving" ? "자동차 경로" : profile === "walking" ? "보행 경로" : "자전거 경로";
    pb.setAttribute("aria-label", ariaLabelKo);
    pb.onclick = () => {
      if (!pins.start) return;
      if (routePickView === "distance" && distanceSearchPending) return;
      if (getRouteTokenInsufficient?.()) return;
      currentProfile = profile;
      profileChosen = true;
      if (routePickView === "distance") distanceProfileKept = true;
      syncProfileUi();
      syncRoutePickView();
      const manualRouteReady = pins.start && pins.end && !distanceDirectionChecked;
      if (manualRouteReady && routePickView === "location") {
        if (getRouteTokenInsufficient?.()) return;
        tokenFeedback.setRoutePending(true);
        onRouteProfile(profile);
        return;
      }
      if (!pins.end) onSetRouteProfileOnly?.(profile);
      /*
       * 10-25 Chief — 거리·방향에서도 수단을 고를 수 있다. 방향을 이미 골랐으면 그 수단으로
       * 바로 재탐색, 아직이면 방향 대기를 새 수단으로 다시 걸어 다음 방향 클릭에 쓴다.
       */
      if (routePickView === "distance" && tryArmDirectionPick() && distanceConfirmed && selectedDirection) {
        onGenerateDistanceRoute?.(selectedDirection);
      }
    };
    profileButtons.push(pb);
    rowProfile.appendChild(pb);
  }

  /*
   * 10-26 Chief(지시94) — 경로 삭제는 탭(Start·End · 거리·방향) 오른쪽, 빨간 테두리. 두 탭 공통.
   */
  let clearRouteBtn: HTMLButtonElement | null = null;
  if (typeof onClearRoute === "function") {
    clearRouteBtn = document.createElement("button");
    clearRouteBtn.type = "button";
    clearRouteBtn.className = "map-view__pick-btn map-view__pick-btn--clear-route";
    clearRouteBtn.textContent = "경로 삭제";
    clearRouteBtn.title = "경로 전체 삭제";
    clearRouteBtn.setAttribute("aria-label", "경로 전체 삭제");
    clearRouteBtn.onclick = () => {
      if (canClearRouteNow && !canClearRouteNow()) {
        onClearRoute();
        return;
      }
      onClearRoute();
      onClearDistanceAutoRouteCircle?.();
      pins.start = false;
      pins.end = false;
      selectedStart = null;
      if (routePickView === "distance") {
        distanceDirectionChecked = false;
        resetDistanceSelection();
        syncDistanceModeUi();
        syncAutoRouteUi();
        syncTokenUi();
        setInlinePhase("idle");
      } else closePopup();
    };
    /* 재지시37 — dragHandle pointerdown이 자손 삭제 버튼의 click을 삼키지 않게 차단. preventDefault 금지. */
    clearRouteBtn.addEventListener("pointerdown", (event) => event.stopPropagation());
  }

  /*
   * 지시38 — profile행 끝 '거리 ›' 버튼 제거(이중 캐럿으로 대체). 별도 중간행 없음.
   * 기존 폰트/버튼 크기 축소 금지 원칙에 따라 profile 버튼은 그대로 둔다.
   */

  function syncProfileUi() {
    const hasStart = pins.start;
    const manualRouteReady = pins.start && pins.end && !distanceDirectionChecked;
    const onLocationTab = routePickView === "location";
    const autoGenerateOnProfile =
      manualRouteReady && onLocationTab && !distanceDirectionChecked;
    profileSection.hidden = !hasStart && !clearRouteBtn;
    const readyForProfile = onLocationTab ? manualRouteReady : distanceConfirmed && (Boolean(selectedDirection) || profileChosen);
    /*
     * 10-25 Chief — 두 탭의 맨 아래 줄은 같은 구조(수단 3개 · 주행)로 늘 보인다(경로 삭제는 탭 줄, 지시94).
     * 쓸 수 없을 때는 숨기지 않고 끈다: 출발·도착은 두 위치가 있어야, 거리·방향은 출발만 있으면 쓴다.
     */
    const profileUsable = onLocationTab ? manualRouteReady : hasStart;
    rowProfile.hidden = false;
    if (clearRouteBtn) clearRouteBtn.hidden = false;
    wrap.classList.toggle("map-view__pick--awaiting-profile", readyForProfile && !profileChosen && !distanceSearchPending);
    profileLabel.textContent = readyForProfile ? "경로 탐색 유형 선택" : "이동수단";
    const tokenInsufficient = Boolean(getRouteTokenInsufficient?.());
    profileSpecs.forEach((spec, i) => {
      const pb = profileButtons[i];
      if (!pb) return;
      pb.classList.toggle("is-active", profileChosen && spec.profile === currentProfile);
      pb.setAttribute("aria-pressed", String(profileChosen && spec.profile === currentProfile));
      const blockProfile = !profileUsable || (autoGenerateOnProfile || !onLocationTab) && tokenInsufficient || distanceSearchPending;
      pb.disabled = blockProfile;
      pb.classList.toggle("is-disabled", blockProfile);
      pb.title = distanceSearchPending ? "경로 탐색 중입니다."
        : !profileUsable
        ? (onLocationTab ? "Start·End 를 먼저 정하세요" : "출발 위치를 먼저 정하세요")
        : blockProfile
        ? ROUTE_TOKEN_INSUFFICIENT_HINT
        : spec.profile === "driving"
          ? "자동차 경로"
          : spec.profile === "walking"
            ? "보행 경로"
            : "자전거 경로";
    });
  }

  function restartProfileAttention() {
    // 줄은 늘 보이므로 숨김이 아니라 강조 대상 여부(syncProfileUi 가 단 클래스)로 판단한다.
    if (!wrap.classList.contains("map-view__pick--awaiting-profile")) return;
    wrap.classList.remove("map-view__pick--awaiting-profile");
    void wrap.offsetWidth;
    wrap.classList.add("map-view__pick--awaiting-profile");
  }

  function syncTokenUi() {
    /*
     * 제목 행은 늘 선다 — 숨기면 긴 주소가 첫 줄로 올라와 닫기 ✕ 를 덮는다.
     * 출발 핀 전에는 「경로 생성」만, 찍으면 「경로 생성 잔여 토큰 N개」(2026-09-16 Chief).
     */
    tokenFeedback.setRouteStartPinned(pins.start);
  }

  const profileBottomRow = document.createElement("div");
  profileBottomRow.className = "map-view__pick-profile-bottom-row";
  profileBottomRow.append(rowProfile);
  const startRideBtn = document.createElement("button");
  startRideBtn.type = "button";
  /*
   * 10-29 Chief — 맨 아래 줄에 이동 수단·경로 삭제·녹색 원 재생 버튼을 둔다.
   * 알약 테두리·「주행」 글자 없음(화면 읽기 이름은 「주행 시작」). 두 탭 공통.
   */
  startRideBtn.className = "map-view__pick-btn map-view__pick-btn--start-ride map-view__pick-start-ride";
  startRideBtn.setAttribute("aria-label", "주행 시작");
  startRideBtn.title = "주행 시작";
  const playIcon = document.createElement("span");
  playIcon.className = "map-view__pick-start-ride-icon";
  playIcon.setAttribute("aria-hidden", "true");
  startRideBtn.append(playIcon);
  const syncRideStart = () => {
    startRideBtn.hidden = typeof deps.onStartRide !== "function";
    startRideBtn.disabled = !deps.getCanStartRide?.();
  };
  /*
   * 펄스는 버튼 활성 전환이 아니라 App 의 펄스 번호를 따른다. 이미 경로가 있는 채 거리·방향으로
   * 다시 찾으면 버튼이 한 번도 꺼지지 않아 활성 전환만으로는 펄스가 나지 않았다(10-26 Chief 확인).
   */
  const pulseRideStart = () => {
    syncRideStart();
    if (!startRideBtn.hidden && !startRideBtn.disabled) restartRideStartPulse(startRideBtn);
  };
  startRideBtn.onclick = () => {
    if (!deps.getCanStartRide?.()) return;
    stopRideStartPulse(startRideBtn);
    deps.onStartRide?.();
  };
  syncRideStart();
  if (clearRouteBtn) profileBottomRow.append(clearRouteBtn);
  profileBottomRow.append(startRideBtn);
  profileSection.append(profileBottomRow);
  syncProfileUi();
  syncTokenUi();

  const autoRouteSection = document.createElement("div");
  autoRouteSection.className = "map-view__pick-auto-route";
  autoRouteSection.id = "map-view-pick-distance-view";
  autoRouteSection.setAttribute("role", "tabpanel");
  autoRouteSection.setAttribute("aria-labelledby", "map-view-pick-tab-distance");

  let targetKm = autoRouteTargetKm;

  const distanceRow = document.createElement("div");
  distanceRow.className = "map-view__pick-distance-row";

  const modeField = document.createElement("label");
  modeField.className = "map-view__pick-distance-mode";
  /*
   * 지시34 — checkbox는 내부 동기화용으로만 남기고 사용자에게 표시하지 않는다
   * (hidden이라 조작·탭 불가, 거리 화면 진입에 체크 추가 요구 없음).
   * 계약이 클래스명·aria 상수를 겨누므로 DOM과 상수는 유지한다.
   */
  modeField.hidden = true;

  const modeCheckbox = document.createElement("input");
  modeCheckbox.type = "checkbox";
  modeCheckbox.className = "map-view__pick-distance-mode-checkbox";
  modeCheckbox.setAttribute("aria-label", DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_ARIA);

  const modeLabel = document.createElement("span");
  modeLabel.className = "map-view__pick-distance-mode-label";
  modeLabel.textContent = DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_LABEL;

  modeField.append(modeCheckbox, modeLabel);

  const distanceLabel = document.createElement("label");
  distanceLabel.className = "map-view__pick-sr-only";
  distanceLabel.textContent = "목표거리(km)";
  distanceLabel.htmlFor = "map-view-pick-distance-slider";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.className = "map-view__pick-distance-step map-view__pick-distance-step--minus";
  minusBtn.textContent = "−";
  minusBtn.setAttribute("aria-label", "목표 거리 0.5km 감소");

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.className = "map-view__pick-distance-step map-view__pick-distance-step--plus";
  plusBtn.textContent = "+";
  plusBtn.setAttribute("aria-label", "목표 거리 0.5km 증가");

  const distanceSlider = document.createElement("input");
  distanceSlider.type = "range";
  distanceSlider.className = "map-view__pick-distance-slider";
  distanceSlider.id = "map-view-pick-distance-slider";
  /**
   * **슬라이더를 칩으로 대체한다**(5A-R2 §4.2). 추가가 아니라 대체다 — 팝업이 커지면
   * 3D-2 의 공간 최적화를 되돌리는 것이라 실패다.
   *
   * 0.5~120 km 를 0.5 눈금으로 두면 240칸이고 폰 슬라이더 폭 200 px 에서 한 칸이 1 px
   * 미만이라 손가락으로 특정 값을 고를 수 없었다. 자주 쓰는 값을 칩으로 내고, 미세 조정은
   * 이미 있는 `±` 버튼과 숫자 입력이 맡는다. 20 km 초과는 숫자 입력으로 — 드문 경우에
   * UI 공간을 쓰지 않는다.
   */
  distanceSlider.hidden = true;

  const distanceNumber = document.createElement("input");
  distanceNumber.type = "text";
  distanceNumber.inputMode = "decimal";
  distanceNumber.className = "map-view__pick-distance-number";
  distanceNumber.setAttribute("aria-label", "목표거리 km");
  distanceNumber.value = targetKm.toFixed(1);

  const distanceChips = document.createElement("div");
  distanceChips.className = "map-view__pick-distance-chips";
  const chipButtons: { km: number; el: HTMLButtonElement }[] = [];
  for (const km of DISTANCE_AUTO_ROUTE_CHIP_KM) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "map-view__pick-distance-chip";
    chip.textContent = String(km);
    chip.setAttribute("aria-label", `목표 거리 ${km}km`);
    chip.onclick = () => {
      /* 지시38 — mode=false라는 이유만으로 보이는 거리 컨트롤을 먹통으로 하지 않는다. */
      if (!ensureDistanceDirectionForInput()) return;
      syncDistanceInputs(km);
      commitDistanceInput();
    };
    chipButtons.push({ km, el: chip });
    distanceChips.appendChild(chip);
  }

  distanceRow.append(modeField, distanceLabel, minusBtn, distanceSlider, plusBtn, distanceNumber);
  /*
   * 지시34 — 한행 '목표 거리 −/숫자/km/＋'. DOM 순서(계약 고정)는 그대로 두고
   * CSS order로만 시각 배열한다. sr-only label은 AT용으로 유지하고,
   * 보이는 캡션·단위는 aria-hidden으로 중복 낭독을 피한다.
   */
  const routeDistanceCaption = document.createElement("span");
  routeDistanceCaption.className = "map-view__pick-distance-caption";
  routeDistanceCaption.textContent = "목표 거리";
  routeDistanceCaption.setAttribute("aria-hidden", "true");
  const routeDistanceUnit = document.createElement("span");
  routeDistanceUnit.className = "map-view__pick-distance-unit";
  routeDistanceUnit.textContent = "km";
  routeDistanceUnit.setAttribute("aria-hidden", "true");
  distanceRow.append(routeDistanceCaption, routeDistanceUnit);
  distanceRow.append(distanceChips);

  const autoRouteStatusSlot = document.createElement("div");
  autoRouteStatusSlot.className = "map-view__pick-auto-route-status-slot";

  const autoRouteStatus = document.createElement("p");
  autoRouteStatus.className = "map-view__pick-auto-route-status map-view__pick-auto-route-status--idle";
  autoRouteStatus.setAttribute("role", "status");
  autoRouteStatus.setAttribute("aria-live", "polite");
  autoRouteStatus.dataset.phase = "idle";

  // 「N km 로 늘려 클릭 지점까지 가기」 버튼은 제거했다(5A-R2 §3).
  // 그 버튼은 directRoadM 을 100m 단위로 **올림**해 목표로 삼아, 목표가 실측 도로거리보다
  // 커지면서 스스로 부족분을 만들고 우회를 불러 중복을 생산했다.
  // `offered` 고지 문구·고스트 마커·점선은 그대로 남는다 — 없앤 것은 버튼뿐이다.
  autoRouteStatusSlot.append(autoRouteStatus);

  function syncDistanceInputs(km: number) {
    targetKm = km;
    for (const c of chipButtons) c.el.classList.toggle("is-active", Math.abs(c.km - km) < 1e-9);
    distanceNumber.value = km.toFixed(1);
    /* 지시38 — 보이는 거리 컨트롤의 stepper/disabled는 Start/기능 전제·min/max로만 판정. */
    const available = pins.start && typeof onArmDirectionPick === "function";
    if (!available) {
      minusBtn.disabled = true;
      plusBtn.disabled = true;
    } else {
      minusBtn.disabled = km <= DISTANCE_AUTO_ROUTE_KM_MIN;
      plusBtn.disabled = km >= DISTANCE_AUTO_ROUTE_KM_MAX;
    }
    // 원과 함께 안내 `{N}` 즉시 갱신(검색/결과 문구는 덮지 않음)
    if (autoRouteStatus.dataset.phase === "direction") {
      autoRouteStatus.textContent = "";
    }
  }

  function syncDistanceModeUi() {
    modeCheckbox.checked = distanceDirectionChecked;
    /* 지시38 — 숨긴 checkbox는 내부 동기화용으로만 유지. 보이는 컨트롤은 mode=false
     * 때문이 아니라 Start/기능 전제로만 막는다(펼친 뒤 재선택 가능해야 함). */
    const available = pins.start && typeof onArmDirectionPick === "function";
    distanceSlider.disabled = !available;
    for (const c of chipButtons) c.el.disabled = !available;
    distanceNumber.disabled = !available;
    distanceRow.classList.toggle(
      "map-view__pick-distance-row--disabled",
      !available,
    );
    if (!available) {
      minusBtn.disabled = true;
      plusBtn.disabled = true;
      return;
    }
    minusBtn.disabled = targetKm <= DISTANCE_AUTO_ROUTE_KM_MIN;
    plusBtn.disabled = targetKm >= DISTANCE_AUTO_ROUTE_KM_MAX;
    if (autoRouteStatus.dataset.phase === "direction") {
      autoRouteStatus.textContent = "";
    }
  }

  /*
   * 지시38 — 거리 입력 조작 시 방향대기 활성화를 위한 내부 승격. 모드 변경과
   * presentation 중심/펼침은 분리하므로 여기서 view/펼침을 건드리지 않는다.
   */
  function ensureDistanceDirectionForInput(): boolean {
    if (!pins.start || typeof onArmDirectionPick !== "function") return false;
    if (!distanceDirectionChecked) {
      distanceDirectionChecked = true;
      getDistanceAutoRouteMapBridge()?.setDistanceDirectionMode?.(true);
      syncDistanceModeUi();
      syncProfileUi();
    }
    return true;
  }

  function applyDistanceDirectionMode(checked: boolean) {
    distanceDirectionChecked = checked;
    /*
     * 브리지는 **그때그때 다시 찾는다**(2026-09-18 Chief).
     * `mapBridge` 는 팝업을 만들 때 한 번 잡아 둔 값이라, 그 시점에 아직 등록 전이었거나
     * 이후 다시 등록됐으면 `null`·낡은 객체를 붙들고 있다 — 그러면 이 호출이 조용히
     * 사라져 체크를 풀어도 훅은 아무것도 모른다(반경 원이 그대로 남던 원인).
     *
     * 지시34 — '거리 ›' 진입은 이 경로로 기존 bridge의 방향대기를 활성화하며
     * distance뷰로 전환한다. 진입은 지도 방향 클릭 준비뿐: 원격 도로탐색·토큰차감·
     * 핀초기화·경로삭제를 하지 않는다. 복귀는 disarm/원 정리 후 location뷰.
     * 핀·목표거리·수단·이미 생성된 경로는 여기서 임의 초기화하지 않는다(아래 정리 호출 제외).
     * 수동 경로 준비/토큰 disabled가 낡지 않게 syncProfileUi도 갱신한다.
     */
    getDistanceAutoRouteMapBridge()?.setDistanceDirectionMode?.(checked);
    /* 지시38 — 모드 변경과 중심/펼침 분리: 여기서는 view를 건드리지 않는다. */
    syncDistanceModeUi();
    syncRoutePickView();
    syncProfileUi();
    if (!checked) {
      onClearAutoRouteClickDebugMarker?.();
      // 원을 소유한 쪽에 직접 지우라고 말한다 — 훅의 정리에만 기대지 않는다.
      onClearDistanceAutoRouteCircle?.();
      setInlinePhase("idle");
      return;
    }
    previewCircleForTargetKm(targetKm);
    if (tryArmDirectionPick()) {
      distanceConfirmed = true;
      syncProfileUi();
    }
  }

  function pauseDistancePickForTabSwitch() {
    resetDistanceSelection();
    distanceDirectionChecked = false;
    getDistanceAutoRouteMapBridge()?.setDistanceDirectionMode?.(false);
    onClearDistanceAutoRouteCircle?.();
    onClearAutoRouteClickDebugMarker?.();
    syncDistanceModeUi();
  }

  function setRoutePickTab(next: "location" | "distance") {
    if (routePickView === next) return;
    if (routePickView === "distance") {
      pauseDistancePickForTabSwitch();
    }
    routePickView = next;
    if (routePickView === "distance") applyDistanceDefaultProfile();
    syncRoutePickView();
    syncProfileUi();
    if (routePickView === "distance" && pins.start) {
      applyDistanceDirectionMode(true);
      pulseDistanceEntry();
    }
  }

  function pulseDistanceEntry() {
    if (routePickView === "distance" && pins.start && distanceDirectionChecked && autoRouteStatus.dataset.phase === "direction") {
      onPulseDistanceCircle?.(5);
    }
  }

  function tryArmDirectionPickIfChecked() {
    if (!distanceDirectionChecked) return;
    tryArmDirectionPick();
  }

  function stepTargetKm(deltaKm: number) {
    if (!ensureDistanceDirectionForInput()) return;
    const next = Math.min(
      DISTANCE_AUTO_ROUTE_KM_MAX,
      Math.max(
        DISTANCE_AUTO_ROUTE_KM_MIN,
        Math.round((targetKm + deltaKm) / DISTANCE_AUTO_ROUTE_KM_STEP) * DISTANCE_AUTO_ROUTE_KM_STEP,
      ),
    );
    syncDistanceInputs(next);
    commitDistanceInput();
  }

  function resetDistanceSelection() {
    distanceConfirmed = false;
    selectedDirection = null;
    profileChosen = false;
    onStopDistanceCirclePulse?.();
    onClearAutoRouteClickDebugMarker?.();
    syncProfileUi();
  }

  function commitDistanceInput() {
    resetDistanceSelection();
    if (!ensureDistanceDirectionForInput() || !tryArmDirectionPick()) return;
    distanceConfirmed = true;
    syncProfileUi();
    onPulseDistanceCircle?.();
  }

  function setInlinePhase(
    phase: "idle" | "direction" | "searching" | "found" | "failed",
    message?: string,
  ) {
    distanceSearchPending = phase === "searching";
    if (phase === "found") profileChosen = true;
    syncProfileUi();
    autoRouteStatus.className = "map-view__pick-auto-route-status";
    autoRouteStatus.dataset.phase = phase;
    // 평상시 방향·반경 설명은 생략하고 실제 탐색/결과/오류만 알린다.
    autoRouteStatus.hidden = phase === "idle" || phase === "direction";
    if (phase === "idle") {
      autoRouteStatus.textContent = "";
      autoRouteStatus.classList.add("map-view__pick-auto-route-status--idle");
      return;
    }
    if (phase === "direction") {
      autoRouteStatus.textContent = "";
      return;
    }
    if (phase === "searching") {
      autoRouteStatus.classList.add("map-view__pick-auto-route-status--searching");
      autoRouteStatus.textContent =
        message ?? "목표 거리에 맞는 도로 경로를 찾는 중입니다…";
      return;
    }
    if (phase === "failed") {
      autoRouteStatus.classList.add("map-view__pick-auto-route-status--failed");
      autoRouteStatus.textContent = message ?? "경로를 찾지 못했습니다.";
      return;
    }
    autoRouteStatus.classList.add("map-view__pick-auto-route-status--found");
    autoRouteStatus.textContent = message ?? "경로를 찾았습니다.";
  }

  function tryArmDirectionPick(): boolean {
    if (!distanceDirectionChecked) return false;
    const start = getRouteStart();
    if (!start || typeof onArmDirectionPick !== "function") return false;
    if (getRouteTokenInsufficient?.()) {
      setInlinePhase("failed", ROUTE_TOKEN_INSUFFICIENT_HINT);
      return false;
    }
    const parsed = Number.parseFloat(distanceNumber.value);
    const validated = validateDistanceAutoRouteTargetKm(parsed);
    if (!validated.ok) {
      setInlinePhase("failed", validated.message);
      return false;
    }
    syncDistanceInputs(validated.km);
    previewCircleForTargetKm(validated.km);
    const result = onArmDirectionPick({
      start,
      profile: currentProfile,
      targetKm: validated.km,
    });
    if (!result.ok) {
      setInlinePhase("failed", result.message);
      return false;
    }
    autoSessionActive = true;
    const rerouteReady = autoRouteStatus.dataset.phase === "found";
    setInlinePhase(
      "direction",
      rerouteReady || autoRouteStatusMessage === DISTANCE_AUTO_ROUTE_REROUTE_HINT
        ? DISTANCE_AUTO_ROUTE_REROUTE_HINT
        : formatDistanceAutoRouteDirectionClickHint(validated.km),
    );
    onDirectionPickArmed?.();
    return true;
  }

  onRegisterAutoRouteUi?.({
    setInlinePhase,
    tryArmDirectionPick: tryArmDirectionPickIfChecked,
    syncDistanceInputs,
    getRoutePickView: () => routePickView,
    syncRideStart,
    pulseRideStart,
    selectDistanceStart: (point) => {
      if (routePickView !== "distance" || pins.start) return false;
      selectStart(point);
      return true;
    },
    stageDirectionPick: (point) => {
      if (routePickView !== "distance") return false;
      if (!distanceConfirmed || distanceSearchPending) return true;
      selectedDirection = point;
      profileChosen = false;
      onStopDistanceCirclePulse?.();
      syncProfileUi();
      restartProfileAttention();
      onGenerateDistanceRoute?.(point);
      return true;
    },
  });

  modeCheckbox.addEventListener("change", () => {
    applyDistanceDirectionMode(modeCheckbox.checked);
  });


  minusBtn.addEventListener("click", () => {
    if (minusBtn.disabled) return;
    stepTargetKm(-DISTANCE_AUTO_ROUTE_KM_STEP);
  });
  plusBtn.addEventListener("click", () => {
    if (plusBtn.disabled) return;
    stepTargetKm(DISTANCE_AUTO_ROUTE_KM_STEP);
  });

  distanceNumber.addEventListener("change", () => {
    // Enter로 이미 확정했다면 이후 blur가 같은 펄스를 다시 시작하지 않는다.
    if (!distanceConfirmed) commitDistanceInput();
  });
  distanceNumber.addEventListener("input", resetDistanceSelection);
  distanceNumber.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitDistanceInput();
  });

  // 출발점이 없는 상태에서만 필요한 조작 안내를 남긴다.
  const distanceStartHint = document.createElement("p");
  distanceStartHint.className = "map-view__pick-route-distance-prereq";
  distanceStartHint.textContent = "지도에서 출발 위치를 길게 누르세요";

  autoRouteSection.append(
    distanceStartHint,
    distanceRow,
    autoRouteStatusSlot,
  );

  const routePickTabs = document.createElement("div");
  routePickTabs.className = "map-view__pick-route-tabs";
  routePickTabs.setAttribute("role", "tablist");
  routePickTabs.setAttribute("aria-label", "경로 생성 방식");

  const tabLocation = document.createElement("button");
  tabLocation.type = "button";
  tabLocation.className = "map-view__pick-route-tab";
  tabLocation.id = "map-view-pick-tab-location";
  tabLocation.setAttribute("role", "tab");
  /* 2026-10-29 Chief: 보이는 글자는 경로 두 지점·자+화살표 아이콘, 화면 읽기 이름은 한국어 유지 */
  tabLocation.innerHTML = buildPickPopupLocationModeIconSvg();
  tabLocation.setAttribute("aria-label", "출발·도착");
  tabLocation.title = "출발·도착";
  tabLocation.setAttribute("aria-controls", routeLocationView.id);

  const tabDistance = document.createElement("button");
  tabDistance.type = "button";
  tabDistance.className = "map-view__pick-route-tab";
  tabDistance.id = "map-view-pick-tab-distance";
  tabDistance.setAttribute("role", "tab");
  tabDistance.innerHTML = buildPickPopupDistanceModeIconSvg();
  tabDistance.setAttribute("aria-label", "거리·방향");
  tabDistance.title = "거리·방향";
  tabDistance.setAttribute("aria-controls", autoRouteSection.id);

  tabLocation.onclick = () => setRoutePickTab("location");
  tabDistance.onclick = () => setRoutePickTab("distance");
  routePickTabs.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    if (event.key === "Home" || event.key === "ArrowLeft") {
      setRoutePickTab("location");
      tabLocation.focus();
      return;
    }
    setRoutePickTab("distance");
    tabDistance.focus();
  });
  routePickTabs.append(tabLocation, tabDistance);
  // 제목과 닫기 사이의 모드 버튼은 드래그 대신 클릭으로 동작한다.
  const tabsRow = document.createElement("div");
  tabsRow.className = "map-view__pick-tabs-row";
  tabsRow.addEventListener("pointerdown", (event) => event.stopPropagation());
  tabsRow.append(routePickTabs);

  function syncRoutePickView() {
    const onLocation = routePickView === "location";
    routeLocationView.hidden = !onLocation;
    autoRouteSection.hidden = onLocation;
    tabLocation.setAttribute("aria-selected", String(onLocation));
    tabDistance.setAttribute("aria-selected", String(!onLocation));
    tabLocation.tabIndex = onLocation ? 0 : -1;
    tabDistance.tabIndex = onLocation ? -1 : 0;
    tabLocation.classList.toggle("is-active", onLocation);
    tabDistance.classList.toggle("is-active", !onLocation);
    distanceStartHint.hidden = pins.start || onLocation;
    distanceRow.hidden = !pins.start;
    autoRouteStatusSlot.hidden = !pins.start;
    wrap.classList.toggle("map-view__pick--route-tab-distance", !onLocation);
  }

  function syncAutoRouteUi() {
    const available = pins.start && typeof onArmDirectionPick === "function";
    if (!available) {
      distanceDirectionChecked = false;
      getDistanceAutoRouteMapBridge()?.setDistanceDirectionMode?.(false);
      modeCheckbox.checked = false;
      setInlinePhase("idle");
      onClearDistanceAutoRouteCircle?.();
    }
    syncRoutePickView();
  }
  syncAutoRouteUi();
  syncDistanceModeUi();
  syncDistanceInputs(targetKm);
  if (distanceDirectionChecked && pins.start) {
    tryArmDirectionPickIfChecked();
  }
  if (distanceDirectionChecked && deps.initialHasRoute && autoRouteStatusMessage) {
    setInlinePhase("found", autoRouteStatusMessage);
  }

  const unsubTokenForProfile = subscribeRouteTokenEffective(() => {
    syncProfileUi();
    syncAutoRouteUi();
    syncTokenUi();
  });
  signal.addEventListener(
    "abort",
    () => {
      unsubTokenForProfile();
      onStopDistanceCirclePulse?.();
      onClearDistanceAutoRouteCircle?.();
    },
    { once: true },
  );

  const dragHandle = document.createElement("div");
  dragHandle.className = "map-view__pick-drag-handle";
  /*
   * 제목·모드·닫기 한 줄. 과금 상태 안내는 필요할 때 아래 독립 행에 보존한다.
   */
  const headerRow = document.createElement("div");
  headerRow.className = "map-view__pick-header-row";
  const heading = document.createElement("h2");
  heading.className = "map-view__pick-title";
  heading.innerHTML = `${buildPickPopupTitleIconSvg()}<span class="map-view__pick-sr-only">경로</span>`;
  headerRow.append(heading, tabsRow);
  dragHandle.append(headerRow, tokenSection, addressEl);

  wrap.append(dragHandle, routeLocationView, autoRouteSection, profileSection);

  const token = accessToken.trim();
  if (token.length > 0) {
    void (async () => {
      try {
        const place = await fetchMapboxReverseGeocodePlaceName(lngLat, token, signal);
        if (signal.aborted) return;
        setAddressText(place ?? "주소를 찾을 수 없습니다");
      } catch {
        if (signal.aborted) return;
        setAddressText("주소를 불러오지 못했습니다");
      }
    })();
  } else {
    setAddressText("지도 토큰이 없어 주소를 표시할 수 없습니다");
  }

  // App 측 armDirectionPick(anchor extend) 이 popup DOM 보다 먼저 커밋되면 checkbox 가 한 틱 늦게 맞춰진다.
  queueMicrotask(() => {
    if (signal.aborted) return;
    const live = getDistanceAutoRouteMapBridge();
    if (!live?.distanceDirectionMode) {
      pulseDistanceEntry();
      return;
    }
    const armed = live.getArmedStart?.() ?? null;
    if (armed) {
      selectedStart = armed;
      pins.start = true;
    } else if (!pins.start && !selectedStart) {
      return;
    }
    distanceDirectionChecked = true;
    if (typeof live.targetKm === "number" && live.targetKm > 0) {
      syncDistanceInputs(live.targetKm);
    }
    /* 지시38 — 하단 bridge 초기 거리재개 뷰 동기화만. 사용자 caret/토큰/phase 갱신 때 리셋 금지. */
    if (pins.start) {
      routePickView = "distance";
    } else {
      routePickView = "location";
    }
    syncDistanceModeUi();
    syncAutoRouteUi();
    syncProfileUi();
    tryArmDirectionPickIfChecked();
    onDirectionPickArmed?.();
    pulseDistanceEntry();
  });

  return wrap;
}

/**
 * 지도 위 **DOM 마커** — 내 라이더·동행 라이더의 네임태그(GLB 모드)와
 * 스프라이트 마커(iso2d 모드).
 *
 * 왜 MapView 에서 나왔나 (2026-09-28, 구조 정비 A-2) — 이 묶음은 `document.createElement`
 * 와 `mapboxgl.Marker` 만 다룬다. React 상태도, 지도 이벤트도 모른다.
 * **동작은 바꾸지 않았다 — 자리만 옮겼다.**
 *
 * ⚠️ 동행 위치·위상 계산은 여기 없다. 여기는 **이미 정해진 좌표를 화면에 붙이는 일**만 한다.
 * 연속 위상(0~1)을 6장으로 자르는 곳은 `applyPeerDomSpriteFrame` 하나뿐이다(2026-09-25 결정).
 */
import mapboxgl from "mapbox-gl";
import type { LngLat } from "../../lib/geo/geo";
import { ensureRiderPedalStripKeyframes } from "../../lib/rider/riderPedalStripKeyframes";
import { RIDER_PEDAL_CELL_PX, RIDER_PEDAL_FRAME_COUNT, RIDER_PEDAL_SPRITE_REVISION } from "../../lib/rider/riderPedalSpriteMeta";
import { applyIso2dRiderBearing, createIso2dRiderMarkerRoot } from "../../lib/riderPrototype/iso2dMarker";
import { ensureRiderGlbLayer } from "../../lib/riderPrototype/glbModelLayer";
import { ensureRiderPreservedLayer } from "../../lib/map/riderPreservedLayer";
import { getRiderPrototypeMode } from "../../lib/riderPrototype/config";
import { ridePulseAnimationDelay } from "../../lib/ride/ridePulse";

/** MapView 와 같은 값 — `import.meta.env` 를 읽는 순수 함수라 각자 불러도 결과가 같다. */
const RIDER_PROTOTYPE_MODE = getRiderPrototypeMode();

/**
 * 출발/도착/경유·라이더: 3D 피치에서도 빌보드(세움). `map` 정렬은 스프라이트가 지면에 눕는 문제가 있어 라이더도 viewport 유지.
 */
export const PIN_MARKER_VIEWPORT_ALIGNMENT = {
  pitchAlignment: "viewport" as const,
  rotationAlignment: "viewport" as const,
};

/**
 * 라이더 DOM 마커만 — 앵커(bottom) 대비 픽셀 보정. Mapbox: 양수 → 오른쪽·아래, 음수 → 왼쪽·위.
 * (좌표 보간과 별개; 화면상 선·스프라이트 패딩 어긋남만 여기서 조절)
 */
export const RIDER_ROUTE_MARKER_OFFSET_PX: [number, number] = [14, 18];

/** GLB 네임태그 — `viewport` 빌보드(측면 3D 시점에서도 읽힘). 위치 추적은 rAF·render 재투영으로 처리 */
const RIDER_GLB_NAMETAG_ALIGNMENT = {
  pitchAlignment: "viewport" as const,
  rotationAlignment: "viewport" as const,
};

/** GLB 모드 — 캐릭터 머리 위 네임태그(지면 앵커 + 화면 픽셀 위로) */
const RIDER_GLB_NAMETAG_OFFSET_PX: [number, number] = [0, -40];

const RIDER_GLB_NAMETAG_MARKER_OPTS = {
  anchor: "bottom" as const,
  offset: RIDER_GLB_NAMETAG_OFFSET_PX,
  ...RIDER_GLB_NAMETAG_ALIGNMENT,
  /** GLB 머리 높이(~1.1m) — terrain 표면 기준, 과도한 상승 방지 */
  altitude: 1.05,
};

function isPacerMarkerId(id: string): boolean {
  return id === "pacer-a" || id === "pacer-b";
}

function createGlbRiderNametagRoot(kind: "live" | "peer" | "pacer", label: string): HTMLDivElement {
  const root = document.createElement("div");
  root.className =
    kind === "pacer"
      ? "map-view__glb-nametag-host map-view__glb-nametag-host--peer map-view__glb-nametag-host--pacer"
      : `map-view__glb-nametag-host map-view__glb-nametag-host--${kind}`;
  const nametag = document.createElement("div");
  nametag.className =
    kind === "live"
      ? "map-view__rider-nametag map-view__rider-nametag--live"
      : kind === "pacer"
        ? "map-view__rider-nametag map-view__rider-nametag--peer map-view__rider-nametag--pacer"
        : "map-view__rider-nametag map-view__rider-nametag--peer";
  nametag.setAttribute("aria-hidden", "true");
  nametag.textContent = label;
  if (!label.trim()) nametag.style.display = "none";
  root.appendChild(nametag);
  return root;
}

function applyGlbNametagLabel(el: HTMLDivElement | null, label: string): void {
  if (!el) return;
  const t = label.trim();
  el.textContent = t;
  el.style.display = t ? "flex" : "none";
}

/**
 * 내려다보는 화면(QC1 상공·경로 전체)에서는 라이더 모델이 점만 해서 머리 위 -40px 이
 * **허공**이 된다 — 이름표가 점에서 떨어져 옆 라이더의 이름처럼 읽혔다(2026-10-08 Chief).
 *
 * 기울기가 이보다 작으면:
 * - **내 이름표는 숨긴다.** 내 위치는 큰 파란 펄스 점 하나로 충분하다. 위·옆 어디에 붙여도
 *   동행과 붙어 달리면 내 이름이 동행 점 위에 얹혔다(같은 날 2·3차 실측).
 * - 동행 이름표는 그 동행 점 **옆**, 내 점과 **반대쪽**에 붙인다. 오른쪽 고정이면 동행이
 *   내 점 바로 왼쪽에 있을 때 이름이 내 점을 덮었다(실측 peerTag 630..709 ⊃ selfDot 626..654).
 */
const NAMETAG_FLAT_PITCH_MAX_DEG = 30;
const NAMETAG_FLAT_CLASS = "map-view__glb-nametag-host--flat";
const NAMETAG_FLAT_LEFT_CLASS = "map-view__glb-nametag-host--flat-left";
/** 좌우를 바꾸는 최소 가로 차(px) — 나란히 달릴 때 매 프레임 뒤집히지 않게 */
const NAMETAG_SIDE_HYSTERESIS_PX = 4;

const nametagFlatState = new WeakMap<mapboxgl.Marker, boolean>();
/** 동행 이름표 마커 → 그 동행의 위치 점 마커 */
const peerLocationDots = new WeakMap<mapboxgl.Marker, mapboxgl.Marker>();

function applyNametagOffsetForPitch(mk: mapboxgl.Marker, flat: boolean): void {
  if (nametagFlatState.get(mk) === flat) return;
  nametagFlatState.set(mk, flat);
  mk.setOffset(flat ? [0, 0] : RIDER_GLB_NAMETAG_OFFSET_PX);
  mk.getElement().classList.toggle(NAMETAG_FLAT_CLASS, flat);
}

/** 동행이 내 점보다 왼쪽에 있으면 이름표도 왼쪽으로. 차가 작으면 직전 쪽을 유지한다. */
function applyPeerNametagSide(mk: mapboxgl.Marker, peerX: number, selfX: number | null): void {
  const el = mk.getElement();
  if (selfX == null) {
    el.classList.remove(NAMETAG_FLAT_LEFT_CLASS);
    return;
  }
  const dx = peerX - selfX;
  if (dx < -NAMETAG_SIDE_HYSTERESIS_PX) el.classList.add(NAMETAG_FLAT_LEFT_CLASS);
  else if (dx > NAMETAG_SIDE_HYSTERESIS_PX) el.classList.remove(NAMETAG_FLAT_LEFT_CLASS);
}

/** terrain·피치 변화 시 DOM 마커 재투영 (최초 생성 좌표에 고정되는 Mapbox 이슈 완화) */
export function reprojectGlbNametagMarkers(
  liveMarker: mapboxgl.Marker | null,
  peerMarkers: ReadonlyMap<string, mapboxgl.Marker>,
  map?: mapboxgl.Map,
): void {
  const pitchDeg = map?.getPitch();
  const flat = pitchDeg != null && Number.isFinite(pitchDeg) && pitchDeg < NAMETAG_FLAT_PITCH_MAX_DEG;
  let selfX: number | null = null;
  if (liveMarker) {
    applyNametagOffsetForPitch(liveMarker, flat);
    const ll = liveMarker.getLngLat();
    liveMarker.setLngLat([ll.lng, ll.lat]);
    if (flat && map) selfX = map.project(ll).x;
  }
  for (const mk of peerMarkers.values()) {
    applyNametagOffsetForPitch(mk, flat);
    const ll = mk.getLngLat();
    mk.setLngLat([ll.lng, ll.lat]);
    peerLocationDots.get(mk)?.setLngLat([ll.lng, ll.lat]);
    if (flat && map) applyPeerNametagSide(mk, map.project(ll).x, selfX);
  }
}

/**
 * 동행 위치 점 — 내 위치 점보다 작은 청록(이름표와 같은 색) 펄스. 혼동 방지가 목적이라
 * 크기·색·퍼지는 범위를 모두 내 점과 다르게 둔다(2026-10-08 Chief).
 *
 * 이름표 마커에 **붙여서** 만들고 지운다 — MapView 의 정리 코드는 이름표 맵만 돌며
 * `remove()` 하므로, 점을 따로 들고 있으면 스타일 교체 때 점만 남는다.
 */
function createPeerLocationRoot(): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "map-view__peer-location-host";
  root.setAttribute("aria-hidden", "true");
  const pulse = document.createElement("div");
  pulse.className = "map-view__peer-location-pulse";
  pulse.style.animationDelay = ridePulseAnimationDelay();
  const core = document.createElement("div");
  core.className = "map-view__peer-location-core";
  root.append(pulse, core);
  return root;
}

function attachPeerLocationDot(map: mapboxgl.Map, nametag: mapboxgl.Marker, lngLat: LngLat): void {
  const dot = new mapboxgl.Marker({
    element: createPeerLocationRoot(),
    className: "map-view__peer-location-marker",
    anchor: "center",
    ...PIN_MARKER_VIEWPORT_ALIGNMENT,
  })
    .setLngLat(lngLat)
    .addTo(map);
  peerLocationDots.set(nametag, dot);
  const removeNametag = nametag.remove.bind(nametag);
  nametag.remove = () => {
    dot.remove();
    peerLocationDots.delete(nametag);
    return removeNametag();
  };
}


export function syncGlbLiveNametagMarker(
  map: mapboxgl.Map,
  lngLat: LngLat | null,
  label: string,
  markerRef: { current: mapboxgl.Marker | null },
  nametagElRef: { current: HTMLDivElement | null },
): void {
  if (!lngLat) {
    markerRef.current?.remove();
    markerRef.current = null;
    nametagElRef.current = null;
    return;
  }
  let mk = markerRef.current;
  if (!mk) {
    const root = createGlbRiderNametagRoot("live", label);
    nametagElRef.current = root.querySelector<HTMLDivElement>(".map-view__rider-nametag");
    mk = new mapboxgl.Marker({
      element: root,
      className: "map-view__glb-nametag-marker map-view__live-rider-marker",
      ...RIDER_GLB_NAMETAG_MARKER_OPTS,
    })
      .setLngLat(lngLat)
      .addTo(map);
    markerRef.current = mk;
  } else {
    mk.setLngLat(lngLat);
    applyGlbNametagLabel(nametagElRef.current, label);
  }
}

function syncGlbPeerNametagMarkers(
  map: mapboxgl.Map,
  features: PeerDomGJFeature[],
  markersRef: { current: Map<string, mapboxgl.Marker> },
): void {
  const markers = markersRef.current;
  const next = new Set<string>();
  for (const f of features) {
    const id = f.properties.id;
    next.add(id);
    const lngLat = f.geometry.coordinates;
    const { label } = f.properties;
    let mk = markers.get(id);
    if (!mk) {
      const root = createGlbRiderNametagRoot(isPacerMarkerId(id) ? "pacer" : "peer", label);
      mk = new mapboxgl.Marker({
        element: root,
        className: "map-view__glb-nametag-marker",
        ...RIDER_GLB_NAMETAG_MARKER_OPTS,
      })
        .setLngLat(lngLat)
        .addTo(map);
      markers.set(id, mk);
      attachPeerLocationDot(map, mk, lngLat);
    } else {
      mk.setLngLat(lngLat);
      peerLocationDots.get(mk)?.setLngLat(lngLat);
      const nametag = mk.getElement().querySelector<HTMLDivElement>(".map-view__rider-nametag");
      applyGlbNametagLabel(nametag, label);
    }
  }
  for (const id of [...markers.keys()]) {
    if (!next.has(id)) {
      markers.get(id)?.remove();
      markers.delete(id);
    }
  }
}

function pickPeerSourceFrameIndices(totalFrames: number): number[] {
  if (totalFrames < 2) return [0, 0, 0, 0, 0, 0];
  return [0, 1, 2, 3, 4, 5].map((i) => Math.min(totalFrames - 1, Math.round((i * (totalFrames - 1)) / 5)));
}

const PEER_DOM_STRIP_INDICES = pickPeerSourceFrameIndices(RIDER_PEDAL_FRAME_COUNT);

export type PeerDomGJFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: LngLat };
  properties: { id: string; label: string; phaseRev: number; hdg: number };
};

/**
 * `pedal-sprite.png` 스트립의 프레임 수. **스프라이트를 그리는 쪽이 갖는다.**
 *
 * 종전에는 이 값이 `lib/registerPeerRiderPedalSprites` 에 있었고, 전송 계층이 그것을
 * 가져다 위상을 6단계로 잘라 실었다. 그 모듈의 나머지(Mapbox `addImage` 등록·ready
 * 검사·틴트)는 **어디서도 호출되지 않는 죽은 코드**여서 함께 걷었다(2026-09-25).
 * GLB 라이더는 연속 위상을 쓰므로, 6장으로 자르는 일은 여기(iso2d DOM 경로)에만 남는다.
 */
const PEER_DOM_PEDAL_FRAME_COUNT = 6;

/** 연속 위상(0~1)을 스트립 프레임으로 자른다. 자르는 일은 여기서만 한다. */
function applyPeerDomSpriteFrame(sprite: HTMLDivElement | null, phaseRev: number): void {
  if (!sprite) return;
  const frame = Math.floor(((phaseRev % 1) + 1) % 1 * PEER_DOM_PEDAL_FRAME_COUNT);
  const idx = ((frame % PEER_DOM_PEDAL_FRAME_COUNT) + PEER_DOM_PEDAL_FRAME_COUNT) % PEER_DOM_PEDAL_FRAME_COUNT;
  const stripIndex = PEER_DOM_STRIP_INDICES[idx] ?? 0;
  const cell = RIDER_PEDAL_CELL_PX;
  sprite.style.backgroundPosition = `-${stripIndex * cell}px 0`;
}

function createPeerRiderMarkerRoot(initialLabel: string, pacer: boolean): HTMLDivElement {
  if (RIDER_PROTOTYPE_MODE === "iso2d") {
    return createIso2dRiderMarkerRoot(pacer ? "pacer" : "peer", initialLabel, "map-view__peer-rider-host").root;
  }
  ensureRiderPedalStripKeyframes();
  const root = document.createElement("div");
  root.className = "cycling-sim-marker-host map-view__peer-rider-host";
  const nametag = document.createElement("div");
  nametag.className = pacer
    ? "map-view__rider-nametag map-view__rider-nametag--peer map-view__rider-nametag--pacer"
    : "map-view__rider-nametag map-view__rider-nametag--peer";
  nametag.setAttribute("aria-hidden", "true");
  nametag.textContent = initialLabel;
  const flip = document.createElement("div");
  flip.className = "cycling-sim-marker-flip";
  const stack = document.createElement("div");
  stack.className = "cycling-sim-marker-stack";
  const sprite = document.createElement("div");
  sprite.className = "cycling-sim-marker-pedal-sprite";
  const baseRaw = import.meta.env.BASE_URL ?? "/";
  const base = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
  sprite.style.backgroundImage = `url("${base}rider/pedal-sprite.png?v=${RIDER_PEDAL_SPRITE_REVISION}")`;
  sprite.style.animationPlayState = "paused";
  stack.appendChild(sprite);
  flip.appendChild(stack);
  root.appendChild(nametag);
  root.appendChild(flip);
  return root;
}

export function syncPeerDomMarkers(
  map: mapboxgl.Map,
  features: PeerDomGJFeature[],
  markersRef: { current: Map<string, mapboxgl.Marker> },
): void {
  const rider3dLayerReady =
    (RIDER_PROTOTYPE_MODE === "glb" && ensureRiderGlbLayer(map)) ||
    (RIDER_PROTOTYPE_MODE === "preserved" && ensureRiderPreservedLayer(map));
  if (rider3dLayerReady) {
    syncGlbPeerNametagMarkers(map, features, markersRef);
    return;
  }
  const markers = markersRef.current;
  const next = new Set<string>();
  for (const f of features) {
    const id = f.properties.id;
    next.add(id);
    const lngLat = f.geometry.coordinates;
    const { label, phaseRev, hdg } = f.properties;
    let mk = markers.get(id);
    if (!mk) {
      const root = createPeerRiderMarkerRoot(label, isPacerMarkerId(id));
      mk = new mapboxgl.Marker({
        element: root,
        className: "map-view__peer-rider-marker",
        anchor: "bottom",
        offset: RIDER_ROUTE_MARKER_OFFSET_PX,
        ...PIN_MARKER_VIEWPORT_ALIGNMENT,
      })
        .setLngLat(lngLat)
        .addTo(map);
      markers.set(id, mk);
    } else {
      mk.setLngLat(lngLat);
    }
    const root = mk.getElement();
    const nametag = root.querySelector<HTMLDivElement>(".map-view__rider-nametag--peer");
    const flip = root.querySelector<HTMLDivElement>(
      RIDER_PROTOTYPE_MODE === "iso2d" ? ".map-view__proto-iso-flip" : ".cycling-sim-marker-flip",
    );
    if (RIDER_PROTOTYPE_MODE === "iso2d") {
      const img = root.querySelector<HTMLImageElement>(".map-view__proto-iso-sprite");
      if (nametag) nametag.textContent = label;
      if (flip && img) applyIso2dRiderBearing(flip, img, "peer", hdg);
    } else {
      const sprite = root.querySelector<HTMLDivElement>(".cycling-sim-marker-pedal-sprite");
      if (nametag) nametag.textContent = label;
      applyPeerDomSpriteFrame(sprite, phaseRev);
      if (flip) {
        flip.style.transform = hdg > 90 && hdg < 270 ? "scaleX(-1)" : "scaleX(1)";
      }
    }
  }
  for (const id of [...markers.keys()]) {
    if (!next.has(id)) {
      markers.get(id)?.remove();
      markers.delete(id);
    }
  }
}


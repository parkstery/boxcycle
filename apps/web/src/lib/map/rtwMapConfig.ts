import type { LinePaint } from "mapbox-gl";

/**
 * 지도 위 선의 의미를 색으로 나눈다(2026-08-28).
 *
 *   빨강    #ef4444 — 아직 안 간 길(설정된 루트). MapView ROUTE_LINE_COLOR
 *   마젠타  #EC4899 — **내가 달린 길** — 이번 주행 궤적과 내 도로망 모두
 *
 * 「이번에 달린」과 「예전에 달린」을 색으로 가르지 않는다 — 사용자에게 중요한 구분은
 * 「내가 달렸나 / 아직 안 갔나」 하나뿐이다. 이번 주행 궤적은 glow 와 굵기로만 구별해
 * 「지금 칠해지는 중」임을 알린다.
 *
 * 색 선택 근거 — Outdoors 스타일이 실제로 쓰는 색상환을 뽑아 비어 있는 대역을 골랐다.
 *   35°  road-steps      hsl(35,80%,48%)    주황
 *   50°~60° land·building hsl(50~60,15~20%,75~85%) 베이지
 *   98°  national-park   hsl(98,38%,68%)    녹지
 *   194° wetland         hsl(194,38%,74%)   청록   ← 청록이 여기서 막힌다
 *   205° water           hsl(205,75%,70%)   강·바다 ← 시안이 여기에 섞였다
 *   224° water-shadow    hsl(224,79%,69%)   파랑
 * 앱 오브젝트는 0°(루트·도착핀) · 142°(출발핀)를 쓴다.
 * 260°~340°(보라~마젠타)만 비어 있어, 넓은 맵에서 강·녹지·도로 어디에도 섞이지 않는다.
 *
 * 마젠타(330°)가 빨강(0°)과 30° 이웃인데도 쓰는 이유: 재주행 시 구분이 안 되던 진짜
 * 원인은 색이 아니라 **레이어 순서**였다 — 누적 궤적이 경로선 아래에 깔려 강한 빨강에
 * 덮였다. 순서를 바로잡으면(route < 누적 < live) 마젠타가 그대로 드러난다.
 * `MapView.orderConquestLayersAboveRoute` 참고.
 *
 * 골드(#E8A33D)·청록(#0891B2)을 쓰지 않는 이유: 골드는 Outdoors 도로(주황·황토)에,
 * 청록은 강·바다(205°)와 습지(194°)에 섞여 넓은 맵에서 임팩트가 사라졌다.
 */

/**
 * 내 도로망(과거 누적) — 마젠타(330°).
 * 대안(이 상수 한 줄만 고치면 된다):
 *   `#A855F7`(280°) 퍼플 · `#C026D3`(292°) 자주 — 빨강에서 더 멀게
 */
const RTW_TRACE_OWNED_COLOR = "#8A2BE2";

/** 이번 주행에서 지나온 구간 — 내 도로망과 같은 마젠타(glow·굵기로만 구별) */
const RTW_TRACE_LIVE_COLOR = RTW_TRACE_OWNED_COLOR;


/** 이번 주행 실시간 궤적 — 마젠타 + glow */
export const RTW_TRACE_LIVE_PAINT: LinePaint = {
  "line-color": RTW_TRACE_LIVE_COLOR,
  "line-opacity": 1,
  "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3.2, 12, 5, 16, 8],
};

/**
 * 실시간 궤적 glow — Mapbox 는 CSS drop-shadow 미지원이라 같은 라인을
 * 더 굵고 흐리게 한 겹 아래 깔아 발광을 흉내낸다. 본선보다 먼저(아래) 추가할 것.
 */
export const RTW_TRACE_LIVE_GLOW_PAINT: LinePaint = {
  "line-color": RTW_TRACE_LIVE_COLOR,
  "line-width": ["interpolate", ["linear"], ["zoom"], 8, 9, 12, 14, 16, 22],
  "line-blur": 8,
  "line-opacity": 0.35,
};

/**
 * 누적된 세계(내 도로망) — 마젠타.
 * 「영구 자산」이 핵심 판타지이므로 넓은 맵에서 한눈에 보여야 한다.
 */
/** 내 도로망 선 폭의 줌 stop — [zoom, px] */
const RTW_TRACE_ACCUMULATED_WIDTH_STOPS: readonly (readonly [number, number])[] = [
  [4, 2.6],
  [8, 2.8],
  [12, 4],
  [16, 7],
];

/**
 * 내 도로망 선 폭. `minWidthPx` 를 주면 그 아래로 내려가지 않는다.
 *
 * 왜 하한이 필요한가: 경로선은 줌과 무관하게 4px 고정인데 이 선은 z12 에서 4px,
 * z8 에서 2.8px 다. 경로선 **아래** 로 깔리는 단계(경로 설정 중)에는 z12 이하에서
 * 경로선이 더 굵어 내 도로망이 통째로 가려진다 — 하한을 줘서 양옆에 띠가 남게 한다.
 */
export function rtwAccumulatedWidthExpression(
  minWidthPx?: number,
): NonNullable<LinePaint>["line-width"] {
  /*
   * 하한은 **stop 값에 직접** 건다. `["max", <interpolate>, n]` 으로 감싸면 Mapbox 가
   * 거부한다 — "zoom" 표현식은 top-level interpolate/step 의 입력으로만 쓸 수 있다.
   * (실주행 e2e 콘솔 오류로 잡혔다.)
   */
  const expr: unknown[] = ["interpolate", ["linear"], ["zoom"]];
  for (const [zoom, px] of RTW_TRACE_ACCUMULATED_WIDTH_STOPS) {
    expr.push(zoom, minWidthPx == null ? px : Math.max(px, minWidthPx));
  }
  return expr as NonNullable<LinePaint>["line-width"];
}

export const RTW_TRACE_ACCUMULATED_PAINT: LinePaint = {
  "line-color": RTW_TRACE_OWNED_COLOR,
  "line-opacity": 0.95,
  "line-width": rtwAccumulatedWidthExpression(),
};

/**
 * 줌아웃 LOD — 「내 도로망」 집계 광채.
 *
 * 문제: 세계 줌(z4~8)에서 하루치 주행은 몇 px짜리 실오라기라 사실상 보이지 않는다.
 * 성취가 얇아 보이는 원인은 인정 규칙이 아니라 **원거리에서의 가시성**이다.
 *
 * 해법: 누적 궤적 **아래**에 같은 색을 굵고 흐리게 한 겹 깐다. 서로 가까운 궤적들의
 * 흐린 테두리가 자연히 겹쳐 하나의 덩어리로 읽힌다 — 별도 집계 데이터·타일·면(面)
 * 없이 순수 paint 만으로 LOD 집계가 성립한다.
 *
 * 경계(edge)가 없는 광채여야 한다. 윤곽이 생기는 순간 「채워야 할 영역」(분모)으로
 * 읽히고, 그것은 Conquest 설계 §3.4 의 탐험도·비율 판정 금지와 어긋난다.
 *
 * z13 에서 0 으로 사라진다 — 근거리 표현은 종전과 완전히 동일하다.
 */
export const RTW_TRACE_ACCUMULATED_HALO_PAINT: LinePaint = {
  "line-color": RTW_TRACE_OWNED_COLOR,
  "line-width": ["interpolate", ["linear"], ["zoom"], 4, 16, 8, 13, 11, 8, 13, 0],
  "line-blur": ["interpolate", ["linear"], ["zoom"], 4, 5, 8, 5, 11, 4, 13, 0],
  "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 8, 0.65, 11, 0.4, 13, 0],
};

/*
 * 2026-09-26 (Phase 6-D3): `storage/appSessionKeys` 에서 **그대로** 옮겨 왔다.
 * 스타일 목록은 지도 설정이지 세션 저장 키가 아니다.
 */
const MAP_STYLE_OUTDOORS = "mapbox://styles/mapbox/outdoors-v12";
export const MAP_STYLE_SATELLITE = "mapbox://styles/mapbox/satellite-streets-v12";

/** 제거된 Spinatlas Dark(navigation-night·dark-v11) — 복원·저장값 방어용 */
const LEGACY_MAP_STYLE_DARK_URLS = new Set([
  "mapbox://styles/mapbox/navigation-night-v1",
  "mapbox://styles/mapbox/dark-v11",
]);

/** 앱 기본 맵 스타일 — Outdoors */
export const DEFAULT_MAP_STYLE = MAP_STYLE_OUTDOORS;

/** 알 수 없거나 제거된 스타일 URL → Outdoors */
function normalizeMapStyle(style: string): string {
  if (LEGACY_MAP_STYLE_DARK_URLS.has(style)) return MAP_STYLE_OUTDOORS;
  if (style === MAP_STYLE_OUTDOORS || style === MAP_STYLE_SATELLITE) return style;
  return MAP_STYLE_OUTDOORS;
}

/**
 * 주행 HUD Outdoors↔Satellite 토글.
 * 그 외(레거시 Dark 등)는 Outdoors 로 정규화한 뒤 Satellite 으로 보낸다.
 */
export function nextOutdoorsSatelliteMapStyle(current: string): string {
  const style = normalizeMapStyle(current);
  if (style === MAP_STYLE_SATELLITE) return MAP_STYLE_OUTDOORS;
  return MAP_STYLE_SATELLITE;
}

/** HUD 칩용 짧은 라벨(2~4자). */
export function mapStyleHudShortLabel(style: string): string {
  const normalized = normalizeMapStyle(style);
  if (normalized === MAP_STYLE_SATELLITE) return "위성";
  if (normalized === MAP_STYLE_OUTDOORS) return "야외";
  return "맵";
}

/**
 * 고밀도 화면 렌더 해상도 상한 (2026-10-16 P1).
 *
 * mapbox-gl 3.23.1 의 `MapOptions` 에는 `pixelRatio` 가 없고 `Map` 에도
 * `get/setPixelRatio` 가 없다. 내부는 전역 `window.devicePixelRatio` 를 직접 읽는다
 * (`_resizeCanvas`·`painter.resize`·타일 pixelRatio·셰이더 `u_device_pixel_ratio` 전부).
 * 그래서 상한은 「JS 가 보는 DPR」을 `min(실측, 상한)` 으로 고정해 강제한다.
 * Mapbox 의 resize 경로(`_onWindowResize` → `resize()`)도 같은 값을 다시 읽으므로
 * 화면 회전·창 크기 변경 뒤에도 상한이 유지된다. 지도 위 3D 라이더 레이어(three.js)는
 * `map.getCanvas()` 와 같은 GL 컨텍스트를 공유하므로 지도 캔버스 해상도를 그대로 따른다.
 */
export const RIDER_MAP_MAX_PIXEL_RATIO = 2;
/** `?maxdpr=` 비교 측정용 키 (운영 포함). 범위를 벗어나면 상수로 복귀. */
const RIDER_MAP_MAX_DPR_QUERY_KEY = "maxdpr";
const RIDER_MAP_MAX_DPR_MIN = 1;
const RIDER_MAP_MAX_DPR_MAX = 4;

/** `?maxdpr=` 파싱 — 1–4 범위만 인정, 없거나 잘못되면 상수. */
export function parseRiderMapMaxPixelRatio(search: string | null | undefined): number {
  try {
    const raw = new URLSearchParams(search ?? "").get(RIDER_MAP_MAX_DPR_QUERY_KEY);
    if (raw == null || raw.trim() === "") return RIDER_MAP_MAX_PIXEL_RATIO;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < RIDER_MAP_MAX_DPR_MIN || n > RIDER_MAP_MAX_DPR_MAX) {
      return RIDER_MAP_MAX_PIXEL_RATIO;
    }
    return n;
  } catch {
    return RIDER_MAP_MAX_PIXEL_RATIO;
  }
}

/**
 * 실측 DPR → 렌더에 쓸 비율. DPR ≤ 2 기기는 그대로라 동작이 바뀌지 않는다.
 * `maxRatio` 가 범위를 벗어나면 상수를 쓴다.
 */
export function resolveRiderMapPixelRatio(
  devicePixelRatio: number,
  maxRatio: number = RIDER_MAP_MAX_PIXEL_RATIO,
): number {
  const dpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const cap =
    Number.isFinite(maxRatio) &&
    maxRatio >= RIDER_MAP_MAX_DPR_MIN &&
    maxRatio <= RIDER_MAP_MAX_DPR_MAX
      ? maxRatio
      : RIDER_MAP_MAX_PIXEL_RATIO;
  return Math.min(dpr, cap);
}

let riderMapMaxCache: number | undefined;
let riderMapTrueDprCache: number | null = null;
/**
 * 상한을 걸기 전 브라우저의 원래 `devicePixelRatio` 접근자. 매번 이것으로 실측해야
 * PC 브라우저 확대·축소나 모니터 이동으로 배율이 바뀌어도 따라간다(Supervisor 보정).
 */
let riderMapNativeDprGetter: (() => number) | null = null;

function readNativeDevicePixelRatio(): number | null {
  if (typeof window === "undefined") return null;
  // 원래 접근자를 못 찾았는데 이미 덮어썼다면 window 를 다시 읽으면 자기 자신을 부른다 → 설치 때 값.
  if (!riderMapNativeDprGetter && riderMapCapInstalled) return riderMapTrueDprCache;
  const raw = riderMapNativeDprGetter ? riderMapNativeDprGetter() : window.devicePixelRatio;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}
let riderMapCapInstalled = false;

/** 페이지 수명 동안 `?maxdpr=` 를 한 번만 읽는다. */
export function getRiderMapMaxPixelRatio(): number {
  if (riderMapMaxCache !== undefined) return riderMapMaxCache;
  const search = typeof window === "undefined" ? "" : (window.location?.search ?? "");
  riderMapMaxCache = parseRiderMapMaxPixelRatio(search);
  return riderMapMaxCache;
}

/** 상한 적용 전 실측 DPR. perflab 기기 정보가 실측을 그대로 보고하게 둔다. */
export function readRiderMapTrueDevicePixelRatio(): number | null {
  if (riderMapCapInstalled) return readNativeDevicePixelRatio() ?? riderMapTrueDprCache;
  if (riderMapTrueDprCache != null) return riderMapTrueDprCache;
  return readNativeDevicePixelRatio();
}

/**
 * 렌더 해상도 상한을 설치한다 — `new mapboxgl.Map` 보다 먼저 부를 것.
 * `window.devicePixelRatio` 의 JS 관측값을 `min(실측, 상한)` 으로 고정한다.
 * @returns 적용 비율. 재정의가 막힌 환경이면 상한 없이 진행하고 값을 그대로 반환한다.
 */
export function installRiderMapPixelRatioCap(): number {
  const max = getRiderMapMaxPixelRatio();
  if (typeof window === "undefined") return max;
  if (riderMapTrueDprCache == null) {
    const raw = window.devicePixelRatio;
    riderMapTrueDprCache =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 1;
  }
  const applied = Math.min(riderMapTrueDprCache, max);
  if (riderMapCapInstalled) return applied;
  try {
    const own = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
    const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window) ?? {}, "devicePixelRatio");
    const nativeGet = own?.get ?? proto?.get;
    if (nativeGet) riderMapNativeDprGetter = () => nativeGet.call(window) as number;
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      enumerable: true,
      get: () =>
        Math.min(readNativeDevicePixelRatio() ?? riderMapTrueDprCache ?? 1, getRiderMapMaxPixelRatio()),
    });
    riderMapCapInstalled = true;
  } catch {
    /* 재정의가 막힌 환경이면 상한 없이 진행 — 순수 함수·계측은 그대로 둔다 */
  }
  return applied;
}

/** 시험이 쿼리 캐시·실측 스냅샷·설치 표시를 비운다. 운영에서는 부르지 않는다. */
export function resetRiderMapPixelRatioCapForTests(): void {
  riderMapMaxCache = undefined;
  riderMapTrueDprCache = null;
  riderMapNativeDprGetter = null;
  riderMapCapInstalled = false;
}

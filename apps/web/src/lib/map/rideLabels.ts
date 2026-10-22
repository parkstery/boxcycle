/**
 * 주행 중 가까운 카메라에서 베이스맵 글자(symbol 레이어) 절충 (Chief 결정 ③, M3 → M4).
 *
 * M4(기본 `names`): 장식·보조 symbol 만 숨기고 도로명·지명·다리·건물·POI
 * 이름은 전부 남긴다 — 이름 레이어는 filter·visibility 모두 그대로.
 *
 * 배경 — M2(주행 + 줌 ≥ 19 글자 전부 숨김)는 지도 JS −2.9 ms·fps 57 → 72 로
 * 성능은 좋지만 "주변 지리를 알려면 지명·건물명이 필요, 너무 많이 줄었다"(Chief).
 * 글자 비용의 대부분은 높은 기울기(카메라 2, pitch ≈ 80°)에서 지평선 근처 먼
 * 글자를 한꺼번에 배치·충돌 계산하기 때문이다. 그래서 라이더 주변 글자는 남기고
 * 먼 글자·사소한 종류만 뺀다.
 *
 * 모드 (`?labelmode=`, 운영 포함, 잘못된 값 → `names`):
 * - `names`(기본) = 장식·보조 symbol 만 숨김. 이름 레이어(road-label*·
 *   poi-label·settlement*·자연·수계·공항·행정)는 filter·visibility 모두
 *   그대로(조임·거리 조건 없음) — Chief 결정(M4).
 * - `both` = `near` + `major` (비교용).
 * - `near`: 모든 베이스맵 symbol 에 `["<", ["distance-from-center"], D]` 조건을
 *   기존 filter 와 `all` 로 결합(지평선 쪽 먼 글자만 제거). D 기본 1.2,
 *   `?labeldist=0.5–3` 으로 조정(범위 밖은 자름, 잘못된 값은 기본).
 * - `major`: 중요한 종류만 남김. 지명(settlement*·행정·자연·수계),
 *   건물·랜드마크(poi-label — 스타일 자체가 filterrank 로 중요도 선별),
 *   큰 도로명(road-label* — class motorway/trunk/primary/secondary 로 조임).
 *   골목·보행로·대중교통·작은 POI·번호 방패 등은 레이어째 숨김.
 * - `all`: 글자 모두 표시(M2 이전 — `?labels=1` 과 같음).
 * - `none`: 글자 모두 숨김(M2 동작 — visibility 만 건드린다).
 *
 * 규칙(M2 유지):
 * - 대상은 M1 `classifyMapCutLayers(layers, ["labels"])` 와 같은 집합
 *   (앱 레이어 `boxcycle-`/`route`/`live-self`/`debug-`/`distance-` 제외).
 * - 히스테리시스: ≥ 19.0 에서 적용, 18.7 미만으로 내려가야 복원.
 * - 복원은 원래 값으로 (원래 `none`·원래 filter 그대로 돌려놓는다).
 * - 스타일 재로드 뒤에도 같은 상태를 다시 적용 (`reapply`).
 * - 상태가 바뀔 때만 지도를 건드린다 — 매 프레임 호출 금지.
 * - DOM 이름표는 건드리지 않는다 (여기서는 스타일 레이어만 다룬다).
 * - 비상 스위치 `?labels=1` 이면 항상 표시. `?mapcut=` 은 그대로 동작.
 */

import { classifyMapCutLayers, type MapCutStyleLayer } from "./mapCut";
import { RIDER_POSE_ANIMATION_MIN_ZOOM } from "../rider/riderDetailLod";

/** 이 줌 이상(주행 중)이면 글자 절충을 적용한다. 라이더 자세를 그리는 줌과 같은 선. */
const RIDE_LABELS_HIDE_ZOOM = RIDER_POSE_ANIMATION_MIN_ZOOM;

/** 적용 상태에서 이 줌 미만으로 내려가야 복원한다 (경계 깜빡임 방지). */
const RIDE_LABELS_SHOW_ZOOM = 18.7;

const RIDE_LABELS_QUERY_KEY = "labels";

/** 주행 글자 모드 쿼리 키 (`?labelmode=names|both|near|major|all|none`). */
const RIDE_LABEL_MODE_QUERY_KEY = "labelmode";

/** near 거리 D 쿼리 키 (`?labeldist=`, 0.5–3). */
const RIDE_LABEL_DIST_QUERY_KEY = "labeldist";

export type RideLabelMode = "names" | "both" | "near" | "major" | "all" | "none";

const KNOWN_MODES: ReadonlySet<string> = new Set(["names", "both", "near", "major", "all", "none"]);

/** 새 기본값 — 장식 기호만 숨기고 이름은 전부 남긴다(M4, Chief 결정). */
const RIDE_LABEL_MODE_DEFAULT: RideLabelMode = "names";

/** near 거리 기본·범위. `distance-from-center` 단위(화면 중심 기준 정규 거리). */
const RIDE_LABEL_DIST_DEFAULT = 1.2;
const RIDE_LABEL_DIST_MIN = 0.5;
const RIDE_LABEL_DIST_MAX = 3;

/**
 * `major`·`both` 에서 poi-label 을 조이는 filterrank 상한.
 *
 * 실제 스타일 3종(2026-10-16 조회 — navigation-night-v1·outdoors-v12·
 * satellite-streets-v12)의 poi-label filter 는 전부 `filterrank <= …` 형태다:
 * outdoors 는 줌 ≥ 17 에서 상한 4–6(종류 보너스 포함),
 * satellite 는 5, navigation-night 는 밀도별 2–5.
 * `sizerank` 는 3종 symbol 레이어 filter 어디에도 쓰이지 않아
 * 조임 조건에 쓰지 않는다(없는 속성 비교는 전부 거짓이 된다).
 * 상한 2 = 가장 중요한 2단계만 남김.
 */
export const MAJOR_POI_FILTERRANK_MAX = 2;

/** `major`·`both` 에서 road-label* 에 남기는 큰 도로 분류. */
export const MAJOR_ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary"] as const;

/** 스타일 레이어 — M1 분류용 최소 필드에 소스·filter 를 더한 것. */
export type RideLabelStyleLayer = MapCutStyleLayer & {
  "source-layer"?: string;
  filter?: unknown;
};

export type RideLabelsMapLike = {
  getStyle?: () => { layers?: RideLabelStyleLayer[] } | undefined;
  getLayer?: (id: string) => unknown;
  getLayoutProperty?: (layerId: string, name: string) => unknown;
  setLayoutProperty?: (layerId: string, name: string, value: unknown) => void;
  getFilter?: (layerId: string) => unknown;
  setFilter?: (layerId: string, filter: unknown) => void;
};

export type RideLabelsStateInput = {
  riding: boolean;
  zoom: number | null | undefined;
  currentlyHidden: boolean;
  forceShow?: boolean;
};

/** `?labels=1` 파싱 — 있으면 주행 글자 절충을 끈다(항상 표시). */
export function parseRideLabelsForceShow(search: string | null | undefined): boolean {
  try {
    return new URLSearchParams(search ?? "").get(RIDE_LABELS_QUERY_KEY) === "1";
  } catch {
    return false;
  }
}

/** `?labelmode=` 파싱 — 모르면(잘못된 값·없음) 새 기본값 `names`. */
export function parseRideLabelMode(search: string | null | undefined): RideLabelMode {
  try {
    const raw = new URLSearchParams(search ?? "")
      .get(RIDE_LABEL_MODE_QUERY_KEY)
      ?.trim()
      .toLowerCase();
    if (raw != null && KNOWN_MODES.has(raw)) return raw as RideLabelMode;
    return RIDE_LABEL_MODE_DEFAULT;
  } catch {
    return RIDE_LABEL_MODE_DEFAULT;
  }
}

/** `?labeldist=` 파싱 — 0.5–3 으로 자름, 없거나 잘못되면 1.2. */
export function parseRideLabelDist(search: string | null | undefined): number {
  try {
    const raw = new URLSearchParams(search ?? "").get(RIDE_LABEL_DIST_QUERY_KEY);
    if (raw == null || raw.trim() === "") return RIDE_LABEL_DIST_DEFAULT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return RIDE_LABEL_DIST_DEFAULT;
    return Math.min(RIDE_LABEL_DIST_MAX, Math.max(RIDE_LABEL_DIST_MIN, n));
  } catch {
    return RIDE_LABEL_DIST_DEFAULT;
  }
}

/** 운영 판독 — 페이지 쿼리를 매번 읽는다(값이 바뀌면 다음 줌·주행 이벤트에 반영). */
export function readRideLabelMode(): RideLabelMode {
  if (typeof window === "undefined") return RIDE_LABEL_MODE_DEFAULT;
  try {
    return parseRideLabelMode(window.location?.search ?? "");
  } catch {
    return RIDE_LABEL_MODE_DEFAULT;
  }
}

/** 운영 판독 — near 거리 D. */
export function readRideLabelDist(): number {
  if (typeof window === "undefined") return RIDE_LABEL_DIST_DEFAULT;
  try {
    return parseRideLabelDist(window.location?.search ?? "");
  } catch {
    return RIDE_LABEL_DIST_DEFAULT;
  }
}

/** 운영 판독 — 페이지 쿼리를 매번 읽는다(값이 바뀌면 다음 줌·주행 이벤트에 반영). */
function isRideLabelsForceShown(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return parseRideLabelsForceShow(window.location?.search ?? "");
  } catch {
    return false;
  }
}

/**
 * 순수 상태 함수 — 숨길 것인가.
 * - 강제 표시(`?labels=1`) → 항상 표시.
 * - 주행 아님 → 표시. 줌 모름(NaN·null) → 표시(모를 때 숨기면 글자가 조용히 사라진다).
 * - 미숨김: 줌 ≥ 19.0 → 숨김. 숨김 중: 18.7 미만으로 내려가야 복원.
 */
export function shouldHideRideLabels(input: RideLabelsStateInput): boolean {
  if (input.forceShow) return false;
  if (!input.riding) return false;
  const zoom = input.zoom;
  if (typeof zoom !== "number" || !Number.isFinite(zoom)) return false;
  if (input.currentlyHidden) return zoom >= RIDE_LABELS_SHOW_ZOOM;
  return zoom >= RIDE_LABELS_HIDE_ZOOM;
}

/** M1 분류와 같은 집합 — 베이스맵 symbol(앱 레이어 제외). */
export function getRideLabelLayerIds(layers: readonly MapCutStyleLayer[]): string[] {
  return classifyMapCutLayers(layers, ["labels"]).labels;
}

/** `major`·`both` 에서 레이어째 숨기는 사소한 종류 (id 기준, 소스보다 먼저 본다). */
const MAJOR_MINOR_ID_PATTERNS: readonly RegExp[] = [
  /shield/, // 도로 번호·출구 방패
  /transit/, // 대중교통 정류장
  /path/, // 보행로·오솔길
  /pedestrian/, // 보행자 도로
  /intersection/, // 교차로 이름
  /ferry/, // 여객선 항로
  /aerialway/, // 케이블카
  /oneway/, // 일방통행 화살표
  /arrow/, // 터널·교량 화살표
  /crossing/, // 건널목
  /turning/, // 회차로
  /incident/, // 사고 지점
  /contour/, // 등고선 수치
  /entrance/, // 건물 출입구
  /gate/, // 문·게이트
  /crosswalk/, // 횡단보도
  /housenum/, // 지번
  /block-number/, // 블록 번호(place_label 이지만 지명 유지 대상이 아니다)
  /building-number/, // 건물 번호
  /golf/, // 골프홀
];

/** 소스 레이어 정보가 없을 때 `major` 유지 판정을 대신하는 id 패턴. */
const MAJOR_KEEP_ID_PATTERNS: readonly RegExp[] = [
  /settlement/,
  /country/,
  /state/,
  /continent/,
  /natural/,
  /water/,
  /poi-label/,
  /airport/,
  /road-label/,
];

/**
 * `major`·`both` 유지 판정 — 레이어 단위.
 *
 * 실제 스타일 3종에서 중요 레이어 id·소스는 같다: settlement-*
 * (place_label), country·state(place_label), continent·natural-*
 * (natural_label), water*(natural_label), poi-label(poi_label),
 * airport-label(airport_label), road-label*(road).
 * 스타일마다 이름이 다르면 소스 레이어로 판정한다.
 */
export function isMajorKeptLabelLayer(layer: {
  id: string;
  "source-layer"?: string;
}): boolean {
  const id = layer.id.toLowerCase();
  if (MAJOR_MINOR_ID_PATTERNS.some((re) => re.test(id))) return false;
  const sourceLayer = (layer["source-layer"] ?? "").toLowerCase();
  if (sourceLayer === "road") return id.includes("road-label");
  if (
    sourceLayer === "place_label" ||
    sourceLayer === "natural_label" ||
    sourceLayer === "airport_label" ||
    sourceLayer === "poi_label"
  ) {
    return true;
  }
  if (sourceLayer !== "") return false;
  return MAJOR_KEEP_ID_PATTERNS.some((re) => re.test(id));
}

/**
 * `names`(M4 기본) 장식 판정 — 이름 레이어는 절대 숨기지 않는다.
 *
 * M3 `MAJOR_MINOR_ID_PATTERNS`(방패·화살표·횡단보도·출입구·지번·블록번호·
 * 교차로·게이트·등고선·보행로·골프·여객선·transit 등)를 재사용하되, 이름
 * 레이어(`road-label*`, `poi-label`, `settlement*`, `natural*`, `water*`,
 * `waterway*`, `airport*`, `state*`, `country*`, `continent*`)를 먼저
 * 가려내어 `false`(유지)로 돌려보낸다. 소스 레이어로 판정할 때도 이름
 * 소스(`place_label`·`natural_label`·`airport_label`·`poi_label`,
 * `road` 의 `road-label`)는 유지. 모르는 것(패턴·소스 모두 해당 없음)은
 * 이름일 수 있으니 숨기지 않는다(M3 와 반대 — M3 는 모르면 숨김).
 */
const NAMES_KEEP_ID_PATTERNS: readonly RegExp[] = [
  /road-label/,
  /poi-label/,
  /settlement/,
  /country/,
  /state/,
  /continent/,
  /natural/,
  /waterway/,
  /water/,
  /airport/,
];

/** 이름 레이어의 소스 레이어 (`road` 는 `road-label` 일 때만 이름 — id 로 먼저 가린다). */
const NAMES_KEEP_SOURCES: ReadonlySet<string> = new Set([
  "place_label",
  "natural_label",
  "airport_label",
  "poi_label",
]);

export function isDecorativeSymbolLayer(layer: {
  id: string;
  "source-layer"?: string;
}): boolean {
  const id = layer.id.toLowerCase();
  if (NAMES_KEEP_ID_PATTERNS.some((re) => re.test(id))) return false;
  if (MAJOR_MINOR_ID_PATTERNS.some((re) => re.test(id))) return true;
  const sourceLayer = (layer["source-layer"] ?? "").toLowerCase();
  if (sourceLayer === "road") return !id.includes("road-label");
  if (sourceLayer === "") return false;
  if (NAMES_KEEP_SOURCES.has(sourceLayer)) return false;
  return true;
}

/** `near` 조건 — 화면 중심에서 D 이상 떨어진 글자를 걷어낸다. */
export function buildNearCondition(dist: number): unknown[] {
  return ["<", ["distance-from-center"], dist];
}

/**
 * 유지 레이어 중 종류를 더 조이는 조건 (`major`·`both`).
 * - road-label*: 큰 도로 4분류만.
 * - poi-label: filterrank 상위만(스타일 자체 선별 위에 한 번 더 조임).
 * - 그 외 유지 레이어(지명·자연·수계·공항): null — 레이어째 유지.
 */
export function getMajorTightenCondition(layer: {
  id: string;
  "source-layer"?: string;
}): unknown[] | null {
  const id = layer.id.toLowerCase();
  const sourceLayer = (layer["source-layer"] ?? "").toLowerCase();
  if (sourceLayer === "road" || id.includes("road-label")) {
    return ["match", ["get", "class"], [...MAJOR_ROAD_CLASSES], true, false];
  }
  if (sourceLayer === "poi_label" || id === "poi-label") {
    return ["<=", ["get", "filterrank"], MAJOR_POI_FILTERRANK_MAX];
  }
  return null;
}

/** 기존 filter 에 조건들을 `all` 로 결합. 원래 filter 가 없으면 조건만. */
export function combineLabelFilter(original: unknown, extras: readonly unknown[]): unknown {
  const parts: unknown[] = [];
  if (original !== undefined && original !== null) parts.push(original);
  for (const extra of extras) parts.push(extra);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return ["all", ...parts];
}

/** 컨트롤러 적용 요약 — 헤드리스 census·감리 표용. */
export type RideLabelApplySummary = {
  mode: RideLabelMode;
  dist: number;
  /** 절충이 걸려 있는가(표시 상태 복원 직후는 false). */
  applied: boolean;
  /** 베이스맵 symbol 대상 수. */
  targetCount: number;
  /** visibility 로 숨긴 레이어. */
  hiddenIds: string[];
  /** filter 를 건 레이어. */
  filteredIds: string[];
  /** filter 적용 실패로 건너뛴 레이어(`distance-from-center` 미지원 등). */
  skippedIds: string[];
};

/**
 * 상태가 바뀔 때만 지도를 건드리는 컨트롤러.
 * `hidden` 은 절충 적용 상태, `savedVisibility` 는 숨기기 전 각 레이어의 원래
 * `visibility`, `savedFilter` 는 filter 를 바꾼 각 레이어의 원래 filter.
 */
export class RideLabelsController {
  private hidden = false;
  private appliedKey = "shown";
  private appliedMode: RideLabelMode = RIDE_LABEL_MODE_DEFAULT;
  private appliedDist = RIDE_LABEL_DIST_DEFAULT;
  private savedVisibility = new Map<string, unknown>();
  private savedFilter = new Map<string, unknown>();
  private lastSummary: RideLabelApplySummary = {
    mode: RIDE_LABEL_MODE_DEFAULT,
    dist: RIDE_LABEL_DIST_DEFAULT,
    applied: false,
    targetCount: 0,
    hiddenIds: [],
    filteredIds: [],
    skippedIds: [],
  };

  isHidden(): boolean {
    return this.hidden;
  }

  /** 마지막 적용 요약 — 헤드리스 census·감리 표용. */
  getLastSummary(): RideLabelApplySummary {
    return {
      ...this.lastSummary,
      hiddenIds: [...this.lastSummary.hiddenIds],
      filteredIds: [...this.lastSummary.filteredIds],
      skippedIds: [...this.lastSummary.skippedIds],
    };
  }

  /** 시험용 초기화. 운영에서는 부르지 않는다. */
  resetForTests(): void {
    this.hidden = false;
    this.appliedKey = "shown";
    this.appliedMode = RIDE_LABEL_MODE_DEFAULT;
    this.appliedDist = RIDE_LABEL_DIST_DEFAULT;
    this.savedVisibility.clear();
    this.savedFilter.clear();
    this.lastSummary = {
      mode: RIDE_LABEL_MODE_DEFAULT,
      dist: RIDE_LABEL_DIST_DEFAULT,
      applied: false,
      targetCount: 0,
      hiddenIds: [],
      filteredIds: [],
      skippedIds: [],
    };
  }

  private collectTargets(map: RideLabelsMapLike): RideLabelStyleLayer[] {
    let layers: readonly RideLabelStyleLayer[];
    try {
      layers = map.getStyle?.()?.layers ?? [];
    } catch {
      layers = [];
    }
    const ids = new Set(getRideLabelLayerIds(layers));
    const byId = new Map(layers.map((l) => [l.id, l]));
    const out: RideLabelStyleLayer[] = [];
    for (const id of ids) {
      const layer = byId.get(id);
      if (!layer) continue;
      try {
        if (!map.getLayer?.(id)) continue;
      } catch {
        continue;
      }
      out.push(layer);
    }
    return out;
  }

  private readVisibility(map: RideLabelsMapLike, id: string): unknown {
    try {
      return map.getLayoutProperty?.(id, "visibility");
    } catch {
      return undefined;
    }
  }

  private readFilter(map: RideLabelsMapLike, id: string): unknown {
    try {
      return map.getFilter?.(id);
    } catch {
      return undefined;
    }
  }

  private hideLayer(map: RideLabelsMapLike, id: string, summary: RideLabelApplySummary): void {
    const original = this.readVisibility(map, id);
    this.savedVisibility.set(id, original);
    if (original === "none") return;
    try {
      map.setLayoutProperty?.(id, "visibility", "none");
    } catch {
      /* 한 레이어 실패가 주행 지도를 막지 않는다 */
    }
    summary.hiddenIds.push(id);
  }

  private filterLayer(
    map: RideLabelsMapLike,
    id: string,
    combined: unknown,
    summary: RideLabelApplySummary,
  ): void {
    const original = this.readFilter(map, id);
    try {
      map.setFilter?.(id, combined);
    } catch {
      // `distance-from-center` 미지원 등 — 해당 레이어는 near 를 건너뛴다.
      summary.skippedIds.push(id);
      return;
    }
    this.savedFilter.set(id, original);
    summary.filteredIds.push(id);
  }

  private applyMode(
    map: RideLabelsMapLike,
    mode: RideLabelMode,
    dist: number,
  ): RideLabelApplySummary {
    const summary: RideLabelApplySummary = {
      mode,
      dist,
      applied: true,
      targetCount: 0,
      hiddenIds: [],
      filteredIds: [],
      skippedIds: [],
    };
    const targets = this.collectTargets(map);
    summary.targetCount = targets.length;
    const near = mode === "near" || mode === "both";
    const major = mode === "major" || mode === "both";
    for (const layer of targets) {
      if (mode === "names") {
        // 장식·보조 symbol 만 visibility 로 숨김 — 이름 레이어는 손대지 않음
        // (filter·visibility 호출 0, 조임·거리 조건 없음).
        if (isDecorativeSymbolLayer(layer)) this.hideLayer(map, layer.id, summary);
        continue;
      }
      const kept = !major || isMajorKeptLabelLayer(layer);
      if (!kept) {
        this.hideLayer(map, layer.id, summary);
        continue;
      }
      if (mode === "none") {
        this.hideLayer(map, layer.id, summary);
        continue;
      }
      const extras: unknown[] = [];
      if (near) extras.push(buildNearCondition(dist));
      if (major) {
        const tighten = getMajorTightenCondition(layer);
        if (tighten) extras.push(tighten);
      }
      if (extras.length === 0) continue;
      this.filterLayer(map, layer.id, combineLabelFilter(this.readFilter(map, layer.id), extras), summary);
    }
    return summary;
  }

  private restoreAll(map: RideLabelsMapLike): void {
    for (const [id, original] of this.savedFilter) {
      let exists: boolean;
      try {
        exists = Boolean(map.getLayer?.(id));
      } catch {
        exists = false;
      }
      if (!exists) continue;
      try {
        map.setFilter?.(id, original ?? undefined);
      } catch {
        /* 한 레이어 실패가 주행 지도를 막지 않는다 */
      }
    }
    this.savedFilter.clear();
    for (const [id, original] of this.savedVisibility) {
      if (original === "none") continue;
      let exists: boolean;
      try {
        exists = Boolean(map.getLayer?.(id));
      } catch {
        exists = false;
      }
      if (!exists) continue;
      try {
        map.setLayoutProperty?.(id, "visibility", original ?? "visible");
      } catch {
        /* 한 레이어 실패가 주행 지도를 막지 않는다 */
      }
    }
    this.savedVisibility.clear();
  }

  /**
   * 주행·줌 변화에 반응. 상태(적용 여부·모드·D)가 바뀌었을 때만 지도를 건드린다.
   * 반환값은 적용 후 절충 상태. `mode: "all"`·`?labels=1` 은 항상 표시.
   * `map` 은 `unknown` — mapbox-gl 제네릭 시그니처와 충돌하지 않게 내부에서 좁힌다
   * (M1 `applyMapCutToMap` 과 같은 이유).
   */
  update(
    map: unknown,
    input: {
      riding: boolean;
      zoom: number | null | undefined;
      forceShow?: boolean;
      mode?: RideLabelMode;
      dist?: number;
    },
  ): boolean {
    const forceShow = input.forceShow ?? isRideLabelsForceShown();
    const mode = input.mode ?? readRideLabelMode();
    const dist = input.dist ?? readRideLabelDist();
    const effectiveForce = forceShow || mode === "all";
    const want = shouldHideRideLabels({
      riding: input.riding,
      zoom: input.zoom,
      currentlyHidden: this.hidden,
      forceShow: effectiveForce,
    });
    if (map == null) return this.hidden;
    const key = want ? `${mode}|${dist}` : "shown";
    if (want === this.hidden && key === this.appliedKey) return this.hidden;
    const target = map as RideLabelsMapLike;
    this.restoreAll(target);
    if (want) {
      this.lastSummary = this.applyMode(target, mode, dist);
      this.appliedMode = mode;
      this.appliedDist = dist;
    } else {
      this.lastSummary = {
        mode,
        dist,
        applied: false,
        targetCount: 0,
        hiddenIds: [],
        filteredIds: [],
        skippedIds: [],
      };
    }
    this.hidden = want;
    this.appliedKey = key;
    return this.hidden;
  }

  /**
   * 스타일 재로드(`style.load`)·스타일 교체 후 같은 상태를 다시 적용.
   * 상태는 바꾸지 않고, 적용 중이면 새 스타일의 원본을 다시 기억하며 적용한다.
   */
  reapply(map: unknown): void {
    if (!this.hidden || map == null) return;
    const target = map as RideLabelsMapLike;
    this.savedVisibility.clear();
    this.savedFilter.clear();
    this.lastSummary = this.applyMode(target, this.appliedMode, this.appliedDist);
  }
}

let sharedController: RideLabelsController | null = null;

/** MapView·perflab 이 공유하는 단일 컨트롤러. */
export function getRideLabelsController(): RideLabelsController {
  if (!sharedController) sharedController = new RideLabelsController();
  return sharedController;
}

/** perflab 표시·복사 JSON 용 현재 숨김 상태. */
export function readRideLabelsHidden(): boolean {
  return sharedController?.isHidden() ?? false;
}

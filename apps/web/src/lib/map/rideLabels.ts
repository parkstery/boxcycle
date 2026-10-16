/**
 * 주행 중 가까운 카메라에서 베이스맵 글자(symbol 레이어) 숨김 (Chief 결정 A).
 *
 * 왜 — 실측(운영, GTX 1660, 카메라 2·줌 22): labels 숨김만 fps 54–57 → 70.5,
 * 지도 렌더 JS 8.2–8.6 ms → 4.9 ms. terrain/buildings/roads 는 델타 없음.
 * 그래서 주행 중 줌 ≥ 19(라이더 자세를 그리는 가까운 카메라)에서만 글자를 숨긴다.
 * 주행 전·종료 후·줌 < 19 는 지금 그대로.
 *
 * 규칙:
 * - 대상은 M1 `classifyMapCutLayers(layers, ["labels"])` 와 같은 집합
 *   (앱 레이어 `boxcycle-`/`route`/`live-self`/`debug-`/`distance-` 제외).
 * - 히스테리시스: ≥ 19.0 에서 숨김, 18.7 미만으로 내려가야 복원.
 * - 복원은 원래 값으로 (원래 `none` 이던 레이어는 `none` 유지).
 * - 스타일 재로드 뒤에도 같은 상태를 다시 적용 (`reapply`).
 * - 상태가 바뀔 때만 `setLayoutProperty` 호출 — 매 프레임 호출 금지.
 * - DOM 이름표는 건드리지 않는다 (여기서는 스타일 레이어만 다룬다).
 * - 비상 스위치 `?labels=1` 이면 항상 표시. `?mapcut=` 은 그대로 동작.
 */

import { classifyMapCutLayers, type MapCutStyleLayer } from "./mapCut";
import { RIDER_POSE_ANIMATION_MIN_ZOOM } from "../rider/riderDetailLod";

/** 이 줌 이상(주행 중)이면 글자를 숨긴다. 라이더 자세를 그리는 줌과 같은 선. */
export const RIDE_LABELS_HIDE_ZOOM = RIDER_POSE_ANIMATION_MIN_ZOOM;

/** 숨김 상태에서 이 줌 미만으로 내려가야 복원한다 (경계 깜빡임 방지). */
export const RIDE_LABELS_SHOW_ZOOM = 18.7;

export const RIDE_LABELS_QUERY_KEY = "labels";

export type RideLabelsMapLike = {
  getStyle?: () => { layers?: MapCutStyleLayer[] } | undefined;
  getLayer?: (id: string) => unknown;
  getLayoutProperty?: (layerId: string, name: string) => unknown;
  setLayoutProperty?: (layerId: string, name: string, value: unknown) => void;
};

export type RideLabelsStateInput = {
  riding: boolean;
  zoom: number | null | undefined;
  currentlyHidden: boolean;
  forceShow?: boolean;
};

/** `?labels=1` 파싱 — 있으면 주행 글자 숨김을 끈다(항상 표시). */
export function parseRideLabelsForceShow(search: string | null | undefined): boolean {
  try {
    return new URLSearchParams(search ?? "").get(RIDE_LABELS_QUERY_KEY) === "1";
  } catch {
    return false;
  }
}

/** 운영 판독 — 페이지 쿼리를 매번 읽는다(값이 바뀌면 다음 줌·주행 이벤트에 반영). */
export function isRideLabelsForceShown(): boolean {
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

/**
 * 상태가 바뀔 때만 지도를 건드리는 컨트롤러.
 * `hidden` 은 숨김 상태, `saved` 는 숨기기 전 각 레이어의 원래 `visibility`.
 */
export class RideLabelsController {
  private hidden = false;
  private saved = new Map<string, unknown>();

  isHidden(): boolean {
    return this.hidden;
  }

  /** 시험용 초기화. 운영에서는 부르지 않는다. */
  resetForTests(): void {
    this.hidden = false;
    this.saved.clear();
  }

  private collectTargets(map: RideLabelsMapLike): string[] {
    let layers: readonly MapCutStyleLayer[];
    try {
      layers = map.getStyle?.()?.layers ?? [];
    } catch {
      layers = [];
    }
    const ids = getRideLabelLayerIds(layers);
    return ids.filter((id) => {
      try {
        return Boolean(map.getLayer?.(id));
      } catch {
        return false;
      }
    });
  }

  private readVisibility(map: RideLabelsMapLike, id: string): unknown {
    try {
      return map.getLayoutProperty?.(id, "visibility");
    } catch {
      return undefined;
    }
  }

  private hide(map: RideLabelsMapLike): void {
    this.saved.clear();
    for (const id of this.collectTargets(map)) {
      const original = this.readVisibility(map, id);
      this.saved.set(id, original);
      if (original === "none") continue;
      try {
        map.setLayoutProperty?.(id, "visibility", "none");
      } catch {
        /* 한 레이어 실패가 주행 지도를 막지 않는다 */
      }
    }
  }

  private show(map: RideLabelsMapLike): void {
    for (const [id, original] of this.saved) {
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
    this.saved.clear();
  }

  /**
   * 주행·줌 변화에 반응. 상태가 바뀌었을 때만 `setLayoutProperty` 를 호출한다.
   * 반환값은 적용 후 숨김 상태.
   * `map` 은 `unknown` — mapbox-gl 제네릭 시그니처와 충돌하지 않게 내부에서 좁힌다
   * (M1 `applyMapCutToMap` 과 같은 이유).
   */
  update(
    map: unknown,
    input: { riding: boolean; zoom: number | null | undefined; forceShow?: boolean },
  ): boolean {
    const forceShow = input.forceShow ?? isRideLabelsForceShown();
    const want = shouldHideRideLabels({
      riding: input.riding,
      zoom: input.zoom,
      currentlyHidden: this.hidden,
      forceShow,
    });
    if (map == null) return this.hidden;
    if (want === this.hidden) return this.hidden;
    const target = map as RideLabelsMapLike;
    if (want) this.hide(target);
    else this.show(target);
    this.hidden = want;
    return this.hidden;
  }

  /**
   * 스타일 재로드(`style.load`)·스타일 교체 후 같은 상태를 다시 적용.
   * 상태는 바꾸지 않고, 숨김 중이면 새 스타일의 원본을 다시 기억하며 숨긴다.
   */
  reapply(map: unknown): void {
    if (!this.hidden || map == null) return;
    this.hide(map as RideLabelsMapLike);
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

/** 시험이 공유 컨트롤러를 비운다. 운영에서는 부르지 않는다. */
export function resetRideLabelsControllerForTests(): void {
  sharedController?.resetForTests();
  sharedController = null;
}

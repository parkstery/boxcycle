import type { LngLat } from "../geo/geo";
import { MAP_STYLE_SATELLITE } from "./rtwMapConfig";

/**
 * 앱 소개 배경 — Colosseum(로마 콜로세움)을 위성 지도의 screen-right 쪽에 둔다.
 * 랜드마크 좌표는 고정이고, 카메라 경도만 서쪽으로 옮겨 화면 오른쪽 약 76%에 오게 한다.
 * 스타일은 새 URL을 만들지 않고 rtwMapConfig의 MAP_STYLE_SATELLITE를 재사용한다.
 */
export const APP_INTRO_MAP_STYLE = MAP_STYLE_SATELLITE;

const COLOSSEUM_LNG = 12.4922;
const COLOSSEUM_LAT = 41.8902;
const APP_INTRO_ZOOM = 16;
const FALLBACK_VIEWPORT_WIDTH = 800;
/** 화면 오른쪽 76% ≈ 중심에서 폭의 26%만큼 서쪽. */
const SCREEN_RIGHT_FRACTION = 0.26;

export function createAppIntroMapView(viewportWidth: number): {
  lngLat: LngLat;
  zoom: number;
} {
  const validViewportWidth =
    Number.isFinite(viewportWidth) && viewportWidth > 0
      ? viewportWidth
      : FALLBACK_VIEWPORT_WIDTH;
  const lng =
    COLOSSEUM_LNG -
    (validViewportWidth * SCREEN_RIGHT_FRACTION * 360) / (512 * 2 ** APP_INTRO_ZOOM);
  return {
    lngLat: [lng, COLOSSEUM_LAT],
    zoom: APP_INTRO_ZOOM,
  };
}

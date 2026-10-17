import type { LngLat } from "../geo/geo";

/**
 * 인트로 오른쪽에 비칠 맵박스 카메라.
 * 콜로세움 중심은 예전 Esri 고정 영역(경도 12.4865–12.4979, 위도 41.8875–41.8929)의 가운데다.
 * 왼쪽 소개 글이 가리므로, 랜드마크가 화면 너비의 약 70%에 오도록 카메라를 서쪽으로 민다.
 */
const INTRO_COLOSSEUM: LngLat = [12.4922, 41.8902];
const INTRO_ZOOM = 16;
const INTRO_LANDMARK_SCREEN_X = 0.7;

export function createAppIntroMapView(viewportWidth: number): { lngLat: LngLat; zoom: number } {
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 800;
  const shiftDeg =
    ((INTRO_LANDMARK_SCREEN_X - 0.5) * width * 360) / (512 * 2 ** INTRO_ZOOM);
  return {
    lngLat: [INTRO_COLOSSEUM[0] - shiftDeg, INTRO_COLOSSEUM[1]],
    zoom: INTRO_ZOOM,
  };
}

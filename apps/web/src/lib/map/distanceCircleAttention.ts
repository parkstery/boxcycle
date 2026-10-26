import type { GeoJSONSource, Map } from "mapbox-gl";
import type { LineStringGeometry } from "../geo/geo";
import {
  buildCircleRadialArrowFeatureCollection,
  inferCircleLineMetrics,
  type CircleLineMetrics,
} from "../route/distanceAutoRoute";

export const DISTANCE_CIRCLE_SOURCE_ID = "distance-target-circle";
export const DISTANCE_CIRCLE_ARROWS_SOURCE_ID = "distance-target-circle-arrows";

/** 펄스 한 주기(ms)·최대 확대율 — Chief 10-26 참고 영상(pulsing.mp4, 약 1.5초 주기·반지름 +10%). */
const DISTANCE_CIRCLE_PULSE_PERIOD_MS = 1500;
const DISTANCE_CIRCLE_PULSE_MAX_SCALE = 1.1;
/** GeoJSON setData 는 프레임마다 워커 재분할을 부른다 — 30fps 면 눈에 매끄럽고 비용은 절반. */
const PULSE_FRAME_INTERVAL_MS = 33;

/** 0→1→0 한 주기. 커질 때 빠르고 돌아올 때 부드럽게(영상의 「툭 퍼졌다 잦아듦」). */
function distanceCirclePulseScale(elapsedMs: number): number {
  const phase = (elapsedMs % DISTANCE_CIRCLE_PULSE_PERIOD_MS) / DISTANCE_CIRCLE_PULSE_PERIOD_MS;
  const wave = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  return 1 + (DISTANCE_CIRCLE_PULSE_MAX_SCALE - 1) * wave;
}

/** 원 둘레를 중심 기준으로 scale 배 — 수 km 반경에서는 경위도 차를 곱해도 측지 원과 차이가 무시된다. */
function scaleCircleLine(
  circle: LineStringGeometry,
  center: CircleLineMetrics["center"],
  scale: number,
): LineStringGeometry {
  return {
    type: "LineString",
    coordinates: circle.coordinates.map(([lng, lat]) => {
      const dLng = ((lng - center[0] + 540) % 360) - 180;
      return [center[0] + dLng * scale, center[1] + (lat - center[1]) * scale] as [number, number];
    }),
  };
}

type PulseMap = Pick<Map, "getSource">;

/**
 * 거리 확정 후 「이 원 위 아무 방향이나 누르라」는 안내 — 원과 바깥 화살표를 함께 키웠다 줄이기를
 * 방향을 누를 때까지 반복한다. 원의 의미(목표 거리 D)는 멈추면 원래 크기로 복원된다.
 * `getCircle` 은 매 프레임 현재 원을 돌려준다(거리를 바꾸면 새 원을 따라간다).
 */
export function pulseDistanceCircle(
  map: PulseMap,
  getCircle: () => LineStringGeometry | null | undefined,
): () => void {
  let frame = 0;
  let stopped = false;
  let lastPaint = -Infinity;
  let base: LineStringGeometry | null = null;
  let metrics: CircleLineMetrics | null = null;

  const paint = (scale: number) => {
    const circle = getCircle();
    if (!circle?.coordinates?.length) return;
    if (circle !== base) {
      base = circle;
      metrics = inferCircleLineMetrics(circle);
    }
    if (!metrics) return;
    const circleSource = map.getSource(DISTANCE_CIRCLE_SOURCE_ID) as GeoJSONSource | undefined;
    const arrowsSource = map.getSource(DISTANCE_CIRCLE_ARROWS_SOURCE_ID) as GeoJSONSource | undefined;
    if (!circleSource) return;
    const geometry = scale === 1 ? circle : scaleCircleLine(circle, metrics.center, scale);
    circleSource.setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry }],
    });
    arrowsSource?.setData(
      buildCircleRadialArrowFeatureCollection(metrics.center, metrics.radiusMeters * scale),
    );
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    paint(1);
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    stopped = true;
    return () => {};
  }
  const start = performance.now();
  const tick = (now: number) => {
    if (stopped) return;
    if (now - lastPaint >= PULSE_FRAME_INTERVAL_MS) {
      lastPaint = now;
      paint(distanceCirclePulseScale(now - start));
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return stop;
}

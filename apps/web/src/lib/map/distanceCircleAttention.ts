import type { Map } from "mapbox-gl";

/** 기존 원/화살표 paint만 두 번 강조한다. 좌표·카메라·네트워크는 변경하지 않는다. */
export function pulseDistanceCircle(map: Pick<Map, "getLayer" | "setPaintProperty">): () => void {
  const layers = [
    ["distance-target-circle-line", 3, 0.95],
    ["distance-target-circle-casing", 4, 0.2],
    ["distance-target-circle-arrows-line", 3, 0.95],
    ["distance-target-circle-arrows-casing", 4, 0.2],
  ] as const;
  let frame = 0;
  let stopped = false;
  const paint = (wave: number) => {
    for (const [id, width, opacity] of layers) {
      if (!map.getLayer(id)) continue;
      map.setPaintProperty(id, "line-width", width + wave * 3);
      map.setPaintProperty(id, "line-opacity", opacity * (1 - wave * 0.5));
    }
  };
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    paint(0);
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return stop;
  const start = performance.now();
  const tick = (now: number) => {
    if (stopped) return;
    const progress = Math.min(1, (now - start) / 1400);
    if (progress >= 1) { stop(); return; }
    paint(Math.sin(progress * Math.PI * 2) ** 2);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return stop;
}
